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
        <img alt="当前版本" src="https://img.shields.io/badge/版本-2026.02-brightgreen">
    </a>
</p>

</div>

## ✨ 特色功能

🎯 **一键解析** - 粘贴抖音分享链接，自动识别视频和图片  
📱 **移动优先** - 完美适配手机端，支持全屏预览模式  
🌙 **深色模式** - 内置明暗主题切换，护眼体验  
⚡ **实时预览** - 媒体内容可视化预览，支持网格和列表视图  
🔄 **稳定下载** - 视频文件使用代理下载，提高下载成功率  
🚀 **快速下载** - 图片直接下载，视频代理下载，优化下载体验  
📋 **便捷复制** - 单个或批量复制下载链接  
🍪 **智能Cookie管理** - 网页界面一键更新Cookie，支持多种格式自动识别  
🔧 **环境变量支持** - 支持本地开发和生产环境配置  
☁️ **Vercel一键部署** - 开箱即用的云端部署方案  

### 🎉 最新功能：Cookie智能更新

- ✅ **网页界面更新** - 点击🍪按钮即可更新Cookie  
- ✅ **格式智能识别** - 自动识别完整Cookie或sid_guard值  
- ✅ **实时生效** - 当前会话立即使用新Cookie  
- 🚀 **Vercel自动同步** - 可选功能，自动更新云端环境变量  

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

## 🚀 部署指南

### 📱 本地部署

#### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn 包管理器

#### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/JIaLeChye/dydownload.git
cd dydownload

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
```

#### 配置抖音Cookie（必需）

**方法一：获取完整Cookie**
1. 浏览器访问 [douyin.com](https://douyin.com)
2. 按 `F12` 打开开发者工具
3. 切换到 `Network` 标签页，刷新页面
4. 找到任意请求，复制 `Request Headers` 中的完整 `Cookie` 值

**方法二：只获取sid_guard值**
1. 在上述Cookie中找到 `sid_guard=` 部分
2. 复制等号后的值（如：`a1b2c3d4...xyz`）

编辑 `.env.local` 文件：
```bash
# 完整Cookie格式（推荐）
DOUYIN_COOKIE=sid_guard=你的完整cookie值; sessionid=另一个值;

# 或只配置sid_guard值（系统会自动包装）
DOUYIN_COOKIE=sid_guard=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6%7C1756624538%7C5184000%7CThu%2C+30-Oct-2025+07%3A15%3A38+GMT;
```

#### 启动服务

```bash
# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用

#### � 可选配置

**.env.local 可选环境变量：**

```bash
# 性能监控（默认关闭）
ENABLE_PERF_MONITORING=1    # 启用后会输出API响应时间和内存使用情况

# 其他可选配置
DEBUG_VIDEO_URLS=1          # 启用视频URL调试模式
SINGLE_VIDEO_URL=1          # 只返回单个最佳视频链接
STABLE_VIDEO_ONLY=1         # 只使用稳定的API接口
```

#### 💡 本地部署注意事项
- ✅ Cookie配置在 `.env.local` 文件中，重启服务器后持久有效
- ✅ 网页界面更新Cookie仅在当前会话有效，重启后恢复配置文件中的值
- ✅ 建议在 `.env.local` 中配置稳定的长期Cookie
- ⚡ 性能监控默认关闭，开启后可查看详细性能指标
- 🔄 Cookie过期时可先用网页更新应急，再更新配置文件

---

### ☁️ Vercel云端部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/JIaLeChye/dydownload)

#### 基础部署（5分钟完成）

**第1步：连接仓库**
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择此GitHub仓库
4. 点击 "Deploy"

**第2步：配置环境变量**
在Vercel项目的 `Settings` > `Environment Variables` 中添加：

| 变量名 | 值 | 环境 | 说明 |
|--------|----|----|------|
| `DOUYIN_COOKIE` | `sid_guard=你的cookie值;` | Production, Preview | 必需 |

**第3步：重新部署**
- 点击 `Deployments` > `Redeploy` 使环境变量生效

#### 高级功能：Cookie自动同步（可选）

> **⚠️ 重要说明**：由于安全限制，Vercel的Token和Project ID无法自动获取，需要用户手动配置。这是正常的安全机制，确保您的账户安全。

**这个功能的作用**：
- 🎯 **问题**：通常情况下，网页更新Cookie只在当前会话有效，Vercel重启后会恢复到环境变量中的旧值
- 💡 **解决**：启用此功能后，网页更新Cookie时会自动同步到Vercel环境变量，实现真正的持久化

**配置步骤**（仅在需要自动同步功能时）：

