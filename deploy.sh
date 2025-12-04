#!/bin/bash

# MeetingMind 一键部署脚本

echo "🚀 MeetingMind 容器化部署脚本"
echo "================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装（支持两种格式）
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ 使用 Docker Compose 命令: $DOCKER_COMPOSE_CMD"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，正在创建模板..."
    cp .env.example .env
    echo "📝 请编辑 .env 文件，配置 OpenAI API Key"
    echo "   OPENAI_API_KEY=sk-your-actual-api-key"
    exit 1
fi

# 检查 API Key 是否配置
if grep -q "OPENAI_API_KEY=sk-your-openai-api-key-here" .env; then
    echo "❌ 请先在 .env 文件中配置有效的 OpenAI API Key"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 构建和启动服务
echo "🔨 开始构建 Docker 镜像..."
$DOCKER_COMPOSE_CMD build

echo ""
echo "🚀 启动服务..."
$DOCKER_COMPOSE_CMD up -d

echo ""
echo "⏳ 等待服务启动..."
echo "   等待Traefik和服务完全启动..."

# 等待容器完全健康
for i in {1..30}; do
    if docker compose ps | grep -q "healthy"; then
        echo "✅ 所有服务已健康启动"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  超时：部分服务仍在启动中，继续健康检查..."
    fi
    sleep 2
done

echo "   等待Traefik路由注册..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态检查:"
$DOCKER_COMPOSE_CMD ps

echo ""
echo "🔍 服务健康检查:"

# 检查后端服务（通过Traefik）
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常 (通过Traefik: /api/health)"
else
    echo "❌ 后端服务启动失败（无法通过Traefik访问 /api/health）"
fi

# 检查前端服务（通过Traefik）
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ 前端服务运行正常 (通过Traefik: /)"
else
    echo "❌ 前端服务启动失败（无法通过Traefik访问 /）"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   前端界面: http://localhost/"
echo "   后端API: http://localhost/api/"
echo "   Traefik仪表板: http://localhost:8080/ (仅开发环境)"
echo ""
echo "📋 常用命令:"
echo "   查看日志: $DOCKER_COMPOSE_CMD logs -f"
echo "   停止服务: $DOCKER_COMPOSE_CMD down"
echo "   重新部署: $DOCKER_COMPOSE_CMD up -d --build"
echo ""
echo "💡 提示: 首次使用请确保在 .env 文件中配置了正确的 OpenAI API Key"