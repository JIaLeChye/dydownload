//#!/usr/bin/env node

const Scraper = require('../bin/index.js')
const { maskSensitiveInfo, formatRemainingTime, checkSidGuardExpiry } = require('../bin/index.js')
const express = require('express')
const path = require('path')
const fs = require('fs')
const { pipeline } = require('stream')
const { promisify } = require('util')
const { marked } = require('marked')

const pipelineAsync = promisify(pipeline)

// Performance monitoring utility
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.enabled = process.env.ENABLE_PERF_MONITORING === '1';
    }
    
    start(label) {
        if (!this.enabled) return;
        this.metrics.set(label, {
            start: Date.now(),
            memory: process.memoryUsage()
        });
    }
    
    end(label) {
        if (!this.enabled) return;
        const metric = this.metrics.get(label);
        if (!metric) return;
        
        const duration = Date.now() - metric.start;
        const endMemory = process.memoryUsage();
        const memoryDelta = {
            heapUsed: (endMemory.heapUsed - metric.memory.heapUsed) / 1024 / 1024,
            external: (endMemory.external - metric.memory.external) / 1024 / 1024
        };
        
        console.log(`⏱️  [${label}] Duration: ${duration}ms, Memory: ${memoryDelta.heapUsed.toFixed(2)}MB heap`);
        this.metrics.delete(label);
        
        return { duration, memoryDelta };
    }
    
    clear() {
        this.metrics.clear();
    }
}

const perfMonitor = new PerformanceMonitor();

// Helper function: Check if debug mode is enabled
function isDebugMode(req) {
    return (req.body && (req.body.debug == 1 || req.body.debug === true))
        || (req.query && req.query.debug == 1)
        || process.env.DEBUG_VIDEO_URLS === '1'
        || process.env.DEBUG === '1';
}

// Helper function: Process Douyin video URL and return standardized response
async function processDouyinVideo(url, debugMode = false) {
    const douyinId = await scraper.getDouyinVideoId(url);
    const douyinData = await scraper.getDouyinVideoData(douyinId);
    let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
    
    // Check if it's an image share (media_type 2 or 42)
    const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);
    let imgUrls = [];
    let videoUrls = [];
    
    if (isImagesShare) {
        // Image share: douyinUrls contains all image links
        imgUrls = douyinUrls || [];
        videoUrls = [];
    } else {
        // Video share: only get video links, no cover images
        videoUrls = douyinUrls || [];
        imgUrls = [];
    }
    
    // Filter to most stable URL in non-debug mode
    if (!debugMode && Array.isArray(videoUrls) && videoUrls.length > 1) {
        // Keep only the most stable aweme.snssdk.com interface or first one
        const stable = videoUrls.find(u =>
            (typeof u === 'string' && u.includes('aweme.snssdk.com/aweme/v1/play')) ||
            (u && typeof u === 'object' && u.url && u.url.includes('aweme.snssdk.com/aweme/v1/play'))
        );
        videoUrls = [stable || videoUrls[0]];
    }
    
    return { 
        code: 0, 
        data: { 
            video: videoUrls, 
            img: imgUrls, 
            debugMode, 
            isImagesShare 
        } 
    };
}

// Simple in-memory cache for API responses
class SimpleCache {
    constructor(ttl = 60000) { // TTL in milliseconds (default: 60 seconds)
        this.cache = new Map();
        this.ttl = ttl;
        this.cleanupStartIndex = 0; // Track position for round-robin cleanup
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + this.ttl
        });
    }
    
    clear() {
        this.cache.clear();
    }
    
    // Cleanup expired entries periodically using round-robin approach
    startCleanup(interval = 300000) { // every 5 minutes
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const entries = Array.from(this.cache.entries());
            const entriesToCheck = Math.min(50, entries.length);
            
            // Round-robin: start from last position
            for (let i = 0; i < entriesToCheck && entries.length > 0; i++) {
                const index = (this.cleanupStartIndex + i) % entries.length;
                const [key, item] = entries[index];
                
                if (now > item.expiry) {
                    this.cache.delete(key);
                }
            }
            
            // Advance starting position for next cleanup
            this.cleanupStartIndex = (this.cleanupStartIndex + entriesToCheck) % Math.max(entries.length, 1);
        }, interval);
    }
    
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Request deduplication to prevent duplicate concurrent requests
class RequestDeduplicator {
    constructor() {
        this.pending = new Map();
    }
    
