<div align="center">

# 🎬 抖音工具 - DY Download

<p align="center">
    <em>现代化的抖音视频/图片无水印下载工具</em>
</p>

<p align="center">
    <a href="https://github.com/helson-lin/douyin_no_watermark">
        <img alt="基于项目" src="https://img.shields.io/badge/基于-douyin__no__watermark-blue">
    </a>
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="当前版本" src="https://img.shields.io/badge/版本-2025.8-brightgreen">
    </a>
</p>

</div>

## ✨ 特色功能

🎯 **一键解析** - 粘贴抖音分享链接，自动识别视频和图片  
📱 **移动优先** - 完美适配手机端，支持全屏预览模式  
🌙 **深色模式** - 内置明暗主题切换，护眼体验  
⚡ **实时预览** - 媒体内容可视化预览，支持网格和列表视图  
🔄 **稳定下载** - 视频文件使用代理下载，提高下载成功率  
� **快速下载** - 图片直接下载，视频代理下载，优化下载体验  
📋 **便捷复制** - 单个或批量复制下载链接  

## 🎨 界面预览

<div align="center">
<img src="https://img.shields.io/badge/界面设计-现代化响应式-blue?style=for-the-badge" alt="现代化界面"/>
</div>

### 核心功能截图

- **🖥️ 桌面端**: 简洁居中布局，专业工具体验
- **📱 移动端**: 全屏沉浸式预览，触控优化
- **🌓 主题切换**: 明暗模式无缝切换
- **📋 链接管理**: 可视化链接列表，类型标识


## ⚠️ 免责声明

> 使用本项目所产生的所有风险由用户自行承担。我们不对因使用本项目而导致的任何直接、间接、偶然、特殊或后果性的损害负责，包括但不限于利润损失、数据丢失或其他经济损失。

## 📊 项目状态

<p align="center">
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="GitHub Issues" src="https://img.shields.io/github/issues/JIaLeChye/dydownload"/>
    </a>
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="GitHub Stars" src="https://img.shields.io/github/stars/JIaLeChye/dydownload?style=social"/>
    </a>
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="平台支持" src="https://img.shields.io/badge/平台-macOS%7CLinux%7CWindows-brightgreen"/>
    </a>
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="最后提交" src="https://img.shields.io/github/last-commit/JIaLeChye/dydownload"/>
    </a>
</p>

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn 包管理器

### 本地运行

> **第一步**: Fork 本仓库到你的 GitHub 账户

```bash
# 克隆你 Fork 的项目（替换 YOUR_USERNAME 为你的用户名）
git clone https://github.com/YOUR_USERNAME/dydownload.git
cd dydownload


# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用

### 使用方法

1. **📎 粘贴链接** - 在输入框粘贴抖音分享链接
2. **🔍 自动解析** - 点击"解析"按钮，系统自动识别内容
3. **👀 预览内容** - 在预览区域查看视频/图片
4. **💾 下载文件** - 系统自动选择合适的下载方式

## 🛠️ 核心技术特性

## 🛠️ 核心技术特性

### 🔄 下载系统优化 (2025.8 最新)

**自动文件类型检测**
- 支持格式：`.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.flv`, `.m4v`
- 系统自动识别文件类型，选择合适的下载方式

**分类下载策略**
- **视频文件** → 使用服务器代理下载
  - 绕过抖音防盗链保护，避免403错误
  - 确保视频文件完整性，防止文件损坏
  - 支持大文件下载，提升稳定性
- **图片文件** → 直接下载
  - 保持下载速度，即点即下
  - 减少服务器负载，提升响应速度

**技术实现**
```javascript
// 下载方式选择逻辑
const isVideoFile = url.includes('.mp4') || 
                   url.includes('zjcdn.com') || 
                   url.includes('video') ||
                   extension === '.mp4';

