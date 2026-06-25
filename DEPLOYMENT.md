# MeetingMind 容器化部署指南

## 快速开始

### 1. 环境准备
- 安装 Docker 和 Docker Compose
- 复制环境变量配置文件：`cp .env.example .env`
- 在 `.env` 文件中配置 OpenAI API Key

### 2. 构建和启动服务
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 访问应用
- 前端界面：http://localhost:80
- 后端API：http://localhost:3000

## 服务说明

### 后端服务 (backend)
- 端口：3000
- 功能：音频处理、AI转录、会议纪要生成、视频链接转录（YouTube / Bilibili）
- 依赖：Node.js、ffmpeg、yt-dlp、OpenAI API

### 前端服务 (frontend)  
- 端口：80
- 功能：用户界面、文件上传、结果展示
- 技术：React + Vite（内置开发服务器）

## 环境变量配置

在 `.env` 文件中配置以下变量：

```bash
# OpenAI API Key (必需)
OPENAI_API_KEY=sk-your-actual-api-key

# 可选配置
BACKEND_PORT=3000
FRONTEND_PORT=80

# 视频链接转录功能（YouTube / Bilibili）
VIDEO_URL_FEATURE_ENABLED=true        # 设为 false 可关闭该功能（后端路由 404，前端入口隐藏）
VIDEO_URL_MAX_DURATION_SECONDS=14400  # 视频最长时长，默认 4 小时
VIDEO_URL_MAX_TASKS_PER_HOUR=5        # 单用户限流阈值
VIDEO_URL_MAX_FILE_SIZE_MB=500        # 下载音频体积上限
YT_DLP_TIMEOUT_MS=600000              # yt-dlp 调用超时上限
YT_DLP_BINARY=yt-dlp                  # yt-dlp 可执行文件名 / 路径
YT_DLP_COOKIES_FILE=                  # 可选：Bilibili 高清 / 会员视频使用的 cookies.txt 路径

# MySQL 认证存储（必填，否则后端启动时 fail-fast 退出）
MYSQL_HOST=                           # 数据库地址，例如 10.0.1.6 或 cdb-xxx.tencentcdb.com
MYSQL_PORT=3306
MYSQL_USER=                           # 必填
MYSQL_PASSWORD=                       # 强烈建议非空
MYSQL_DATABASE=                       # 必填，例如 local
```

## MySQL 配置确认 checklist

`MYSQL_*` 是认证模块写入用户表 `auth_users` 的关键依赖。production 出现"注册成功但库里没数据"几乎都源于这块配置在容器中未真正生效。请按下列顺序排查：

```bash
# 1. 容器内确认实际生效的 MYSQL_* 环境变量（绝不能被 docker run --env-file 之外的来源覆盖）
docker exec -it <backend_container> env | grep -E '^MYSQL_'

# 2. 查最近 1 小时启动期日志关键事件
docker logs --since 1h <backend_container> | grep -E 'DB_INIT|DB_CONNECTED|DB_CONNECT_FAILED|CONFIG_MYSQL_INCOMPLETE|REGISTER_FAILED'

# 3. 在容器内执行只读诊断脚本，验证连接 + 表 + 写入权限
docker exec -it <backend_container> npm --prefix /app/backend run diagnose:auth
docker exec -it <backend_container> node /app/backend/scripts/diagnoseAuth.js --email=probe-$(date +%s)@diag.local

# 4. 用 admin 账号请求诊断接口，看后端真正连的是哪个 host/database
curl -s -b 'echoflow_user_session=<admin_token>' https://your-domain/api/admin/diagnostics/db | jq
```

> 说明：从本版本开始，后端启动时会以 `DB_INIT` 事件打印实际加载的 host / port / database / user / hasPassword（密码仅打印 boolean）；并强制执行 `SELECT 1` 健康检查，任何一步失败都会让进程立即退出（fail-fast），杜绝"前端注册返回 201、但表里没数据"的灵异现象。

完整排障 Runbook 见 [docs/runbook-auth.md](docs/runbook-auth.md)。

## 视频链接转录功能补充说明

- **依赖项**：Docker 镜像在 [backend/Dockerfile](backend/Dockerfile) 中已预装 `python3`/`py3-pip` 以及 `pip install yt-dlp`，同时保留了 `ffmpeg`。本地开发需要手动安装：

  ```bash
  # macOS
  brew install yt-dlp ffmpeg

  # Ubuntu / Debian
  sudo apt install ffmpeg python3-pip && pip3 install -U yt-dlp

  # 验证
  yt-dlp --version
  ```

- **启动检查**：后端启动时会自动打印 `yt-dlp --version` 结果到日志（`YT_DLP_CHECK_OK`）；若失败则记录 `YT_DLP_CHECK_FAILED` 警告。

- **Bilibili Cookies**（可选）：需要下载某些仅登录用户可访问的高清/会员视频时，可将 Bilibili 的 cookies 导出为 Netscape 格式的 `cookies.txt`，挂载到容器并设置 `YT_DLP_COOKIES_FILE` 环境变量。

- **资源限制**：默认每用户每小时 5 任务、视频最长 4 小时、音频下载上限 500 MB。可通过上述环境变量调整。

## 常用命令

```bash
# 停止服务
docker-compose down

# 重新构建镜像
docker-compose build --no-cache

# 查看服务日志
docker-compose logs backend
docker-compose logs frontend

# 进入容器调试
docker-compose exec backend sh
docker-compose exec frontend sh

# 清理所有容器和镜像
docker-compose down -v --rmi all
```

## 生产环境部署

### 1. 使用生产环境配置
```bash
# 使用生产环境docker-compose文件（如有）
docker-compose -f docker-compose.prod.yml up -d
```

### 2. 配置反向代理
建议使用 Nginx 或 Traefik 作为反向代理，配置 SSL 证书。

### 3. 监控和日志
- 配置日志收集（如 ELK Stack）
- 设置健康检查监控
- 配置备份策略

## 故障排除

### 常见问题

1. **端口冲突**：检查 3000 和 80 端口是否被占用
2. **API Key 错误**：确认 OpenAI API Key 正确配置
3. **构建失败**：清理缓存重新构建 `docker-compose build --no-cache`
4. **文件权限**：确保 uploads 目录有写入权限

### 健康检查
服务启动后，可以通过以下方式验证：
- 访问 http://localhost:80 查看前端界面
- 访问 http://localhost:3000 查看后端API状态

## 更新部署

当代码更新时：
```bash
# 拉取最新代码
git pull

# 重新构建和部署
docker-compose up -d --build
```