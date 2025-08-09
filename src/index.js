
const Scraper = require('..')
const express = require('express')
const path = require('path')
const fs = require('fs')
const { marked } = require('marked')
require('dotenv').config();

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
    console.log('🚀 zjcdn API收到请求:', url);
    
    // 简单的URL有效性预检查
    if (!url || typeof url !== 'string') {
        return res.send({ code: 1, msg: 'URL参数无效', data: null });
    }
    
    if (!url.includes('douyin.com') && !url.includes('dy.toutiao.com')) {
        return res.send({ code: 1, msg: '请提供有效的抖音链接', data: null });
    }
    
    try {
        console.log('📎 开始解析videoId...');
        const douyinId = await scraper.getDouyinVideoId(url);
        console.log('✅ VideoId解析成功:', douyinId);
        
        console.log('📡 开始获取视频数据...');
        const douyinData = await scraper.getDouyinVideoData(douyinId);
        console.log('✅ 视频数据获取成功');
        
        // 检查是否为图片集分享
        const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);
        console.log('🎭 媒体类型检查:', douyinData.aweme_detail.media_type, '是否为图片集:', isImagesShare);
        
        if (isImagesShare) {
            // 图片集分享
            console.log('📸 处理图片集分享...');
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
            console.log('🎬 处理视频分享，尝试获取zjcdn直链...');
            const zjcdnUrls = await scraper.getZjcdnDirectUrls(douyinData);
            
            if (zjcdnUrls.length > 0) {
                console.log('✅ zjcdn直链获取成功:', zjcdnUrls.length, '个');
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
                console.log('⚠️ zjcdn直链获取失败，使用常规方法');
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
    console.log('🧪 测试URL解析:', url);
    
    try {
        console.log('📎 步骤1: 解析videoId...');
        const douyinId = await scraper.getDouyinVideoId(url);
        console.log('✅ VideoId:', douyinId);
        
        console.log('📡 步骤2: 获取视频数据...');
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
        
        console.log('✅ 测试成功');
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
    console.log('🔍 检查URL有效性:', url);
    
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
    console.log('🎯 直接测试VideoId:', videoId);
    
    try {
        console.log('📡 获取视频数据...');
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
        
        console.log('✅ VideoId测试成功');
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
        console.log('🔄 服务器代理下载:', filename || 'unknown');
        
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
        
        console.log('📁 最终文件名:', finalFilename);
        console.log('📋 内容类型:', contentType);
        
        // 设置文件下载头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
            console.log('📏 文件大小:', Math.round(contentLength / 1024 / 1024 * 100) / 100 + ' MB');
        }
        
        console.log('✅ 开始代理下载:', finalFilename);
        
        // 修复: 使用 arrayBuffer 处理二进制内容
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.write(buffer);
        res.end();
        
        console.log('✅ 代理下载已完成:', finalFilename);
        
    } catch (error) {
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
        console.log('🎬 视频代理预览:', url.substring(0, 100) + '...');
        
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
            console.log('❌ 视频获取失败:', response.status, response.statusText);
            return res.status(response.status).json({ error: `视频获取失败: ${response.status} ${response.statusText}` });
        }
        
        // 获取文件信息
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        
        console.log('📋 视频内容类型:', contentType);
        if (contentLength) {
            console.log('📏 视频大小:', Math.round(contentLength / 1024 / 1024 * 100) / 100 + ' MB');
        }
        
        // 设置视频流响应头（用于预览，不是下载）
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        
        console.log('✅ 开始视频流传输');
        
        // 修复: 使用 arrayBuffer 处理视频流
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.write(buffer);
        res.end();
        
        console.log('✅ 视频流传输完成');
        
    } catch (error) {
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
        console.log('🔍 Debug: 获取真实URL信息 -', url);
        
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
        
        console.log('✅ Debug下载已完成:', filename);
        
    } catch (error) {
        console.error('❌ Debug下载错误:', error.message);
        if (!res.headersSent) {
            res.status(500).send('下载失败: ' + error.message);
        }
    }
});

PORT = getArgsPort()
app.listen(PORT, () => {
    console.log(`server is running on: ${PORT} \n`);
})