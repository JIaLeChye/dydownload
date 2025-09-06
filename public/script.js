// Theme management
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// Global variables
let currentMediaItems = [];

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

// 自动调整 textarea 高度
function autoResize(textarea) {
  // 重置高度以获取正确的 scrollHeight
  textarea.style.height = 'auto';
  
  // 计算最小高度（约3行）和最大高度（约10行）
  const minHeight = 96; // 6rem = 96px (约3行)
  const maxHeight = 240; // 15rem = 240px (约10行)
  
  // 获取内容需要的高度
  const scrollHeight = textarea.scrollHeight;
  
  // 设置高度，在最小值和最大值之间
  const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
  textarea.style.height = newHeight + 'px';
}

// 初始化 textarea 自动调整功能
document.addEventListener('DOMContentLoaded', function() {
  const videoUrlTextarea = document.getElementById('videoUrl');
  
  if (videoUrlTextarea) {
    // 监听输入事件
    videoUrlTextarea.addEventListener('input', function() {
      autoResize(this);
    });
    
    // 监听粘贴事件
    videoUrlTextarea.addEventListener('paste', function() {
      // 粘贴后稍微延迟调整高度，确保内容已经粘贴完成
      setTimeout(() => {
        autoResize(this);
      }, 10);
    });
    
    // 初始调整高度
    autoResize(videoUrlTextarea);
  }
});

