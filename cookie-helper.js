/**
 * Cookie更新助手脚本
 * 
 * 使用方法：
 * 1. 访问 https://www.douyin.com
 * 2. 按F12打开开发者工具
 * 3. 在Console中执行以下代码获取cookie信息
 */

console.log('=== 抖音Cookie更新助手 ===');

// 获取所有相关的cookie
function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const importantCookies = [
    'sid_guard',
    'sessionid', 
    'msToken',
    'webid',
    's_v_web_id',
    'ttwid'
];

console.log('重要Cookie值:');
const cookieParts = [];
importantCookies.forEach(name => {
    const value = getCookieValue(name);
    if (value) {
        console.log(`${name}: ${value}`);
        cookieParts.push(`${name}=${value}`);
    } else {
        console.log(`${name}: (未找到)`);
    }
});

const fullCookieString = cookieParts.join('; ') + ';';
console.log('\n完整Cookie字符串:');
console.log(fullCookieString);

// 检查URL参数
const webid = getCookieValue('webid');
const msToken = getCookieValue('msToken');

console.log('\nAPI URL参数更新:');
console.log(`webid=${webid || '需要获取'}`);
console.log(`msToken=${msToken || '需要获取'}`);

console.log('\n=== 更新指南 ===');
console.log('1. 复制上面的完整Cookie字符串');
console.log('2. 更新 bin/index.js 第16行的cookie值');
console.log('3. 更新 bin/index.js 第97行的webid和msToken参数');
console.log('4. 重启服务器: npm run dev');

module.exports = {
    getCookieValue,
    importantCookies,
    fullCookieString
};
