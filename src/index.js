//#!/usr/bin/env node

const Scraper = require('..')
const express = require('express')
const path = require('path')
const fs = require('fs')
const { pipeline } = require('stream')
const { promisify } = require('util')
const { marked } = require('marked')

const pipelineAsync = promisify(pipeline)

// 工具函数：安全地隐藏敏感信息用于日志输出
const maskSensitiveInfo = (str, type = 'cookie') => {
    if (!str || typeof str !== 'string') return str;
    
    if (type === 'cookie') {
        // 隐藏Cookie值，只显示前4位和后4位
        if (str.length <= 8) return '****';
        return str.substring(0, 4) + '****' + str.substring(str.length - 4);
    }
    
    // 通用敏感信息隐藏
    if (str.length <= 8) return '****';
    return str.substring(0, 3) + '****' + str.substring(str.length - 3);
};

// 配置dotenv加载.env.local文件
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const app = express()
app.use(express.static(path.join(__dirname, '../public')))

app.use(express.json()); // 用于解析 JSON 格式的请求体
app.use(express.urlencoded({ extended: true }));
const scraper = new Scraper()
let PORT = process.env.PORT || 3000;

// readme docs
app.get('/readme', (req, res) => {
    const html = getReadmeContent()
    res.send(html)
})

// zjcdn直链API - 优先使用zjcdn域名的直接链接
app.post('/zjcdn', async (req, res) => {
    const url = req.body.url;

    // 简单的URL有效性预检查
    if (!url || typeof url !== 'string') {
        return res.send({ code: 1, msg: 'URL参数无效', data: null });
    }
    
    if (!url.includes('douyin.com') && !url.includes('dy.toutiao.com')) {
        return res.send({ code: 1, msg: '请提供有效的抖音链接', data: null });
    }
    
    try {

        const douyinId = await scraper.getDouyinVideoId(url);

        const douyinData = await scraper.getDouyinVideoData(douyinId);

        // 检查是否为图片集分享
        const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);

        if (isImagesShare) {
            // 图片集分享

            let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
            res.send({ 
                code: 0, 
                data: { 
                    video: [], 
                    img: douyinUrls || [], 
                    debugMode: false, 
                    isImagesShare: true,
                    method: 'zjcdn-images',
                    title: douyinData?.aweme_detail?.desc || '',
                    author: douyinData?.aweme_detail?.author?.nickname || ''
                } 
            });
        } else {
            // 视频分享 - 优先获取zjcdn直链

            const zjcdnUrls = await scraper.getZjcdnDirectUrls(douyinData);
            
            if (zjcdnUrls.length > 0) {

                res.send({ 
                    code: 0, 
                    data: { 
                        video: zjcdnUrls, 
                        img: [], 
                        debugMode: false, 
                        isImagesShare: false,
                        method: 'zjcdn-direct',
                        title: douyinData?.aweme_detail?.desc || '',
                        author: douyinData?.aweme_detail?.author?.nickname || ''
                    } 
                });
            } else {
                // 回退到常规方法

                let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
                res.send({ 
                    code: 0, 
                    data: { 
                        video: douyinUrls || [], 
                        img: [], 
                        debugMode: false, 
                        isImagesShare: false,
                        method: 'zjcdn-fallback',
                        title: douyinData?.aweme_detail?.desc || '',
                        author: douyinData?.aweme_detail?.author?.nickname || ''
                    } 
                });
            }
        }
    } catch (e) {
        console.log('❌ zjcdn API返回错误:', e.message);
        console.error('详细错误信息:', e);
        
        // 根据错误类型提供更具体的错误信息
        let userMessage = String(e);
        if (e.message.includes('无法从任何用户代理获取videoId') || e.message.includes('can\'t get videoId')) {
            userMessage = '抖音链接已过期或无效，请使用最新的分享链接';
        } else if (e.message.includes('网络')) {
            userMessage = '网络连接失败，请检查网络连接';
        } else if (e.message.includes('输入链接没有解析到地址')) {
            userMessage = '链接格式不正确，请复制完整的抖音分享链接';
        }
        
        res.send({ code: 1, msg: userMessage, data: null })
    }
});