document.addEventListener("DOMContentLoaded", function () {
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
      const loadingDom = document.getElementById("loading");
      const submitText = document.getElementById("submit-text");
      
      // Show loading state
      if (loadingDom) loadingDom.hidden = false;
      if (submitText) submitText.textContent = "解析中...";
      
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
  
  if (loadingDom) loadingDom.hidden = true;
  if (submitText) submitText.textContent = "解析";

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
      

      
  // 显示媒体预览（非 debug 只显示一条也兼容）
  displayMediaPreview(allUrls);
      
      // 移动端友好的反馈
      if (window.innerWidth <= 768) {
        document.getElementById("mediaPreview").scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (!debugMode) {

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

}



// 直接下载函数 - 视频文件强制使用代理下载
function downloadMedia(url, index, isBatchDownload = false) {
  try {
    // 尝试获取文件扩展名，改进扩展名检测
    let extension = '';
    
    // 方法1: 从URL参数中检测
    if (url.includes('.mp4')) {
      extension = '.mp4';
    } else if (url.includes('.jpg') || url.includes('.jpeg')) {
      extension = '.jpg';
    } else if (url.includes('.png')) {
      extension = '.png';
    } else {
      // 方法2: 从URL路径中提取
      const urlMatch = url.match(/\.([a-zA-Z0-9]{2,4})(\?|$)/);
      if (urlMatch) {
        extension = '.' + urlMatch[1];
      } else {
        // 默认扩展名
        extension = '.mp4';
      }
    }

    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');

    // 确定文件类型
    const mediaItem = document.querySelector(`[data-index="${index}"]`);
    const isImage = mediaItem && mediaItem.querySelector('img');
    const filePrefix = isImage ? 'douyin_image' : 'douyin_video';
    const fileName = `${filePrefix}_${timestamp}_${index + 1}${extension}`;

    // 检查是否为视频文件（包括 zjcdn 域名和 mp4 扩展名）
    const isVideoFile = !isImage && (
      url.includes('.mp4') || 
      url.includes('zjcdn.com') || 
      url.includes('video') ||
      extension === '.mp4'
    );

    // 视频文件直接使用代理下载，避免 403 错误
    if (isVideoFile) {
      if (!isBatchDownload) {
        showToast('🔄 视频文件使用服务器代理下载', 'info');
      }
      proxyDownload(url, fileName, isBatchDownload);
      return;
    }

    // 图片文件尝试直接下载
    if (!isBatchDownload) {
      showToast('📥 开始下载图片...', 'info');
    }

    // 使用 fetch 下载文件
    fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Accept': '*/*'
      },
      credentials: 'omit'
    })
      .then(response => {
        if (!response.ok) {
          // 检查具体的HTTP错误状态
          if (response.status === 403) {
            throw new Error('访问被拒绝 (403 Forbidden)');
          } else if (response.status === 404) {
            throw new Error('文件不存在 (404 Not Found)');
          } else {
            throw new Error(`网络响应错误: ${response.status} ${response.statusText}`);
          }
        }
        return response.blob();
      })
      .then(blob => {
        // 创建下载链接
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理内存
        window.URL.revokeObjectURL(downloadUrl);
        
        if (!isBatchDownload) {
          showToast('✅ 下载完成', 'success');
        }
      })
      .catch(error => {
        console.error('直接下载失败:', error);
        if (!isBatchDownload) {
          showToast(`⚠️ 直接下载失败: ${error.message}，尝试服务器代理下载...`, 'warning');
        }
        
        // 如果下载失败，则回退到服务器代理下载
        proxyDownload(url, fileName, isBatchDownload);
      });
    
  } catch (error) {
    console.error('下载初始化失败:', error);
    if (!isBatchDownload) {
      showToast('❌ 下载失败，尝试服务器代理下载...', 'warning');
    }
    
    // 如果连初始化都失败，直接使用代理下载
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const fileName = `douyin_media_${timestamp}_${index + 1}.mp4`;
    proxyDownload(url, fileName, isBatchDownload);
  }
}

function proxyDownload(url, fileName, isBatchDownload = false) {
  try {
    // 使用服务器代理下载

    // 构建代理下载URL
    const proxyUrl = `/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`;
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (!isBatchDownload) {
      showToast('🔄 使用服务器代理下载', 'info');
    }
    
  } catch (error) {
    console.error('代理下载也失败:', error);
    if (!isBatchDownload) {
      showToast('❌ 代理下载失败，尝试直接打开链接', 'error');
    }
    
    // 最后的回退方案：直接打开链接
    finalFallbackDownload(url, fileName, isBatchDownload);
  }
}

function finalFallbackDownload(url, fileName, isBatchDownload = false) {
  // 最终回退方案：直接创建下载链接
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 重置界面函数
function resetInterface() {
  const mediaPreview = document.getElementById("mediaPreview");
  
  if (mediaPreview) mediaPreview.style.display = 'none';
  
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
  const batchDownloadBtn = document.getElementById("batchDownloadBtn");
  
  // 保存当前媒体项目到全局变量
  currentMediaItems = mediaItems;
  
  mediaContainer.className = `media-container ${currentViewMode}-view`;
  
  // 显示/隐藏一键下载按钮 - 文件数量达到10个或以上时显示
  if (mediaItems.length >= 10) {
    batchDownloadBtn.style.display = 'inline-block';
    batchDownloadBtn.style.visibility = 'visible';
    batchDownloadBtn.style.setProperty('display', 'inline-block', 'important');
  } else {
    batchDownloadBtn.style.display = 'none';
    batchDownloadBtn.style.visibility = 'hidden';
    batchDownloadBtn.style.setProperty('display', 'none', 'important');
  }
  
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
      // 使用代理URL来避免403错误
      const proxyVideoUrl = `/proxy-video?url=${encodeURIComponent(item.url)}`;
      mediaContent = `<video controls preload="metadata" onclick="handleMediaClick(${index}, '${item.type}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                       <source src="${proxyVideoUrl}" type="video/mp4">
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
        <button class="media-download-btn" onclick="event.stopPropagation(); downloadMedia('${item.url}', ${index})" title="智能下载（视频自动使用代理）">
          ⬇️
        </button>
        <div class="media-content">
          ${mediaContent}
        </div>
        ${mediaInfo}
        <div class="media-actions mt-2">
          <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); downloadMedia('${item.url}', ${index})" title="智能下载（视频自动使用代理）">
            ⬇️ 智能下载
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
        // 使用代理URL来避免403错误
        const proxyVideoUrl = `/proxy-video?url=${encodeURIComponent(item.url)}`;
        mediaContent.innerHTML = `<video controls preload="metadata" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                   <source src="${proxyVideoUrl}" type="video/mp4">
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
  
  const batchDownloadBtn = document.getElementById("batchDownloadBtn");
  const totalItems = currentMediaItems.length;
  downloadProgress = { total: totalItems, completed: 0, inProgress: true };
  
  // 开始下载状态
  batchDownloadBtn.classList.add('downloading');
  batchDownloadBtn.innerHTML = '<span class="download-progress-indicator"></span>📥 下载中...';
  updateDownloadProgress(0);
  
  // 显示底部进度条而不是toast
  showDownloadProgress(totalItems);
  
  for (let i = 0; i < currentMediaItems.length; i++) {
    try {
      downloadMedia(currentMediaItems[i].url, i, true); // 传入true表示批量下载
      downloadProgress.completed++;
      
      // 更新圆形进度条
      const progressPercent = (downloadProgress.completed / downloadProgress.total) * 100;
      updateDownloadProgress(progressPercent);
      
      // 更新底部进度条
      updateBottomProgress(downloadProgress.completed, downloadProgress.total);
      
      // 每次下载后稍微延迟，避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error(`下载第 ${i + 1} 个文件失败:`, error);
    }
  }
  
  downloadProgress.inProgress = false;
  
  // 完成状态
  batchDownloadBtn.classList.remove('downloading');
  batchDownloadBtn.innerHTML = '<span class="download-progress-indicator"></span>📥 一键下载';
  
  // 显示完成状态并延迟隐藏进度条
  updateBottomProgress(downloadProgress.total, downloadProgress.total, true);
  setTimeout(() => {
    hideDownloadProgress();
  }, 2000);
}

// 更新圆形进度条
function updateDownloadProgress(percent) {
  const progressIndicator = document.querySelector('.download-progress-indicator');
  if (progressIndicator) {
    progressIndicator.style.setProperty('--progress', percent);
  }
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
      downloadMedia(imageItems[i].url, originalIndex, true); // 批量下载图片
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
      downloadMedia(videoItems[i].url, originalIndex, true); // 批量下载视频
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
  // 检查是否是移动端
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // 移动端使用底部通知
    showMobileToast(message, type);
  } else {
    // 桌面端使用右上角通知
    showDesktopToast(message, type);
  }
}

function showMobileToast(message, type = 'success') {
  // 创建移动端toast容器（如果不存在）
  let mobileToastContainer = document.getElementById('mobile-toast-container');
  if (!mobileToastContainer) {
    mobileToastContainer = document.createElement('div');
    mobileToastContainer.id = 'mobile-toast-container';
    document.body.appendChild(mobileToastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = `mobile-toast ${type}`;
  toast.textContent = message;
  
  // 添加到容器
  mobileToastContainer.appendChild(toast);
  
  // 触发动画
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (mobileToastContainer.contains(toast)) {
        mobileToastContainer.removeChild(toast);
      }
    }, 300);
  }, 2500); // 移动端显示时间稍短
}

function showDesktopToast(message, type = 'success') {
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

// Cookie Update Functionality
class CookieManager {
  constructor() {
    this.modal = document.getElementById('cookieModal');
    this.statusBtn = document.getElementById('cookie-status-btn');
    this.closeBtn = document.querySelector('.cookie-modal-close');
    this.cancelBtn = document.getElementById('cookie-cancel-btn');
    this.saveBtn = document.getElementById('cookie-save-btn');
    this.textarea = document.getElementById('cookie-textarea');
    this.status = document.getElementById('cookie-status');
    this.vercelCheckbox = document.getElementById('update-vercel-env');
    this.vercelStatus = document.getElementById('vercel-config-status');
    
    // Modal内的状态显示元素
    this.modalStatusInfo = document.getElementById('cookie-status-info');
    this.modalStatusText = document.getElementById('modal-status-text');
    this.modalStatusIcon = document.getElementById('modal-status-icon');
    this.modalCookieSource = document.getElementById('modal-cookie-source');
    this.modalCookieRemaining = document.getElementById('modal-cookie-remaining');
    this.modalCookieValidity = document.getElementById('modal-cookie-validity');
    
    this.vercelConfig = null;
    this.statusCheckInterval = null; // 定期检查 sid_guard 状态的定时器
    
    this.init();
  }
  
  init() {
    // 绑定圆形按钮点击事件
    if (this.statusBtn) {
      this.statusBtn.addEventListener('click', () => this.openModal());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeModal());
    }
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.closeModal());
    }
    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveCookie());
    }
    
    // 点击模态框背景关闭
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('show')) {
        this.closeModal();
      }
    });
    
    // 文本框自动调整高度
    if (this.textarea) {
      this.textarea.addEventListener('input', () => {
        this.autoResizeTextarea();
      });
    }
    
    // 检查框状态变化
    if (this.vercelCheckbox) {
      this.vercelCheckbox.addEventListener('change', () => {
        if (this.vercelCheckbox.checked && !this.vercelConfig?.config?.isConfigured) {
          this.loadVercelConfig();
        }
      });
    }
    
    // 初始化 sid_guard 状态检查
    this.initStatusCheck();
  }
  
  
  async openModal() {
    if (this.modal) {
      // 使用内联样式强制显示
      this.modal.style.display = 'flex';
      this.modal.style.alignItems = 'center';
      this.modal.style.justifyContent = 'center';
      this.modal.classList.add('show');
      if (this.textarea) {
        this.textarea.focus();
      }
      this.hideStatus();
      
      // 更新模态框内的状态信息
      await this.updateModalStatus();
      
      // 加载Vercel配置状态
      await this.loadVercelConfig();
    }
  }
  
  closeModal() {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.modal.classList.remove('show');
      this.hideStatus();
      this.hideVercelStatus();
    }
  }
  
  async loadVercelConfig() {
    try {
      const response = await fetch('/api/vercel-config');
      if (response.ok) {
        this.vercelConfig = await response.json();
        this.updateVercelStatus();
      }
    } catch (error) {
      console.error('获取Vercel配置失败:', error);
    }
  }
  
  updateVercelStatus() {
    if (!this.vercelStatus || !this.vercelConfig) return;
    
    const { config } = this.vercelConfig;
    
    // 如果Vercel功能不可用
    if (config.available === false) {
      this.vercelStatus.innerHTML = `
        <div class="text-info small">
          ℹ️ Vercel自动同步为可选功能，基础Cookie更新功能正常可用
        </div>
      `;
      this.vercelCheckbox.disabled = true;
      this.vercelCheckbox.checked = false;
      return;
    }
    
    // 如果Vercel功能可用且已配置
    if (config.isConfigured) {
      this.vercelStatus.innerHTML = `
        <div class="text-success small">
          ✅ Vercel配置已完成，支持自动更新环境变量
        </div>
      `;
      this.vercelCheckbox.disabled = false;
    } else {
      // Vercel功能可用但未配置
      const missing = [];
      if (!config.hasToken) missing.push('VERCEL_TOKEN');
      if (!config.hasProjectId) missing.push('VERCEL_PROJECT_ID');
      
      this.vercelStatus.innerHTML = `
        <div class="text-warning small">
          ⚠️ 缺少配置: ${missing.join(', ')}
        </div>
      `;
      this.vercelCheckbox.disabled = true;
      this.vercelCheckbox.checked = false;
    }
  }
  
  autoResizeTextarea() {
    if (this.textarea) {
      this.textarea.style.height = 'auto';
      const minHeight = 120;
      const maxHeight = 300;
      const scrollHeight = this.textarea.scrollHeight;
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
      this.textarea.style.height = newHeight + 'px';
    }
  }
  
  async saveCookie() {
    const cookieValue = this.textarea?.value?.trim();
    const updateVercel = this.vercelCheckbox?.checked || false;
    
    if (!cookieValue) {
      this.showStatus('请输入cookie内容', 'error');
      return;
    }
    
    // 智能验证cookie格式
    let isValidFormat = false;
    
    // 检查是否是完整的sid_guard cookie格式
    if (cookieValue.startsWith('sid_guard=') && cookieValue.includes('%7C')) {
      isValidFormat = true;
    }
    // 检查是否只是sid_guard的值（包含%7C分隔符）
    else if (cookieValue.includes('%7C') && !cookieValue.includes('=')) {
      isValidFormat = true;
    }
    // 检查是否包含sid_guard参数
    else if (cookieValue.includes('sid_guard=')) {
      isValidFormat = true;
    }
    
    if (!isValidFormat) {
      this.showStatus('Cookie格式无效。请输入完整cookie或sid_guard值', 'error');
      return;
    }
    
    const statusMessage = updateVercel ? 
      '正在更新Cookie并备份到Vercel...' : 
      '正在动态更新Cookie...';
    this.showStatus(statusMessage, 'info');
    this.saveBtn.disabled = true;
    
    try {
      const response = await fetch('/api/update-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cookie: cookieValue,
          updateVercel: updateVercel
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // 🎉 突出显示立即生效的特性
        if (result.immediate && result.noRedeployNeeded) {
          this.showStatus('🎉 Cookie已更新并立即生效！无需重新部署 🚀', 'success');
          
          // 显示额外的成功提示
          setTimeout(() => {
            showToast('🚀 Cookie动态更新成功，立即可用！', 'success');
          }, 800);
        } else {
          this.showStatus(result.message, 'success');
        }
        
        // 显示 sid_guard 状态信息
        if (result.sidGuardStatus) {
          const { sidGuardStatus } = result;
          if (sidGuardStatus.isValid) {
            const timeMsg = sidGuardStatus.remainingTime ? ` (剩余: ${sidGuardStatus.remainingTime})` : '';
            setTimeout(() => {
              showToast(`✅ sid_guard 状态正常${timeMsg}`, 'success');
            }, 1500);
          } else {
            setTimeout(() => {
              showToast(`❌ sid_guard 状态异常: ${sidGuardStatus.error}`, 'error');
            }, 1500);
          }
          
          // 立即更新状态显示
          this.updateStatusDisplay(result);
        }
        
        // 如果有Vercel备份
        if (result.vercelUpdateResult && updateVercel) {
          setTimeout(() => {
            this.showStatus('🎉 Cookie立即生效 + Vercel环境变量已备份', 'success');
          }, 1200);
        }
        
        setTimeout(() => {
          this.closeModal();
        }, 2500);
      } else {
        this.showStatus(result.message || 'Cookie更新失败', 'error');
      }
    } catch (error) {
      console.error('Cookie更新错误:', error);
      this.showStatus('网络错误，请稍后重试', 'error');
    } finally {
      this.saveBtn.disabled = false;
    }
  }
  
  showStatus(message, type) {
    if (this.status) {
      this.status.textContent = message;
      this.status.className = `cookie-status ${type}`;
    }
  }
  
  hideStatus() {
    if (this.status) {
      this.status.className = 'cookie-status';
    }
  }
  
  hideVercelStatus() {
    if (this.vercelStatus) {
      this.vercelStatus.innerHTML = '';
    }
  }
  
  // 初始化状态检查
  initStatusCheck() {
    // 立即执行一次检查
    this.checkCookieStatus();
    
    // 设置定期检查（每30秒）
    this.statusCheckInterval = setInterval(() => {
      this.checkCookieStatus();
    }, 30000);
  }
  
  // 新增：刷新状态（带视觉反馈）
  async refreshStatus() {
    if (this.refreshBtn) {
      // 添加loading状态
      const originalIcon = this.refreshBtn.querySelector('.btn-icon').textContent;
      this.refreshBtn.querySelector('.btn-icon').textContent = '⏳';
      this.refreshBtn.disabled = true;
      
      try {
        await this.checkSidGuardStatus();
        
        // 成功反馈
        this.refreshBtn.querySelector('.btn-icon').textContent = '✅';
        setTimeout(() => {
          this.refreshBtn.querySelector('.btn-icon').textContent = originalIcon;
          this.refreshBtn.disabled = false;
        }, 1000);
      } catch (error) {
        // 错误反馈
        this.refreshBtn.querySelector('.btn-icon').textContent = '❌';
        setTimeout(() => {
          this.refreshBtn.querySelector('.btn-icon').textContent = originalIcon;
          this.refreshBtn.disabled = false;
        }, 1000);
      }
    }
  }

  // 新增：检查 sid_guard 状态
  async checkSidGuardStatus() {
    try {
      const response = await fetch('/api/cookie-status');
      if (response.ok) {
        const result = await response.json();
        this.updateStatusDisplay(result);
      } else {
        this.updateStatusDisplay({
          success: false,
          message: '状态检查失败',
          sidGuardStatus: {
            isValid: false,
            isExpired: true,
            error: '无法连接到服务器',
            remainingTime: null
          }
        });
      }
    } catch (error) {
      console.error('检查 Cookie 状态失败:', error);
      this.updateStatusDisplay({
        success: false,
        message: '网络错误',
        sidGuardStatus: {
          isValid: false,
          isExpired: true,
          error: '网络连接失败',
          remainingTime: null
        }
      });
    }
  }
  
  // 新增：更新状态显示
  updateStatusDisplay(result) {
    if (!this.statusDisplay || !this.statusIcon || !this.statusText) {
      return;
    }

    const { sidGuardStatus, cookieInfo } = result;
    
    // 移除所有状态类
    this.statusDisplay.classList.remove('valid', 'expired', 'warning');
    
    // 更新基本信息
    if (this.statusTitle) {
      this.statusTitle.textContent = 'Cookie 状态';
    }
    
    // 更新详细信息
    if (this.cookieSource && cookieInfo) {
      this.cookieSource.textContent = cookieInfo.source === 'environment' ? '.env.local' : 
                                      cookieInfo.source === 'scraper' ? '默认配置' : '未知';
    }
    
    if (this.cookieRemaining && sidGuardStatus.remainingTime) {
      this.cookieRemaining.textContent = sidGuardStatus.remainingTime;
    }

    if (sidGuardStatus.error) {
      // 错误状态
      this.statusIcon.textContent = '❌';
      this.statusText.textContent = sidGuardStatus.error;
      this.statusDisplay.classList.add('expired');
      if (this.cookieValidity) {
        this.cookieValidity.textContent = '错误';
      }
    } else if (sidGuardStatus.isValid) {
      // 有效状态
      this.statusIcon.textContent = '✅';
      const remainingTime = sidGuardStatus.remainingTime || '未知';
      
      // 如果剩余时间少于1小时，显示警告
      if (sidGuardStatus.remainingSeconds && sidGuardStatus.remainingSeconds < 3600) {
        this.statusDisplay.classList.add('warning');
        this.statusIcon.textContent = '⚠️';
        this.statusText.textContent = `即将过期`;
        if (this.cookieValidity) {
          this.cookieValidity.textContent = '即将过期';
        }
      } else {
        this.statusDisplay.classList.add('valid');
        this.statusText.textContent = `运行正常`;
        if (this.cookieValidity) {
          this.cookieValidity.textContent = '有效';
        }
      }
    } else {
      // 已过期
      this.statusIcon.textContent = '❌';
      this.statusText.textContent = '会话已过期';
      this.statusDisplay.classList.add('expired');
      if (this.cookieValidity) {
        this.cookieValidity.textContent = '已过期';
      }
      if (this.cookieRemaining) {
        this.cookieRemaining.textContent = '已过期';
      }
    }
    
    // 显示状态和详情
    this.statusDisplay.style.display = 'block';
    
    // 根据响应式状态设置显示模式
    this.updateDisplayMode();
    
    // 如果是过期或即将过期，显示更明显的提示
    if (sidGuardStatus.isExpired || (sidGuardStatus.remainingSeconds && sidGuardStatus.remainingSeconds < 3600)) {
      this.showExpiryNotification(sidGuardStatus);
    }
  }
  
  // 新增：切换状态详情显示
  toggleStatusDetails() {
    if (this.statusDetails) {
      const isVisible = this.statusDetails.style.display !== 'none';
      this.statusDetails.style.display = isVisible ? 'none' : 'block';
    }
  }
  
  // 新增：显示过期通知
  showExpiryNotification(sidGuardStatus) {
    // 创建或更新通知
    let notification = document.getElementById('expiry-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'expiry-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        z-index: 10000;
        font-weight: 500;
        min-width: 300px;
        animation: slideInRight 0.3s ease-out;
      `;
      document.body.appendChild(notification);
    }
    
    if (sidGuardStatus.isExpired) {
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">❌</span>
          <div>
            <div style="font-weight: bold;">Cookie 已过期</div>
            <div style="font-size: 12px; opacity: 0.9;">请更新 .env.local 中的 sid_guard</div>
          </div>
        </div>
      `;
    } else if (sidGuardStatus.remainingSeconds < 3600) {
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">⚠️</span>
          <div>
            <div style="font-weight: bold;">Cookie 即将过期</div>
            <div style="font-size: 12px; opacity: 0.9;">剩余: ${sidGuardStatus.remainingTime}</div>
          </div>
        </div>
      `;
    }
    
    // 5秒后自动隐藏
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);
  }
  
  // 检查 Cookie 状态
  async checkCookieStatus() {
    try {
      const response = await fetch('/api/cookie-status');
      if (response.ok) {
        const result = await response.json();
        this.updateStatusDisplay(result);
        return result;
      } else {
        throw new Error('状态检查失败');
      }
    } catch (error) {
      console.error('检查 Cookie 状态失败:', error);
      this.updateStatusDisplay({
        success: false,
        message: '网络错误',
        sidGuardStatus: {
          isValid: false,
          isExpired: true,
          error: '网络连接失败',
          remainingTime: null
        }
      });
    }
  }
  
  // 更新圆形按钮状态显示
  updateStatusDisplay(result) {
    if (!this.statusBtn) return;

    const { sidGuardStatus } = result;
    
    // 移除所有状态类
    this.statusBtn.classList.remove('status-valid', 'status-expired', 'status-warning', 'status-unknown');
    
    if (sidGuardStatus.error) {
      // 错误状态
      this.statusBtn.classList.add('status-expired');
      this.statusBtn.title = `Cookie状态 - 错误: ${sidGuardStatus.error}`;
    } else if (sidGuardStatus.isValid) {
      // 有效状态 - 检查是否即将过期
      if (sidGuardStatus.remainingSeconds && sidGuardStatus.remainingSeconds < 3600) {
        this.statusBtn.classList.add('status-warning');
        this.statusBtn.title = `Cookie状态 - 即将过期 (${sidGuardStatus.remainingTime})`;
      } else {
        this.statusBtn.classList.add('status-valid');
        this.statusBtn.title = `Cookie状态 - 运行正常 (剩余: ${sidGuardStatus.remainingTime || '未知'})`;
      }
    } else {
      // 已过期
      this.statusBtn.classList.add('status-expired');
      this.statusBtn.title = 'Cookie状态 - 会话已过期，需要更新';
    }
  }
  
  // 更新模态框内的状态信息
  async updateModalStatus() {
    try {
      const result = await this.checkCookieStatus();
      if (!result) return;
      
      const { sidGuardStatus, cookieInfo } = result;
      
      // 更新模态框内的状态信息面板
      if (this.modalStatusInfo) {
        // 移除状态类
        this.modalStatusInfo.classList.remove('status-valid', 'status-warning', 'status-expired');
        
        if (sidGuardStatus.error) {
          this.modalStatusInfo.classList.add('status-expired');
          if (this.modalStatusText) this.modalStatusText.textContent = sidGuardStatus.error;
          if (this.modalStatusIcon) this.modalStatusIcon.textContent = '❌';
        } else if (sidGuardStatus.isValid) {
          if (sidGuardStatus.remainingSeconds && sidGuardStatus.remainingSeconds < 3600) {
            this.modalStatusInfo.classList.add('status-warning');
            if (this.modalStatusText) this.modalStatusText.textContent = '即将过期';
            if (this.modalStatusIcon) this.modalStatusIcon.textContent = '⚠️';
          } else {
            this.modalStatusInfo.classList.add('status-valid');
            if (this.modalStatusText) this.modalStatusText.textContent = '运行正常';
            if (this.modalStatusIcon) this.modalStatusIcon.textContent = '✅';
          }
        } else {
          this.modalStatusInfo.classList.add('status-expired');
          if (this.modalStatusText) this.modalStatusText.textContent = '会话已过期';
          if (this.modalStatusIcon) this.modalStatusIcon.textContent = '❌';
        }
        
        // 更新详细信息
        if (this.modalCookieSource && cookieInfo) {
          this.modalCookieSource.textContent = cookieInfo.source === 'environment' ? '.env.local' : 
                                              cookieInfo.source === 'scraper' ? '默认配置' : '未知';
        }
        
        if (this.modalCookieRemaining) {
          this.modalCookieRemaining.textContent = sidGuardStatus.remainingTime || (sidGuardStatus.isExpired ? '已过期' : '未知');
        }
        
        if (this.modalCookieValidity) {
          if (sidGuardStatus.error) {
            this.modalCookieValidity.textContent = '错误';
          } else if (sidGuardStatus.isValid) {
            this.modalCookieValidity.textContent = sidGuardStatus.remainingSeconds && sidGuardStatus.remainingSeconds < 3600 ? '即将过期' : '有效';
          } else {
            this.modalCookieValidity.textContent = '已过期';
          }
        }
      }
    } catch (error) {
      console.error('更新模态框状态失败:', error);
    }
  }

  // 清理定时器
  destroy() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }
}

// 全局变量以供HTML中的onclick调用
let cookieManager;

// 初始化Cookie管理器
document.addEventListener('DOMContentLoaded', function() {
  cookieManager = new CookieManager();
});

// 页面卸载时清理定时器
window.addEventListener('beforeunload', function() {
  if (cookieManager && cookieManager.destroy) {
    cookieManager.destroy();
  }
});

// 显示下载进度条
function showDownloadProgress(totalFiles) {
  const progressBar = document.getElementById('download-progress-bar');
  const progressTotal = document.getElementById('progress-total');
  const progressCurrent = document.getElementById('progress-current');
  const progressFill = document.getElementById('progress-fill');
  
  if (progressBar) {
    progressTotal.textContent = totalFiles;
    progressCurrent.textContent = '0';
    progressFill.style.width = '0%';
    
    progressBar.classList.add('show');
  }
}

// 更新底部进度条
function updateBottomProgress(current, total, isComplete = false) {
  const progressCurrent = document.getElementById('progress-current');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.querySelector('.progress-text');
  
  if (progressCurrent && progressFill) {
    progressCurrent.textContent = current;
    const percentage = (current / total) * 100;
    progressFill.style.width = percentage + '%';
    
    if (isComplete) {
      progressText.textContent = '🎉 下载完成！';
    } else {
      progressText.textContent = '📥 批量下载中...';
    }
  }
}

// 隐藏下载进度条
function hideDownloadProgress() {
  const progressBar = document.getElementById('download-progress-bar');
  if (progressBar) {
    progressBar.classList.remove('show');
  }
}

