// Theme management
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Check for saved theme preference or default to 'light'
const currentTheme = localStorage.getItem('theme') || 'light';

// Apply the saved theme
if (currentTheme === 'dark') {
  body.setAttribute('data-theme', 'dark');
  themeToggle.textContent = '☀️';
}

// Theme toggle functionality
themeToggle.addEventListener('click', function() {
  const currentTheme = body.getAttribute('data-theme');
  
  if (currentTheme === 'dark') {
    body.setAttribute('data-theme', 'light');
    themeToggle.textContent = '🌙';
    localStorage.setItem('theme', 'light');
  } else {
    body.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
    localStorage.setItem('theme', 'dark');
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // 添加测试模式 - 直接显示原始链接区域进行测试
  const testMode = false; // 设置为 true 来启用测试模式
  
  if (testMode) {
    setTimeout(() => {
      console.log('测试模式：强制显示原始链接区域');
      forceShowRawLinks();
    }, 1000);
  }
  
  document
    .getElementById("submit")
    .addEventListener("click", function (e) {
      e.preventDefault();

      var videoUrl = document.getElementById("videoUrl").value;
      if (!videoUrl) {
        alert("请输入视频链接。");
        return;
      }

      const requestData = { url: videoUrl };
      const resultDom = document.getElementById("result");
      const loadingDom = document.getElementById("loading");
      const copyDom = document.getElementById("autocopy");
      const submitText = document.getElementById("submit-text");
      
      // Show loading state
      if (loadingDom) loadingDom.hidden = false;
      if (copyDom) copyDom.hidden = true;
      // 不要隐藏 resultDom，因为它是原始链接文本框
      // if (resultDom) resultDom.hidden = true;
      if (submitText) submitText.textContent = "解析中...";
      
      // 临时添加模拟数据进行测试
      const simulateSuccess = false; // 设置为 true 来使用模拟数据
      
      if (simulateSuccess) {
        console.log('使用模拟数据进行测试');
        
        // 模拟成功的API响应
        const mockData = {
          code: 0,
          data: [
            "https://example.com/video1.mp4",
            "https://example.com/image1.jpg",
            "https://example.com/video2.mp4"
          ]
        };
        
        // 模拟网络延迟
        setTimeout(() => {
          handleApiResponse(mockData);
        }, 1000);
        return; // 跳过实际的网络请求
      }
      
      // 首先尝试zjcdn API（最稳定）
      fetch("/zjcdn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log('✅ zjcdn API响应:', data);
          if (data.code === 0) {
            handleApiResponse(data);
          } else {
            throw new Error(data.msg || 'zjcdn API返回错误');
          }
        })
        .catch((error) => {
          console.error("zjcdn API失败，回退到workflow API:", error);
          
          // 检查是否是URL过期错误
          let errorMessage = error.message || '';
          if (errorMessage.includes('无法从任何用户代理获取videoId') || 
              errorMessage.includes('can\'t get videoId')) {
            showToast('⚠️ 链接可能已过期，请使用新的抖音分享链接', 'warning');
          }
          
          // 回退到workflow API
          fetch("/workflow", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              console.log('✅ workflow API响应:', data);
              handleApiResponse(data);
            })
            .catch((fallbackError) => {
              console.error("所有API都失败了!", fallbackError);
              if (loadingDom) loadingDom.hidden = true;
              if (submitText) submitText.textContent = "解析";
              
              // 显示更详细的错误信息
              let errorMsg = "解析失败";
              if (fallbackError.message.includes('无法从任何用户代理获取videoId') || 
                  fallbackError.message.includes('can\'t get videoId')) {
                errorMsg = "抖音链接已过期或无效，请使用新的分享链接";
              } else if (fallbackError.message.includes('网络')) {
                errorMsg = "网络连接失败，请检查网络连接";
              }
              
              showToast('❌ ' + errorMsg, 'error');
              resetInterface();
            });
        });
    });
});

