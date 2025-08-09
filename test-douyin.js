// 测试抖音API的简单脚本
const fetch = require('node-fetch');
const { sign } = require('./bin/sign');

async function testDouyinLink(url) {
    console.log('测试链接:', url);
    
    // 首先获取重定向后的真实链接
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual'
        });
        
        const location = response.headers.get('location');
        console.log('重定向链接:', location);
        
        if (location) {
            // 从location中提取video_id
            const videoIdMatch = location.match(/video\/(\d+)/);
            if (videoIdMatch) {
                const videoId = videoIdMatch[1];
                console.log('视频ID:', videoId);
                
                // 构建API URL
                const baseApiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=110.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7158288523463362079&msToken=abL8SeUTPa9-EToD8qfC7toScSADxpg6yLh2dbNcpWHzE0bT04txM_4UwquIcRvkRb9IU8sifwgM1Kwf1Lsld81o9Irt2_yNyUbbQPSUO8EfVlZJ_78FckDFnwVBVUVK`;
                
                const urlParser = new URL(baseApiUrl);
                const query = urlParser.search.replace('?', '');
                const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                
                console.log('正在生成a_bogus签名...');
                const a_bogus = await sign(query, userAgent);
                console.log('a_bogus签名:', a_bogus);
                
                const apiUrl = baseApiUrl + "&a_bogus=" + a_bogus;
                console.log('完整API URL:', apiUrl);
                
                // 测试API请求
                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'accept-encoding': 'gzip, deflate, br',
                        'User-Agent': userAgent,
                        'referer': 'https://www.douyin.com/',
                        'cookie': 'sid_guard=eaf3cfd1fd30ba206ace29421e88b59b%7C1754657837%7C5184000%7CTue%2C+07-Oct-2025+12%3A57%3A17+GMT;'
                    }
                });
                
                console.log('API响应状态:', apiResponse.status);
                
                if (apiResponse.status === 200) {
                    const data = await apiResponse.text();
                    console.log('API响应内容长度:', data.length);
                    
                    // 尝试解析JSON
                    if (data && data.length > 0) {
                        try {
                            const jsonData = JSON.parse(data);
                            console.log('解析后的JSON:');
                            console.log('- status_code:', jsonData.status_code);
                            console.log('- aweme_detail存在:', !!jsonData.aweme_detail);
                            if (jsonData.aweme_detail) {
                                console.log('- 视频标题:', jsonData.aweme_detail.desc);
                                console.log('- 视频播放地址存在:', !!jsonData.aweme_detail.video);
                            }
                        } catch (e) {
                            console.log('JSON解析失败:', e.message);
                            console.log('原始数据前200字符:', data.substring(0, 200));
                        }
                    } else {
                        console.log('收到空响应');
                    }
                } else {
                    console.log('API请求失败，状态码:', apiResponse.status);
                    const errorText = await apiResponse.text();
                    console.log('错误响应:', errorText);
                }
            }
        }
        
    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

// 测试你提供的链接
testDouyinLink('https://v.douyin.com/WDtp40Neqts/');
