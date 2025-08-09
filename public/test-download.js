// 测试代理下载功能
const testVideoUrl = 'https://aweme.snssdk.com/aweme/v1/play/?video_id=v1e00fgi0000d2b9nnvog65mdajdqhc0&ratio=1080p&line=0';

// 模拟前端下载功能
function testDownloadMedia(url, index) {
  try {
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileName = `douyin_test_video_${timestamp}.mp4`;
    
    console.log('开始测试代理下载...');
    
    // 使用服务器代理下载，避免403错误
    const proxyUrl = `/proxy-download?${new URLSearchParams({
      url: url,
      filename: fileName
    })}`;
    
    console.log('代理URL:', proxyUrl);
    
    // 创建隐藏的下载链接
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    // 监听下载成功/失败
    const handleDownload = () => {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('下载完成');
    };
    
    // 先测试代理URL是否可用
    fetch(proxyUrl, { method: 'HEAD' })
      .then(response => {
        console.log('代理测试响应:', response.status, response.headers.get('Content-Type'));
        if (response.ok) {
          console.log('代理可用，开始下载');
          handleDownload();
        } else {
          throw new Error(`代理下载失败: ${response.status}`);
        }
      })
      .catch(error => {
        console.error('代理下载错误:', error);
      });
    
  } catch (error) {
    console.error('下载错误:', error);
  }
}

// 测试API响应格式
function testApiResponse() {
  const testData = {
    code: 0,
    data: {
      video: ['https://aweme.snssdk.com/aweme/v1/play/?video_id=v1e00fgi0000d2b9nnvog65mdajdqhc0&ratio=1080p&line=0'],
      img: [],
      debugMode: false,
      isImagesShare: false
    }
  };
  
  console.log('测试API响应:', testData);
  
  // 模拟前端处理
  if (testData.code === 0 && testData.data) {
    let allUrls = [];
    let urlsWithType = [];
    
    // 处理视频URL
    if (testData.data.video && Array.isArray(testData.data.video)) {
      testData.data.video.forEach(url => {
        allUrls.push(url);
        urlsWithType.push({ url: url, type: 'video' });
      });
    }
    
    // 处理图片URL  
    if (testData.data.img && Array.isArray(testData.data.img)) {
      testData.data.img.forEach(url => {
        allUrls.push(url);
        urlsWithType.push({ url: url, type: 'image' });
      });
    }
    
    console.log('处理后的URLs:', allUrls);
    console.log('带类型的URLs:', urlsWithType);
    
    return { allUrls, urlsWithType };
  }
}

// 运行测试
console.log('=== 测试开始 ===');
const result = testApiResponse();
if (result && result.allUrls.length > 0) {
  console.log('准备测试下载...');
  testDownloadMedia(result.allUrls[0], 0);
}