// 处理API响应的函数
function handleApiResponse(data) {
  const loadingDom = document.getElementById("loading");
  const submitText = document.getElementById("submit-text");
  const copyDom = document.getElementById("autocopy");
  
  if (loadingDom) loadingDom.hidden = true;
  if (submitText) submitText.textContent = "解析";
  
  console.log('API Response:', data);
  
  if (data.code === 0 && data.data) {
    const debugMode = !!data.data.debugMode;
    let allUrls = [];
    let urlsWithType = []; // 新增：带类型信息的URL数组
    
    // 处理视频URL
    if (data.data.video && Array.isArray(data.data.video)) {
      data.data.video.forEach(url => {
        allUrls.push(url);
        urlsWithType.push({ url: url, type: 'video' });
      });
    }
    
    // 处理图片URL  
    if (data.data.img && Array.isArray(data.data.img)) {
      data.data.img.forEach(url => {
        allUrls.push(url);
        urlsWithType.push({ url: url, type: 'image' });
      });
    }
    
    // 兼容旧格式 - 如果data.data是数组
    if (Array.isArray(data.data)) {
      allUrls = data.data;
      // 对于旧格式，我们需要猜测类型
      urlsWithType = data.data.map(url => ({
        url: url,
        type: detectLinkType(url)
      }));
    }
    
    console.log('All URLs:', allUrls);
    
    if (allUrls.length > 0) {
      // 对于图片集，即使在非 debug 模式下也要显示所有图片
      // 只对纯视频链接进行过滤（保留第一个）
      const isImageShare = data.data.isImagesShare || (data.data.img && data.data.img.length > 0 && (!data.data.video || data.data.video.length === 0));
      
      if (!debugMode && allUrls.length > 1 && !isImageShare) {
        // 只有在非图片分享且非debug模式下，才过滤为第一个链接
        const videoUrls = urlsWithType.filter(item => item.type === 'video');
        const imageUrls = urlsWithType.filter(item => item.type === 'image');
        
        // 保留所有图片，但视频只保留第一个
        const filteredVideoUrls = videoUrls.length > 0 ? [videoUrls[0]] : [];
        urlsWithType = [...filteredVideoUrls, ...imageUrls];
        allUrls = urlsWithType.map(item => item.url);
      }
      // 填充原始链接区域（保留原有逻辑用于复制功能）
      const resultDom = document.getElementById("result");
      if (resultDom) {
        resultDom.value = allUrls.join(",\n");
      }
      
      // 生成分开的链接列表（使用类型信息）
  generateLinksListWithTypes(urlsWithType);
      
      // 显示原始链接区域，但复制按钮保持隐藏直到展开
      const rawLinksSection = document.getElementById("rawLinks");
      if (rawLinksSection) {
        rawLinksSection.hidden = false;
        // 确保样式正确应用
        rawLinksSection.style.display = 'block';
        console.log('Raw links section shown');
      } else {
        console.error('Raw links section not found!');
      }
      // 不自动显示复制按钮，等到用户点击展开时才显示
      if (copyDom) copyDom.hidden = true;
      
  // 显示媒体预览（非 debug 只显示一条也兼容）
  displayMediaPreview(allUrls);
      
      // 移动端友好的反馈
      if (window.innerWidth <= 768) {
        document.getElementById("mediaPreview").scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (!debugMode) {
        console.log('单链接模式（非debug），如需查看所有候选：添加 ?debug=1 或设置环境变量 DEBUG_VIDEO_URLS=1');
      }
    } else {
      console.error('No URLs found in response');
      alert("解析成功但没有找到媒体链接");
      resetInterface();
    }
  } else {
    console.error('Parse failed:', data);
    alert("解析失败，请检查链接是否正确");
    // 重置界面
    resetInterface();
  }
}

// 使用明确类型信息生成链接列表
function generateLinksListWithTypes(urlsWithType) {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;
  
  linksList.innerHTML = '';
  
  urlsWithType.forEach((item, index) => {
    const { url, type } = item;
    const isVideo = type === 'video';
    const isImage = type === 'image';
    
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    
    linkItem.innerHTML = `
      <span class="link-type-badge ${isVideo ? 'link-type-video' : 'link-type-image'}" id="badge-${index}">
        ${isVideo ? '🎬 视频' : '📸 图片'} ${index + 1}
      </span>
      <a href="${url}" target="_blank" class="link-url" title="点击在新标签页中打开">
        ${url}
      </a>
      <div class="link-actions">
        <button class="btn btn-sm btn-outline-primary" onclick="copySingleLink('${url}')" title="复制链接">
          📋 复制链接
        </button>
        <button class="btn btn-sm btn-outline-success" onclick="directDownloadFromUrl('${url}', ${index})" title="直接下载">
          ⬇️ 直接下载
        </button>
      </div>
    `;
    
    linksList.appendChild(linkItem);
    
    // 如果初始判断不确定，可以进行异步验证
    if (type === 'video' && detectLinkType(url) !== 'video') {
      verifyLinkType(url, index);
    }
  });
  
  console.log('Links with types populated successfully');
}

// 生成分开的链接列表（保留原函数作为备用）
function generateLinksList(urls) {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;
  
  linksList.innerHTML = '';
  
  urls.forEach((url, index) => {
    // 改进的文件类型判断逻辑
    const linkType = detectLinkType(url);
    const isVideo = linkType === 'video';
    const isImage = linkType === 'image';
    
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    
    // 生成唯一的链接ID
    const linkId = `link-${index}`;
    
    linkItem.innerHTML = `
      <span class="link-type-badge ${isVideo ? 'link-type-video' : 'link-type-image'}" id="badge-${index}">
        ${isVideo ? '🎬 视频' : '📸 图片'} ${index + 1}
      </span>
      <a href="${url}" target="_blank" class="link-url" title="点击在新标签页中打开">
        ${url}
      </a>
      <div class="link-actions">
        <button class="btn btn-sm btn-outline-primary" onclick="copySingleLink('${url}')" title="复制链接">
          � 复制链接
        </button>
        <button class="btn btn-sm btn-outline-success" onclick="directDownloadFromUrl('${url}', ${index})" title="直接下载">
          ⬇️ 直接下载
        </button>
      </div>
    `;
    
    linksList.appendChild(linkItem);
    
    // 异步验证文件类型
    verifyLinkType(url, index);
  });
  
  console.log('Links populated successfully');
}

// 改进的链接类型检测函数
function detectLinkType(url) {
  const urlLower = url.toLowerCase();
  
  // 明确的图片扩展名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const hasImageExtension = imageExtensions.some(ext => urlLower.includes(ext));
  
  // 明确的视频扩展名
  const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m3u8'];
  const hasVideoExtension = videoExtensions.some(ext => urlLower.includes(ext));
  
  // 如果有明确的扩展名，直接返回
  if (hasImageExtension) return 'image';
  if (hasVideoExtension) return 'video';
  
  // 基于URL路径和参数的判断
  if (urlLower.includes('/image/') || 
      urlLower.includes('img') || 
      urlLower.includes('photo') || 
      urlLower.includes('pic')) {
    return 'image';
  }
  
  if (urlLower.includes('/video/') || 
      urlLower.includes('aweme') || 
      urlLower.includes('play') || 
      urlLower.includes('stream')) {
    return 'video';
  }
  
  // 基于域名的判断
  if (urlLower.includes('p3-sign.douyinpic.com') || 
      urlLower.includes('p6-sign.douyinpic.com') ||
      urlLower.includes('p9-sign.douyinpic.com') ||
      urlLower.includes('douyinpic.com')) {
    return 'image';
  }
  
  if (urlLower.includes('aweme.snssdk.com') || 
      urlLower.includes('v.douyin.com') ||
      urlLower.includes('aweme') ||
      urlLower.includes('douyinvod.com')) {
    return 'video';
  }
  
  // 基于HTTP响应头的判断（异步，作为备选）
  // 这里我们先返回一个默认值，后面可以通过HEAD请求来确认
  
  // 如果都无法判断，默认根据索引位置和常见模式
  // 抖音通常先返回视频链接，后返回图片链接
  return 'video'; // 默认为视频
}

// 异步验证链接类型
async function verifyLinkType(url, index) {
  try {
    // 使用HEAD请求获取Content-Type，避免下载整个文件
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'cors'
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let actualType = 'video'; // 默认
      
      if (contentType.startsWith('image/')) {
        actualType = 'image';
      } else if (contentType.startsWith('video/')) {
        actualType = 'video';
      }
      
      // 更新标签显示
      updateLinkTypeBadge(index, actualType);
    }
  } catch (error) {
    // 如果HEAD请求失败，尝试其他方法
    console.log(`无法验证链接 ${index + 1} 的类型:`, error);
    
    // 可以尝试通过创建Image对象来检测图片
    if (!url.includes('.mp4') && !url.includes('video')) {
      const img = new Image();
      img.onload = () => {
        updateLinkTypeBadge(index, 'image');
      };
      img.onerror = () => {
        // 如果不是图片，保持为视频
      };
      img.src = url;
    }
  }
}

