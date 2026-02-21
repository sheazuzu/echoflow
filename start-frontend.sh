#!/bin/bash

# Echoflow 前端测试启动脚本
# 用于快速启动前端开发服务器进行测试

echo "🎨 Echoflow 前端测试启动脚本"
echo "================================"
echo ""

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# 检查前端目录是否存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ 错误: 前端目录不存在: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}📂 前端目录: $FRONTEND_DIR${NC}"
echo ""

# 进入前端目录
cd "$FRONTEND_DIR" || exit 1

# 检查 Node.js 是否安装
echo -e "${BLUE}🔍 检查环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm 版本: $NPM_VERSION${NC}"
echo ""

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: package.json 文件不存在${NC}"
    exit 1
fi

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules 目录不存在，需要安装依赖${NC}"
    NEED_INSTALL=true
else
    echo -e "${GREEN}✅ node_modules 目录已存在${NC}"
    NEED_INSTALL=false
fi

# 询问是否重新安装依赖
if [ "$NEED_INSTALL" = false ]; then
    echo ""
    read -p "是否重新安装依赖? (y/N): " reinstall
    if [[ $reinstall =~ ^[Yy]$ ]]; then
        NEED_INSTALL=true
    fi
fi

# 安装依赖
if [ "$NEED_INSTALL" = true ]; then
    echo ""
    echo -e "${BLUE}📦 正在安装依赖...${NC}"
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

echo ""
echo -e "${BLUE}🚀 启动前端开发服务器...${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📝 提示:${NC}"
echo -e "  • 开发服务器将在 ${GREEN}http://localhost:5173${NC} 启动"
echo -e "  • 按 ${YELLOW}Ctrl+C${NC} 停止服务器"
echo -e "  • 修改代码后会自动热重载"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 等待用户确认
read -p "按 Enter 键继续启动..."

# 启动开发服务器
npm run dev

# 如果启动失败
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ 前端服务器启动失败${NC}"
    echo ""
    echo -e "${YELLOW}💡 故障排查建议:${NC}"
    echo "  1. 检查端口 5173 是否被占用"
    echo "  2. 尝试删除 node_modules 并重新安装: rm -rf node_modules && npm install"
    echo "  3. 检查 package.json 中的依赖是否正确"
    echo "  4. 查看上方的错误信息"
    exit 1
fi
