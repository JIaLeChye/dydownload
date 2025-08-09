<p align="center">
    <a href="https://github.com/helson-lin">
        <img alt="Original Author" src="https://img.shields.io/badge/Original Author-helson_lin-blue">
    </a>
    <a href="https://github.com/helson-lin/douyin_no_watermark"> 
        <img alt="Project Link" src="https://img.shields.io/badge/Project Link-douyin__no__watermark-blue">
    </a>
</p>



<h2 align="center">douyin_no_watermark是一个抖音视频无水印下载程序 【2024/11/23 a_bougs 更新 无法使用】</h2>
<p align="center">支持Docker、Vercel、私有化服务部署，支持IOS捷径快捷下载</p>
<p align="center">免责声明：使用本项目所产生的所有风险由用户自行承担。我们不对因使用本项目而导致的任何直接、间接、偶然、特殊或后果性的损害负责，包括但不限于利润损失、数据丢失或其他经济损失。
责任限制：在适用法律允许的最大范围内，项目作者及贡献者对因使用或无法使用本项目而导致的任何损失不承担责任。</p>
<p align="center">
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="github issues" src="https://img.shields.io/github/issues/JIaLeChye/dydownload"/>
    </a>
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="github stars" src="https://img.shields.io/github/stars/JIaLeChye/dydownload?style=social"/>
    </a>
    <!-- <a href="https://github.com/JIaLeChye/dydownload">
          <img alt="release downloads" src="https://img.shields.io/github/downloads/JIaLeChye/dydownload/total?color=brightgreen&label=release%20download"/>
    </a> -->
    <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="platform support" src="https://img.shields.io/badge/platform-macos%7Clinux%7Cwin-brightgreen"/>
    </a>
     <a href="https://github.com/JIaLeChye/dydownload">
        <img alt="last commit" src="https://img.shields.io/github/last-commit/JIaLeChye/dydownload"/>
    </a>
</p>

<<<<<<< Updated upstream
### 需知
=======
> 注：历史调试/测试脚本已迁移到 `docs/legacy/`，生产部署不需要它们。

## 🚀 快速开始
>>>>>>> Stashed changes

如果程序出现如下类似报错: `FetchError: invalid json response body at https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=7366865544722550035&pc_client_type=1&version_code=190500&versio`

请替换 `bin/index.js` 16 行的cookie变量. cookie 变量的获取，可以在抖音网页版内，打开“开发者工具” - “应用/Application” - “Cookie”.

