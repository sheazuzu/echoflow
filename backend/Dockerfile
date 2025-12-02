# 使用官方 Node.js 运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 安装 ffmpeg（用于音频处理）
RUN apk add --no-cache ffmpeg

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]