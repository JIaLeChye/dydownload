const fetch = require('node-fetch')
const { sign } = require('./sign')
const getDeepProperty = require("@orange-opensource/get-deep-property");

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

/**
 * 格式化剩余时间为易读格式
 */
const formatRemainingTime = (seconds) => {
    if (seconds <= 0) return '已过期';

    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}秒`);

    return parts.length > 0 ? parts.join('') : '即将过期';
};

/**
 * 检测 sid_guard 是否过期
 */
const checkSidGuardExpiry = (sidGuard) => {
    const result = {
        isValid: false,
        isExpired: true,
        error: null,
        details: {
            sessionId: null,
            generateTimestamp: null,
            expiryTimestamp: null,
            validitySeconds: null,
            gmtTime: null,
            currentTimestamp: null,
            // remainingSeconds: 0,
            remainingTime: null
        }
    };

    try {

        const parts = sidGuard.split('|');
        if (parts.length !== 4) {
            result.error = `sid_guard 格式错误，应包含4个部分，实际包含${parts.length}个部分`;
            return result;
        }

        const [sessionId, generateTimestampStr, validitySecondsStr, gmtTime] = parts;
        const generateTimestamp = parseInt(generateTimestampStr);
        const validitySeconds = parseInt(validitySecondsStr);

        if (isNaN(generateTimestamp)) {
            result.error = `生成时间戳格式错误: ${generateTimestampStr}`;
            return result;
        }

        if (isNaN(validitySeconds)) {
            result.error = `有效期秒数格式错误: ${validitySecondsStr}`;
            return result;
        }

        // 计算真正的过期时间：生成时间 + 有效期
        const expiryTimestamp = generateTimestamp + validitySeconds;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const remainingSeconds = expiryTimestamp - currentTimestamp;

        result.details = {
            sessionId: sessionId.trim(),
            generateTimestamp: generateTimestamp,
            expiryTimestamp: expiryTimestamp,
            validitySeconds: validitySeconds,
            gmtTime: gmtTime.trim(),
            currentTimestamp: currentTimestamp,
            remainingSeconds: remainingSeconds,
            remainingTime: formatRemainingTime(remainingSeconds)
        };

        result.isExpired = remainingSeconds <= 0;
        result.isValid = !result.isExpired;

        if (result.isExpired) {
            result.error = `sid_guard 已过期 ${Math.abs(remainingSeconds)} 秒`;
        }

    } catch (error) {
        result.error = `解析 sid_guard 时出错: ${error.message}`;
    }

    return result;
};

class Scraper {

    constructor() {
        this.headers = { // sign 需要的参数
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
        };

        this.douyinApiHeaders = {
            'accept-encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'referer': 'https://www.douyin.com/',
            'cookie': process.env.DOUYIN_COOKIE || 'sid_guard=替换为您的sid_guard值;'
            // 其他请求头
        };
        
        // Precompile regex patterns for better performance
        this.urlPatterns = [
            /(slides|video|note)\/(\d+)/, // 原有模式
            /\/video\/(\d+)/, // 简单video模式
            /\/note\/(\d+)/, // note模式
            /\/slides\/(\d+)/, // slides模式
            /aweme_id[=:](\d+)/, // 查询参数模式
            /\/(\d{19})/, // 19位数字ID
            /\/(\d{18})/, // 18位数字ID
            /\/(\d{17})/, // 17位数字ID
        ];
        
        this.urlRegex = new RegExp('http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+');
        
        // Simple cache for video IDs
        this.videoIdCache = new Map();
        this.cacheMaxSize = 100;
    }

    /**
     * 🚀 动态更新Cookie - 无需重新部署！
     * @param {string} newCookie - 新的Cookie值
     */
    updateCookie(newCookie) {
        if (!newCookie || typeof newCookie !== 'string') {
            throw new Error('Cookie值无效');
        }
        
        // 更新douyinApiHeaders中的cookie
        this.douyinApiHeaders.cookie = newCookie.trim();
        
        console.log('🍪 Cookie已动态更新，立即生效！[Cookie: ' + maskSensitiveInfo(newCookie) + ']');
        return true;
    }

    /**
     * 获取当前Cookie状态
     */
    getCurrentCookie() {
        return this.douyinApiHeaders.cookie;
    }

    /**
     * @description get videoId by share url
     * @param {string} url 
     * @returns {Promise<string>} videoId
     */
    getVideoIdByShareUrl(url) {
        // Check cache first
        if (this.videoIdCache.has(url)) {
            return Promise.resolve(this.videoIdCache.get(url));
        }
        
        // 尝试多种用户代理
        const userAgents = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        return new Promise(async (resolve, reject) => {
            for (let i = 0; i < userAgents.length; i++) {
                const userAgent = userAgents[i];

                const headers = {
                    authority: 'v.douyin.com',
                    'user-agent': userAgent,
                }
                
                try {
                    const res = await fetch(url, {
                        headers,
                        redirect: 'follow', // 跟随重定向
                        timeout: 10000
                    });

                    if (!res?.url) {

                        continue;
                    }
                    
                    // 如果重定向到主页，尝试下一个用户代理
                    if (res.url === 'https://www.douyin.com/' || res.url === 'https://www.douyin.com') {

                        continue;
                    }
                    
                    // Use precompiled patterns
                    let videoId = null;
                    let matchedPattern = '';
                    
                    for (let j = 0; j < this.urlPatterns.length; j++) {
                        const match = res.url.match(this.urlPatterns[j]);
                        if (match) {
                            videoId = match[match.length - 1]; // 取最后一个捕获组
                            matchedPattern = `Pattern ${j + 1}`;

                            break;
                        }
                    }
                    
                    if (videoId) {
                        // Cache the result
                        this._cacheVideoId(url, videoId);

                        resolve(videoId);
                        return;
                    } else {
                        console.log('❌ 当前用户代理无法匹配videoId，尝试下一个');
                        continue;
                    }
                    
                } catch (fetchError) {
                    console.log('❌ 当前用户代理Fetch错误:', fetchError.message);
                    continue;
                }
            }
            
            // 所有用户代理都尝试失败
            console.log('❌ 所有用户代理都无法获取有效的videoId');
            reject(new Error(`无法从任何用户代理获取videoId。请检查URL是否有效或已过期。URL: ${url}`));
        });
    }
    
    /**
     * @private
     * Cache video ID with size limit using proper LRU strategy
     */
    _cacheVideoId(url, videoId) {
        // Remove if already exists to update access order
        if (this.videoIdCache.has(url)) {
            this.videoIdCache.delete(url);
        }
        
        // Limit cache size - remove least recently used (first in Map)
        if (this.videoIdCache.size >= this.cacheMaxSize) {
            const firstKey = this.videoIdCache.keys().next().value;
            this.videoIdCache.delete(firstKey);
        }
        
        // Add to end (most recently used)
        this.videoIdCache.set(url, videoId);
    }
    /**
     * @description get sec_user_id by shared home page url
     * @param {string} url 用户主页分享地址 
     * @returns {string} sec_user_id
     */
    getUserSecUidByShareUrl(url) {
        const headers = {
            authority: 'v.douyin.com',
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
        }
        return new Promise((resolve, reject) => {
            // Use precompiled regex
            const matchUrl = url.match(this.urlRegex);
            if (!matchUrl || !matchUrl[0]) {
                reject('输入链接没有解析到地址')
            } else {
                fetch(matchUrl[0], headers).then((res) => {
                    if (!res?.url) reject('地址有误')
                    try {
                        const userSplitArr = new URL(res.url).pathname.split('user')
                        const sec_user_id = userSplitArr[userSplitArr.length - 1].replace('/', '')
                        resolve(sec_user_id)
                    } catch (e) {
                        reject('获取sec_uid失败')
                    }
                })
            }
        })
    }

    /**
    * @description get douyin videoId by url
    * @param {string} url 
    * @returns {string} videoId
    */
    async getDouyinVideoId(url) {

        // 首先尝试从URL中直接提取可能的videoId
        const directIdMatch = url.match(/(\d{19}|\d{18}|\d{17})/);
        if (directIdMatch) {

            // 验证这个ID是否有效
            try {
                const testData = await this.getDouyinVideoData(directIdMatch[0]);
                if (testData && testData.aweme_detail) {

                    return directIdMatch[0];
                }
            } catch (e) {
                console.log('⚠️ 直接提取的videoId验证失败，继续常规解析');
            }
        }
        
        // Use precompiled regex
        const relUrl = url.match(this.urlRegex);
        
        if (!relUrl || !relUrl[0]) {
            console.log('❌ URL格式不正确:', url);
            throw new Error("输入链接没有解析到地址")
        }
        
        console.log('🔗 提取到的URL:', relUrl[0]);
        
        try {
            let videoId = await this.getVideoIdByShareUrl(relUrl[0]);

            return videoId;
        } catch (error) {
            console.log('❌ 获取VideoId失败:', error.message);
            
            // 最后尝试：如果是v.douyin.com的链接，尝试手动解析
            if (relUrl[0].includes('v.douyin.com')) {
                const shortCode = relUrl[0].split('/').pop();
                console.log('🔄 尝试解析短链接代码:', shortCode);
                
                // 这里可以实现更高级的短链接解析逻辑
                // 暂时抛出原始错误
            }
            
            throw error;
        }
    }
    /**
     * @description get videoData by video id
     * @param {string} videoId
     * @returns {object}v videoData
     */
    async getDouyinVideoData(videoId) {
        let apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=110.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7158288523463362079&msToken=abL8SeUTPa9-EToD8qfC7toScSADxpg6yLh2dbNcpWHzE0bT04txM_4UwquIcRvkRb9IU8sifwgM1Kwf1Lsld81o9Irt2_yNyUbbQPSUO8EfVlZJ_78FckDFnwVBVUVK`;
        const urlParser = new URL(apiUrl)
        const query = urlParser.search.replace('?', '')
        console.log('【parser】query参数：', query, 'User-agent：', this.headers['User-Agent'])
        const a_bogus = await sign(query, this.headers['User-Agent'])
        console.log('【parser】 生成的a_bogus签名为: ' + a_bogus)
        const new_url = apiUrl + "&a_bogus=" + a_bogus
        console.log('【parser】 正在获取视频数据: \n')
        try {
            const res = await fetch(new_url, {
                headers: this.douyinApiHeaders
            })
            
            const text = await res.text();
            
            try {
                const json = JSON.parse(text);
                return json;
            } catch (parseError) {
                console.log('❌【DEBUG】JSON解析失败，可能是HTML错误页面或需要更新Cookie');
                throw new Error('Cookie已失效，需要更新Cookie后重试');
            }
        } catch (e) {
           throw new Error(e);
        }
        // return new Promise((resolve, reject) => {
        //     fetch(new_url, {
        //         headers: this.douyinApiHeaders
        //     }).then((res) => res.json())
        //         .then(json => {
        //             resolve(json)
        //         })
        //         .catch(err => reject(err));
        // })
    }

    /**
     * @description parser no watermark video url
     * @param {object} videoData 
     * @returns {string}
     */
    /**
     * @description 获取zjcdn直链（最稳定的下载方式）
     * @param {object} videoData 
     * @returns {string[]}
     */
    async getZjcdnDirectUrls(videoData) {
        const zjcdnUrls = [];
        
        try {
            const video = videoData.aweme_detail.video;
            if (!video) return zjcdnUrls;
            
            // 打印调试信息

            console.log('   play_addr:', video.play_addr?.url_list?.slice(0, 2));
            console.log('   download_addr:', video.download_addr?.url_list?.slice(0, 2));
            
            // 从play_addr中查找zjcdn链接
            const playUrls = video.play_addr?.url_list || [];
            const downloadUrls = video.download_addr?.url_list || [];
            
            // 合并所有可能的URL
            const allUrls = [...playUrls, ...downloadUrls];
            
            // 筛选出zjcdn域名的URL
            const zjcdnDirects = allUrls.filter(url => url && url.includes('zjcdn.com'));
            
            if (zjcdnDirects.length > 0) {

                zjcdnDirects.forEach((url, index) => {
                    console.log(`   ${index + 1}. ${url.substring(0, 120)}...`);
                });
                zjcdnUrls.push(...zjcdnDirects);
            } else {
                console.log('⚠️ 未找到zjcdn直链，尝试其他zjcdn变体');
                
                // 从其他URL中提取可能的信息来构建zjcdn链接
                const firstUrl = allUrls[0] || '';
                console.log('   参考URL:', firstUrl.substring(0, 120) + '...');
                
                // 尝试从URL中提取hash或ID
                const urlPattern = /\/([a-f0-9]{32})\//;
                const hashMatch = firstUrl.match(urlPattern);
                const videoUri = video.play_addr?.uri || '';
                
                if (hashMatch || videoUri) {
                    const hash = hashMatch ? hashMatch[1] : '';
                    const simpleVideoId = videoUri.replace(/^video\//, '');
                    
                    console.log('   提取hash:', hash);
                    console.log('   video_id:', simpleVideoId);
                    
                    // 尝试构建zjcdn变体
                    const zjcdnVariants = [];
                    
                    if (hash) {
                        zjcdnVariants.push(
                            firstUrl.replace(/https:\/\/[^\/]+/, 'https://v5-dy-o-abtest.zjcdn.com'),
                            firstUrl.replace(/https:\/\/[^\/]+/, 'https://v3-dy-o.zjcdn.com'),
                            firstUrl.replace(/https:\/\/[^\/]+/, 'https://v6-dy-o.zjcdn.com')
                        );
                    }
                    
                    if (zjcdnVariants.length > 0) {
                        console.log('📝 构建zjcdn变体:', zjcdnVariants.length, '个');
                        zjcdnUrls.push(...zjcdnVariants);

                    }
                    console.log('🔗 可能的zjcdn链接列表:', zjcdnUrls.length);

                }
            }
            
        } catch (error) {
            console.error('❌ 获取zjcdn链接失败:', error.message);
        }
        
        return x;
    }

    async getDouyinNoWatermarkVideo(videoData) {
        let noWatermarkUrls = [];
        const isImagesShare = [2, 42].includes(videoData.aweme_detail.media_type)
        if (!isImagesShare) {
            const video = videoData.aweme_detail.video;
            if (!video?.play_addr?.url_list?.length) {
                console.log('❌ No video URL found in data');
                return noWatermarkUrls;
            }
            
            const originalUrl = video.play_addr.url_list[0]; // 通常已经是无水印播放地址 (play)
            const videoUri = video.play_addr.uri;            // e.g. video/tos/...   或  v0d00fg1...
            console.log('🎬 Original URL:', originalUrl);
            console.log('🆔 Video URI:', videoUri);

            // 构建候选 URL （由高 -> 低优先级）
            const candidates = [];

            // 1) 最高优先级：获取zjcdn直链
            const zjcdnUrls = await this.getZjcdnDirectUrls(videoData);
            if (zjcdnUrls.length > 0) {
                candidates.push(...zjcdnUrls);

            }

            // 2) 如果原始URL就是zjcdn域名，确保在最前面
            if (originalUrl.includes('zjcdn.com')) {
                candidates.unshift(originalUrl);
            }

            // 3) 如果拿到的是带水印的 playwm 则转换为 play
            if (originalUrl.includes('/playwm/')) {
                candidates.push(originalUrl.replace('/playwm/', '/play/'));
            } else if (!originalUrl.includes('zjcdn.com')) {
                candidates.push(originalUrl); // 原始URL（非zjcdn时添加）
            }

            // 4) 标准 API 形式：aweme/snssdk play 接口（备用）
            try {
                const simpleVideoId = videoUri.replace(/^video\//, '');
                candidates.push(`https://aweme.snssdk.com/aweme/v1/play/?video_id=${simpleVideoId}&ratio=1080p&line=0`);
            } catch (e) {}

            // 去重 + 过滤非法
            let unique = [...new Set(candidates)].filter(u => u && u.startsWith('http'));

            // 优先去掉明显带水印的 (playwm) 版本；如果全部都是 playwm 则保留
            const noWatermarkPreferred = unique.filter(u => !/\/playwm\//.test(u));
            if (noWatermarkPreferred.length) unique = noWatermarkPreferred;

            // 简单排序：更短（通常参数少，稳定）优先
            unique.sort((a,b) => a.length - b.length);

            // 稳定接口优先模式（仅返回 aweme.snssdk.com 标准接口）
            const stableOnly = process.env.STABLE_VIDEO_ONLY === '1';
            if (stableOnly) {
                const stable = unique.find(u => u.includes('aweme.snssdk.com/aweme/v1/play'));
                if (stable) unique = [stable];
            }

            // 如果配置要求只返回单个链接（.env 设置 SINGLE_VIDEO_URL=1）
            const single = process.env.SINGLE_VIDEO_URL === '1';
            if (!stableOnly && single && unique.length > 1) {
                unique = [unique[0]];
            }

            console.log('🔗 Final candidate URLs:', unique.length, `${stableOnly ? '[stable-only] ' : ''}${(!stableOnly && single) ? '(single mode)' : ''}`);
            noWatermarkUrls = unique;
        } else {
            // 图片分享
            console.log('📸 正在获取图片数据: \n')
            let images = videoData?.aweme_detail?.images
            
            // 打印图片URL信息
            if (images && images.length > 0) {
                console.log('   图片数量:', images.length);
                console.log('   图片URL列表:');
                images.forEach((img, index) => {
                    if (img?.url_list && img.url_list.length > 0) {
                        const maxSizePicIndex = img.url_list.length - 1;
                        const imageUrl = img.url_list[maxSizePicIndex];
                        console.log(`   ${index + 1}. ${imageUrl.substring(0, 120)}...`);
                    }
                });
            } else {
                console.log('⚠️ 未找到图片数据');
            }
            
            noWatermarkUrls = images.map(i => {
                if (!i?.url_list) return null
                const maxSizePicIndex = i?.url_list.length - 1
                return i?.url_list[maxSizePicIndex]
            }).filter(i => i)
        }
        return noWatermarkUrls;
    }

    /**
     * @description parser watermark video url
     * @param {object} videoData 
     * @returns {string}
     */
    async getDouyinWatermarkVideo(videoData) {
        return videoData.aweme_detail.video.download_addr.url_list[0];
    }

    async getDouyinImageUrls(videoData) {
        return videoData.aweme_detail.video.cover.url_list[0]
    }

    async parserVideoData(videoData) {
        const authInfo = getDeepProperty(videoData, 'aweme_detail.author')
        const video = getDeepProperty(videoData, 'aweme_detail.video')
        console.log(authInfo, video)
    }

    /**
     * @description Replaces all special characters in the string (including Spaces)/替换字符串中的所有特殊字符（包含空格）
     * @date 2024/1/4 - 19:45:52
     * @param {*} string
     * @returns {*}
     */
    trimSpecial(string) {
        if (string != "") {
            const pattern = /[`~!@ᓚᘏᗢ‧˚₊♡$^\-&*()=|{}':;',\\\[\]\.<>\/?~！@ᓚᘏᗢ‧˚₊♡￥……&*（）——|{}【】'；：""'。，、？\s]/g;
            string = string.replace(pattern, "");
        }
        return string
    }
    /**
     * @description get video url by videoData
     * @date 2024/1/4 - 19:24:04
     * @async
     * @param {string} videoId
     * @returns {string} videoUrl
     */
    async getVideoUrl(videoId, videoName, authorName) {
        const videoData = await this.getDouyinVideoData(videoId)
        let url = await this.getDouyinNoWatermarkVideo(videoData);
        let name = `${authorName}-${videoName}`
        name = this.trimSpecial(name)
        return { url, name }
    }

    /**
     * @description get author all videos
     * @param {string} sec_user_id 
     */
    async getHomeVideos(sec_user_id) {
        return new Promise(async (resolve, reject) => {
            let result = []
            let maxCursor = 0
            let awemeLen = 1;
            do {
               try {
                let apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/post/?sec_user_id=${sec_user_id}&count=35&max_cursor=${maxCursor}&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;
                const urlParser = new URL(apiUrl)
                const query = urlParser.search.replace('?', '')
                const xbogus = sign(query, this.headers['User-Agent'])
                const new_url = apiUrl + "&X-Bogus=" + xbogus
                const headers = JSON.parse(JSON.stringify(this.douyinApiHeaders))
                // headers.cookie += 'sessionid=your_sessionid_here'
                const res = await fetch(new_url, { headers })
                const data = await res.json()
                const { aweme_list, max_cursor } = data
                if (max_cursor) maxCursor = max_cursor
                awemeLen = aweme_list.length
                result = result.concat(aweme_list)
                // 间隔一定随机时间防止被ban 
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
               } catch (e) {}
            } while (awemeLen > 0)
            const authorName = getDeepProperty(result, '0.author.nickname')
            // download to local media dir
            // const videoIds = result.map(i => this.getVideoUrl(i.aweme_id, i.desc, authorName))
            // get download info
            const viodes = result.map(i => this.getVideoUrl(i.aweme_id, i.desc, authorName))
            Promise.allSettled(viodes).then((results) => {
                // const isHasFailed = results.filter(res => res.status === 'rejected')
                // console.log(isHasFailed.map(i => i.value))
                const data = results.filter(res => res.status === 'fulfilled').map(i => i.value)
                resolve(data)
            })
        })
    }

    /**
     * @description 获取今天的视频
     * @param {string} sec_user_id 用户id
     */
    async getTodayVideo(sec_user_id) { }
}

module.exports = Scraper;
module.exports.maskSensitiveInfo = maskSensitiveInfo;
module.exports.formatRemainingTime = formatRemainingTime;
module.exports.checkSidGuardExpiry = checkSidGuardExpiry;