![111725585960_ pic](https://github.com/user-attachments/assets/a4c63bfc-5d4f-4e05-8e80-0706cdd323c6)

#### 如直接使用解析之后的地址下载出现 403 forbidden

请在请求下载的时候添加`Referer`请求头，值为`url`的值


### Update Log

2024/9/5: 🐛 修复 x_bogus 验证失败，转换为 a_bougs 参数。

2024/1/4: ✨ 更新通过用户主页分享链接，批量下载作品

2024/1/5: ✨ 优化批量下载用户主页作品，支持图片作品下载。

### 效果展示

[![预览](https://file.helson-lin.cn/picgoSnipaste_2024-01-06_18-33-54.png)](https://file.helson-lin.cn/picgooimi_tk_docs.mp4)



### 部署

#### Vercel部署 （原作者为源）

> 由于Vercel的边缘函数默认的超时时间为6s,批量下载主页作品会多次请求作者的作品耗时比较长，会出现超时的问题（无法解决，只有购买vercel的付费版本）。


[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/helson-lin/tk_no_water_node) 

#### 服务器手动部署

1. 从Release下载对应平台的可执行文件，到服务器。
2. 授权：`chmod +x excutablefilename` `${excutablefilename}`为对应的文件名称
3. `./oimi-tk-linux-x86`根据实际情况执行。

如果服务器和linux基础知识都不明白，不建议手动。

自定义端口：

创建一个`.env`文件在程序同级别目录， 添加如下内容

```js
PORT = 11233
```

或者通过命令行参数指定端口：`./oimi-tk-linux-x86 --port=2301`, 命令行权重最高。

#### Docker部署

1. 拉取镜像: `docker pull h55205l/douyin_no_watermark:latest`,目前没有构建`arm`版本
2. 运行服务：`docker run -p 3311:3000 -d h55205l/douyin_no_watermark:latest`

内置默认端口为`3000`, 映射端口自行修改

### API

`code`: 0: error happened, 1: sucess request
`/workflow`: is for ios workflow

<<<<<<< Updated upstream
| URL       | METHOD | PARAMS      | RESPONSE                                        |
| --------- | ------ | :---------- | ----------------------------------------------- |
| `/douyin`   | `POST`   | `{ url:  ""}` | `{ code: 0, data: {video: '', img: '', msg: ''}}` |
| `/workflow` | `POST`   | `{ url:  ""}` | `{ code: 0, data: ['downloadUrl'] }`              |
|           |        |             |                                                 |
=======
### 用户体验
- **🎨 双主题设计** - 明亮/深色模式切换
- **📱 移动优先** - Mobile-First设计理念
- **🔔 实时反馈** - Toast通知、加载状态
- **💡 智能提示** - 操作指引、错误提示

## ⚙️ 故障排除

## 🌐 环境变量

| 变量名 | 默认值 | 说明 |
| ------ | ------ | ---- |
| `PORT` | 3000 | 服务启动端口 |
| `SINGLE_VIDEO_URL` | (未设置) | 设为 `1` 时，单视频解析只返回一个首选无水印链接，避免前端展示多个候选 |
| `STABLE_VIDEO_ONLY` | (未设置) | 设为 `1` 时，仅返回稳定接口 `https://aweme.snssdk.com/aweme/v1/play/?video_id=...`，忽略其它候选 |
| `DEBUG_VIDEO_URLS` | (未设置) | 设为 `1` 时，接口返回全部候选视频链接用于调试 |

使用方式：

PowerShell 临时设置并启动：
```powershell
$env:SINGLE_VIDEO_URL="1"; npm run dev
```

写入 .env 文件：
```
SINGLE_VIDEO_URL=1
```

不设置时默认返回多个候选链接（不同线路 / 参数形式），便于在某些链接403时手动切换。

组合策略：
- 仅设置 `STABLE_VIDEO_ONLY=1` → 只返 1 条稳定 URL（推荐稳定部署）
- 仅设置 `SINGLE_VIDEO_URL=1` → 经过排序后的首选候选（可能不是 stable 接口，但最短）
- 两者都不设 → 返回所有候选用于手动调试
- 设置 `DEBUG_VIDEO_URLS=1` 或请求体/查询参数带 `debug=1` → 临时查看全部候选

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

**Cookie快速更新（手动）**：
1. 访问 https://www.douyin.com 并登录（如需）
2. 按F12 打开 DevTools，Application / Storage 里复制必要 cookie (sid_guard, sessionid, msToken, webid, ttwid 等)
3. 拼接成 `key=value;` 形式并更新 `bin/index.js` 中的 cookie 常量
4. 保存并重启服务

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
>>>>>>> Stashed changes



**捷径下载**: [iCloud](https://www.icloud.com/shortcuts/58969bbfa6ae405ba9358d60590e3f9c)

捷径内服务器，仅供测试使用。如果有大量使用需求，请自行部署。

推荐使用个人服务器部署，`vercel`部署批量下载或出现超时（单个作品下载不会），请谨记(付费版本除外)。

### 免责声明

使用本项目所产生的所有风险由用户自行承担。我们不对因使用本项目而导致的任何直接、间接、偶然、特殊或后果性的损害负责，包括但不限于利润损失、数据丢失或其他经济损失。
责任限制：在适用法律允许的最大范围内，项目作者及贡献者对因使用或无法使用本项目而导致的任何损失不承担责任。


## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International Public License. See the [LICENSE](./LICENSE) file for details.


## 致谢


`X-Bogus.js`： [Doouyin_TikTOk_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API), `X-Bogus.js`
`X-Bogus.js`:  [douyin_no_watermark](https://github.com/helson-lin/douyin_no_watermark), `X-Bogus.js` 
 