// 测试端点 - 用于调试URL解析问题
app.post('/test-url', async (req, res) => {
    const url = req.body.url;

    try {

        const douyinId = await scraper.getDouyinVideoId(url);

        const douyinData = await scraper.getDouyinVideoData(douyinId);
        
        const result = {
            success: true,
            videoId: douyinId,
            title: douyinData?.aweme_detail?.desc || '无标题',
            mediaType: douyinData?.aweme_detail?.media_type,
            author: douyinData?.aweme_detail?.author?.nickname || '未知作者',
            hasVideo: !![2, 42].includes(douyinData?.aweme_detail?.media_type) ? false : true,
            hasImages: [2, 42].includes(douyinData?.aweme_detail?.media_type),
            videoUrls: douyinData?.aweme_detail?.video?.play_addr?.url_list || [],
            imageUrls: douyinData?.aweme_detail?.images?.map(img => img?.url_list?.[0]) || []
        };

        res.json(result);
        
    } catch (e) {
        console.log('❌ 测试失败:', e.message);
        
        // 如果是URL解析失败，提供建议
        let suggestion = '';
        if (e.message.includes('无法从任何用户代理获取videoId')) {
            suggestion = '建议：1. 检查链接是否过期 2. 尝试使用新的抖音分享链接 3. 确保链接格式正确';
        }
        
        res.json({
            success: false,
            error: e.message,
            suggestion: suggestion,
            inputUrl: url
        });
    }
});

// URL有效性检查端点
app.post('/check-url', async (req, res) => {
    const url = req.body.url;

    try {
        // 基本格式检查
        if (!url || typeof url !== 'string') {
            return res.json({ valid: false, error: 'URL不能为空' });
        }
        
        if (!url.includes('douyin.com') && !url.includes('dy.toutiao.com')) {
            return res.json({ valid: false, error: '请提供抖音链接' });
        }
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return res.json({ valid: false, error: '链接格式不正确，应以http://或https://开头' });
        }
        
        // 快速解析测试（不获取完整数据）
        const douyinId = await scraper.getDouyinVideoId(url);
        
        res.json({ 
            valid: true, 
            videoId: douyinId,
            message: 'URL格式正确，可以进行解析'
        });
        
    } catch (e) {
        let errorMessage = 'URL无效';
        if (e.message.includes('无法从任何用户代理获取videoId') || e.message.includes('can\'t get videoId')) {
            errorMessage = '链接已过期，请使用最新的抖音分享链接';
        } else if (e.message.includes('输入链接没有解析到地址')) {
            errorMessage = '链接格式不正确，请复制完整的分享链接';
        }
        
        res.json({ 
            valid: false, 
            error: errorMessage,
            suggestion: '请从抖音APP获取最新的分享链接'
        });
    }
});

// 直接测试videoId的端点（绕过URL解析）
app.post('/test-videoid', async (req, res) => {
    const videoId = req.body.videoId;

    try {

        const douyinData = await scraper.getDouyinVideoData(videoId);
        
        const result = {
            success: true,
            videoId: videoId,
            title: douyinData?.aweme_detail?.desc || '无标题',
            mediaType: douyinData?.aweme_detail?.media_type,
            author: douyinData?.aweme_detail?.author?.nickname || '未知作者',
            hasVideo: !![2, 42].includes(douyinData?.aweme_detail?.media_type) ? false : true,
            hasImages: [2, 42].includes(douyinData?.aweme_detail?.media_type)
        };

        res.json(result);
        
    } catch (e) {
        console.log('❌ VideoId测试失败:', e.message);
        res.json({
            success: false,
            error: e.message,
            videoId: videoId
        });
    }
});

app.post('/douyin', async (req, res) => {
    const url = req.body.url;
    try {
        const douyinId = await scraper.getDouyinVideoId(url);
        const douyinData = await scraper.getDouyinVideoData(douyinId);
        let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
        
        // 检查是否为图片集分享（media_type 为 2 或 42）
        const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);
        let imgUrls = [];
        let videoUrls = [];
        
        if (isImagesShare) {
            // 图片集分享：douyinUrls 包含所有图片链接
            imgUrls = douyinUrls || [];
            videoUrls = [];
        } else {
            // 视频分享：只获取视频链接，不包含封面图
            videoUrls = douyinUrls || [];
            imgUrls = [];
        }

        // 判断是否开启调试模式（返回所有候选链接）
        const debugMode = (req.body && (req.body.debug == 1 || req.body.debug === true))
            || (req.query && req.query.debug == 1)
            || process.env.DEBUG_VIDEO_URLS === '1'
            || process.env.DEBUG === '1';

        if (!debugMode && Array.isArray(videoUrls) && videoUrls.length > 1) {
            // 只保留最稳定的 aweme.snssdk.com 接口或第一个
            const stable = videoUrls.find(u =>
                (typeof u === 'string' && u.includes('aweme.snssdk.com/aweme/v1/play')) ||
                (u && typeof u === 'object' && u.url && u.url.includes('aweme.snssdk.com/aweme/v1/play'))
            );
            videoUrls = [stable || videoUrls[0]];
        }

        // 不再使用SuperDownloader - 已移除

    res.send({ code: 0, data: { video: videoUrls, img: imgUrls, debugMode, isImagesShare } })
    } catch (e) {
        console.log('error', e)
        res.send({ code: 1, msg: String(e), data: null })
    }
})