if (isVideoFile) {
  // 视频文件 → 代理下载
  proxyDownload(url, fileName);
} else {
  // 图片文件 → 直接下载  
  directDownload(url, fileName);
}
```

**用户体验改进**
- 统一下载按钮界面
- 自动显示下载方式选择（代理/直接）
- 实时反馈下载状态和进度

### 前端技术栈
- **Bootstrap 5** - 现代响应式UI框架
- **原生JavaScript** - 高性能客户端逻辑
- **CSS3** - 深色模式、动画效果、移动端适配
- **Progressive Web App** - 接近原生应用体验

### 移动端优化
- **🔄 全屏预览模式** - 移动端沉浸式体验
- **👆 触控优化** - 手势交互、按钮大小适配
- **📐 响应式布局** - 自适应不同屏幕尺寸
- **⚡ 性能优化** - 懒加载、图片压缩

### 用户体验
- **🎨 双主题设计** - 明亮/深色模式切换
- **📱 移动优先** - Mobile-First设计理念
- **🔔 实时反馈** - Toast通知、加载状态
- **💡 智能提示** - 操作指引、错误提示

## ⚙️ 故障排除

## ⚙️ 故障排除

### 🔄 下载系统相关

#### 下载的视频文件无法播放/文件损坏

**现象**：
- 视频文件下载成功但无法打开
- 文件大小正常但播放器提示格式错误
- 图片可以正常下载，只有视频有问题

**解决方案**：
新版下载系统已经解决了这个问题：
- **视频文件自动使用代理下载**，绕过防盗链保护
- 系统会自动检测 `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.flv`, `.m4v` 等视频格式
- 无需手动选择，点击下载即可

如果仍有问题，请检查：
1. 网络连接是否稳定
2. 浏览器是否允许下载
3. 磁盘空间是否充足

#### response.body.pipe is not a function 错误

**现象**：
```
TypeError: response.body.pipe is not a function
```

**解决方案**：
此问题已在最新版本中修复：
- 使用 `arrayBuffer()` 方法替代 `pipe()` 处理二进制数据
- 兼容 Node.js 22 的 native fetch API
- 修复了所有下载端点的流处理问题

### 🔧 403 Forbidden 错误解决

如果遇到 403 错误，通常是以下原因：

#### 1. Cookie 过期（最常见）

**现象**：
```
FetchError: invalid json response body at https://www.douyin.com/aweme/v1/web/aweme/detail/...
```
或者API返回空响应（status 200但内容为空）

**解决方案**：
1. 打开抖音网页版：https://www.douyin.com
2. 按 `F12` 打开开发者工具
3. 切换到 "Application" → "Storage" → "Cookies" → "https://www.douyin.com"
4. 复制所有cookie值，特别关注以下关键cookie：
   - `sid_guard` - 用户会话标识
   - `sessionid` - 会话ID  
   - `msToken` - 安全令牌
   - `webid` - 浏览器标识
   - `s_v_web_id` - 访问者ID
   - `ttwid` - 追踪ID

5. 替换 `bin/index.js` 第16行的 cookie 变量：

```javascript
// 更新这行，使用完整的cookie字符串
'cookie': 'sid_guard=你的sid_guard值; sessionid=你的sessionid值; msToken=你的msToken值; webid=你的webid值; s_v_web_id=你的s_v_web_id值; ttwid=你的ttwid值;'
```

6. **重要**：还需要更新第97行API URL中的对应参数：
   - 更新 `webid` 参数值
   - 更新 `msToken` 参数值

**完整示例**：
```javascript
// 第16行
'cookie': 'sid_guard=新的值; sessionid=新的值; msToken=新的值; webid=新的值; s_v_web_id=新的值; ttwid=新的值;'

// 第97行中的参数也要对应更新
webid=新的webid值&msToken=新的msToken值
```

![Cookie获取示例](https://github.com/user-attachments/assets/a4c63bfc-5d4f-4e05-8e80-0706cdd323c6)

#### 2. 视频链接403错误（特殊情况）

**现象**：图片可以正常下载，但视频链接返回403错误

**解决方案**：程序现在使用多种策略生成无水印视频链接：
- 方法1：传统的 `/play/` → `/playwm/` 替换
- 方法2：添加 `watermark=0` 参数  
- 方法3：使用不同的CDN域名
- 方法4：包含video_id参数的完整URL
- 方法5：组合多种参数优化

如果仍然遇到视频403错误：
1. 检查网络环境（某些网络可能限制视频CDN访问）
2. 使用VPN切换IP地址和地区
3. 在下载时确保正确的请求头：
   ```javascript
   headers: {
     'Referer': 'https://www.douyin.com/',
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
   }
   ```
4. 尝试不同的下载时间（高峰期可能限制更严格）

#### 3. User-Agent 问题

确保 User-Agent 是最新的浏览器版本：
```javascript
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
```

#### 3. 请求频率限制

- 避免短时间内大量请求
- 可以添加延迟：`await new Promise(resolve => setTimeout(resolve, 1000))`

#### 4. IP 限制

- 更换网络环境
- 使用代理服务器

### 403 下载错误

如果下载时遇到 `403 Forbidden`：
- 在下载请求头中添加 `Referer: https://www.douyin.com/`
- 确保 User-Agent 与解析时一致

### 🆘 快速修复命令

**链接测试**：
```bash
# 测试特定链接
node -e "
const { spawn } = require('child_process');
const url = 'https://v.douyin.com/WDtp40Neqts/';
console.log('测试链接:', url);
"
```

**Cookie快速更新**：
1. 访问 https://www.douyin.com
2. 按F12，在Console中粘贴 `cookie-helper.js` 的代码
3. 复制输出的cookie字符串
4. 替换 `bin/index.js` 中的cookie

**重启服务器**：
```bash
npm run dev
```

**清除缓存**：
```bash
npm clean-install
```

**检查网络连接**：
```bash
curl -I https://www.douyin.com
```

### 🔍 调试模式

如果问题持续，可以启用调试模式：

```bash
# 设置调试环境变量
$env:DEBUG="*"
npm run dev
```

这将显示详细的请求日志，帮助识别具体问题。

## 📅 更新日志

### 🎉 2025.1 版本
- ✨ **全新界面设计** - 现代化响应式UI
- 📱 **移动端全屏预览** - 沉浸式媒体体验  
- 🌙 **深色模式支持** - 护眼主题切换
- 🔄 **智能内容识别** - 自动区分视频/图片
- 📥 **批量下载优化** - 支持分类下载
- 💫 **动画效果增强** - 流畅交互体验