// 更新链接类型标签
function updateLinkTypeBadge(index, actualType) {
  const badge = document.getElementById(`badge-${index}`);
  if (!badge) return;
  
  const isVideo = actualType === 'video';
  const isImage = actualType === 'image';
  
  // 更新样式类
  badge.className = `link-type-badge ${isVideo ? 'link-type-video' : 'link-type-image'}`;
  
  // 更新文本内容
  badge.textContent = `${isVideo ? '🎬 视频' : '📸 图片'} ${index + 1}`;
  
  console.log(`链接 ${index + 1} 类型已更新为: ${actualType}`);
}

// 复制单个链接到剪贴板
function copySingleLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('📋 链接已复制', 'success');
    console.log('Link copied:', url);
  }).catch(err => {
    // 备用复制方法
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('📋 链接已复制', 'success');
    console.log('Link copied (fallback):', url);
  });
}



// 直接下载函数 - 仅使用直接下载
function directDownloadFromUrl(url, index) {
  try {
    // 生成时间戳和文件名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const mediaItem = document.querySelector(`[data-index="${index}"]`);
    const isImage = mediaItem && mediaItem.querySelector('img');
    const filePrefix = isImage ? 'douyin_image' : 'douyin_video';
    const fileName = `${filePrefix}_${timestamp}_${index + 1}${isImage ? '.jpg' : '.mp4'}`;
    
    console.log('⬇️ 服务器代理下载:', fileName);
    showToast('⬇️ 开始下载...', 'info');
    
    // 通过服务器代理下载，不是直接跳转链接
    const proxyUrl = `/proxy-download?${new URLSearchParams({
      url: url,
      filename: fileName
    })}`;
    
    // 创建下载链接，指向服务器代理端点
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('✅ 下载已启动', 'success');
      
  } catch (error) {
    console.error('下载错误:', error);
    showToast('❌ 下载失败: ' + error.message, 'error');
  }
}

