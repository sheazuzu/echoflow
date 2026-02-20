# EchoFlow - 完整项目文档

## 📖 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [功能详解](#功能详解)
  - [音频录制与上传](#音频录制与上传)
  - [AI 转录与分析](#ai-转录与分析)
  - [会议纪要生成](#会议纪要生成)
  - [邮件发送](#邮件发送)
  - [联系反馈](#联系反馈)
- [部署指南](#部署指南)
- [API 文档](#api-文档)
- [常见问题](#常见问题)

---

## 项目简介

**EchoFlow** 是一个基于 AI 的智能会议助手应用，帮助用户将会议录音自动转换为结构化的会议纪要。

### 🎯 核心价值

- **节省时间**：自动转录和整理会议内容，无需手动记录
- **提高效率**：AI 智能分析，生成结构化纪要
- **便捷分享**：一键发送会议纪要给多个参会者
- **易于使用**：现代化 UI，操作简单直观

### 🌟 适用场景

- 团队会议记录
- 客户访谈整理
- 培训课程笔记
- 电话会议纪要
- 头脑风暴总结

---

## 核心功能

### 1. 🎙️ 音频录制与上传

#### 实时录制
- **浏览器内录音**：无需安装任何软件
- **实时波形显示**：可视化音频输入
- **录音时长显示**：实时显示录音时间
- **暂停/继续**：支持录音过程中暂停
- **音频下载**：录音完成后可下载 WAV 格式文件

#### 文件上传
- **多格式支持**：MP3, WAV, M4A, OGG, WEBM
- **拖拽上传**：支持拖拽文件到上传区域
- **文件验证**：自动检查文件格式和大小
- **上传进度**：实时显示上传进度

#### 音频下载功能
- **格式转换**：自动将 WebM 转换为 WAV 格式（兼容性更好）
- **持久化窗口**：下载窗口不会自动消失
- **最小化支持**：可最小化为浮动按钮
- **文件信息**：显示文件名、时长、大小
- **随时下载**：处理前后都可以下载录音文件

### 2. 🤖 AI 转录与分析

#### 语音转文字
- **高精度转录**：基于 OpenAI Whisper 模型
- **多语言支持**：自动识别语言
- **标点符号**：自动添加标点符号
- **说话人识别**：区分不同发言人（如果音频清晰）

#### 智能分析
- **内容理解**：AI 理解会议内容
- **关键信息提取**：自动提取重要信息
- **结构化整理**：按主题组织内容

### 3. 📝 会议纪要生成

#### 结构化输出
- **会议主题**：自动识别会议主题
- **参会人员**：提取参会人员信息
- **讨论要点**：按主题整理讨论内容
- **决策事项**：突出显示重要决策
- **待办事项**：列出后续行动项
- **时间信息**：记录会议时间

#### 格式化展示
- **Markdown 格式**：结构清晰，易于阅读
- **可复制内容**：一键复制全部内容
- **打印友好**：支持打印输出

### 4. 📧 邮件发送（多收件人）

#### 灵活的收件人管理
- **多收件人支持**：一次发送给多个邮箱
- **标签式展示**：已添加的收件人以标签形式显示
- **快捷添加**：支持回车键快速添加
- **邮箱验证**：自动验证邮箱格式
- **防重复**：不允许添加重复邮箱
- **删除管理**：点击标签即可删除收件人

#### 批量发送
- **逐个发送**：确保每个收件人都能收到
- **发送统计**：显示成功/失败数量
- **详细反馈**：列出发送失败的邮箱
- **错误处理**：单个失败不影响其他邮件

#### 邮件内容
- **完整纪要**：包含完整的会议纪要内容
- **格式化**：HTML 格式，美观易读
- **附件支持**：可选添加原始音频文件（未来功能）

### 5. 💬 联系反馈（多收件人）

#### 反馈表单
- **姓名**：发件人姓名
- **邮箱**：发件人邮箱（用于回复）
- **收件人**：支持添加多个收件人
- **反馈内容**：详细的反馈信息

#### 多收件人支持
- **标签式输入**：与会议纪要邮件一致的设计
- **绿色主题**：区别于会议纪要的紫色主题
- **相同交互**：添加、删除、验证逻辑一致

#### 验证机制
- **必填验证**：所有字段必填
- **邮箱格式**：验证发件人和收件人邮箱
- **内容长度**：至少 10 个字符
- **收件人数量**：至少添加一个收件人

---

## 技术架构

### 前端技术栈

```
React 18          - UI 框架
Vite             - 构建工具
Lucide React     - 图标库
CSS3             - 样式（无需额外 UI 库）
MediaRecorder API - 浏览器录音
Fetch API        - HTTP 请求
```

### 后端技术栈

```
Node.js          - 运行环境
Express          - Web 框架
Multer           - 文件上传
FFmpeg           - 音频处理
OpenAI API       - AI 转录和分析
Nodemailer       - 邮件发送
```

### 项目结构

```
echoflow/
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── App.jsx       # 主应用组件
│   │   ├── App.css       # 样式文件
│   │   └── main.jsx      # 入口文件
│   ├── public/           # 静态资源
│   └── package.json      # 前端依赖
│
├── backend/              # 后端服务
│   ├── server.js         # 主服务器文件
│   ├── uploads/          # 上传文件存储
│   └── package.json      # 后端依赖
│
├── docker-compose.yml    # Docker 编排
├── Dockerfile.backend    # 后端镜像
├── Dockerfile.frontend   # 前端镜像
├── deploy.sh            # 部署脚本
├── .env.example         # 环境变量示例
└── README.MD            # 项目说明
```

### 数据流程

```
用户操作
  ↓
前端界面 (React)
  ↓
HTTP 请求
  ↓
后端 API (Express)
  ↓
文件处理 (FFmpeg)
  ↓
AI 处理 (OpenAI)
  ↓
返回结果
  ↓
前端展示
```

---

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn
- OpenAI API Key
- （可选）Docker 和 Docker Compose

### 本地开发

#### 1. 克隆项目

```bash
git clone <repository-url>
cd echoflow
```

#### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，填入你的 OpenAI API Key
OPENAI_API_KEY=sk-your-actual-api-key
```

#### 3. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

#### 4. 启动服务

```bash
# 启动后端（在 backend 目录）
npm start
# 后端运行在 http://localhost:3000

# 启动前端（在 frontend 目录，新终端）
npm run dev
# 前端运行在 http://localhost:5173
```

#### 5. 访问应用

打开浏览器访问：http://localhost:5173

### Docker 部署

#### 快速部署

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 2. 一键部署
./deploy.sh

# 或手动部署
docker-compose up -d
```

#### 访问地址

- 前端：http://localhost:80
- 后端：http://localhost:3000

---

## 功能详解

### 音频录制与上传

#### 录音功能

**开始录音**
1. 点击"开始录音"按钮
2. 浏览器会请求麦克风权限，点击"允许"
3. 录音开始，界面显示实时波形和时长
4. 可以随时点击"暂停"或"停止"

**录音完成**
1. 点击"停止录音"按钮
2. 系统自动将 WebM 格式转换为 WAV 格式
3. 显示下载窗口，包含文件信息
4. 可以选择下载文件或直接处理

**下载窗口功能**
- **文件信息**：显示文件名、时长、大小
- **下载按钮**：下载 WAV 格式文件到本地
- **跳过按钮**：不下载，直接开始 AI 处理
- **最小化按钮**：最小化窗口为浮动按钮
- **持久显示**：窗口不会自动消失，完全由用户控制

**最小化功能**
- 点击右上角"-"按钮最小化窗口
- 窗口变为右下角浮动按钮
- 浮动按钮带脉冲动画提醒
- 点击浮动按钮重新展开窗口

#### 上传功能

**支持的格式**
- MP3 (audio/mpeg)
- WAV (audio/wav)
- M4A (audio/mp4)
- OGG (audio/ogg)
- WEBM (audio/webm)

**上传方式**
1. **点击上传**：点击上传区域，选择文件
2. **拖拽上传**：直接拖拽文件到上传区域

**文件验证**
- 自动检查文件格式
- 检查文件大小（建议 < 100MB）
- 显示验证错误信息

### AI 转录与分析

#### 处理流程

1. **音频预处理**
   - 格式转换（统一为 MP3）
   - 音频压缩（降低文件大小）
   - 质量优化（提高识别准确度）

2. **语音转文字**
   - 调用 OpenAI Whisper API
   - 自动识别语言
   - 生成完整转录文本

3. **智能分析**
   - 调用 GPT-4 分析转录内容
   - 提取关键信息
   - 生成结构化纪要

#### 处理时间

- 短音频（< 5分钟）：约 30-60 秒
- 中等音频（5-15分钟）：约 1-3 分钟
- 长音频（15-30分钟）：约 3-5 分钟

### 会议纪要生成

#### 纪要结构

```markdown
# 会议纪要

## 基本信息
- **会议时间**：2024-01-01 10:00
- **会议主题**：产品规划讨论
- **参会人员**：张三、李四、王五

## 讨论要点

### 1. 产品功能规划
- 讨论了新功能的优先级
- 确定了开发时间表

### 2. 技术方案
- 评估了不同的技术方案
- 选择了最优方案

## 决策事项
1. 采用方案 A 进行开发
2. 下周开始实施

## 待办事项
- [ ] 张三：完成技术文档（截止日期：2024-01-05）
- [ ] 李四：准备设计稿（截止日期：2024-01-08）

## 备注
无
```

#### 操作功能

- **复制内容**：一键复制全部纪要
- **发送邮件**：发送给多个收件人
- **重新开始**：开始新的会议记录

### 邮件发送

#### 会议纪要邮件

**使用流程**
1. 会议纪要生成完成后，点击"发送邮件"按钮
2. 在弹出的对话框中添加收件人邮箱
3. 输入邮箱后点击"添加"或按回车键
4. 可以添加多个收件人
5. 点击"发送"按钮

**收件人管理**
- **添加**：输入邮箱 → 点击"添加"或按回车
- **删除**：点击收件人标签上的 ❌ 按钮
- **验证**：自动验证邮箱格式，防止重复
- **统计**：实时显示已添加收件人数量

**发送结果**
- **全部成功**："邮件发送成功！会议纪要已发送到 N 个邮箱"
- **部分成功**："部分邮件发送成功：X 个成功，Y 个失败。失败的邮箱: ..."
- **全部失败**："所有邮件发送失败，请检查邮箱地址或稍后重试"

#### 联系反馈邮件

**使用流程**
1. 点击页面右上角"Contact"按钮
2. 填写姓名和您的邮箱
3. 添加收件人邮箱（可添加多个）
4. 填写反馈内容（至少 10 个字符）
5. 点击"发送反馈"按钮

**设计特点**
- **绿色主题**：区别于会议纪要的紫色主题
- **相同交互**：与会议纪要邮件一致的操作方式
- **独立状态**：两个功能的收件人列表互不干扰

### 联系反馈

#### 表单字段

- **姓名** *（必填）
- **您的邮箱** *（必填，用于接收回复）
- **收件人邮箱** *（必填，可添加多个）
- **反馈内容** *（必填，至少 10 个字符）

#### 验证规则

| 字段 | 验证规则 |
|-----|---------|
| 姓名 | 必填 |
| 您的邮箱 | 必填，邮箱格式 |
| 收件人 | 至少一个，邮箱格式，不重复 |
| 反馈内容 | 必填，10-5000 字符 |

#### 错误提示

- "请填写所有必需字段"
- "请输入有效的邮箱地址"
- "请输入有效的收件人邮箱地址"
- "该邮箱已添加"
- "请至少添加一个收件人邮箱"
- "反馈内容至少需要10个字符"

---

## 部署指南

### Docker 部署（推荐）

#### 环境准备

1. 安装 Docker 和 Docker Compose
2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置以下变量：
# OPENAI_API_KEY=sk-your-key
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-password
```

#### 一键部署

```bash
./deploy.sh
```

部署脚本会自动：
- 检查环境变量配置
- 停止旧容器
- 构建新镜像
- 启动服务
- 显示服务状态

#### 手动部署

```bash
# 构建并启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 访问地址

- 前端：http://localhost:80
- 后端：http://localhost:3000

### 生产环境部署

#### 1. 服务器准备

- 操作系统：Ubuntu 20.04+ / CentOS 7+
- 内存：至少 2GB
- 磁盘：至少 10GB
- 端口：80, 3000

#### 2. 安全配置

**配置 HTTPS**
```bash
# 使用 Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

**配置 Nginx 反向代理**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 3. 监控和日志

**配置日志收集**
```bash
# 查看容器日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 配置日志轮转
# 编辑 docker-compose.yml，添加：
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

**健康检查**
```bash
# 检查后端健康状态
curl http://localhost:3000/api/health

# 检查前端
curl http://localhost:80
```

#### 4. 备份策略

```bash
# 备份上传文件
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz backend/uploads/

# 备份环境变量
cp .env .env.backup
```

### 常用命令

```bash
# 查看服务状态
docker-compose ps

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f [service-name]

# 进入容器
docker-compose exec backend sh
docker-compose exec frontend sh

# 更新部署
git pull
docker-compose up -d --build

# 清理资源
docker-compose down -v --rmi all
```

---

## API 文档

### 后端 API

#### 1. 健康检查

```
GET /api/health
```

**响应**
```json
{
  "status": "ok",
  "message": "EchoFlow Backend is running"
}
```

#### 2. 上传音频文件

```
POST /api/upload
Content-Type: multipart/form-data
```

**请求参数**
- `file`: 音频文件（必填）

**响应**
```json
{
  "success": true,
  "message": "文件上传成功",
  "fileId": "1234567890-audio.mp3"
}
```

#### 3. 处理音频

```
POST /api/process
Content-Type: application/json
```

**请求体**
```json
{
  "fileId": "1234567890-audio.mp3"
}
```

**响应**
```json
{
  "success": true,
  "transcript": "转录文本...",
  "summary": "会议纪要内容..."
}
```

#### 4. 发送会议纪要邮件

```
POST /api/send-meeting-email
Content-Type: application/json
```

**请求体**
```json
{
  "fileId": "1234567890-audio.mp3",
  "recipients": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

**响应**
```json
{
  "success": true,
  "message": "邮件发送成功！会议纪要已发送到 2 个邮箱",
  "results": [
    { "email": "user1@example.com", "success": true },
    { "email": "user2@example.com", "success": true }
  ]
}
```

#### 5. 发送联系反馈

```
POST /api/contact
Content-Type: application/json
```

**请求体**
```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "recipients": [
    "support@example.com"
  ],
  "message": "反馈内容..."
}
```

**响应**
```json
{
  "success": true,
  "message": "感谢您的反馈！邮件已成功发送给 1 位收件人。"
}
```

---

## 常见问题

### 功能相关

**Q: 支持哪些音频格式？**
A: 支持 MP3, WAV, M4A, OGG, WEBM 格式。

**Q: 音频文件大小有限制吗？**
A: 建议单个文件不超过 100MB，录音时长不超过 1 小时。

**Q: 支持哪些语言？**
A: OpenAI Whisper 支持多种语言，包括中文、英文、日文等。

**Q: 会议纪要的准确度如何？**
A: 准确度取决于音频质量。建议使用清晰的录音，避免背景噪音。

**Q: 可以编辑生成的会议纪要吗？**
A: 目前支持复制内容后在其他编辑器中修改。

**Q: 下载的音频文件是什么格式？**
A: 下载的文件是 WAV 格式，兼容性好，所有设备都能播放。

**Q: 下载窗口会自动消失吗？**
A: 不会。下载窗口会持续显示，直到您点击下载、跳过或最小化按钮。

**Q: 最小化后如何重新打开下载窗口？**
A: 点击右下角的浮动下载按钮即可重新展开窗口。

### 技术相关

**Q: 为什么需要 OpenAI API Key？**
A: 项目使用 OpenAI 的 Whisper（转录）和 GPT-4（分析）API。

**Q: API 调用费用如何？**
A: 根据 OpenAI 定价，Whisper 约 $0.006/分钟，GPT-4 根据 token 计费。

**Q: 可以使用其他 AI 服务吗？**
A: 可以修改后端代码，接入其他语音识别和 NLP 服务。

**Q: 数据安全吗？**
A: 音频文件存储在本地服务器，不会永久保存。建议定期清理 uploads 目录。

**Q: 支持离线使用吗？**
A: 不支持。需要联网调用 OpenAI API。

### 部署相关

**Q: Docker 部署失败怎么办？**
A: 检查：1) Docker 是否正常运行 2) 端口是否被占用 3) 环境变量是否配置

**Q: 如何配置 SMTP 邮件服务？**
A: 在 .env 文件中配置 SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS。

**Q: 可以部署到云服务器吗？**
A: 可以。支持部署到 AWS, 阿里云, 腾讯云等任何支持 Docker 的服务器。

**Q: 如何更新到最新版本？**
A: 执行 `git pull` 然后 `./deploy.sh` 即可。

### 错误处理

**Q: "麦克风权限被拒绝"怎么办？**
A: 在浏览器设置中允许网站访问麦克风。

**Q: "文件上传失败"怎么办？**
A: 检查文件格式和大小，确保网络连接正常。

**Q: "AI 处理失败"怎么办？**
A: 检查 OpenAI API Key 是否正确，账户是否有余额。

**Q: "邮件发送失败"怎么办？**
A: 检查 SMTP 配置是否正确，邮箱地址是否有效。

---

## 更新日志

### v2.1.0 (2026-02-20)
- ✨ 新增音频下载功能（WebM 转 WAV）
- ✨ 下载窗口持久化显示
- ✨ 支持下载窗口最小化
- 🎨 优化下载窗口 UI 设计
- 🐛 修复录音格式兼容性问题

### v2.0.0 (2026-02-20)
- ✨ 会议纪要邮件支持多收件人
- ✨ 联系反馈支持多收件人
- 🎨 标签式收件人输入 UI
- 🔧 后端批量邮件发送逻辑
- 📊 详细的发送结果反馈

### v1.0.0 (2026-02-19)
- 🎉 项目初始版本
- ✨ 音频录制与上传
- ✨ AI 转录与分析
- ✨ 会议纪要生成
- ✨ 邮件发送功能
- ✨ 联系反馈功能

---

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 报告问题

在 GitHub Issues 中提交问题，请包含：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（浏览器、操作系统等）

### 提交代码

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

---

## 联系方式

- 项目主页：[GitHub Repository]
- 问题反馈：[GitHub Issues]
- 邮箱：support@echoflow.com

---

**感谢使用 EchoFlow！** 🎉
