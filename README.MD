EchoFlow Pro 开发指南 (Node.js 全栈版)

欢迎回到 Node.js！我们将构建一个统一语言栈的“前后端分离”应用。

前端: React (Vite) - 负责界面

后端: Node.js (Express) - 负责业务逻辑、文件上传

IDE: IntelliJ IDEA (或者 WebStorm/VS Code)

第一阶段：项目结构初始化

为了管理方便，我们将前端和后端放在同一个大文件夹下。

创建项目根目录

新建一个文件夹，命名为 echoflow-app。

初始化 Node.js 后端

在 echoflow-app 内部新建文件夹 backend。

在终端进入该目录：cd backend

初始化项目：npm init -y

安装后端依赖：

npm install express multer cors


express: Web 服务器框架

multer: 处理文件上传

cors: 解决前后端跨域问题

创建文件：在 backend 目录下创建 server.js，复制以下代码：

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000; // Node.js 常用端口

// 1. 允许前端跨域访问 (CORS)
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// 2. 确保存储目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
fs.mkdirSync(uploadDir);
}

// 3. 配置上传存储
const storage = multer.diskStorage({
destination: (req, file, cb) => cb(null, uploadDir),
filename: (req, file, cb) => {
// 防止文件名冲突
const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
cb(null, uniqueSuffix + '-' + file.originalname);
}
});
const upload = multer({ storage: storage });

// 4. 定义路由
// 上传接口
app.post('/api/upload', upload.single('file'), (req, res) => {
if (!req.file) {
return res.status(400).json({ code: 400, message: "未上传文件" });
}
console.log(`文件接收成功: ${req.file.filename}, 大小: ${req.file.size}`);

    // TODO: 这里可以接入 COS SDK 上传或调用 AI 接口

    res.json({
        code: 200,
        message: "上传成功",
        data: { filename: req.file.filename }
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
res.json({ message: "EchoFlow Node.js Backend is running!" });
});

// 启动服务
app.listen(PORT, () => {
console.log(`后端服务已启动: http://localhost:${PORT}`);
});


初始化 React 前端

回到根目录 echoflow-app。

运行命令：npm create vite@latest frontend -- --template react

进入前端目录：cd frontend

安装依赖：npm install

安装样式库：

npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p


配置 Tailwind:

修改 frontend/tailwind.config.js 的 content 为 ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]。

修改 frontend/src/index.css，加入 @tailwind base; @tailwind components; @tailwind utilities;。

粘贴 UI 代码：将之前的 MeetingAssistant.jsx 内容覆盖到 frontend/src/App.jsx。

最终结构：

echoflow-app/
├── backend/
│   ├── node_modules/
│   ├── uploads/
│   ├── package.json
│   └── server.js    <-- Node.js 服务器
└── frontend/
├── src/
│   └── App.jsx  <-- React 界面
└── ...


第二阶段：在 IntelliJ IDEA 中运行

1. 运行后端 (Node.js)

在 IDEA 中打开 echoflow-app。

找到 backend/server.js。

右键点击 server.js，选择 Run 'server.js'。

控制台会显示：后端服务已启动: http://localhost:3000。

2. 运行前端 (React)

打开 IDEA底部的 Terminal。

输入 cd frontend 进入前端目录。

输入 npm run dev。

终端显示前端地址：http://localhost:5173。

第三阶段：连接前后端

修改前端 frontend/src/App.jsx 中的请求逻辑，端口改为 3000。

修改 startProcessing 或上传函数：

const uploadFileToNode = async (fileObj) => {
// ... 设置状态 ...

    const formData = new FormData();
    formData.append('file', fileObj); // 这里的 'file' 对应 server.js upload.single('file')

    try {
      // 注意：端口变成了 3000
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Node 后端返回:", data);
        // 进入下一步...
      }
    } catch (error) {
      console.error("连接服务器失败:", error);
    }
};