// 获取真实URL函数
async function getRealUrl(url) {
  try {
    const response = await fetch(`/get-real-url?url=${encodeURIComponent(url)}`);
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        realUrl: result.realUrl,
        contentType: result.headers.contentType,
        contentLength: result.headers.contentLength
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 重置界面函数
function resetInterface() {
  const rawLinksSection = document.getElementById("rawLinks");
  const copyDom = document.getElementById("autocopy");
  const resultDom = document.getElementById("result");
  const mediaPreview = document.getElementById("mediaPreview");
  const linksList = document.getElementById("linksList");
  
  if (rawLinksSection) {
    rawLinksSection.hidden = true;
    rawLinksSection.style.display = 'none';
  }
  if (copyDom) copyDom.hidden = true;
  if (resultDom) resultDom.value = "";
  if (mediaPreview) mediaPreview.style.display = 'none';
  if (linksList) linksList.innerHTML = '';
  
  // 重置原始链接内容区域
  const rawLinksContent = document.getElementById('rawLinksContent');
  const rawLinksToggleText = document.getElementById('rawLinksToggleText');
  if (rawLinksContent) {
    rawLinksContent.style.display = 'none';
    rawLinksContent.classList.remove('expanded');
  }
  if (rawLinksToggleText) {
    rawLinksToggleText.textContent = '展开';
  }
  
  // 重置媒体项目
  currentMediaItems = [];
}

function copyTextToClipboard(textToCopy) {
  return new Promise((resolve, reject) => {
    const tempInput = document.createElement('input');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    tempInput.value = textToCopy;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      const successful = document.execCommand('copy');
      const msg = successful ? '成功' : '失败';
      resolve(msg)
    } catch (err) {
      reject(err)
    }
    document.body.removeChild(tempInput);
  })
}

function copyToClipboard() {
  var resultDom = document.getElementById("result");
  var textToCopy = resultDom.value;
  
  // 优先使用现代 clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy)
      .then(function () {
        showToast('📋 所有链接已复制', 'success');
        console.log('Links copied to clipboard');
      })
      .catch(function (error) {
        fallbackCopyTextToClipboard(textToCopy);
      });
  } else {
    fallbackCopyTextToClipboard(textToCopy);
  }
}

function fallbackCopyTextToClipboard(text) {
  copyTextToClipboard(text).then(function () {
    showToast('📋 所有链接已复制', 'success');
    console.log('Links copied to clipboard (fallback)');
  })
  .catch(function (error) {
    showToast('❌ 复制失败，请手动选择文本复制', 'error');
  });
}

// Media preview functionality
let currentViewMode = 'list';
let mediaUrls = [];

function displayMediaPreview(urls) {
  mediaUrls = urls;
  const previewContainer = document.getElementById("mediaPreview");
  const mediaContainer = document.getElementById("mediaContainer");
  
  if (!urls || urls.length === 0) {
    previewContainer.hidden = true;
    return;
  }
  
  previewContainer.hidden = false;
  
  // 在移动端自动启用全屏模式
  if (window.innerWidth <= 768) {
    enableMobileFullscreen();
  }
  
  mediaContainer.innerHTML = '<div class="media-loading"><div class="spinner-border" role="status"></div><span class="ms-2">正在加载预览...</span></div>';
  
  // 检测每个URL的媒体类型并创建预览
  Promise.all(urls.map((url, index) => checkMediaType(url, index)))
    .then(mediaItems => {
      displayMediaItems(mediaItems);
    })
    .catch(error => {
      console.error('Error loading media:', error);
      mediaContainer.innerHTML = '<div class="no-media">⚠️ 无法加载媒体预览</div>';
    });
}

