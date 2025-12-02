# MeetingMind Docker 部署说明

## 简化部署（无需nginx）

现在项目已经简化配置，移除了nginx代理层，您可以直接访问localhost！

### 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 OpenAI API Key

# 2. 一键部署
./deploy.sh

# 或者手动部署
docker-compose up -d
```

### 直接访问地址

- **前端界面**: http://localhost:80
- **后端API**: http://localhost:3000

### 为什么不需要nginx？

1. **前端服务**：使用内置的开发服务器，直接暴露80端口
2. **后端服务**：Express服务器直接暴露3000端口  
3. **CORS配置**：后端已配置允许前端域名访问
4. **简单直接**：减少中间层，部署更简单

### 服务架构

```
用户浏览器 → localhost:80 (前端React应用)
           ↓
前端应用 → localhost:3000 (后端API)
```

### 生产环境建议

对于生产环境，您可能仍需要考虑：
- SSL证书（HTTPS）
- 负载均衡
- 域名配置
- 监控和日志

但对于开发和测试环境，当前的简化配置完全足够！