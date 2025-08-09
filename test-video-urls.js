// Video URL Structure Test
const fetch = require('node-fetch');
const { sign } = require('./bin/sign');

async function testVideoUrlGeneration(url) {
    console.log('🔍 Testing Video URL Generation for:', url);
    
    try {
        // Get video ID from redirect
        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual'
        });
        
        const location = response.headers.get('location');
        const videoIdMatch = location.match(/video\/(\d+)/);
        
        if (!videoIdMatch) {
            console.log('❌ Could not extract video ID');
            return;
        }
        
        const videoId = videoIdMatch[1];
        console.log('📹 Video ID:', videoId);
        
        // Get API data with proper a_bogus
        const baseApiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=110.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7158288523463362079&msToken=abL8SeUTPa9-EToD8qfC7toScSADxpg6yLh2dbNcpWHzE0bT04txM_4UwquIcRvkRb9IU8sifwgM1Kwf1Lsld81o9Irt2_yNyUbbQPSUO8EfVlZJ_78FckDFnwVBVUVK`;
        
        const urlParser = new URL(baseApiUrl);
        const query = urlParser.search.replace('?', '');
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        const a_bogus = await sign(query, userAgent);
        const apiUrl = baseApiUrl + "&a_bogus=" + a_bogus;
        
        // Test with updated cookie - you'll need to replace this
        const testCookie = 'sid_guard=eaf3cfd1fd30ba206ace29421e88b59b%7C1754657837%7C5184000%7CTue%2C+07-Oct-2025+12%3A57%3A17+GMT; sessionid_ss=your_session_id; msToken=your_ms_token; webid=your_webid;';
        
        const apiResponse = await fetch(apiUrl, {
            headers: {
                'accept-encoding': 'gzip, deflate, br',
                'User-Agent': userAgent,
                'referer': 'https://www.douyin.com/',
                'cookie': testCookie
            }
        });
        
        if (apiResponse.status !== 200) {
            console.log('❌ API Request failed:', apiResponse.status);
            return;
        }
        
        const data = await apiResponse.text();
        if (!data || data.length === 0) {
            console.log('❌ Empty API response - Cookie needs update!');
            console.log('📋 Update cookie in bin/index.js line 16');
            return;
        }
        
        const jsonData = JSON.parse(data);
        
        if (!jsonData.aweme_detail) {
            console.log('❌ No video data in response');
            return;
        }
        
        console.log('✅ Video data retrieved successfully');
        console.log('📊 Media type:', jsonData.aweme_detail.media_type);
        
        // Check video URL structure
        const video = jsonData.aweme_detail.video;
        if (!video) {
            console.log('❌ No video object found');
            return;
        }
        
        console.log('🎬 Video URL structure:');
        console.log('- play_addr exists:', !!video.play_addr);
        console.log('- url_list length:', video.play_addr?.url_list?.length || 0);
        
        if (video.play_addr?.url_list?.length > 0) {
            const originalUrl = video.play_addr.url_list[0];
            console.log('📹 Original URL:', originalUrl);
            
            // Test different URL transformation methods
            console.log('\n🔧 Testing URL transformations:');
            
            // Method 1: Current method
            const method1 = originalUrl.replace('/play/', '/playwm/');
            console.log('1. Current method (/play/ → /playwm/):', method1);
            
            // Method 2: Add watermark=0 parameter
            const method2 = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'watermark=0';
            console.log('2. Add watermark=0:', method2);
            
            // Method 3: Use different domain
            const method3 = originalUrl.replace('aweme.snssdk.com', 'aweme-eagle.snssdk.com');
            console.log('3. Different domain:', method3);
            
            // Method 4: Use video URI for construction
            const uri = video.play_addr.uri;
            console.log('4. Video URI:', uri);
            
            // Test URL accessibility
            console.log('\n🔍 Testing URL accessibility:');
            await testUrlAccess(method1, '1. Current method');
            await testUrlAccess(method2, '2. Watermark param');
            await testUrlAccess(method3, '3. Different domain');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testUrlAccess(url, name) {
    try {
        const response = await fetch(url, { 
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.douyin.com/'
            }
        });
        console.log(`   ${name}: ${response.status} ${response.status === 200 ? '✅' : response.status === 403 ? '❌ 403' : '⚠️'}`);
    } catch (error) {
        console.log(`   ${name}: ❌ Error - ${error.message}`);
    }
}

// Test the problematic link
testVideoUrlGeneration('https://v.douyin.com/WDtp40Neqts/');