function checkMediaType(url, index) {
  return new Promise((resolve) => {
    // 智能URL分析 - 基于URL特征判断媒体类型，避免403错误
    const urlLower = url.toLowerCase();
    
    // 视频URL特征识别
    const videoIndicators = [
      '.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', // 扩展名
      'mime_type=video', '/video/', // 路径特征
      'zjcdn.com', 'tiktokcdn.com', 'ixigua.com', // 抖音视频CDN
      'v3-dy-o', 'v5-hl-hw-ov', 'v9-dy', 'v26-dy', // 抖音CDN前缀
      'video_id=', 'aweme_id=', // 视频参数
      'btag=', 'dy_q=', 'feature_id=' // 抖音特有参数
    ];
    
    // 图片URL特征识别
    const imageIndicators = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', // 扩展名
      'douyinpic.com', 'p3-pc-sign', 'p1-pc-sign', // 抖音图片CDN
      'aweme-avatar', 'tos-cn-p-', // 图片路径特征
      'image/', 'pic/', 'avatar/' // 通用图片路径
    ];
    
    // 检查视频特征
    const isVideo = videoIndicators.some(indicator => urlLower.includes(indicator));
    
    // 检查图片特征
    const isImage = imageIndicators.some(indicator => urlLower.includes(indicator));
    
    if (isVideo) {
      // 识别为视频，直接返回而不进行网络请求
      resolve({
        url: url,
        type: 'video',
        index: index,
        loaded: true,
        source: 'url-analysis'
      });
      return;
    }
    
    if (isImage) {
      // 识别为图片，尝试加载获取尺寸（图片通常没有CORS限制）
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const timeout = setTimeout(() => {
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: true, // 即使加载失败，也认为是有效图片
          source: 'url-analysis-timeout'
        });
      }, 2000); // 缩短超时时间
      
      img.onload = function() {
        clearTimeout(timeout);
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: true,
          width: this.naturalWidth,
          height: this.naturalHeight,
          source: 'image-loaded'
        });
      };
      
      img.onerror = function() {
        clearTimeout(timeout);
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: true, // 仍然认为是图片，只是加载失败
          source: 'image-error'
        });
      };
      
      img.src = url;
      return;
    }
    
    // 如果无法确定类型，根据URL长度和复杂度进行推断
    if (urlLower.includes('?') && url.length > 200) {
      // 长URL且有参数，通常是视频
      resolve({
        url: url,
        type: 'video',
        index: index,
        loaded: true,
        source: 'heuristic-video'
      });
    } else {
      // 简短URL，可能是图片
      resolve({
        url: url,
        type: 'image',
        index: index,
        loaded: true,
        source: 'heuristic-image'
      });
    }
  });
}