    async execute(key, asyncFunction) {
        // If request is already pending, return the existing promise
        if (this.pending.has(key)) {
            console.log('📋 Request deduplication:', key);
            return this.pending.get(key);
        }
        
        // Create new request promise
        const promise = asyncFunction()
            .finally(() => {
                // Remove from pending when complete
                this.pending.delete(key);
            });
        
        this.pending.set(key, promise);
        return promise;
    }
    
    clear() {
        this.pending.clear();
    }
}

// Create cache instances
const videoDataCache = new SimpleCache(120000); // 2 minutes for video data
videoDataCache.startCleanup();

const requestDeduplicator = new RequestDeduplicator();

/**
 * 从 Cookie 字符串中提取并检测 sid_guard
 * @param {string} cookieString - Cookie 字符串
 * @returns {object} 检测结果
 */
const checkCookieSidGuardExpiry = (cookieString) => {
    if (!cookieString || typeof cookieString !== 'string') {
        return {
            isValid: false,
            isExpired: true,
            error: 'Cookie 字符串为空或无效',
            details: null
        };
    }

    // 从Cookie中提取sid_guard
    const sidGuardMatch = cookieString.match(/sid_guard=([^;]+)/);
    if (!sidGuardMatch) {
        return {
            isValid: false,
            isExpired: true,
            error: '未找到 sid_guard 参数',
            details: null
        };
    }

    const sidGuard = decodeURIComponent(sidGuardMatch[1]);
    return checkSidGuardExpiry(sidGuard);
};

// Auto-detect deployment environment and load appropriate configuration
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isProduction = process.env.NODE_ENV === 'production';
const envLocalPath = process.env.ENV_LOCAL_PATH || path.join(__dirname, '../.env.local');

console.log('\n🔍 Environment Detection:');
console.log(`   Platform: ${isVercel ? 'Vercel' : 'Local'}`);
console.log(`   Node Environment: ${process.env.NODE_ENV || 'development'}`);

if (!isVercel) {
    // Local development: load .env.local file
    console.log(`   Loading .env.local from: ${envLocalPath}`);

    try {
        if (fs.existsSync(envLocalPath) && fs.statSync(envLocalPath).isDirectory()) {
            console.warn(`   ⚠️  ENV_LOCAL_PATH points to a directory: ${envLocalPath}`);
            console.warn('   ⚠️  Skip loading .env.local. Please set ENV_LOCAL_PATH to a file path.');
        } else {
            const envResult = require('dotenv').config({ path: envLocalPath });
            if (envResult.error) {
                if (envResult.error.code === 'ENOENT') {
                    console.log('   ℹ️  .env.local not found yet. It will be created when Cookie is updated from web UI.');
                } else {
                    console.error('   ❌ Failed to load .env.local:', envResult.error.message);
                }
            } else {
                console.log('   ✅ .env.local loaded successfully');
                console.log(`   📝 Found ${Object.keys(envResult.parsed || {}).length} environment variables`);
            }
        }
    } catch (envLoadError) {
        console.error('   ❌ Failed to check .env.local path:', envLoadError.message);
    }
} else {
    // Vercel: use environment variables directly
    console.log('   ✅ Using Vercel environment variables');
}

// Verify DOUYIN_COOKIE is available
if (process.env.DOUYIN_COOKIE) {
    const cookiePreview = maskSensitiveInfo(process.env.DOUYIN_COOKIE, 'cookie');
    console.log(`   🍪 DOUYIN_COOKIE loaded: ${cookiePreview}`);
} else {
    console.warn('   ⚠️  WARNING: DOUYIN_COOKIE not found in environment!');
}
console.log('');

const app = express()
app.use(express.static(path.join(__dirname, '../public')))

app.use(express.json()); // 用于解析 JSON 格式的请求体
app.use(express.urlencoded({ extended: true }));
const scraper = new Scraper()
let PORT = process.env.PORT || 3000;

