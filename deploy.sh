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

# 证书管理配置
echo "🔒 配置 HTTPS 证书..."
echo "请选择部署环境:"
echo "1) 私有部署 (使用自签名证书，适合内网或测试)"
echo "2) 云服务器部署 (使用 Let's Encrypt 免费证书，需要公网IP和域名)"
read -p "请输入选项 (1/2): " deploy_mode

# 创建必要的目录
mkdir -p traefik/certs
mkdir -p traefik/dynamic
mkdir -p traefik/letsencrypt

# 清理旧的规则配置 (确保从干净的状态开始)
if [ -f .env ]; then
    sed -i '' '/FRONTEND_RULE/d' .env
    sed -i '' '/BACKEND_RULE/d' .env
fi

if [ "$deploy_mode" = "1" ]; then
    echo "🏠 正在配置私有部署环境..."
    
    # 生成自签名证书
    if [ ! -f "traefik/certs/server.crt" ]; then
        echo "Generating self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout traefik/certs/server.key \
            -out traefik/certs/server.crt \
            -subj "/CN=localhost"
    fi

    # 生成动态配置文件以加载证书
    cat > traefik/dynamic/tls.yml <<EOF
tls:
  stores:
    default:
      defaultCertificate:
        certFile: /certs/server.crt
        keyFile: /certs/server.key
EOF

    # 清理 override 文件（如果存在）
    rm -f docker-compose.override.yml
    
    echo "✅ 自签名证书配置完成"

elif [ "$deploy_mode" = "2" ]; then
    echo "☁️  正在配置云服务器环境..."
    
    read -p "请输入您的域名 (例如: example.com): " domain_name
    if [ -z "$domain_name" ]; then
        echo "❌ 域名不能为空"
        exit 1
    fi

    read -p "请输入您的邮箱地址 (用于 Let's Encrypt 通知): " acme_email
    
    # 更新 .env 中的邮箱
    if grep -q "ACME_EMAIL=" .env; then
        sed -i '' "s/ACME_EMAIL=.*/ACME_EMAIL=$acme_email/" .env
    else
        echo "ACME_EMAIL=$acme_email" >> .env
    fi

    # 配置路由规则到 .env
    echo "FRONTEND_RULE=Host(\`$domain_name\`)" >> .env
    echo "BACKEND_RULE=Host(\`$domain_name\`) && PathPrefix(\`/api\`)" >> .env

    # 确保 acme.json 存在且权限正确 (600)
    if [ ! -f "traefik/letsencrypt/acme.json" ]; then
        touch traefik/letsencrypt/acme.json
    fi
    chmod 600 traefik/letsencrypt/acme.json

    # 创建 override 文件以启用 ACME resolver
    cat > docker-compose.override.yml <<EOF
version: '3'
services:
  frontend:
    labels:
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
  backend:
    labels:
      - "traefik.http.routers.backend.tls.certresolver=myresolver"
EOF

    # 清理动态 TLS 配置（避免冲突，或者保留为空）
    rm -f traefik/dynamic/tls.yml
    
    echo "✅ Let's Encrypt 配置完成 (域名: $domain_name)"
else
    echo "❌ 无效选项，默认使用私有部署模式"
    # 默认为私有部署逻辑...
fi

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

# 检查SMTP配置和连通性
echo ""
echo "📧 SMTP邮件服务检查:"

# 检查.env文件中是否配置了SMTP
if [ -f ".env" ]; then
    SMTP_HOST=$(grep "^SMTP_HOST=" .env | cut -d '=' -f2)
    SMTP_USER=$(grep "^SMTP_USER=" .env | cut -d '=' -f2)
    SMTP_PASS=$(grep "^SMTP_PASS=" .env | cut -d '=' -f2)
    
    # 检查哪些配置缺失
    MISSING_CONFIGS=()
    [ -z "$SMTP_HOST" ] && MISSING_CONFIGS+=("SMTP_HOST")
    [ -z "$SMTP_USER" ] && MISSING_CONFIGS+=("SMTP_USER")
    [ -z "$SMTP_PASS" ] && MISSING_CONFIGS+=("SMTP_PASS")
    
    if [ ${#MISSING_CONFIGS[@]} -gt 0 ]; then
        echo "⚠️  SMTP配置不完整，邮件发送功能将不可用"
        echo ""
        echo "❌ 缺失的配置项:"
        for config in "${MISSING_CONFIGS[@]}"; do
            case $config in
                "SMTP_HOST")
                    echo "   ❌ $config - 请输入SMTP服务器地址 (例如: smtp.gmail.com)"
                    ;;
                "SMTP_USER")
                    echo "   ❌ $config - 请输入发件人邮箱地址 (例如: your-email@gmail.com)"
                    ;;
                "SMTP_PASS")
                    echo "   ❌ $config - 请输入邮箱密码或应用专用密码"
                    echo "      提示: Gmail需要使用应用专用密码，不是普通登录密码"
                    ;;
            esac
        done
        echo ""
        echo "📝 请在项目根目录的 .env 文件中配置以上参数"
        echo "   示例配置:"
        echo "   SMTP_HOST=smtp.gmail.com"
        echo "   SMTP_PORT=587"
        echo "   SMTP_SECURE=false"
        echo "   SMTP_USER=your-email@gmail.com"
        echo "   SMTP_PASS=your-app-password"
    else
        # 读取所有SMTP配置
        SMTP_PORT=$(grep "^SMTP_PORT=" .env | cut -d '=' -f2)
        SMTP_SECURE=$(grep "^SMTP_SECURE=" .env | cut -d '=' -f2)
        
        # 设置默认值
        SMTP_PORT=${SMTP_PORT:-587}
        SMTP_SECURE=${SMTP_SECURE:-false}
        
        echo "✅ SMTP配置已找到 (服务器: $SMTP_HOST)"
        echo "   正在测试SMTP连通性..."
        
        # 使用Node.js测试SMTP连接，直接传递配置值
        SMTP_TEST_RESULT=$(docker compose exec -T backend node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: '$SMTP_HOST',
    port: parseInt('$SMTP_PORT'),
    secure: '$SMTP_SECURE' === 'true',
    auth: {
        user: '$SMTP_USER',
        pass: '$SMTP_PASS',
    },
    // 增加超时时间，解决网络不稳定导致的DNS解析失败
    connectionTimeout: 60000,  // 连接超时：60秒
    greetingTimeout: 30000,    // 握手超时：30秒
    socketTimeout: 60000,      // Socket超时：60秒
});
transporter.verify()
    .then(() => console.log('SUCCESS'))
    .catch(err => console.log('FAILED:' + err.message));
" 2>&1)
        
        if echo "$SMTP_TEST_RESULT" | grep -q "SUCCESS"; then
            echo "   ✅ SMTP服务器连接成功，邮件发送功能已就绪"
        else
            echo "   ❌ SMTP服务器连接失败"
            ERROR_MSG=$(echo "$SMTP_TEST_RESULT" | grep "FAILED:" | cut -d ':' -f2-)
            if [ -n "$ERROR_MSG" ]; then
                echo "   错误信息: $ERROR_MSG"
            fi
            echo "   请检查SMTP配置是否正确"
            echo "   当前配置: $SMTP_HOST:$SMTP_PORT (secure=$SMTP_SECURE)"
        fi
    fi
else
    echo "⚠️  未找到.env文件，无法检查SMTP配置"
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