### 🐛 2024.9.5
- 🔧 修复 x_bogus 验证失败，转换为 a_bougs 参数

### ✨ 2024.1.4-1.5  
- 🎯 支持用户主页分享链接批量下载
- 📸 优化图片作品批量下载功能

## 🚀 部署方案

### 🖥️ 本地开发

> **重要**: 开发前请先 Fork 本仓库到你的 GitHub 账户

1. **Fork 仓库**: 访问 [本项目](https://github.com/JIaLeChye/dydownload)，点击右上角 "Fork" 按钮
2. **克隆你的 Fork**:

```bash
# 克隆你 Fork 的项目（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git clone https://github.com/YOUR_USERNAME/dydownload.git
cd dydownload

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

3. **设置上游仓库**（用于同步原仓库更新）:

```bash
# 添加原仓库为上游
git remote add upstream https://github.com/JIaLeChye/dydownload.git

# 查看远程仓库配置
git remote -v
```

访问 http://localhost:3000

### ☁️ Vercel 部署

> **重要**: 部署前请先 Fork 本仓库到你的 GitHub 账户

1. **Fork 仓库**: 点击右上角 "Fork" 按钮，将仓库复制到你的账户
2. **部署到 Vercel**: 使用你 Fork 后的仓库地址进行部署

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/JIaLeChye/dydownload)

**或者手动部署**:
1. 访问 [Vercel](https://vercel.com/new)
2. 选择你 Fork 的 `dydownload` 仓库
3. 点击 "Deploy" 开始部署

> **注意**: Vercel 免费版有6秒超时限制，批量下载可能受影响

### 🐳 Docker 部署

```bash
# 拉取镜像
docker pull h55205l/douyin_no_watermark:latest

# 启动容器
docker run -p 3000:3000 -d h55205l/douyin_no_watermark:latest
```

### 🖥️ 服务器部署

1. 下载对应平台的可执行文件
2. 授权执行：`chmod +x oimi-tk-linux-x86`
3. 运行：`./oimi-tk-linux-x86`

**自定义端口**:
```bash
# 方式1: 环境变量
echo "PORT=8080" > .env

# 方式2: 命令行参数
./oimi-tk-linux-x86 --port=8080
```

## 🔌 API 接口

| 接口 | 方法 | 参数 | 响应 |
|-----|------|-----|------|
| `/douyin` | `POST` | `{ url: "抖音链接" }` | `{ code: 0, data: {video: [], img: [], msg: ''}}` |
| `/workflow` | `POST` | `{ url: "抖音链接" }` | `{ code: 0, data: ['downloadUrl'] }` |

### 响应示例

```json
{
  "code": 0,
  "data": {
    "video": ["https://video-url-1.mp4"],
    "img": ["https://image-url-1.jpg", "https://image-url-2.jpg"],
    "msg": "解析成功"
  }
}
```

## 📱 iOS 捷径

**下载捷径**: [iCloud 链接](https://www.icloud.com/shortcuts/58969bbfa6ae405ba9358d60590e3f9c)

> 捷径内置测试服务器，生产环境请使用自己部署的服务

## 📝 更新日志

### 🚀 v2025.8 - 下载系统优化
*发布日期: 2025年8月10日*

**🔧 核心修复**
- 修复 `response.body.pipe is not a function` 错误
- 解决 Node.js 22 native fetch API 兼容性问题
- 修复三个下载端点的流处理错误

**🔄 下载系统改进**
- 实现文件类型自动检测（支持7种视频格式）
- 视频文件自动使用服务器代理下载，避免403防盗链错误
- 图片文件继续直接下载，保持速度优势
- 优化下载策略，提升成功率

**🎨 用户界面优化**
- 统一下载按钮界面设计
- 添加下载方式说明和提示信息
- 更新测试页面，保持界面一致性

**🧹 代码优化**
- 清理32个测试和调试文件，精简代码结构
- 移除未使用的依赖和功能模块
- 优化错误处理和用户反馈机制

### 📊 v2025.1 - 现代化重构
*发布日期: 2025年1月*

**🎨 界面现代化**
- 全新响应式设计，支持明暗主题
- 移动端优化，触控友好交互
- Bootstrap 5 + 原生 JavaScript

**📱 移动端适配**
- 全屏预览模式
- 手势操作优化
- 自适应布局系统

**🔧 功能增强**
- 实时媒体预览
- 智能链接识别
- 改进下载机制

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 开启 Pull Request

## 📄 开源协议

本项目采用 [Creative Commons Attribution-NonCommercial 4.0](./LICENSE) 协议

## 🙏 致谢

- **原作者**: [helson-lin](https://github.com/helson-lin) - [douyin_no_watermark](https://github.com/helson-lin/douyin_no_watermark)
- **X-Bogus.js**: [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)
- **UI 设计**: Bootstrap 5 & 现代化响应式设计

---

<div align="center">

**⭐ 觉得有用的话，请给个 Star ⭐**

Made with ❤️ by [JIaLeChye](https://github.com/JIaLeChye)

</div>