function displayMediaItems(mediaItems) {
  const mediaContainer = document.getElementById("mediaContainer");
  mediaContainer.className = `media-container ${currentViewMode}-view`;
  
  if (mediaItems.length === 0) {
    mediaContainer.innerHTML = '<div class="no-media">📭 没有找到媒体内容</div>';
    return;
  }
  
  const itemsHtml = mediaItems.map((item, index) => {
    let mediaContent;
    
    if (item.type === 'image') {
      mediaContent = `<img src="${item.url}" alt="图片 ${index + 1}" onclick="handleMediaClick(${index}, '${item.type}')" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                      <div style="display:none; padding: 2rem; text-align: center; background: var(--card-bg); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️</div>
                        <div>图片加载失败</div>
                        <button onclick="retryLoadMedia('${item.url}', ${index})" class="btn btn-sm btn-outline-primary mt-2">重试</button>
                      </div>`;
    } else {
      mediaContent = `<video controls preload="metadata" onclick="handleMediaClick(${index}, '${item.type}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                       <source src="${item.url}" type="video/mp4">
                       您的浏览器不支持视频播放。
                     </video>
                     <div style="display:none; padding: 2rem; text-align: center; background: var(--card-bg); border-radius: 8px;">
                       <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎬</div>
                       <div>视频加载失败</div>
                       <button onclick="retryLoadMedia('${item.url}', ${index})" class="btn btn-sm btn-outline-primary mt-2">重试</button>
                     </div>`;
    }
    
    const mediaInfo = item.type === 'image' && item.loaded && item.width && item.height
      ? `<div class="media-info">📸 图片 • ${item.width} × ${item.height}px</div>`
      : `<div class="media-info">${item.type === 'image' ? '📸 图片' : '🎬 视频'}</div>`;
    
    return `
      <div class="media-item" data-index="${index}" data-type="${item.type}" data-url="${item.url}" onclick="handleMediaItemClick(event, ${index}, '${item.type}')">
        <div class="media-type">${item.type === 'image' ? '📸 图片' : '🎬 视频'} ${index + 1}</div>
        <button class="media-download-btn" onclick="event.stopPropagation(); downloadMedia('${item.url}', ${index})" title="下载">
          ⬇️
        </button>
        <div class="media-content">
          ${mediaContent}
        </div>
        ${mediaInfo}
        <div class="media-actions mt-2">
          <button class="btn btn-sm btn-outline-primary me-2" onclick="event.stopPropagation(); copySingleLink('${item.url}')" title="复制链接">
            🔗 复制链接
          </button>
          <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); downloadMedia('${item.url}', ${index})" title="下载文件">
            ⬇️ 下载
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  mediaContainer.innerHTML = itemsHtml;
}

function retryLoadMedia(url, index) {
  const mediaItem = document.querySelector(`[data-index="${index}"]`);
  if (!mediaItem) return;
  
  const mediaContent = mediaItem.querySelector('.media-content');
  mediaContent.innerHTML = '<div class="media-loading"><div class="spinner-border spinner-border-sm" role="status"></div><span class="ms-2">重新加载中...</span></div>';
  
  // 重新检测媒体类型并加载
  checkMediaType(url, index).then(item => {
    setTimeout(() => {
      if (item.type === 'image') {
        mediaContent.innerHTML = `<img src="${item.url}" alt="图片 ${index + 1}" onclick="openLightbox(${index})" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                  <div style="display:none; padding: 2rem; text-align: center; background: var(--card-bg); border-radius: 8px;">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️</div>
                                    <div>图片加载失败</div>
                                  </div>`;
      } else {
        mediaContent.innerHTML = `<video controls preload="metadata" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                   <source src="${item.url}" type="video/mp4">
                                   您的浏览器不支持视频播放。
                                 </video>
                                 <div style="display:none; padding: 2rem; text-align: center; background: var(--card-bg); border-radius: 8px;">
                                   <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎬</div>
                                   <div>视频加载失败</div>
                                 </div>`;
      }
    }, 500);
  });
}

function toggleView(viewMode) {
  currentViewMode = viewMode;
  const buttons = document.querySelectorAll('.btn-group .btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  if (viewMode === 'list') {
    buttons[0].classList.add('active');
  } else {
    buttons[1].classList.add('active');
  }
  
  if (mediaUrls.length > 0) {
    // 重新渲染媒体项目
    checkMediaType();
    Promise.all(mediaUrls.map((url, index) => checkMediaType(url, index)))
      .then(mediaItems => {
        displayMediaItems(mediaItems);
      });
  }
}

function downloadMedia(url, index) {
  // 将 downloadMedia 重定向到 directDownloadFromUrl
  directDownloadFromUrl(url, index);
}



// 下载进度状态
let downloadProgress = {
  total: 0,
  completed: 0,
  inProgress: false
};

// 批量下载所有媒体
async function downloadAllMedia() {
  if (!currentMediaItems || currentMediaItems.length === 0) {
    showToast('❌ 没有可下载的媒体文件', 'error');
    return;
  }
  
  if (downloadProgress.inProgress) {
    showToast('⏳ 下载任务进行中，请等待完成', 'warning');
    return;
  }
  
  const totalItems = currentMediaItems.length;
  downloadProgress = { total: totalItems, completed: 0, inProgress: true };
  
  showToast(`🚀 开始批量下载 ${totalItems} 个文件...`, 'info');
  updateBulkDownloadProgress();
  
  for (let i = 0; i < currentMediaItems.length; i++) {
    try {
      downloadMedia(currentMediaItems[i].url, i);
      downloadProgress.completed++;
      updateBulkDownloadProgress();
      
      // 每次下载后稍微延迟，避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error(`下载第 ${i + 1} 个文件失败:`, error);
    }
  }
  
  downloadProgress.inProgress = false;
  showToast(`🎉 批量下载完成！`, 'success');
  hideBulkDownloadProgress();
}

// 批量下载图片
async function downloadImages() {
  if (!currentMediaItems || currentMediaItems.length === 0) {
    showToast('❌ 没有可下载的媒体文件', 'error');
    return;
  }
  
  const imageItems = currentMediaItems.filter(item => item.type === 'image');
  
  if (imageItems.length === 0) {
    showToast('❌ 没有找到图片文件', 'error');
    return;
  }
  
  if (downloadProgress.inProgress) {
    showToast('⏳ 下载任务进行中，请等待完成', 'warning');
    return;
  }
  
  const totalItems = imageItems.length;
  downloadProgress = { total: totalItems, completed: 0, inProgress: true };
  
  showToast(`🖼️ 开始下载 ${totalItems} 张图片...`, 'info');
  updateBulkDownloadProgress();
  
  for (let i = 0; i < imageItems.length; i++) {
    try {
      const originalIndex = currentMediaItems.indexOf(imageItems[i]);
      downloadMedia(imageItems[i].url, originalIndex);
      downloadProgress.completed++;
      updateBulkDownloadProgress();
      
      // 每次下载后稍微延迟
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (error) {
      console.error(`下载第 ${i + 1} 张图片失败:`, error);
    }
  }
  
  downloadProgress.inProgress = false;
  showToast(`🎉 图片下载完成！`, 'success');
  hideBulkDownloadProgress();
}

// 批量下载视频
async function downloadVideos() {
  if (!currentMediaItems || currentMediaItems.length === 0) {
    showToast('❌ 没有可下载的媒体文件', 'error');
    return;
  }
  
  const videoItems = currentMediaItems.filter(item => item.type === 'video');
  
  if (videoItems.length === 0) {
    showToast('❌ 没有找到视频文件', 'error');
    return;
  }
  
  if (downloadProgress.inProgress) {
    showToast('⏳ 下载任务进行中，请等待完成', 'warning');
    return;
  }
  
  const totalItems = videoItems.length;
  downloadProgress = { total: totalItems, completed: 0, inProgress: true };
  
  showToast(`🎬 开始下载 ${totalItems} 个视频...`, 'info');
  updateBulkDownloadProgress();
  
  for (let i = 0; i < videoItems.length; i++) {
    try {
      const originalIndex = currentMediaItems.indexOf(videoItems[i]);
      downloadMedia(videoItems[i].url, originalIndex);
      downloadProgress.completed++;
      updateBulkDownloadProgress();
      
      // 视频文件更大，延迟稍长
      await new Promise(resolve => setTimeout(resolve, 1200));
    } catch (error) {
      console.error(`下载第 ${i + 1} 个视频失败:`, error);
    }
  }
  
  downloadProgress.inProgress = false;
  showToast(`🎉 视频下载完成！`, 'success');
  hideBulkDownloadProgress();
}

// 更新批量下载进度
function updateBulkDownloadProgress() {
  const bulkActions = document.getElementById('bulkActions');
  if (!bulkActions || !downloadProgress.inProgress) return;
  
  let progressDiv = document.getElementById('downloadProgress');
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.id = 'downloadProgress';
    progressDiv.className = 'download-progress mt-3';
    bulkActions.appendChild(progressDiv);
  }
  
  const percentage = Math.round((downloadProgress.completed / downloadProgress.total) * 100);
  progressDiv.innerHTML = `
    <div class="progress mb-2" style="height: 8px;">
      <div class="progress-bar bg-primary progress-bar-striped progress-bar-animated" 
           style="width: ${percentage}%"></div>
    </div>
    <div class="text-center">
      <small class="text-muted">下载进度: ${downloadProgress.completed}/${downloadProgress.total} (${percentage}%)</small>
    </div>
  `;
}

// 隐藏批量下载进度
function hideBulkDownloadProgress() {
  const progressDiv = document.getElementById('downloadProgress');
  if (progressDiv) {
    setTimeout(() => {
      progressDiv.remove();
    }, 3000); // 3秒后移除进度条
  }
}

function showToast(message, type = 'success') {
  // 创建toast容器（如果不存在）
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1500;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  
  // 设置不同类型的颜色
  if (type === 'error') {
    toast.style.background = '#dc3545';
  } else if (type === 'info') {
    toast.style.background = '#17a2b8';
  } else if (type === 'warning') {
    toast.style.background = '#ffc107';
    toast.style.color = '#212529';
  } else {
    toast.style.background = '#28a745';
  }
  
  // 添加到容器顶部
  toastContainer.insertBefore(toast, toastContainer.firstChild);
  
  // 触发动画
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
      // 如果容器为空，也移除容器
      if (toastContainer.children.length === 0 && document.body.contains(toastContainer)) {
        document.body.removeChild(toastContainer);
      }
    }, 300);
  }, 3000);
}

// Lightbox functionality
let currentImageIndex = 0;
let lightboxImages = [];

function openLightbox(imageIndex) {
  // 获取所有图片URL
  const imageItems = mediaUrls.map((url, index) => {
    const mediaItem = document.querySelector(`[data-index="${index}"]`);
    if (mediaItem && mediaItem.querySelector('img')) {
      return { url, index };
    }
    return null;
  }).filter(item => item !== null);
  
  if (imageItems.length === 0) return;
  
  // 找到对应的图片索引
  const actualImageIndex = imageItems.findIndex(item => item.index === imageIndex);
  if (actualImageIndex === -1) return;
  
  lightboxImages = imageItems.map(item => item.url);
  currentImageIndex = actualImageIndex;
  
  showLightbox();
}

function showLightbox() {
  let lightbox = document.getElementById('lightbox');
  
  if (!lightbox) {
    // 创建lightbox元素
    lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <span class="lightbox-close">&times;</span>
      <span class="lightbox-nav lightbox-prev" onclick="previousImage()">❮</span>
      <span class="lightbox-nav lightbox-next" onclick="nextImage()">❯</span>
      <img id="lightbox-img" src="" alt="">
    `;
    document.body.appendChild(lightbox);
    
    // 添加事件监听器
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
        closeLightbox();
      }
    });
    
    // 键盘导航
    document.addEventListener('keydown', function(e) {
      if (lightbox.classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') previousImage();
        if (e.key === 'ArrowRight') nextImage();
      }
    });
  }
  
  const lightboxImg = document.getElementById('lightbox-img');
  lightboxImg.src = lightboxImages[currentImageIndex];
  lightbox.classList.add('active');
  
  // 显示/隐藏导航箭头
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  prevBtn.style.display = lightboxImages.length > 1 ? 'block' : 'none';
  nextBtn.style.display = lightboxImages.length > 1 ? 'block' : 'none';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
  }
}

