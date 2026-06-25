# 使用官方 Node.js 运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先安装系统依赖（ffmpeg、python3、yt-dlp），并刷新 apk 索引避免旧索引导致的依赖解析失败
# 放在 npm install 之前，可提升 Docker 缓存命中率
RUN set -eux; \
    for i in 1 2 3; do \
        apk update && apk add --no-cache ffmpeg python3 py3-pip && break || { \
            echo "apk attempt $i failed, retrying in 3s..."; sleep 3; \
        }; \
    done; \
    pip3 install --no-cache-dir --break-system-packages yt-dlp || pip3 install --no-cache-dir yt-dlp; \
    yt-dlp --version; \
    rm -rf /var/cache/apk/* /root/.cache/pip

# 预创建日志目录（与 docker-compose 卷挂载点一致）
RUN mkdir -p /app/logs

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装 Node 依赖
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]