**第1步：获取Vercel Token**
1. 访问 [Vercel Dashboard](https://vercel.com/account/tokens)
2. 点击 "Create Token"
3. 输入Token名称（如：`dydownload-cookie-sync`）
4. 复制生成的Token（格式：`vercel_xxxxxxxxxx`）

**第2步：获取Project ID**
1. 在Vercel项目页面，点击 "Settings"
2. 在 "General" 部分找到 "Project ID"
3. 复制Project ID（格式：`prj_xxxxxxxxxx`）

**第3步：添加环境变量**

| 变量名 | 获取方法 | 说明 |
|--------|----------|------|
| `VERCEL_TOKEN` | 步骤1获取的Token | ⚠️ 敏感信息，请妥善保管 |
| `VERCEL_PROJECT_ID` | 步骤2获取的Project ID | 项目标识符 |
| `VERCEL_TEAM_ID` | 团队Settings > General > Team ID | 仅团队项目需要 |

**第4步：重新部署项目**

**功能优势**：
- 🔄 网页界面更新Cookie后自动同步到Vercel环境变量
- 🚀 无需手动登录Dashboard更新环境变量
- ⚡ 支持一键Cookie更新+自动部署
- 🛡️ 安全的API调用，所有操作通过官方API进行

#### 💡 Vercel部署重点提醒

**✅ 推荐使用方式（90%的用户）**：
- 只配置 `DOUYIN_COOKIE` 环境变量
- Cookie失效时，在Vercel Dashboard手动更新环境变量
- 简单、安全、够用

**🚀 高级使用方式（技术用户）**：
- 额外配置Vercel API相关环境变量
- 支持网页一键更新并自动同步到云端
- 适合频繁更新Cookie的重度用户

**🔐 安全考虑**：
- Vercel Token具有高级权限，请妥善保管
- 建议定期更换Token保证账户安全
- 所有API调用都通过HTTPS加密传输

---

## 📖 使用指南

### 基础操作

1. **📎 粘贴链接** - 在输入框粘贴抖音分享链接
2. **🔍 自动解析** - 点击"解析"按钮，系统自动识别内容
3. **👀 预览内容** - 在预览区域查看视频/图片
4. **💾 下载文件** - 系统自动选择合适的下载方式

### 🍪 Cookie管理功能

#### 更新Cookie
1. 点击页面右上角的 🍪 按钮
2. 输入新的Cookie值
   - 仅sid_guard值：`a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6%7C1756624538...`
3. 可选择是否同步到Vercel环境变量
4. 点击"更新Cookie"完成

#### Cookie格式说明
- ✅ **简化格式**：`sid_guard=值;`
- ✅ **纯值格式**：`a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6%7C1756624538...`

系统会自动识别并处理不同格式的Cookie。

---

## 🛠️ 故障排除

### 常见问题

#### 1. "链接已过期"错误
**原因**：Cookie失效或链接格式不正确
**解决方案**：
- 更新Cookie值（使用网页Cookie更新功能）
- 确保使用最新的抖音分享链接
- 检查链接是否完整（包含https://）

#### 2. "服务器错误"或"解析失败" 
**原因**：Cookie无效或网络问题
**解决方案**：
- 检查 `.env.local` 中的Cookie配置是否正确
- 重新获取Cookie并更新配置
- 重启本地服务器

#### 3. 本地环境Cookie未生效
**原因**：环境变量文件路径或格式问题
**解决方案**：
```bash
# 检查文件是否存在
ls .env.local

# 检查文件内容格式
cat .env.local

# 确保格式正确（无多余空格）
DOUYIN_COOKIE=sid_guard=你的cookie值;
```

#### 4. Vercel部署后功能异常
**原因**：环境变量未配置或格式错误
**解决方案**：
- 在Vercel Dashboard检查环境变量是否存在
- 确认变量名为 `DOUYIN_COOKIE`（区分大小写）
- 重新部署项目使环境变量生效

#### 5. Cookie自动同步失败
**原因**：Vercel API配置不完整
**解决方案**：
- 检查 `VERCEL_TOKEN` 是否有效
- 确认 `VERCEL_PROJECT_ID` 是否正确
- 查看浏览器控制台错误信息

#### 6. 为什么不能自动获取Vercel凭证？
**问题**：能否自动获取Vercel Token和Project ID？
**答案**：**不可以，也不应该！**

**技术原因**：
- Vercel Token是**个人访问令牌**，具有账户级别权限
- 自动获取意味着需要存储您的Vercel用户名/密码
- 这会带来**严重的安全风险**

**安全考虑**：
- ✅ **推荐做法**：手动配置Token（当前方案）
  - 您完全控制权限范围和有效期
  - 可以随时撤销或重新生成
  - 符合安全最佳实践
- ❌ **不安全做法**：自动获取凭证
  - 需要存储密码或长期凭证
  - 增加账户被盗风险
  - 违反零信任安全原则

**替代方案**：
- 使用Vercel CLI的 `vercel env` 命令批量管理
- 编写脚本调用Vercel API进行自动化（但仍需手动配置Token）

### 🔧 调试技巧

1. **本地调试**：查看终端控制台输出
2. **网络问题**：检查浏览器Network标签页
3. **环境变量**：使用 `console.log(process.env.DOUYIN_COOKIE)` 检查
4. **Vercel日志**：在Vercel Dashboard的Functions标签页查看运行日志

---

### 使用方法

1. **📎 粘贴链接** - 在输入框粘贴抖音分享链接
2. **🔍 自动解析** - 点击"解析"按钮，系统自动识别内容
3. **👀 预览内容** - 在预览区域查看视频/图片
4. **💾 下载文件** - 系统自动选择合适的下载方式

## 🛠️ 核心技术特性

### 🔄 智能下载系统
- **自动文件检测**：支持 `.mp4`, `.mov`, `.avi`, `.webm` 等视频格式
- **分类下载策略**：
  - 📹 **视频文件** → 服务器代理下载（确保完整性）
  - 🖼️ **图片文件** → 直接下载（提升速度）
- **用户体验**：统一界面，自动选择最优下载方式

### 🎨 现代化前端
- **响应式设计**：完美适配移动端和桌面端
- **深色模式**：内置主题切换，护眼体验  
- **实时预览**：网格/列表视图，支持全屏预览
- **渐进式Web应用**：接近原生应用的使用体验

### 🛡️ 安全与配置
- **环境变量管理**：敏感数据通过环境变量保护
- **多层Cookie管理**：
  - 配置文件持久化存储
  - 网页界面临时更新
  - Vercel环境变量自动同步

### ⚡ 性能优化与监控
- **性能监控**（可选功能，默认关闭）：
  - 通过环境变量 `ENABLE_PERF_MONITORING=1` 启用
  - 记录API端点响应时间和内存使用情况
  - 输出格式：`⏱️ [zjcdn-api] Duration: 245ms, Memory: 1.23MB heap`
  - 零性能开销：禁用时完全不执行任何监控代码
- **响应缓存**：
  - 2分钟TTL自动过期
  - 相同URL请求直接返回缓存结果
  - 性能提升：缓存命中可达99.6%加速
- **请求去重**：
  - 并发相同请求自动合并
  - 减少重复API调用约80%
  - 降低服务器负载和API压力

### 用户体验
- **🎨 双主题设计** - 明亮/深色模式切换
- **📱 移动优先** - Mobile-First设计理念
- **🔔 实时反馈** - Toast通知、加载状态
- **💡 智能提示** - 操作指引、错误提示

## ⚙️ 故障排除

### 🔄 下载系统相关

### 🔧 403 Forbidden 错误解决

如果遇到 403 错误，通常是以下原因：

#### Cookie 过期

**现象**：
```
FetchError: invalid json response body at https://www.douyin.com/aweme/v1/web/aweme/detail/...
```
或者API返回空响应（status 200但内容为空）

**解决方案**：
1. 打开抖音网页版：https://www.douyin.com
2. 按 `F12` 打开开发者工具
---

## 📅 更新日志

### 🚀 v2026.2.12
*发布日期: 2026年2月12日*

**🔍 环境检测**
- 自动识别本地/Vercel环境，启动时显示环境信息和Cookie加载状态
- 修复 `.env.local` 文件加载问题，添加调试日志

**💾 Cookie管理**
- 网页更新Cookie后自动写入 `.env.local` 文件，重启后保持有效
- 支持 `sid_guard` 完整格式和纯值格式自动转换
- 本地环境立即更新内存变量 + 保存文件，Vercel环境更新运行时变量
- 新增 `/api/cookie-status` 端点检查Cookie有效期

**⚡ 性能优化**
- 新增响应缓存（2分钟TTL）和请求去重机制，减少重复API调用
- `/zjcdn` 端点缓存命中响应速度提升约99%
- 新增性能监控工具（可选启用）

**🔧 Bug修复**
- 修复 `/zjcdn` 返回403错误：改用 `getDouyinNoWatermarkVideo()` 多重回退策略
- 修复流处理资源泄漏，优雅处理客户端断开连接
- 重构 `/douyin` 和 `/workflow` 端点，统一视频处理逻辑

**📝 文档**
- 新增 `function.md` 完整技术文档（架构图、API端点、函数说明）

---

### �🔧 v2025.11.23 - UI修复与优化
*发布日期: 2025年11月23日*

**🐛 Bug修复**
- 修复图片Lightbox查看器按钮无响应问题
  - 重构事件监听器绑定逻辑
  - 修正HTML预定义元素与动态创建冲突
- 修复移动端按钮尺寸不一致问题
  - 统一设置按钮高度和内边距
  - 调整按钮垂直对齐方式

**📱 响应式优化**
- 调整布局断点至1200px以下启用垂直排列
- 添加容器溢出保护
  - 设置max-width和overflow控制
  - 优化长文本显示处理
- 改进移动端触摸区域（最小44px）

**🎨 交互改进**
- 优化Lightbox按钮层级和定位
- 添加移动端触摸高亮反馈
- 改进按钮点击响应速度

### 🚀 v2025.8 - 环境变量优化与Cookie管理
*发布日期: 2025年8月31日*

**🍪 Cookie管理系统**
- 新增网页界面Cookie更新功能
- 支持多种Cookie格式自动识别
- 实现Vercel环境变量自动同步（可选）
- 智能Cookie存储分层：配置文件 + 临时更新 + 云端同步

**🔧 环境变量优化**
- 修复 `.env.local` 文件加载问题
- 完善 `dotenv` 配置，支持本地开发环境
- 添加环境变量示例文件 `.env.example`
- 优化Vercel部署的环境变量配置流程

**�️ 系统稳定性**
- 修复 Node.js fetch API 兼容性问题
- 实现智能文件类型检测和下载策略
- 优化错误处理和用户反馈机制
- 清理冗余代码，简化项目结构

### 🎉 v2025.1 - 现代化界面重构
- ✨ 全新响应式设计，支持明暗主题
- 📱 移动端全屏预览，沉浸式体验
- 🔄 智能内容识别，批量下载优化
- ⚡ 流畅动画效果，现代交互体验

### 🚀 v2025.11 - 增强的下载管理功能

#### 📥 改进的下载系统
- **队列管理**: 基础的下载队列功能，支持任务排序
- **并发控制**: 可设置同时下载文件数量（1-10个）
- **重试机制**: 下载失败时自动重试，可配置重试次数
- **进度显示**: 基本的下载进度监控

#### ⚙️ 下载设置面板
- **参数调整**: 简单的滑块界面调整下载参数
  - 最大并发数：控制同时下载的文件数量
  - 下载间隔：设置下载任务间的等待时间
  - 重试次数：失败时的重试次数设置
- **设置保存**: 配置保存到浏览器本地存储
- **默认设置**: 支持重置为默认配置

#### 🎨 界面改进
- **统计显示**: 显示下载任务的基本统计信息
- **进度条**: 简单的进度条显示下载状态
- **基础控制**: 取消下载等基本操作
- **移动适配**: 在手机端的基本可用性

#### 📊 功能特点
- **文件识别**: 自动识别视频和图片文件类型
- **下载策略**: 视频使用代理下载，图片直接下载
- **错误处理**: 基础的错误提示和处理
- **兼容性**: 保持与原有功能的兼容

#### 🔧 技术改进
- **事件处理**: 基于事件的下载状态更新
- **向后兼容**: 不影响现有的下载功能
- **代码优化**: 改进代码结构，减少重复代码
- **主题支持**: 适配明暗主题切换

#### 💡 实用价值
1. **可见性**: 能看到下载任务的基本状态
2. **可控性**: 基本的下载流程控制
3. **可配置**: 简单的参数自定义
4. **稳定性**: 改进的错误处理机制
5. **易用性**: 更直观的用户界面

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. **Fork 本仓库**
2. **创建特性分支**：`git checkout -b feature/AmazingFeature`
3. **提交更改**：`git commit -m 'Add some AmazingFeature'`
4. **推送分支**：`git push origin feature/AmazingFeature`
5. **开启 Pull Request**

## 📄 开源协议

本项目采用 [ISC License](./LICENSE) 协议

## 🙏 致谢

- **原作者**: [helson-lin](https://github.com/helson-lin) - [douyin_no_watermark](https://github.com/helson-lin/douyin_no_watermark)
- **X-Bogus算法**: [Evil0ctal](https://github.com/Evil0ctal) - [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给个 Star ⭐**

Made with ❤️ by [JIaLeChye](https://github.com/JIaLeChye)

[![GitHub stars](https://img.shields.io/github/stars/JIaLeChye/dydownload?style=social)](https://github.com/JIaLeChye/dydownload/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/JIaLeChye/dydownload?style=social)](https://github.com/JIaLeChye/dydownload/network)

</div>
