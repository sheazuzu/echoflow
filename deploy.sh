#!/bin/bash

# MeetingMind 一键部署脚本

echo "🚀 MeetingMind 容器化部署脚本"
echo "================================"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

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
docker-compose build

echo ""
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态检查:"
docker-compose ps

echo ""
echo "🔍 服务健康检查:"

# 检查后端服务
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常 (端口: 3000)"
else
    echo "❌ 后端服务启动失败"
fi

# 检查前端服务
if curl -f http://localhost:80 > /dev/null 2>&1; then
    echo "✅ 前端服务运行正常 (端口: 80)"
else
    echo "❌ 前端服务启动失败"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   前端界面: http://localhost:80"
echo "   后端API: http://localhost:3000"
echo ""
echo "📋 常用命令:"
echo "   查看日志: docker-compose logs -f"
echo "   停止服务: docker-compose down"
echo "   重新部署: docker-compose up -d --build"
echo ""
echo "💡 提示: 首次使用请确保在 .env 文件中配置了正确的 OpenAI API Key"