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
      if (resultDom) resultDom.hidden = true;
      if (submitText) submitText.textContent = "解析中...";
      
      fetch("/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })
        .then((response) => response.json())
        .then((data) => {
          if (resultDom) resultDom.hidden = false;
          if (loadingDom) loadingDom.hidden = true;
          if (copyDom) copyDom.hidden = false;
          if (submitText) submitText.textContent = "解析";
          
          if (data.code === 0 && data.data.length > 0) {
            resultDom.value = data.data.join(",\n");
            
            // 显示媒体预览
            displayMediaPreview(data.data);
            
            // 移动端友好的反馈
            if (window.innerWidth <= 768) {
              document.getElementById("mediaPreview").scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            alert("解析失败，请检查链接是否正确");
          }
        })
        .catch((error) => {
          console.error("There was an error!", error);
          if (loadingDom) loadingDom.hidden = true;
          if (submitText) submitText.textContent = "解析";
          alert("网络错误，请稍后重试");
        });
    });
});

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
        // 移动端友好的成功反馈
        const copyButton = document.getElementById("autocopy");
        const originalText = copyButton.textContent;
        copyButton.textContent = "✅ 复制成功";
        copyButton.classList.remove("btn-primary");
        copyButton.classList.add("btn-success");
        
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.classList.remove("btn-success");
          copyButton.classList.add("btn-primary");
        }, 2000);
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
    alert('复制成功！可以在浏览器或其他应用中粘贴下载链接')
  })
  .catch(function (error) {
    alert('复制失败，请手动选择文本复制')
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
    // 先通过URL扩展名进行简单判断
    const urlLower = url.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    
    // 检查URL是否包含明确的扩展名
    const isImageByUrl = imageExtensions.some(ext => urlLower.includes(ext));
    const isVideoByUrl = videoExtensions.some(ext => urlLower.includes(ext));
    
    if (isVideoByUrl) {
      resolve({
        url: url,
        type: 'video',
        index: index,
        loaded: true
      });
      return;
    }
    
    if (isImageByUrl) {
      // 对于图片，尝试加载以获取尺寸信息
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const timeout = setTimeout(() => {
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: false
        });
      }, 3000);
      
      img.onload = function() {
        clearTimeout(timeout);
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: true,
          width: this.naturalWidth,
          height: this.naturalHeight
        });
      };
      
      img.onerror = function() {
        clearTimeout(timeout);
        resolve({
          url: url,
          type: 'image',
          index: index,
          loaded: false
        });
      };
      
      img.src = url;
      return;
    }
    
    // 如果无法通过URL判断，使用HEAD请求检查Content-Type
    fetch(url, { method: 'HEAD' })
      .then(response => {
        const contentType = response.headers.get('content-type');
        if (contentType) {
          if (contentType.startsWith('image/')) {
            // 是图片，加载以获取尺寸
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            const timeout = setTimeout(() => {
              resolve({
                url: url,
                type: 'image',
                index: index,
                loaded: false
              });
            }, 3000);
            
            img.onload = function() {
              clearTimeout(timeout);
              resolve({
                url: url,
                type: 'image',
                index: index,
                loaded: true,
                width: this.naturalWidth,
                height: this.naturalHeight
              });
            };
            
            img.onerror = function() {
              clearTimeout(timeout);
              resolve({
                url: url,
                type: 'image',
                index: index,
                loaded: false
              });
            };
            
            img.src = url;
          } else if (contentType.startsWith('video/')) {
            resolve({
              url: url,
              type: 'video',
              index: index,
              loaded: true
            });
          } else {
            // 默认假设是视频
            resolve({
              url: url,
              type: 'video',
              index: index,
              loaded: false
            });
          }
        } else {
          // 无Content-Type，默认假设是视频
          resolve({
            url: url,
            type: 'video',
            index: index,
            loaded: false
          });
        }
      })
      .catch(() => {
        // 请求失败，默认假设是视频
        resolve({
          url: url,
          type: 'video',
          index: index,
          loaded: false
        });
      });
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
      mediaContent = `<img src="${item.url}" alt="图片 ${index + 1}" onclick="openLightbox(${index})" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                      <div style="display:none; padding: 2rem; text-align: center; background: var(--card-bg); border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️</div>
                        <div>图片加载失败</div>
                        <button onclick="retryLoadMedia('${item.url}', ${index})" class="btn btn-sm btn-outline-primary mt-2">重试</button>
                      </div>`;
    } else {
      mediaContent = `<video controls preload="metadata" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
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
      <div class="media-item" data-index="${index}">
        <div class="media-type">${item.type === 'image' ? '📸 图片' : '🎬 视频'} ${index + 1}</div>
        <button class="media-download-btn" onclick="downloadMedia('${item.url}', ${index})" title="下载">
          ⬇️
        </button>
        <div class="media-content">
          ${mediaContent}
        </div>
        ${mediaInfo}
        <div class="download-link" title="点击复制链接" onclick="copyToClipboardText('${item.url}')" style="cursor: pointer;">
          ${item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url}
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

function copyToClipboardText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('✅ 链接已复制', 'success');
      })
      .catch(() => {
        fallbackCopyTextToClipboard(text);
      });
  } else {
    fallbackCopyTextToClipboard(text);
  }
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
  try {
    // 尝试获取文件扩展名
    const urlParts = url.split('.');
    const extension = urlParts.length > 1 ? '.' + urlParts[urlParts.length - 1].split('?')[0] : '';
    
    // 生成时间戳
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    
    // 确定文件类型
    const mediaItem = document.querySelector(`[data-index="${index}"]`);
    const isImage = mediaItem && mediaItem.querySelector('img');
    const filePrefix = isImage ? 'douyin_image' : 'douyin_video';
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filePrefix}_${timestamp}_${index + 1}${extension}`;
    link.target = '_blank';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 显示下载开始的提示
    showToast('📥 开始下载...', 'info');
    
  } catch (error) {
    console.error('Download error:', error);
    showToast('❌ 下载失败', 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  
  if (type === 'error') {
    toast.style.background = '#dc3545';
  } else if (type === 'info') {
    toast.style.background = '#17a2b8';
  }
  
  document.body.appendChild(toast);
  
  // 触发动画
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
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
