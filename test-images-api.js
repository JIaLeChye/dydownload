// 测试API响应
const url = 'http://localhost:3000/douyin';
const testData = {
    url: 'https://v.douyin.com/WDtp40Neqts/'
};

fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
    console.log('API Response:');
    console.log('Code:', data.code);
    console.log('Debug Mode:', data.data?.debugMode);
    console.log('Is Images Share:', data.data?.isImagesShare);
    console.log('Video URLs:', data.data?.video?.length || 0);
    console.log('Image URLs:', data.data?.img?.length || 0);
    
    if (data.data?.img?.length > 0) {
        console.log('First few image URLs:');
        data.data.img.slice(0, 3).forEach((url, i) => {
            console.log(`${i + 1}:`, url.substring(0, 80) + '...');
        });
    }
})
.catch(error => {
    console.error('Error:', error);
});