// readme docs - with caching
let readmeCache = null;
let readmeCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get('/readme', async (req, res) => {
    try {
        const now = Date.now();
        if (readmeCache && (now - readmeCacheTime < CACHE_DURATION)) {
            return res.send(readmeCache);
        }
        
        const html = await getReadmeContent();
        readmeCache = html;
        readmeCacheTime = now;
        res.send(html);
    } catch (error) {
        console.error('Error loading readme:', error);
        res.status(500).send('Error loading documentation');
    }
})

// zjcdn直链API - 优先使用zjcdn域名的直接链接
app.post('/zjcdn', async (req, res) => {
    perfMonitor.start('zjcdn-api');
    const url = req.body.url;

    // 简单的URL有效性预检查
    if (!url || typeof url !== 'string') {
        perfMonitor.end('zjcdn-api');
        return res.send({ code: 1, msg: 'URL参数无效', data: null });
    }
    
    if (!url.includes('douyin.com') && !url.includes('dy.toutiao.com')) {
        perfMonitor.end('zjcdn-api');
        return res.send({ code: 1, msg: '请提供有效的抖音链接', data: null });
    }
    
    // Check cache first
    const cacheKey = `zjcdn:${url}`;
    const cachedResult = videoDataCache.get(cacheKey);
    if (cachedResult) {
        console.log('📦 使用缓存的结果');
        perfMonitor.end('zjcdn-api');
        return res.send(cachedResult);
    }
    
    // Use request deduplication
    try {
        const result = await requestDeduplicator.execute(cacheKey, async () => {
            const douyinId = await scraper.getDouyinVideoId(url);
            const douyinData = await scraper.getDouyinVideoData(douyinId);

            // 检查是否为图片集分享
            const isImagesShare = [2, 42].includes(douyinData.aweme_detail.media_type);
            
            if (isImagesShare) {
                // 图片集分享
                let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
                return { 
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
                };
            }
            
            // 视频分享 - 使用scraper的完整逻辑获取最佳视频URL
            let douyinUrls = await scraper.getDouyinNoWatermarkVideo(douyinData);
            
            return { 
                code: 0, 
                data: { 
                    video: douyinUrls || [], 
                    img: [], 
                    debugMode: false, 
                    isImagesShare: false,
                    method: 'zjcdn-auto',
                    title: douyinData?.aweme_detail?.desc || '',
                    author: douyinData?.aweme_detail?.author?.nickname || ''
                } 
            };
        });
        
        // Cache the result
        videoDataCache.set(cacheKey, result);
        perfMonitor.end('zjcdn-api');
        res.send(result);
        
    } catch (e) {
        console.log('❌ zjcdn API返回错误:', e.message);
        console.error('详细错误信息:', e);
        perfMonitor.end('zjcdn-api');
        
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
        const debugMode = isDebugMode(req);
        const result = await processDouyinVideo(url, debugMode);
        res.send(result);
    } catch (e) {
        console.log('error', e);
        res.send({ code: 1, msg: String(e), data: null });
    }
})

app.post('/workflow', async (req, res) => {
    const url = req.body.url;
    try {
        const isHomeUrl = url.indexOf('查看TA的更多作品') !== -1;
        
        if (!isHomeUrl) {
            const debugMode = isDebugMode(req);
            const result = await processDouyinVideo(url, debugMode);
            res.send(result);
        } else {
            const sec_user_id = await scraper.getUserSecUidByShareUrl(url);
            const result = await scraper.getHomeVideos(sec_user_id);
            const urls = result.map(i => i.url).flat(Infinity);
            res.send({ code: 0, data: urls });
        }
    } catch (e) {
        console.log('error', e);
        res.send({ code: 1, msg: String(e), data: null });
    }
})