app.post('/workflow', async (req, res) => {
    const url = req.body.url;
    try {
        const isHomeUrl = url.indexOf('查看TA的更多作品') !== -1
        if (!isHomeUrl) {
            const douyinId = await scraper.getDouyinVideoId(url);
            const douyinData = await scraper.getDouyinVideoData(douyinId);
            let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
            
            // 检查是否为图片集分享（media_type 为 2 或 42）
            const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);
            let imgUrls = [];
            let videoUrls = [];
            
            if (isImagesShare) {
                // 图片集分享：douyinUrls 包含所有图片链接
                imgUrls = douyinUrls || [];
                videoUrls = [];
            } else {
                // 视频分享：只获取视频链接，不包含封面图
                videoUrls = douyinUrls || [];
                imgUrls = [];
            }
            
            // 判断是否开启调试模式（返回所有候选链接）
            const debugMode = (req.body && (req.body.debug == 1 || req.body.debug === true))
                || (req.query && req.query.debug == 1)
                || process.env.DEBUG_VIDEO_URLS === '1'
                || process.env.DEBUG === '1';

            if (!debugMode && Array.isArray(videoUrls) && videoUrls.length > 1) {
                // 只保留最稳定的 aweme.snssdk.com 接口或第一个
                const stable = videoUrls.find(u =>
                    (typeof u === 'string' && u.includes('aweme.snssdk.com/aweme/v1/play')) ||
                    (u && typeof u === 'object' && u.url && u.url.includes('aweme.snssdk.com/aweme/v1/play'))
                );
                videoUrls = [stable || videoUrls[0]];
            }

            res.send({ code: 0, data: { video: videoUrls, img: imgUrls, debugMode, isImagesShare } })
        } else {
            const sec_user_id = await scraper.getUserSecUidByShareUrl(url)
            const result = await scraper.getHomeVideos(sec_user_id)
            const urls = result.map(i => i.url).flat(Infinity)
            res.send({ code: 0, data: urls })
        }
    } catch (e) {
        console.log('error', e)
        res.send({ code: 1, msg: String(e), data: null })
    }
})