function previousImage() {
  if (lightboxImages.length > 1) {
    currentImageIndex = (currentImageIndex - 1 + lightboxImages.length) % lightboxImages.length;
    document.getElementById('lightbox-img').src = lightboxImages[currentImageIndex];
  }
}

function nextImage() {
  if (lightboxImages.length > 1) {
    currentImageIndex = (currentImageIndex + 1) % lightboxImages.length;
    document.getElementById('lightbox-img').src = lightboxImages[currentImageIndex];
  }
}

// 初始化默认视图
document.addEventListener("DOMContentLoaded", function() {
  // 设置默认的列表视图为激活状态
  const listBtn = document.querySelector('.btn-group .btn:first-child');
  if (listBtn) {
    listBtn.classList.add('active');
  }
});

// Raw links toggle functionality
function toggleRawLinks() {
  const content = document.getElementById('rawLinksContent');
  const toggleText = document.getElementById('rawLinksToggleText');
  const copyButton = document.getElementById('autocopy');
  
  console.log('Toggle raw links clicked, content:', content); // 调试日志
  
  if (!content || !toggleText) {
    console.error('Raw links elements not found');
    return;
  }
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    content.classList.add('expanded');
    toggleText.textContent = '收起';
    // 展开时显示一键复制按钮
    if (copyButton) copyButton.hidden = false;
    console.log('Raw links expanded'); // 调试日志
  } else {
    content.style.display = 'none';
    content.classList.remove('expanded');
    toggleText.textContent = '展开';
    // 收起时隐藏一键复制按钮
    if (copyButton) copyButton.hidden = true;
    console.log('Raw links collapsed'); // 调试日志
  }
}

