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
            // 移动端友好的反馈
            if (window.innerWidth <= 768) {
              resultDom.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
