# Runbook：注册成功但 `auth_users` 表无新增记录

> 适用场景：用户在前端注册得到 201/2xx 响应（或被前端展示为"注册成功"），但运维直接 `SELECT * FROM auth_users` 看不到新行，新账号无法登录。

## 5 步快速定位（按顺序执行）

### Step 1：核对容器内实际生效的 MYSQL_* 环境变量

```bash
docker exec -it <backend_container> env | grep -E '^MYSQL_'
```

**期望输出**：`MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE` 全部存在且非空，且 `MYSQL_DATABASE` 必须与你打算查询的库**完全一致**（注意大小写、有无空格）。

如果有缺失：进入 Step "典型原因 #4 容器没重启导致 .env 改动未生效"。

### Step 2：抓最近 1 小时启动期与注册路径的关键事件

```bash
docker logs --since 1h <backend_container> \
  | grep -E 'DB_INIT|DB_CONNECTED|DB_CONNECT_FAILED|CONFIG_MYSQL_INCOMPLETE|REGISTER_FAILED|REGISTER_PARTIAL'
```

- `DB_INIT` + `DB_CONNECTED`：后端已成功连库，问题不在启动期。
- `CONFIG_MYSQL_INCOMPLETE` 或 `DB_CONNECT_FAILED`：后端进程应该已经 fail-fast 退出，对照容器编排是否在反复重启。
- `REGISTER_FAILED`：注册路由确实落库失败，看 `code/errno/sqlState` 字段。
- `REGISTER_PARTIAL`：写库已成功，但后续会话/审计步骤失败，账号实际已存在，可直接让用户登录。

### Step 3：调用 admin 诊断接口看"当前到底连的是哪个库"

```bash
curl -s -b 'echoflow_user_session=<admin_token>' \
  https://<domain>/api/admin/diagnostics/db | jq
```

返回字段：`host / port / database / user / hasPassword / poolSize / ping / serverVersion / currentSchema`。

- `ping: 'fail'`：MySQL 当前不可达，转 Step 5。
- `currentSchema` ≠ 你以为的库名：进入 Step "典型原因 #1 库错配"。

### Step 4：在容器里跑独立诊断脚本，复现"注册→入库→查询"全链路

```bash
# 只做只读探针
docker exec -it <backend_container> node /app/backend/scripts/diagnoseAuth.js

# 增加写入探针（会自动 INSERT → SELECT 校验 → DELETE 清理）
docker exec -it <backend_container> node /app/backend/scripts/diagnoseAuth.js --email=probe-$(date +%s)@diag.local
```

任一 `FAIL` 都会打印对应的 next-step 建议。

### Step 5：登录 MySQL 直接查最新数据

```sql
SELECT id, email, created_at
FROM auth_users
ORDER BY created_at DESC
LIMIT 5;
```

如果脚本 PASS 但这里没新行 → 你查询的库 / 实例 ≠ 后端实际连接的，参考 Step 3 输出的 `host` / `currentSchema`。

---

## 4 类典型原因与验证方式

### 典型原因 #1：连接到的库不是 production 期望库

**症状**：诊断接口返回的 `currentSchema` 与运维查询的库名不一致；脚本写入探针 PASS，但运维库里依旧空。

**验证**：

```bash
docker exec -it <backend_container> env | grep MYSQL_DATABASE
# 对比腾讯云 CDB 控制台中 production 应使用的库名
```

**修复**：调整 `.env` / docker-compose `environment` 中的 `MYSQL_DATABASE`，重启容器。

### 典型原因 #2：安全组未放通 3306

**症状**：日志中 `DB_CONNECT_FAILED` + `code: ETIMEDOUT` 或 `ECONNREFUSED`；进程在反复重启。

**验证**：

```bash
docker exec -it <backend_container> sh -lc 'apk add --no-cache busybox-extras >/dev/null 2>&1; nc -vz <MYSQL_HOST> <MYSQL_PORT>'
```

**修复**：在腾讯云 VPC 安全组放通后端 ECS/容器出口到 CDB 3306 的入站规则。

### 典型原因 #3：MYSQL_USER 没有 INSERT/SELECT 权限

**症状**：脚本第 2 步（SELECT 1）PASS，但第 3 步（COUNT auth_users）或第 4 步（INSERT）FAIL，错误码 `ER_TABLEACCESS_DENIED_ERROR` / `ER_INSERT_DENIED`。

**验证**（在 MySQL 内）：

```sql
SHOW GRANTS FOR '<MYSQL_USER>'@'%';
```

**修复**：

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON `<MYSQL_DATABASE>`.* TO '<MYSQL_USER>'@'%';
FLUSH PRIVILEGES;
```

### 典型原因 #4：容器没重启导致 .env 改动未生效

**症状**：你刚改了 `.env` 或 docker-compose，但 `docker exec env | grep MYSQL_` 仍是旧值；日志里 `DB_INIT` 时间戳早于你改文件的时间。

**验证**：

```bash
docker inspect <backend_container> --format '{{.State.StartedAt}}'
stat -c '%y' .env  # macOS: stat -f '%Sm' .env
```

**修复**：

```bash
docker-compose up -d --force-recreate backend
# 或
docker-compose down && docker-compose up -d
```

> 提示：仅 `docker-compose restart` 不会重新读取 `.env`，需要 `up -d --force-recreate` 或 `down + up`。

---

## 应急处置

如果用户已经在前端"注册"过但库里没数据，告知用户重新执行注册即可（旧的请求实际并未落库）。修复完根因之后，建议在内部环境用一个全新邮箱完整跑一次"注册 → MySQL 内 SELECT → 退出 → 登录"链路验收。
