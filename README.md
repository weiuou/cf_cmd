# Codeforces API 工具

一个功能强大的 Codeforces API 命令行工具和 Web 服务，支持获取比赛信息、题目数据、用户信息等功能。

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

```bash
# 克隆项目
git clone <repository-url>
cd cf脚本

# 安装依赖
npm install

# 构建项目
npm run build
```

## 使用方法

### 命令行工具

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