const getReadmeContent = async () => {
    const content = await fs.promises.readFile(path.join(__dirname, '../README.md'), 'utf-8');
    const htmlContent = marked(content);
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
    return htmlWithStyle;
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0',
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

        // 使用 pipeline 确保正确的错误处理和资源清理
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0',
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

        // 🚀 动态更新环境变量中的cookie - 立即生效！
        // 注意：这是用户主动更新的真实有效的 sid_guard，不是我们生成的测试数据
        process.env.DOUYIN_COOKIE = finalCookie;
        console.log('🍪 DOUYIN_COOKIE 环境变量已更新，立即生效！[Cookie: ' + maskSensitiveInfo(finalCookie) + ']');

        // 同时更新 scraper 实例（如果存在）
        if (scraper && scraper.updateCookie) {
            scraper.updateCookie(finalCookie);
        }

        // 🔍 检测用户提供的 sid_guard 过期状态
        const sidGuardStatus = checkCookieSidGuardExpiry(finalCookie);
        console.log('🔍 sid_guard 状态检测:', sidGuardStatus.isValid ? '✅ 有效' : '❌ 过期/无效');
        if (sidGuardStatus.details && sidGuardStatus.details.remainingTime) {
            console.log('⏰ 剩余时间:', sidGuardStatus.details.remainingTime);
        }

        // 💾 本地环境：同步更新 .env.local 文件，确保重启后cookie依然是最新的
        let localFileUpdated = false;
        if (!isVercel) {
            try {
                const envPath = envLocalPath;
                let envContent = '';

                // Ensure parent directory exists when using mounted data path.
                fs.mkdirSync(path.dirname(envPath), { recursive: true });
                
                // 尝试读取现有文件
                if (fs.existsSync(envPath)) {
                    if (fs.statSync(envPath).isDirectory()) {
                        throw new Error(`.env.local 路径是目录而不是文件: ${envPath}`);
                    }
                    envContent = fs.readFileSync(envPath, 'utf-8');
                }
                
                // 更新或添加 DOUYIN_COOKIE
                if (envContent.includes('DOUYIN_COOKIE=')) {
                    // 替换现有的 DOUYIN_COOKIE 值
                    envContent = envContent.replace(/DOUYIN_COOKIE=.*/g, `DOUYIN_COOKIE=${finalCookie}`);
                } else {
                    // 添加新的 DOUYIN_COOKIE
                    envContent = envContent.trim() + (envContent ? '\n' : '') + `DOUYIN_COOKIE=${finalCookie}\n`;
                }
                
                // 写入文件
                fs.writeFileSync(envPath, envContent, 'utf-8');
                console.log('💾 .env.local 文件已更新，重启后依然有效');
                localFileUpdated = true;
            } catch (fileError) {
                console.error('⚠️ .env.local 文件更新失败:', fileError.message);
                // 不中断流程，因为环境变量已经更新
            }
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
                    message = localFileUpdated 
                        ? '🎉 Cookie立即生效 + .env.local已更新 + Vercel环境变量已备份 🚀'
                        : '🎉 Cookie立即生效 + Vercel环境变量已备份 🚀';
                } catch (vercelError) {
                    console.error('Vercel环境变量更新失败:', vercelError);
                    message = localFileUpdated
                        ? '🎉 Cookie已立即生效 + .env.local已更新！Vercel备份失败: ' + vercelError.message
                        : '🎉 Cookie已立即生效！Vercel备份失败: ' + vercelError.message;
                }
            } else {
                message = localFileUpdated
                    ? '🎉 Cookie已立即生效 + .env.local已更新！(Vercel配置不完整，但主要功能正常) 🚀'
                    : '🎉 Cookie已立即生效！(Vercel配置不完整，但主要功能正常) 🚀';
            }
        } else if (updateVercel && !vercelEnv) {
            message = localFileUpdated
                ? '🎉 Cookie已立即生效 + .env.local已更新！(Vercel自动同步功能未启用，但主要功能正常) 🚀'
                : '🎉 Cookie已立即生效！(Vercel自动同步功能未启用，但主要功能正常) 🚀';
        } else if (localFileUpdated) {
            message = '🎉 Cookie已更新并立即生效 + .env.local已保存！重启后依然有效 🚀';
        }

        res.json({ 
            success: true, 
            message,
            immediate,
            noRedeployNeeded,
            localFileUpdated,
            sidGuardStatus: {
                isValid: sidGuardStatus.isValid,
                isExpired: sidGuardStatus.isExpired,
                error: sidGuardStatus.error,
                remainingTime: sidGuardStatus.details ? sidGuardStatus.details.remainingTime : null,
                remainingSeconds: sidGuardStatus.details ? sidGuardStatus.details.remainingSeconds : 0
            },
            vercelConfig: vercelEnv ? vercelEnv.getConfigStatus() : { isConfigured: false, available: false },
            vercelUpdateResult: vercelUpdateResult ? { success: true } : null
        });

    } catch (error) {
        console.error('Cookie更新错误:', error.message || 'Unknown error');
        res.status(500).json({ success: false, message: '更新失败: ' + error.message });
    }
});

