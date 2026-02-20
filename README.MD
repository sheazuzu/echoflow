# EchoFlow - AI 智能会议助手

<div align="center">

**将会议录音自动转换为结构化会议纪要**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

</div>

---

## 📖 简介

**EchoFlow** 是一个基于 AI 的智能会议助手，帮助您：

- 🎙️ **录制或上传**会议音频
- 🤖 **AI 自动转录**语音为文字
- 📝 **智能生成**结构化会议纪要
- 📧 **一键发送**给多个参会者
- 💾 **下载音频**备份（WAV 格式）

---

## ✨ 核心功能

| 功能 | 描述 |
|-----|------|
| 🎙️ **音频录制** | 浏览器内实时录音，支持暂停/继续，可视化波形显示 |
| 📤 **文件上传** | 支持 MP3/WAV/M4A/OGG/WEBM，拖拽上传 |
| 💾 **音频下载** | 自动转换为 WAV 格式，持久化下载窗口，支持最小化 |
| 🤖 **AI 转录** | 基于 OpenAI Whisper，高精度语音转文字 |
| 📝 **智能纪要** | GPT-4 分析生成结构化会议纪要 |
| 📧 **多收件人邮件** | 标签式输入，批量发送，详细反馈 |
| 💬 **联系反馈** | 多收件人反馈表单 |

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd echoflow

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 OpenAI API Key

# 3. 一键部署
./deploy.sh

# 4. 访问应用
# 前端：http://localhost:80
# 后端：http://localhost:3000
```

### 方式二：本地开发

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 安装前端依赖
cd ../frontend
npm install

# 3. 启动后端（终端1）
cd backend
npm start

# 4. 启动前端（终端2）
cd frontend
npm run dev

# 5. 访问应用
# 前端：http://localhost:5173
# 后端：http://localhost:3000
```

---

## 📋 环境要求

### 必需
- **Node.js** 16+
- **OpenAI API Key** ([获取地址](https://platform.openai.com/api-keys))

### 可选
- **Docker** & **Docker Compose**（用于容器化部署）
- **SMTP 邮箱**（用于发送邮件功能）

---

## ⚙️ 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# OpenAI API（必需）
OPENAI_API_KEY=sk-your-actual-api-key

# SMTP 邮件服务（可选，用于邮件发送功能）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 端口配置（可选）
BACKEND_PORT=3000
FRONTEND_PORT=5173
```

---

## 📚 使用指南

### 1. 录制会议

1. 点击"开始录音"按钮
2. 允许浏览器访问麦克风
3. 录音过程中可暂停/继续
4. 点击"停止录音"完成

### 2. 下载音频（可选）

1. 录音完成后显示下载窗口
2. 查看文件信息（文件名、时长、大小）
3. 点击"下载录音文件"保存 WAV 格式文件
4. 或点击"跳过并开始处理"直接进入下一步
5. 可点击"-"按钮最小化窗口

### 3. 上传音频（替代录音）

1. 点击上传区域或拖拽文件
2. 支持 MP3/WAV/M4A/OGG/WEBM 格式
3. 等待上传完成

### 4. AI 处理

1. 系统自动进行语音转文字
2. AI 分析生成会议纪要
3. 显示处理进度

### 5. 查看纪要

1. 查看结构化的会议纪要
2. 包含：主题、参会人员、讨论要点、决策事项、待办事项
3. 可一键复制全部内容

### 6. 发送邮件

1. 点击"发送邮件"按钮
2. 添加收件人邮箱（支持多个）
3. 点击"发送"按钮
4. 查看发送结果

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                   用户浏览器                     │
│              (React + Vite)                     │
└────────────────┬────────────────────────────────┘
                 │ HTTP/HTTPS
┌────────────────▼────────────────────────────────┐
│              后端服务器                          │
│         (Node.js + Express)                     │
├─────────────────────────────────────────────────┤
│  • 文件上传 (Multer)                            │
│  • 音频处理 (FFmpeg)                            │
│  • AI 转录 (OpenAI Whisper)                     │
│  • 智能分析 (GPT-4)                             │
│  • 邮件发送 (Nodemailer)                        │
└─────────────────────────────────────────────────┘
```

### 技术栈

**前端**
- React 18
- Vite
- Lucide React（图标）
- CSS3

**后端**
- Node.js
- Express
- Multer（文件上传）
- FFmpeg（音频处理）
- OpenAI API（AI 服务）
- Nodemailer（邮件发送）

---

## 📁 项目结构

```
echoflow/
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── App.jsx       # 主组件
│   │   ├── App.css       # 样式
│   │   └── main.jsx      # 入口
│   └── package.json
│
├── backend/              # 后端服务
│   ├── server.js         # 主服务器
│   ├── uploads/          # 上传文件
│   └── package.json
│
├── docker-compose.yml    # Docker 编排
├── Dockerfile.backend    # 后端镜像
├── Dockerfile.frontend   # 前端镜像
├── deploy.sh            # 部署脚本
├── .env.example         # 环境变量示例
├── README.MD            # 项目说明（本文件）
└── DOCUMENTATION.md     # 完整文档
```

---

## 📖 完整文档

查看 **[DOCUMENTATION.md](./DOCUMENTATION.md)** 获取：

- 详细功能说明
- API 文档
- 部署指南
- 常见问题
- 更新日志

---

## 🐛 常见问题

### Q: 需要付费吗？
A: 项目代码免费开源，但需要 OpenAI API Key（按使用量付费）。

### Q: 支持哪些语言？
A: OpenAI Whisper 支持多种语言，包括中文、英文、日文等。

### Q: 音频文件会被保存吗？
A: 音频文件临时存储在服务器，建议定期清理 `backend/uploads/` 目录。

### Q: 可以离线使用吗？
A: 不可以，需要联网调用 OpenAI API。

### Q: 下载的音频是什么格式？
A: WAV 格式，兼容性好，所有设备都能播放。

更多问题请查看 [DOCUMENTATION.md](./DOCUMENTATION.md#常见问题)

---

## 🔄 更新日志

### v2.1.0 (2026-02-20)
- ✨ 新增音频下载功能（WebM 转 WAV）
- ✨ 下载窗口持久化显示，支持最小化
- 🎨 优化下载窗口 UI 设计

### v2.0.0 (2026-02-20)
- ✨ 会议纪要和联系反馈支持多收件人
- 🎨 标签式收件人输入 UI
- 🔧 批量邮件发送逻辑

### v1.0.0 (2026-02-19)
- 🎉 项目初始版本

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

---

## 📧 联系方式

- 📮 邮箱：support@echoflow.com
- 🐛 问题反馈：[GitHub Issues]
- 📖 项目主页：[GitHub Repository]

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给个 Star！**

Made with ❤️ by EchoFlow Team

</div>