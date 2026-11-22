const fetch = require('node-fetch')
const crypto = require('crypto')
const { sign } = require('./sign')
const getDeepProperty = require("@orange-opensource/get-deep-property");

const MOBILE_FEED_ENDPOINTS = [
    'https://api5-normal-c-hl.amemv.com/aweme/v1/feed/',
    'https://aweme.snssdk.com/aweme/v1/feed/',
];

const MOBILE_FEED_USER_AGENT =
    'com.ss.android.ugc.aweme/290101 (Linux; U; Android 10; zh_CN; Pixel 4; ' +
    'Build/QQ3A.200805.001; Cronet/TTNetVersion:5f9037be 2023-01-13 QuicVersion:4668bb42 2022-11-21)';

const SECSDK_WEBSIGN_CONST = 'A96D855A08C0A9707F8BEF0D9A527E4E';

const TOXIC_SECSDK_COOKIE_PATTERNS = [
    /^bd_ticket_guard/i,
    /^_bd_ticket_crypt_cookie$/i,
    /^__security/i,
    /^fpk\d*$/i,
    /^x_tt_token$/i,
    /^sdk_source_info$/i,
];

const isImagesAweme = (awemeDetail) => {
    if (!awemeDetail || typeof awemeDetail !== 'object') return false;
    if ([2, 42].includes(awemeDetail.media_type) || awemeDetail.aweme_type === 68) {
        return Array.isArray(awemeDetail.images) && awemeDetail.images.length > 0;
    }
    return Array.isArray(awemeDetail.images) && awemeDetail.images.length > 0 && !awemeDetail.video?.play_addr?.url_list?.length;
};

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
        if (!/^\d+$/.test(generateTimestampStr)) {
            result.error = `生成时间戳格式错误: ${generateTimestampStr}`;
            return result;
        }

        if (!/^\d+$/.test(validitySecondsStr)) {
            result.error = `有效期秒数格式错误: ${validitySecondsStr}`;
            return result;
        }

        const generateTimestamp = Number(generateTimestampStr);
        const validitySeconds = Number(validitySecondsStr);

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
        this.ttwidCache = null;
    }

    _matchVideoIdFromUrl(targetUrl) {
        if (!targetUrl || typeof targetUrl !== 'string') return null;
        if (targetUrl === 'https://www.douyin.com/' || targetUrl === 'https://www.douyin.com') {
            return null;
        }
        for (let j = 0; j < this.urlPatterns.length; j++) {
            const match = targetUrl.match(this.urlPatterns[j]);
            if (match) {
                return match[match.length - 1];
            }
        }
        return null;
    }

    _extractUifid(cookieString) {
        for (const envKey of ['DOUYIN_UIFID', 'DY_UIFID']) {
            const envVal = (process.env[envKey] || '').trim().replace(/^['"]|['"]$/g, '');
            if (envVal) return envVal;
        }
        if (!cookieString || typeof cookieString !== 'string') return '';
        const raw = cookieString.trim().replace(/^['"]|['"]$/g, '');
        if (!raw.includes('=') && raw.length >= 32) return raw;
        for (const pair of raw.split(';')) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            const k = pair.slice(0, eqIdx).trim().replace(/^['"]|['"]$/g, '').toUpperCase();
            const v = pair.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if ((k === 'UIFID' || k === 'UIFID_TEMP') && v) return v;
        }
        return '';
    }

    _sanitizeWebCookie(cookieString, ttwid) {
        const parts = [];
        let hasTtwid = false;
        if (cookieString && typeof cookieString === 'string' && !cookieString.includes('替换为您的sid_guard值')) {
            for (const pair of cookieString.split(';')) {
                const trimmed = pair.trim();
                if (!trimmed || !trimmed.includes('=')) continue;
                const name = trimmed.split('=', 1)[0].trim();
                if (TOXIC_SECSDK_COOKIE_PATTERNS.some((re) => re.test(name))) continue;
                if (name.toLowerCase() === 'ttwid') hasTtwid = true;
                parts.push(trimmed);
            }
        }
        if (!hasTtwid && ttwid) {
            parts.push(`ttwid=${ttwid}`);
        }
        return parts.join('; ');
    }

    _generateMsToken(length = 107) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const bytes = crypto.randomBytes(length);
        let out = '';
        for (let i = 0; i < length; i++) {
            out += chars[bytes[i] % chars.length];
        }
        return out;
    }

    _signSecSdk(url, uifid, ts = Math.floor(Date.now() / 1000)) {
        if (!uifid) return url;
        const qIdx = url.indexOf('?');
        const base = qIdx === -1 ? url : url.slice(0, qIdx);
        const query = qIdx === -1 ? '' : url.slice(qIdx + 1);

        const parts = [];
        const names = new Set();
        for (const pair of query.split('&')) {
            if (!pair) continue;
            const eqIdx = pair.indexOf('=');
            const rawK = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
            const rawV = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);
            let k = rawK;
            let v = rawV;
            try { k = decodeURIComponent(rawK.replace(/\+/g, ' ')); } catch (_) {}
            try { v = decodeURIComponent(rawV.replace(/\+/g, ' ')); } catch (_) {}
            names.add(k);
            parts.push(`${k}=${encodeURIComponent(v)}`);
        }
        if (!names.has('uifid')) {
            parts.push(`uifid=${encodeURIComponent(uifid)}`);
        }

        const signedQuery = `${parts.join('&')}&timestamp=${ts}`;
        const plain = `${uifid}_${ts}_${SECSDK_WEBSIGN_CONST}_${signedQuery}`;
        const signature = crypto.createHash('md5').update(plain, 'utf8').digest('hex');
        return `${base}?${signedQuery}&x-secsdk-web-signature=${signature}`;
    }

    async _getTtwid() {
        if (this.ttwidCache) return this.ttwidCache;
        try {
            const res = await fetch('https://ttwid.bytedance.com/ttwid/union/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    region: 'cn',
                    aid: 6383,
                    need_t: 1,
                    service: 'www.douyin.com',
                    migrate_priority: 0,
                    cb_url_protocol: 'https',
                    domain: '.douyin.com'
                }),
                timeout: 5000
            });
            const setCookies = res.headers.raw()['set-cookie'] || [];
            for (const c of setCookies) {
                const match = c.match(/ttwid=([^;]+)/);
                if (match && match[1]) {
                    this.ttwidCache = match[1];
                    return this.ttwidCache;
                }
            }
        } catch (e) {
            console.log('⚠️ 获取动态 ttwid 失败:', e.message);
        }
        return null;
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
                    // 先尝试 manual 重定向，直接从 Location 提取 videoId，避免下载整页 HTML
                    const manualRes = await fetch(url, {
                        headers,
                        redirect: 'manual',
                        timeout: 8000
                    });
                    const location = manualRes.headers.get('location');
                    const manualVideoId = this._matchVideoIdFromUrl(location);
                    if (manualVideoId) {
                        this._cacheVideoId(url, manualVideoId);
                        resolve(manualVideoId);
                        return;
                    }

                    const res = await fetch(url, {
                        headers,
                        redirect: 'follow', // 跟随重定向
                        timeout: 10000
                    });

                    if (!res?.url) {
                        continue;
                    }

                    const videoId = this._matchVideoIdFromUrl(res.url);
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
     * @description 通过移动端 Feed 接口获取作品详情（免 Argus 门禁、免 Cookie、免签名）
     * @param {string} videoId
     * @returns {Promise<object|null>}
     */
    async _getDouyinVideoDataFromMobileFeed(videoId) {
        const enableMobileFeed = (process.env.DOUYIN_ENABLE_MOBILE_FEED || '1').trim().toLowerCase();
        if (['0', 'false', 'no', 'off'].includes(enableMobileFeed)) {
            return null;
        }

        const headers = {
            'User-Agent': MOBILE_FEED_USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
        };

        for (const endpoint of MOBILE_FEED_ENDPOINTS) {
            try {
                const feedUrl = `${endpoint}?aweme_id=${encodeURIComponent(videoId)}&aid=1128`;
                const res = await fetch(feedUrl, { headers, timeout: 6000 });
                if (!res.ok) {
                    console.log(`⚠️ Mobile Feed (${endpoint}) HTTP ${res.status}`);
                    continue;
                }
                const text = await res.text();
                if (!text) continue;
                const json = JSON.parse(text);
                const awemeList = Array.isArray(json.aweme_list) ? json.aweme_list : [];
                const matched = awemeList.find(
                    (item) => item && String(item.aweme_id || item.id || '') === String(videoId)
                );
                if (matched) {
                    console.log(`✅【parser】移动端 Feed 通道获取视频数据成功 (${new URL(endpoint).hostname})`);
                    return {
                        status_code: 0,
                        aweme_detail: matched,
                        _source: 'mobile_feed'
                    };
                }
            } catch (err) {
                console.log(`⚠️ Mobile Feed (${endpoint}) 请求异常:`, err.message);
            }
        }
        return null;
    }

    /**
     * @description 备用通道：通过 PC Web Detail API 获取作品详情（支持 a_bogus + uifid/x-secsdk-web-signature）
     * @param {string} videoId
     * @returns {Promise<object>}
     */
    async _getDouyinVideoDataFromWebApi(videoId) {
        const msToken = this._generateMsToken(107);
        const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&msToken=${encodeURIComponent(msToken)}`;
        const urlParser = new URL(apiUrl);
        const query = urlParser.search.replace('?', '');
        const a_bogus = await sign(query, this.headers['User-Agent']);
        let finalUrl = `${apiUrl}&a_bogus=${encodeURIComponent(a_bogus)}`;

        const ttwid = await this._getTtwid();
        const uifid = this._extractUifid(this.douyinApiHeaders.cookie);
        const headers = {
            ...this.douyinApiHeaders,
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.douyin.com/video/${videoId}`,
            'cookie': this._sanitizeWebCookie(this.douyinApiHeaders.cookie, ttwid),
        };
        if (uifid) {
            headers['uifid'] = uifid;
            finalUrl = this._signSecSdk(finalUrl, uifid);
        }

        const res = await fetch(finalUrl, { headers, timeout: 10000 });
        const text = await res.text();

        if (!res.ok) {
            const preview = text.slice(0, 200).trim();
            console.log(`❌【DEBUG】Web API 返回 HTTP ${res.status}: ${preview}`);
            if (res.status === 403 && preview.includes('ArgusSecurityPlugin')) {
                throw new Error(`抖音Web接口触发风控拦截 (${preview})，请配置包含 UIFID 的完整 Cookie 或稍后重试`);
            }
            throw new Error(`抖音Web接口请求失败 (HTTP ${res.status})`);
        }

        try {
            const json = JSON.parse(text);
            if (!json || !json.aweme_detail) {
                const reason = json?.filter_detail?.detail_msg || json?.status_msg || '未返回有效视频数据';
                throw new Error(`解析失败: ${reason}`);
            }
            return json;
        } catch (parseError) {
            if (parseError.message && parseError.message.startsWith('解析失败:')) {
                throw parseError;
            }
            console.log('❌【DEBUG】JSON解析失败，可能是HTML错误页面或需要更新Cookie');
            throw new Error('Cookie已失效或触发风控，需要更新Cookie后重试');
        }
    }

    /**
     * @description get videoData by video id
     * @param {string} videoId
     * @returns {Promise<object>} videoData
     */
    async getDouyinVideoData(videoId) {
        // 1. 优先走移动端 Feed 核心通道（免 Argus 403、免 Cookie、免签名）
        const mobileData = await this._getDouyinVideoDataFromMobileFeed(videoId);
        if (mobileData && mobileData.aweme_detail) {
            return mobileData;
        }

        // 2. 兜底回退到 PC Web Detail API
        console.log('🔄【parser】移动端 Feed 未命中，回退到 Web Detail API...');
        return await this._getDouyinVideoDataFromWebApi(videoId);
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
        
        return zjcdnUrls;
    }

    async getDouyinNoWatermarkVideo(videoData) {
        let noWatermarkUrls = [];
        const isImagesShare = isImagesAweme(videoData?.aweme_detail)
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
module.exports.isImagesAweme = isImagesAweme;