// Cookie 状态检查API - 检测当前 sid_guard 是否过期
app.get('/api/cookie-status', (req, res) => {
    try {
        // 重新加载环境变量以确保获取最新值 (仅在本地环境)
        if (!isVercel) {
            if (fs.existsSync(envLocalPath) && !fs.statSync(envLocalPath).isDirectory()) {
                require('dotenv').config({ path: envLocalPath, override: true });
            }
        }
        
        // 首先尝试从环境变量获取（.env.local中的值或Vercel环境变量）
        let currentCookie = process.env.DOUYIN_COOKIE;
        let cookieSource = 'environment';
        
        // 如果环境变量没有设置，从 scraper 实例获取
        if (!currentCookie && scraper && scraper.douyinApiHeaders && scraper.douyinApiHeaders.cookie) {
            currentCookie = scraper.douyinApiHeaders.cookie;
            cookieSource = 'scraper';
        }
        
        if (!currentCookie) {
            return res.json({
                success: false,
                message: 'Cookie 未设置',
                sidGuardStatus: {
                    isValid: false,
                    isExpired: true,
                    error: '未找到任何Cookie配置',
                    remainingTime: null,
                    remainingSeconds: 0
                },
                cookieInfo: {
                    source: 'none',
                    hasCookie: false,
                    cookiePreview: null,
                    isPlaceholder: false
                }
            });
        }

        // 检查是否是默认的占位符
        if (currentCookie.includes('替换为您的sid_guard值')) {
            return res.json({
                success: false,
                message: '当前使用的是默认占位符，需要设置真实Cookie',
                sidGuardStatus: {
                    isValid: false,
                    isExpired: true,
                    error: '当前Cookie是默认占位符，请从浏览器获取真实的sid_guard值',
                    remainingTime: null,
                    remainingSeconds: 0
                },
                cookieInfo: {
                    source: cookieSource,
                    hasCookie: true,
                    cookiePreview: maskSensitiveInfo(currentCookie, 'cookie'),
                    isPlaceholder: true
                }
            });
        }

        // 检测 sid_guard 状态
        const sidGuardStatus = checkCookieSidGuardExpiry(currentCookie);

        res.json({
            success: sidGuardStatus.isValid,
            message: sidGuardStatus.isValid ? 'Cookie 状态正常' : 'Cookie 已过期或无效',
            sidGuardStatus: {
                isValid: sidGuardStatus.isValid,
                isExpired: sidGuardStatus.isExpired,
                error: sidGuardStatus.error,
                remainingTime: sidGuardStatus.details ? sidGuardStatus.details.remainingTime : null,
                remainingSeconds: sidGuardStatus.details ? sidGuardStatus.details.remainingSeconds : 0
            },
            cookieInfo: {
                source: cookieSource,
                hasCookie: true,
                cookiePreview: maskSensitiveInfo(currentCookie, 'cookie'),
                isPlaceholder: false
            }
        });

    } catch (error) {
        console.error('Cookie 状态检查错误:', error);
        res.status(500).json({
            success: false,
            message: '状态检查失败: ' + error.message,
            sidGuardStatus: {
                isValid: false,
                isExpired: true,
                error: '检查过程中发生错误',
                remainingTime: null,
                remainingSeconds: 0
            }
        });
    }
});

// Vercel配置状态检查API
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

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, cleaning up...');
    videoDataCache.stopCleanup();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, cleaning up...');
    videoDataCache.stopCleanup();
    process.exit(0);
});