const getReadmeContent = () => {
    const content = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf-8')
    const htmlContent = marked(content)
    const htmlWithStyle = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Douyin No WaterMark Batch Download</title>
            <!-- 引入 GitHub Markdown CSS -->
            <link href="https://cdn.bootcdn.net/ajax/libs/reseter.css/2.0.0/minireseter.css" rel="stylesheet">
            <link rel="stylesheet" type="text/css" href="https://sindresorhus.com/github-markdown-css/github-markdown.css">
        </head>
        <body>
        <div class="markdown-body">${htmlContent}</div>
        <style>.markdown-body { padding: 20px 40px; box-sizing: border-box;}</style>
        </body>
        </html>
    `;
    return htmlWithStyle
}

// 服务器端代理下载 - 用户点击下载按钮直接下载，不跳转链接
app.get('/proxy-download', async (req, res) => {
    const { url, filename } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: '缺少URL参数' });
    }
    
    try {

        const fetch = require('node-fetch');
        
        // 直接获取文件内容
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.douyin.com/',
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive'
            },
            timeout: 60000
        });
        
        if (!response.ok) {
            console.log('❌ 文件获取失败:', response.status, response.statusText);
            return res.status(response.status).json({ error: `文件获取失败: ${response.status} ${response.statusText}` });
        }
        
        // 获取文件信息
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        
        // 处理文件名，确保有正确的扩展名
        let finalFilename = filename || 'douyin_video';
        
        // 根据内容类型确定扩展名
        if (!finalFilename.includes('.')) {
            if (contentType.includes('video/mp4') || contentType.includes('video/mpeg') || url.includes('.mp4')) {
                finalFilename += '.mp4';
            } else if (contentType.includes('image/jpeg') || url.includes('.jpg') || url.includes('.jpeg')) {
                finalFilename += '.jpg';
            } else if (contentType.includes('image/png') || url.includes('.png')) {
                finalFilename += '.png';
            } else if (contentType.includes('video/')) {
                finalFilename += '.mp4'; // 默认视频格式
            } else if (contentType.includes('image/')) {
                finalFilename += '.jpg'; // 默认图片格式
            } else {
                // 尝试从URL中提取扩展名
                const urlMatch = url.match(/\.([a-zA-Z0-9]{2,4})(\?|$)/);
                if (urlMatch) {
                    finalFilename += '.' + urlMatch[1];
                } else {
                    finalFilename += '.mp4'; // 最终默认
                }
            }
        }

        // 设置文件下载头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // 改进: 使用 pipeline 确保正确的错误处理和资源清理
        await pipelineAsync(response.body, res);

    } catch (error) {
        // 忽略客户端提前断开连接的正常情况（如用户取消下载）
        if (error.code === 'ERR_STREAM_PREMATURE_CLOSE' || 
            error.message.includes('Premature close') ||
            error.code === 'ECONNRESET' ||
            error.code === 'EPIPE') {
            // console.log('📡 客户端提前断开连接（正常情况，如取消下载）');
            return;
        }
        
        console.error('❌ 代理下载错误:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: '下载失败: ' + error.message });
        }
    }
});

// 视频代理端点 - 用于预览，不强制下载
app.get('/proxy-video', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: '缺少URL参数' });
    }
    
    try {

        const fetch = require('node-fetch');
        
        // 构建请求头，支持 Range 请求（拖拽进度条）
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.douyin.com/',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive'
        };
        
        // 透传客户端的 Range 请求头（支持视频拖拽进度条）
        if (req.headers.range) {
            headers.Range = req.headers.range;
            console.log('📡 透传 Range 请求:', req.headers.range);
        }
        
        // 直接获取文件内容
        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
            timeout: 60000
        });
        
        if (!response.ok) {
            console.log('❌ 视频获取失败:', response.status, response.statusText);
            return res.status(response.status).json({ error: `视频获取失败: ${response.status} ${response.statusText}` });
        }
        
        // 获取文件信息
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        const acceptRanges = response.headers.get('accept-ranges');
        const contentRange = response.headers.get('content-range');
        
        // 如果是 Range 请求，设置 206 状态码
        if (response.status === 206) {
            res.status(206);
        }
        
        // 设置视频流响应头（用于预览，不是下载）
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        
        if (contentRange) {
            res.setHeader('Content-Range', contentRange);
        }

        // 改进: 使用 pipeline 确保正确的错误处理和资源清理
        await pipelineAsync(response.body, res);

    } catch (error) {
        // 忽略客户端提前断开连接的正常情况（如拖拽进度条）
        if (error.code === 'ERR_STREAM_PREMATURE_CLOSE' || 
            error.message.includes('Premature close') ||
            error.code === 'ECONNRESET' ||
            error.code === 'EPIPE') {
            // console.log('📡 客户端提前断开连接（正常情况，如拖拽进度条）');
            return;
        }
        
        console.error('❌ 视频代理错误:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: '视频加载失败: ' + error.message });
        }
    }
});

const getArgsPort = () => {
    const args = process.argv.slice(2);
    const portArg = args.find(i => i.toLocaleUpperCase().indexOf('PORT') !== -1);
    if (portArg) {
        const port = portArg.split('=').pop()
        if (isNaN(Number(port))) return PORT
        return Number(port)
    } else {
        return PORT
    }
}

// Debug端点: 获取真实URL信息
app.get('/get-real-url', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.json({ success: false, error: '缺少URL参数' });
    }
    
    try {

        // 检查是否是抖音链接，如果是则使用特殊处理
        const isDouyinUrl = url.includes('douyin.com') || url.includes('iesdouyin.com');
        
        let response;
        
        if (isDouyinUrl) {
            // 对抖音链接使用适当的用户代理
            response = await fetch(url, { 
                method: 'HEAD',
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1'
                }
            });
        } else {
            // 对其他链接使用默认方式
            response = await fetch(url, { 
                method: 'HEAD',
                redirect: 'follow'
            });
        }
        
        const headers = {
            contentType: response.headers.get('content-type') || 'unknown',
            contentLength: response.headers.get('content-length') || 'unknown',
            lastModified: response.headers.get('last-modified') || 'unknown',
            server: response.headers.get('server') || 'unknown'
        };
        
        res.json({
            success: true,
            originalUrl: url,
            realUrl: response.url,
            status: response.status,
            redirected: response.redirected,
            headers: headers,
            urlType: isDouyinUrl ? 'douyin' : 'general'
        });
        
    } catch (error) {
        console.error('❌ Debug错误:', error.message);
        res.json({ 
            success: false, 
            error: error.message,
            originalUrl: url
        });
    }
});

// Debug端点: 直接下载测试
app.get('/direct-download', async (req, res) => {
    const url = req.query.url;
    const filename = req.query.filename || 'test_download.mp4';
    
    if (!url) {
        return res.status(400).send('缺少URL参数');
    }
    
    try {
        console.log('⬇️ Debug: 直接下载测试 -', filename);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        
        // 修复: 简化的方式
        const text = await response.text();
        res.send(text);

    } catch (error) {
        console.error('❌ Debug下载错误:', error.message);
        if (!res.headersSent) {
            res.status(500).send('下载失败: ' + error.message);
        }
    }
});

// Cookie更新API - 支持环境变量和Vercel自动更新
let VercelEnvManager, vercelEnv;

// 尝试加载Vercel环境管理器（可选功能）
try {
  VercelEnvManager = require('./vercel-env-manager');
  vercelEnv = new VercelEnvManager();
} catch (error) {
  console.log('💡 Vercel自动同步功能未启用（这是正常的，基础功能仍可正常使用）');
  vercelEnv = null;
}

app.post('/api/update-cookie', async (req, res) => {
    try {
        const { cookie, updateVercel = false } = req.body;
        
        if (!cookie || cookie.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Cookie值不能为空' });
        }

        let finalCookie = cookie.trim();

        // 智能格式处理
        if (cookie.includes('sid_guard=')) {
            // 完整cookie格式
            finalCookie = cookie;
        } else if (cookie.includes('%7C')) {
            // 只有sid_guard值，自动包装
            finalCookie = `sid_guard=${cookie};`;
        } else {
            return res.status(400).json({ success: false, message: 'Cookie格式不正确' });
        }

        // 🚀 动态更新scraper实例中的cookie - 立即生效！
        if (scraper && scraper.updateCookie) {
            scraper.updateCookie(finalCookie);
            console.log('🍪 Scraper Cookie已动态更新，立即生效！[Cookie: ' + maskSensitiveInfo(finalCookie) + ']');
        }

        let vercelUpdateResult = null;
        let message = '🎉 Cookie已更新并立即生效！无需重新部署 🚀';
        let immediate = true;
        let noRedeployNeeded = true;

        // 如果请求更新Vercel环境变量且功能可用
        if (updateVercel && vercelEnv) {
            const configStatus = vercelEnv.getConfigStatus();
            
            if (configStatus.isConfigured) {
                try {
                    vercelUpdateResult = await vercelEnv.updateEnvironmentVariable(
                        'DOUYIN_COOKIE', 
                        finalCookie,
                        'encrypted',
                        ['production', 'preview']
                    );
                    message = '🎉 Cookie立即生效 + Vercel环境变量已备份 🚀';
                } catch (vercelError) {
                    console.error('Vercel环境变量更新失败:', vercelError);
                    message = '🎉 Cookie已立即生效！Vercel备份失败: ' + vercelError.message;
                }
            } else {
                message = '🎉 Cookie已立即生效！(Vercel配置不完整，但主要功能正常) 🚀';
            }
        } else if (updateVercel && !vercelEnv) {
            message = '🎉 Cookie已立即生效！(Vercel自动同步功能未启用，但主要功能正常) 🚀';
        }

        res.json({ 
            success: true, 
            message,
            immediate,
            noRedeployNeeded,
            vercelConfig: vercelEnv ? vercelEnv.getConfigStatus() : { isConfigured: false, available: false },
            vercelUpdateResult: vercelUpdateResult ? { success: true } : null
        });

    } catch (error) {
        console.error('Cookie更新错误:', error.message || 'Unknown error');
        res.status(500).json({ success: false, message: '更新失败: ' + error.message });
    }
});

// 新增：Vercel配置状态检查API
app.get('/api/vercel-config', (req, res) => {
    if (!vercelEnv) {
        return res.json({
            success: true,
            config: { 
                isConfigured: false, 
                available: false,
                hasToken: false,
                hasProjectId: false 
            },
            instructions: {
                note: 'Vercel自动同步功能为可选功能',
                vercelToken: '在Vercel Dashboard > Settings > Tokens中创建',
                projectId: '在项目Settings > General中找到Project ID',
                teamId: '如果项目属于团队，在团队设置中找到Team ID'
            }
        });
    }

    const configStatus = vercelEnv.getConfigStatus();
    res.json({
        success: true,
        config: { ...configStatus, available: true },
        instructions: {
            vercelToken: '在Vercel Dashboard > Settings > Tokens中创建',
            projectId: '在项目Settings > General中找到Project ID',
            teamId: '如果项目属于团队，在团队设置中找到Team ID'
        }
    });
});

PORT = getArgsPort()
app.listen(PORT, () => {
    console.log(`server is running on: ${PORT} \n`);
})