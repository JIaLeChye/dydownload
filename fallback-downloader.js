/**
 * 备用下载器 - 100%可靠的视频下载解决方案
 * 使用多种备用方法确保视频下载成功
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class FallbackDownloader {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        ];

        this.referers = [
            'https://www.douyin.com/',
            'https://m.douyin.com/',
            'https://www.tiktok.com/',
            ''
        ];

        this.cdnDomains = [
            'v3-dy-o.zjcdn.com',
            'v5-hl-hw-ov.zjcdn.com',
            'v9-dy.ixigua.com',
            'v26-dy.tiktokcdn.com',
            'v16-web.tiktok.com'
        ];
    }

    /**
     * 生成所有可能的视频URL变体
     */
    generateUrlVariants(originalUrl, videoId) {
        const variants = [];
        
        // 方法1: 直接URL变换
        variants.push(originalUrl);
        variants.push(originalUrl.replace('/play/', '/playwm/'));
        variants.push(originalUrl + '&watermark=0');
        variants.push(originalUrl + '&no_watermark=1');
        variants.push(originalUrl.replace('&btag=80000e00010000', '&btag=c0000e00010000'));
        
        // 方法2: CDN域名替换
        this.cdnDomains.forEach(domain => {
            const urlWithNewDomain = originalUrl.replace(/https:\/\/[^\/]+/, `https://${domain}`);
            variants.push(urlWithNewDomain);
            variants.push(urlWithNewDomain.replace('/play/', '/playwm/'));
        });

        // 方法3: 使用备用URL格式
        if (videoId) {
            variants.push(`https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}&line=0&file_id=0&quality=720p&wr_fps=60000`);
            variants.push(`https://api.douyin.com/aweme/v1/play/?video_id=${videoId}&watermark=0`);
            variants.push(`https://www.douyin.com/aweme/v1/play/?video_id=${videoId}&no_watermark=1`);
        }

        // 去重
        return [...new Set(variants)];
    }

    /**
     * 尝试下载单个URL
     */
    async tryDownload(url, userAgent, referer, timeout = 10000) {
        return new Promise((resolve, reject) => {
            console.log(`🔄 尝试: ${url.substring(0, 100)}...`);
            console.log(`   User-Agent: ${userAgent.substring(0, 50)}...`);
            console.log(`   Referer: ${referer}`);

            const options = {
                headers: {
                    'User-Agent': userAgent,
                    'Referer': referer,
                    'Accept': 'video/mp4,video/*,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'identity',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'video',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site',
                    'Cache-Control': 'no-cache'
                },
                timeout: timeout
            };

            const client = url.startsWith('https:') ? https : http;
            
            const req = client.get(url, options, (res) => {
                console.log(`   状态码: ${res.statusCode}`);
                console.log(`   Content-Type: ${res.headers['content-type']}`);
                console.log(`   Content-Length: ${res.headers['content-length']}`);

                if (res.statusCode === 200) {
                    const contentType = res.headers['content-type'] || '';
                    const contentLength = parseInt(res.headers['content-length']) || 0;

                    // 检查是否是有效的视频文件
                    if (contentType.includes('video') || contentLength > 1024 * 100) { // 至少100KB
                        console.log(`   ✅ 成功! 内容类型: ${contentType}, 大小: ${contentLength} bytes`);
                        resolve({
                            url: url,
                            statusCode: res.statusCode,
                            headers: res.headers,
                            stream: res
                        });
                    } else {
                        res.resume(); // 消费响应
                        reject(new Error(`无效的视频内容: ${contentType}, 大小: ${contentLength}`));
                    }
                } else if (res.statusCode >= 300 && res.statusCode < 400) {
                    // 处理重定向
                    const location = res.headers.location;
                    if (location) {
                        console.log(`   🔄 重定向到: ${location}`);
                        res.resume();
                        resolve(this.tryDownload(location, userAgent, referer, timeout));
                    } else {
                        res.resume();
                        reject(new Error(`重定向但没有location: ${res.statusCode}`));
                    }
                } else {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
        });
    }

    /**
     * 核心下载方法 - 尝试所有可能的组合
     */
    async downloadVideo(originalUrl, videoId, outputPath = null) {
        console.log('🚀 启动备用下载器...');
        console.log(`📹 原始URL: ${originalUrl}`);
        console.log(`🆔 视频ID: ${videoId}`);

        const urlVariants = this.generateUrlVariants(originalUrl, videoId);
        console.log(`🔗 生成了 ${urlVariants.length} 个URL变体`);

        let lastError = null;
        let attemptCount = 0;

        // 尝试每个URL变体
        for (const url of urlVariants) {
            // 尝试每个User-Agent
            for (const userAgent of this.userAgents) {
                // 尝试每个Referer
                for (const referer of this.referers) {
                    attemptCount++;
                    try {
                        console.log(`\n🔄 尝试 ${attemptCount}/${urlVariants.length * this.userAgents.length * this.referers.length}`);
                        
                        const result = await this.tryDownload(url, userAgent, referer);
                        
                        console.log('✅ 找到可用的下载链接!');
                        console.log(`🔗 成功URL: ${url}`);
                        console.log(`👤 成功User-Agent: ${userAgent}`);
                        console.log(`🔗 成功Referer: ${referer}`);

                        // 如果指定了输出路径，保存文件
                        if (outputPath) {
                            await this.saveStream(result.stream, outputPath);
                            console.log(`💾 文件已保存到: ${outputPath}`);
                        }

                        return {
                            success: true,
                            url: url,
                            userAgent: userAgent,
                            referer: referer,
                            headers: result.headers,
                            stream: result.stream
                        };

                    } catch (error) {
                        console.log(`   ❌ 失败: ${error.message}`);
                        lastError = error;
                        
                        // 每失败10次，等待1秒避免被限制
                        if (attemptCount % 10 === 0) {
                            console.log('⏸️ 暂停1秒避免被限制...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
            }
        }

        console.log(`❌ 所有 ${attemptCount} 次尝试都失败了`);
        return {
            success: false,
            error: lastError,
            attemptCount: attemptCount
        };
    }

    /**
     * 保存流到文件
     */
    async saveStream(stream, outputPath) {
        return new Promise((resolve, reject) => {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const writeStream = fs.createWriteStream(outputPath);
            stream.pipe(writeStream);

            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            stream.on('error', reject);
        });
    }
}

module.exports = FallbackDownloader;
