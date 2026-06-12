#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "🚀 开始更新 MeetAndNote 应用..."
echo "✅ 使用 Docker Compose 命令: $DOCKER_COMPOSE_CMD"

$DOCKER_COMPOSE_CMD pull || true
$DOCKER_COMPOSE_CMD build
$DOCKER_COMPOSE_CMD up -d

docker image prune -f

echo "✅ 应用更新完成"