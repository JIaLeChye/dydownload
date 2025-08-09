
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

app.post('/douyin', async (req, res) => {
    const url = req.body.url;
    try {
        const douyinId = await scraper.getDouyinVideoId(url);
        const douyinData = await scraper.getDouyinVideoData(douyinId);
        let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
        const imgUrl = await scraper.getDouyinImageUrls(douyinData);

        // 判断是否开启调试模式（返回所有候选链接）
        const debugMode = (req.body && (req.body.debug == 1 || req.body.debug === true))
            || (req.query && req.query.debug == 1)
            || process.env.DEBUG_VIDEO_URLS === '1'
            || process.env.DEBUG === '1';

        if (!debugMode && Array.isArray(douyinUrls) && douyinUrls.length > 1) {
            // 只保留最稳定的 aweme.snssdk.com 接口或第一个
            const stable = douyinUrls.find(u =>
                (typeof u === 'string' && u.includes('aweme.snssdk.com/aweme/v1/play')) ||
                (u && typeof u === 'object' && u.url && u.url.includes('aweme.snssdk.com/aweme/v1/play'))
            );
            douyinUrls = [stable || douyinUrls[0]];
        }

        // 如果视频URL为空或失败，使用SuperDownloader
        if (!douyinUrls || douyinUrls.length === 0) {
            console.log('🚨 常规方法失败，启动SuperDownloader...');
            
            // 获取原始视频URL
            const originalVideoUrl = douyinData?.video?.play_addr?.url_list?.[0] || 
                                   douyinData?.video?.download_addr?.url_list?.[0];
            
            if (originalVideoUrl) {
                const SuperDownloader = require('../super-downloader');
                const superDownloader = new SuperDownloader();
                
                const result = await superDownloader.getWorkingVideoUrl(originalVideoUrl, douyinId);
                
                if (result.success) {
                    console.log('✅ SuperDownloader成功!');
                    douyinUrls = [{
                        url: result.downloadUrl,
                        headers: {
                            'User-Agent': result.userAgent,
                            'Referer': result.referer
                        },
                        method: 'super-downloader',
                        contentType: result.contentType,
                        contentLength: result.contentLength,
                        duration: result.duration
                    }];
                } else {
                    console.log('❌ SuperDownloader也失败了:', result.error);
                    // 返回错误信息但不中断程序
                    douyinUrls = [{
                        error: result.error,
                        method: 'super-downloader-failed',
                        totalAttempts: result.totalAttempts
                    }];
                }
            }
        }

    res.send({ code: 0, data: { video: douyinUrls, img: imgUrl, debugMode } })
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
            const douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
            const debugMode = (req.body && (req.body.debug == 1 || req.body.debug === true))
                || (req.query && req.query.debug == 1)
                || process.env.DEBUG_VIDEO_URLS === '1'
                || process.env.DEBUG === '1';
            let filtered = douyinUrls;
            if (!debugMode && Array.isArray(filtered) && filtered.length > 1) {
                const stable = filtered.find(u =>
                    (typeof u === 'string' && u.includes('aweme.snssdk.com/aweme/v1/play')) ||
                    (u && typeof u === 'object' && u.url && u.url.includes('aweme.snssdk.com/aweme/v1/play'))
                );
                filtered = [stable || filtered[0]];
            }
            res.send({ code: 0, data: filtered, debugMode })
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

// 代理下载端点 - 解决403错误
app.get('/proxy-download', async (req, res) => {
    const { url, filename } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: '缺少URL参数' });
    }
    
    try {
        console.log('🔄 代理下载:', url.substring(0, 100) + '...');
        
        const fetch = require('node-fetch');
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.douyin.com/',
                'Accept': 'video/mp4,video/*,image/*,*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'identity', // 禁用压缩以避免问题
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'video',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            },
            timeout: 30000 // 30秒超时
        });
        
        if (!response.ok) {
            console.log('❌ 代理下载失败:', response.status, response.statusText);
            return res.status(response.status).json({ 
                error: `下载失败: ${response.status} ${response.statusText}` 
            });
        }
        
        // 获取内容类型和大小
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        
        console.log('✅ 代理下载成功:', contentType, contentLength ? `${contentLength} bytes` : '未知大小');
        
        // 设置响应头
        res.setHeader('Content-Type', contentType);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        
        // 设置下载文件名
        if (filename) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        }
        
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        
        // 将下载流直接传输给客户端
        response.body.pipe(res);
        
    } catch (error) {
        console.error('❌ 代理下载错误:', error.message);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

// CORS预检请求处理
app.options('/proxy-download', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.sendStatus(200);
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


PORT = getArgsPort()
app.listen(PORT, () => {
    console.log(`server is running on: ${PORT} \n`);
})