// 调试函数 - 强制显示原始链接
function forceShowRawLinks() {
  const rawLinksSection = document.getElementById("rawLinks");
  const resultDom = document.getElementById("result");
  
  if (rawLinksSection) {
    rawLinksSection.hidden = false;
    rawLinksSection.style.display = 'block';
    console.log('Force showing raw links section');
  }
  
  if (resultDom) {
    resultDom.value = "测试链接1\n测试链接2\n测试链接3";
    console.log('Test links populated');
  }
  
  // 生成测试链接列表
  const testUrls = [
    { url: "https://example.com/video1.mp4", type: "video" },
    { url: "https://example.com/image1.jpg", type: "image" },
    { url: "https://example.com/video2.mp4", type: "video" }
  ];
  generateLinksListWithTypes(testUrls);
  
  // 展开链接内容
  const rawLinksContent = document.getElementById('rawLinksContent');
  const rawLinksToggleText = document.getElementById('rawLinksToggleText');
  if (rawLinksContent) {
    rawLinksContent.style.display = 'block';
    rawLinksContent.classList.add('expanded');
  }
  if (rawLinksToggleText) {
    rawLinksToggleText.textContent = '收起';
  }
}

// 在控制台中可以调用: forceShowRawLinks()
console.log('调试提示: 在控制台中输入 forceShowRawLinks() 来强制显示原始链接部分');

// 移动端全屏预览功能
function enableMobileFullscreen() {
  if (window.innerWidth <= 768) {
    const previewContainer = document.getElementById("mediaPreview");
    previewContainer.classList.add('fullscreen-mobile');
    
    // 添加退出全屏的点击事件
    const exitButton = document.createElement('button');
    exitButton.innerHTML = '❌ 退出全屏';
    exitButton.className = 'btn btn-sm btn-secondary exit-fullscreen-btn';
    exitButton.style.cssText = 'position: absolute; top: 1rem; left: 1rem; z-index: 2002;';
    exitButton.onclick = disableMobileFullscreen;
    
    previewContainer.appendChild(exitButton);
  }
}

// 处理媒体点击事件
function handleMediaClick(index, type) {
  // 如果是移动端
  if (window.innerWidth <= 768) {
    const previewContainer = document.getElementById("mediaPreview");
    
    // 如果当前不在全屏模式，进入全屏
    if (!previewContainer.classList.contains('fullscreen-mobile')) {
      enableMobileFullscreen();
    } else {
      // 如果已经在全屏模式，对于图片打开lightbox
      if (type === 'image') {
        openLightbox(index);
      }
      // 对于视频，让其正常播放（不做额外处理）
    }
  } else {
    // 桌面端：直接打开lightbox（仅对图片）
    if (type === 'image') {
      openLightbox(index);
    }
  }
}

// 处理媒体项点击事件
function handleMediaItemClick(event, index, type) {
  // 防止在按钮上的点击触发
  if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
    return;
  }
  
  // 如果是移动端且不在全屏模式
  if (window.innerWidth <= 768) {
    const previewContainer = document.getElementById("mediaPreview");
    
    if (!previewContainer.classList.contains('fullscreen-mobile')) {
      // 进入全屏模式
      enableMobileFullscreen();
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

function disableMobileFullscreen() {
  const previewContainer = document.getElementById("mediaPreview");
  const exitButton = previewContainer.querySelector('.exit-fullscreen-btn');
  
  previewContainer.classList.remove('fullscreen-mobile');
  if (exitButton) {
    exitButton.remove();
  }
}

// 监听屏幕旋转和窗口大小变化
window.addEventListener('resize', function() {
  const previewContainer = document.getElementById("mediaPreview");
  
  if (window.innerWidth > 768 && previewContainer.classList.contains('fullscreen-mobile')) {
    disableMobileFullscreen();
  }
});

// ESC键退出全屏模式
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const previewContainer = document.getElementById("mediaPreview");
    if (previewContainer.classList.contains('fullscreen-mobile')) {
      disableMobileFullscreen();
    }
  }
});
