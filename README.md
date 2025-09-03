# Codeforces API 工具

一个功能强大的 Codeforces API 命令行工具和 Web 服务，支持获取比赛信息、题目数据、用户信息等功能。

F**k you Cloudflare authentication

## 功能特性

- 🏆 **比赛管理**: 获取比赛列表、排名、题目信息
- 📚 **题目查询**: 搜索题目、按标签筛选、获取题目详情
- 👤 **用户信息**: 查看用户资料、提交记录、统计分析
- ⚙️ **配置管理**: 灵活的配置系统，支持缓存、速率限制等
- 🚀 **Web API**: 提供 RESTful API 接口
- 💾 **智能缓存**: 减少 API 调用，提高响应速度
- 🔄 **重试机制**: 自动处理网络错误和超时

## 技术栈

- **Node.js** + **TypeScript**: 核心运行环境
- **Commander.js**: 命令行界面
- **Express.js**: Web 服务器
- **Axios**: HTTP 客户端
- **文件系统缓存**: 本地数据缓存

## 安装

首先确保你的系统已经安装了：
- [Node.js](https://nodejs.org/) (版本 20.18.1 或更高)
- [Git](https://git-scm.com/)

### 方法一：本地安装

#### Linux/macOS
```bash
# 克隆项目
git clone <repository-url>
cd cf_cmd

# 安装依赖
npm install

# 构建项目
npm run build
```

#### Windows
```cmd
# 克隆项目
git clone <repository-url>
cd cf_cmd

# 安装依赖
npm install

# 构建项目
npm run build
```

### 方法二：全局安装

如果你想在任何目录下都能使用 `cf` 命令，可以全局安装。

#### Linux/macOS
```bash
# 克隆项目
git clone <repository-url>
cd cf_cmd

# 安装依赖
npm install

# 全局安装（需要管理员权限）
sudo npm link
```

#### Windows
在 Windows 中，需要以管理员权限运行命令提示符或 PowerShell：

```cmd
# 克隆项目
git clone <repository-url>
cd cf_cmd

# 安装依赖
npm install

# 全局安装（需要管理员权限的 PowerShell 或命令提示符）
npm link
```

安装完成后，你可以在任何目录下使用 `cf` 命令：

```bash
# 查看帮助
cf --help

# 获取比赛列表
cf contest list

# 获取比赛排名
cf contest standings 1234
```

### 卸载全局命令

#### Linux/macOS
```bash
sudo npm uninstall -g codeforces-api-tool
```

#### Windows (管理员 PowerShell 或命令提示符)
```cmd
npm uninstall -g codeforces-api-tool
```

### 故障排除

#### Windows 系统
如果在 Windows 上遇到 Chrome/Puppeteer 相关的问题：

1. 确保系统已安装 Chrome 浏览器
2. 如果出现权限错误，请以管理员身份运行命令
3. 如果遇到 Puppeteer 无法下载 Chrome 的问题，可以设置环境变量：
   ```cmd
   set PUPPETEER_SKIP_DOWNLOAD=true
   ```
   然后重新安装依赖：
   ```cmd
   npm install
   ```

#### WSL (Windows Subsystem for Linux)
如果在 WSL 环境中遇到 Chrome 相关问题：

1. 安装必要的依赖：
   ```bash
   sudo apt-get update && sudo apt-get install -y \
   ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
   libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
   libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
   libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
   libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
   libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
   libxtst6 lsb-release wget xdg-utils
   ```

2. 如果无法安装某些包，可以尝试使用系统 Chrome：
   ```bash
   # 下载并安装 Chrome
   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo dpkg -i google-chrome-stable_current_amd64.deb
   sudo apt-get install -f
   ```

3. 设置环境变量并指定 Chrome 路径：
   ```bash
   # 添加到 ~/.bashrc
   export PUPPETEER_SKIP_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   ```

4. 如果仍然遇到问题，可以尝试在 Windows 主机上安装并使用 Chrome：
   ```bash
   # 在 ~/.bashrc 中添加（将 username 替换为你的 Windows 用户名）
   export PUPPETEER_EXECUTABLE_PATH="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
   ```

## 使用方法

### 命令行工具

如果你使用本地安装，需要使用 `npm run cli` 命令：

```bash
# 查看帮助
npm run cli -- --help

# 获取比赛列表
npm run cli contest list

# 获取比赛排名
npm run cli contest standings 1234

# 搜索题目
npm run cli problem search "binary search"

# 获取用户信息
npm run cli user info tourist

# 查看配置
npm run cli config show
```

如果你使用全局安装，可以直接使用 `cf` 命令：

```bash
# 查看帮助
cf --help

# 获取比赛列表
cf contest list

# 获取比赛排名
cf contest standings 1234

# 搜索题目
cf problem search "binary search"

# 获取用户信息
cf user info tourist

# 查看配置
cf config show
```

### Web 服务

```bash
# 启动服务器
npm start

# 开发模式
npm run dev
```

服务器启动后，可以通过以下端点访问 API：

- `GET /health` - 健康检查
- `GET /api/contests` - 获取比赛列表
- `GET /api/contests/:id/standings` - 获取比赛排名
- `GET /api/problems` - 获取题目列表
- `GET /api/users/:handles` - 获取用户信息

## 配置

### 配置文件

项目提供了两种配置方式：

1. **项目配置文件**: `config.json` (项目根目录)
2. **用户配置文件**: `~/.codeforces-api-tool/config.json` (用户主目录)

用户配置文件会覆盖项目配置文件的设置。

### 配置选项

项目根目录的 `config.json` 包含详细的配置说明：

```json
{
  "api": {
    "baseUrl": "https://codeforces.com/api",
    "timeout": 10000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "rateLimit": {
      "requests": 5,
      "window": 1000,
      "burstLimit": 5
    }
  },
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxEntries": 1000,
    "maxSize": 52428800,
    "cacheDir": "~/.cf-tool/cache"
  }
}
```

### 配置说明

- **api.timeout**: API请求超时时间（毫秒）
- **api.retryAttempts**: 请求失败时的重试次数
- **api.rateLimit**: 速率限制配置，防止请求过于频繁
- **cache.enabled**: 是否启用缓存功能
- **cache.ttl**: 缓存生存时间（秒）
- **cache.maxEntries**: 内存中最大缓存条目数
- **cache.maxSize**: 缓存最大占用内存（字节）

### 自定义配置

你可以复制项目根目录的 `config.json` 到用户目录 `~/.codeforces-api-tool/config.json` 并修改相应设置。

## 开发

```bash
# 开发模式
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建
npm run build
```

## 项目结构

```
src/
├── api/           # API 客户端
├── cli/           # 命令行界面
│   └── commands/  # CLI 命令
├── config/        # 配置管理
├── server/        # Web 服务器
├── types/         # TypeScript 类型定义
└── utils/         # 工具函数
```

## 许可证

MIT License
