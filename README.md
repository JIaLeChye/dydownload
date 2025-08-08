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
        <img alt="当前版本" src="https://img.shields.io/badge/版本-2025.1-brightgreen">
    </a>
</p>

</div>

## ✨ 特色功能

🎯 **一键解析** - 粘贴抖音分享链接，自动识别视频和图片  
📱 **移动优先** - 完美适配手机端，支持全屏预览模式  
🌙 **深色模式** - 内置明暗主题切换，护眼体验  
⚡ **实时预览** - 媒体内容可视化预览，支持网格和列表视图  
📥 **批量下载** - 一键下载所有内容，支持分类下载  
🔄 **智能识别** - 自动区分视频和图片类型  
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
4. **💾 下载文件** - 单个下载或批量下载到本地

## 🛠️ 核心技术特性

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

### Cookie 更新

如遇到如下错误：
```
FetchError: invalid json response body at https://www.douyin.com/aweme/v1/web/aweme/detail/...
```

**解决方案**：
1. 打开抖音网页版 (douyin.com)
2. 按 F12 打开开发者工具
3. 切换到 "Application" → "Cookies" 
4. 复制完整的 cookie 值
5. 替换 `bin/index.js` 第16行的 cookie 变量

![Cookie获取示例](https://github.com/user-attachments/assets/a4c63bfc-5d4f-4e05-8e80-0706cdd323c6)

### 403 下载错误

如果下载时遇到 `403 Forbidden`：
- 在下载请求头中添加 `Referer: ${原始URL}`

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


