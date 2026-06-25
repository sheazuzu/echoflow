function normalizeSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

function toTimestamp(value) {
  return new Date(value).getTime();
}

function cloneRow(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function getUserById(state, id) {
  return state.users.find((item) => item.id === id) || null;
}

function buildActivityJoinedRow(state, row) {
  const user = getUserById(state, row.user_id);
  return {
    ...cloneRow(row),
    user_email: user?.email || '',
    user_display_name: user?.display_name || '',
  };
}

function applyActivityFilters(state, sql, params = []) {
  const normalized = normalizeSql(sql);
  let cursor = 0;
  let rows = [...state.activityLogs];

  if (normalized.includes('a.user_id = ?')) {
    const userId = String(params[cursor++] || '');
    rows = rows.filter((item) => item.user_id === userId);
  }

  const inMatch = normalized.match(/a\.activity_type IN \(([^)]+)\)/i);
  if (inMatch) {
    const placeholderCount = (inMatch[1].match(/\?/g) || []).length;
    const allowedTypes = params.slice(cursor, cursor + placeholderCount).map((item) => String(item || ''));
    cursor += placeholderCount;
    rows = rows.filter((item) => allowedTypes.includes(item.activity_type));
  }

  if (normalized.includes('1 = 0')) {
    rows = [];
  }

  if (normalized.includes('a.activity_type = ?')) {
    const activityType = String(params[cursor++] || '');
    rows = rows.filter((item) => item.activity_type === activityType);
  }

  if (normalized.includes('a.status = ?')) {
    const status = String(params[cursor++] || '');
    rows = rows.filter((item) => item.status === status);
  }

  if (normalized.includes('a.created_at >= ?')) {
    const dateFrom = toTimestamp(params[cursor++]);
    rows = rows.filter((item) => toTimestamp(item.created_at) >= dateFrom);
  }

  if (normalized.includes('a.created_at <= ?')) {
    const dateTo = toTimestamp(params[cursor++]);
    rows = rows.filter((item) => toTimestamp(item.created_at) <= dateTo);
  }

  if (normalized.includes('a.title LIKE ?')) {
    const keyword = String(params[cursor++] || '').replace(/%/g, '').toLowerCase();
    cursor += 5;
    rows = rows.filter((item) => {
      const user = getUserById(state, item.user_id);
      const haystack = [
        item.title,
        item.summary,
        item.searchable_text,
        item.file_id,
        user?.email,
        user?.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }

  return {
    rows,
    consumed: cursor,
  };
}

function createMockDb() {
  const state = {
    users: [],
    passwordResetTokens: [],
    failedLoginAttempts: [],
    auditLogs: [],
    activityLogs: [],
  };

  async function query(sql, params = []) {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('CREATE TABLE IF NOT EXISTS')) {
      return [];
    }

    if (normalized.startsWith('DELETE FROM auth_failed_login_attempts WHERE created_at < ?')) {
      const threshold = toTimestamp(params[0]);
      state.failedLoginAttempts = state.failedLoginAttempts.filter((item) => toTimestamp(item.created_at) >= threshold);
      return [];
    }

    if (normalized.startsWith('DELETE FROM auth_password_reset_tokens WHERE used_at IS NOT NULL OR expires_at <= ?')) {
      const reference = toTimestamp(params[0]);
      state.passwordResetTokens = state.passwordResetTokens.filter((item) => !item.used_at && toTimestamp(item.expires_at) > reference);
      return [];
    }

    if (normalized.startsWith('DELETE FROM auth_audit_logs WHERE id NOT IN')) {
      const limitMatch = normalized.match(/LIMIT (\d+)/i);
      const limit = Number(limitMatch?.[1] || params[0] || state.auditLogs.length || 0);
      state.auditLogs = [...state.auditLogs]
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
        .slice(0, limit);
      return [];
    }

    if (normalized.startsWith('SELECT * FROM auth_users WHERE email = ? LIMIT 1')) {
      const email = String(params[0] || '');
      const row = state.users.find((item) => item.email === email) || null;
      return row ? [cloneRow(row)] : [];
    }

    if (normalized.startsWith('SELECT * FROM auth_users WHERE id = ? LIMIT 1')) {
      const id = String(params[0] || '');
      const row = state.users.find((item) => item.id === id) || null;
      return row ? [cloneRow(row)] : [];
    }

    if (normalized.startsWith('SELECT * FROM auth_users ORDER BY created_at DESC')) {
      return [...state.users]
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
        .map(cloneRow);
    }

    if (normalized.startsWith('INSERT INTO auth_users (')) {
      const [id, email, displayName, passwordHash, role, profileJson, createdAt, updatedAt, lastLoginAt] = params;
      state.users.push({
        id,
        email,
        display_name: displayName,
        password_hash: passwordHash,
        role,
        profile_json: profileJson,
        created_at: createdAt,
        updated_at: updatedAt,
        last_login_at: lastLoginAt,
      });
      return { affectedRows: 1 };
    }

    if (normalized.startsWith('UPDATE auth_users SET email = ?, display_name = ?, password_hash = ?, role = ?, profile_json = ?, updated_at = ?, last_login_at = ? WHERE id = ?')) {
      const [email, displayName, passwordHash, role, profileJson, updatedAt, lastLoginAt, id] = params;
      const target = state.users.find((item) => item.id === id);
      if (target) {
        target.email = email;
        target.display_name = displayName;
        target.password_hash = passwordHash;
        target.role = role;
        target.profile_json = profileJson;
        target.updated_at = updatedAt;
        target.last_login_at = lastLoginAt;
      }
      return { affectedRows: target ? 1 : 0 };
    }

    if (normalized.startsWith('SELECT * FROM auth_failed_login_attempts WHERE attempt_key = ? ORDER BY created_at ASC')) {
      const key = String(params[0] || '');
      return state.failedLoginAttempts
        .filter((item) => item.attempt_key === key)
        .sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at))
        .map(cloneRow);
    }

    if (normalized.startsWith('SELECT id FROM auth_failed_login_attempts WHERE attempt_key = ?')) {
      const key = String(params[0] || '');
      return state.failedLoginAttempts
        .filter((item) => item.attempt_key === key)
        .map((item) => ({ id: item.id }));
    }

    if (normalized.startsWith('INSERT INTO auth_failed_login_attempts (')) {
      const [id, attemptKey, account, ipAddress, createdAt, lockedUntil] = params;
      state.failedLoginAttempts.push({
        id,
        attempt_key: attemptKey,
        account,
        ip_address: ipAddress,
        created_at: createdAt,
        locked_until: lockedUntil,
      });
      return { affectedRows: 1 };
    }

    if (normalized.startsWith('DELETE FROM auth_failed_login_attempts WHERE attempt_key = ?')) {
      const key = String(params[0] || '');
      state.failedLoginAttempts = state.failedLoginAttempts.filter((item) => item.attempt_key !== key);
      return [];
    }

    if (normalized.startsWith('DELETE FROM auth_password_reset_tokens WHERE user_id = ?')) {
      const userId = String(params[0] || '');
      state.passwordResetTokens = state.passwordResetTokens.filter((item) => item.user_id !== userId);
      return [];
    }

    if (normalized.startsWith('INSERT INTO auth_password_reset_tokens (')) {
      const [id, userId, tokenHash, createdAt, expiresAt, usedAt] = params;
      state.passwordResetTokens.push({
        id,
        user_id: userId,
        token_hash: tokenHash,
        created_at: createdAt,
        expires_at: expiresAt,
        used_at: usedAt,
      });
      return { affectedRows: 1 };
    }

    if (normalized.startsWith('SELECT * FROM auth_password_reset_tokens WHERE token_hash = ? LIMIT 1')) {
      const tokenHash = String(params[0] || '');
      const row = state.passwordResetTokens.find((item) => item.token_hash === tokenHash) || null;
      return row ? [cloneRow(row)] : [];
    }

    if (normalized.startsWith('INSERT INTO auth_audit_logs (')) {
      const [id, createdAt, action, success, reason, userId, account, requesterJson, metadataJson] = params;
      state.auditLogs.push({
        id,
        created_at: createdAt,
        action,
        success,
        reason,
        user_id: userId,
        account,
        requester_json: requesterJson,
        metadata_json: metadataJson,
      });
      return { affectedRows: 1 };
    }

    if (normalized.startsWith('SELECT * FROM auth_audit_logs ORDER BY created_at DESC')) {
      return [...state.auditLogs]
        .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
        .map(cloneRow);
    }

    if (normalized.startsWith('INSERT INTO auth_activity_logs (')) {
      const [id, dedupeKey, userId, fileId, activityType, status, title, summary, detailJson, metadataJson, searchableText, createdAt, updatedAt] = params;
      const existingIndex = dedupeKey
        ? state.activityLogs.findIndex((item) => item.dedupe_key === dedupeKey)
        : -1;

      const nextRow = {
        id,
        dedupe_key: dedupeKey,
        user_id: userId,
        file_id: fileId,
        activity_type: activityType,
        status,
        title,
        summary,
        detail_json: detailJson,
        metadata_json: metadataJson,
        searchable_text: searchableText,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      if (existingIndex >= 0) {
        state.activityLogs[existingIndex] = {
          ...state.activityLogs[existingIndex],
          ...nextRow,
          id: state.activityLogs[existingIndex].id,
          created_at: state.activityLogs[existingIndex].created_at,
        };
      } else {
        state.activityLogs.push(nextRow);
      }
      return { affectedRows: 1 };
    }

    if (normalized.startsWith('SELECT a.*, u.email AS user_email, u.display_name AS user_display_name FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id WHERE a.dedupe_key = ? LIMIT 1')) {
      const dedupeKey = String(params[0] || '');
      const row = state.activityLogs.find((item) => item.dedupe_key === dedupeKey) || null;
      return row ? [buildActivityJoinedRow(state, row)] : [];
    }

    if (normalized.startsWith('SELECT a.*, u.email AS user_email, u.display_name AS user_display_name FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id WHERE a.id = ? LIMIT 1')) {
      const id = String(params[0] || '');
      const row = state.activityLogs.find((item) => item.id === id) || null;
      return row ? [buildActivityJoinedRow(state, row)] : [];
    }

    if (normalized.startsWith('SELECT COUNT(*) AS total FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      return [{ total: rows.length }];
    }

    if (normalized.startsWith('SELECT a.*, u.email AS user_email, u.display_name AS user_display_name FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows, consumed } = applyActivityFilters(state, normalized, params);
      const preparedPagination = normalized.includes('LIMIT ? OFFSET ?');
      const inlinePagination = normalized.match(/LIMIT (\d+) OFFSET (\d+)/i);
      const limit = preparedPagination
        ? Number(params[consumed] || rows.length || 0)
        : inlinePagination
          ? Number(inlinePagination[1] || rows.length || 0)
          : rows.length;
      const offset = preparedPagination
        ? Number(params[consumed + 1] || 0)
        : inlinePagination
          ? Number(inlinePagination[2] || 0)
          : 0;
      return rows
        .sort((a, b) => {
          const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
          if (createdDiff !== 0) return createdDiff;
          return toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        })
        .slice(offset, offset + limit)
        .map((row) => buildActivityJoinedRow(state, row));
    }

    if (normalized.startsWith('SELECT COUNT(*) AS total_records, COUNT(DISTINCT a.user_id) AS unique_users FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      return [{
        total_records: rows.length,
        unique_users: new Set(rows.map((item) => item.user_id)).size,
      }];
    }

    if (normalized.startsWith('SELECT a.status AS bucket, COUNT(*) AS count FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      const grouped = new Map();
      rows.forEach((item) => grouped.set(item.status, (grouped.get(item.status) || 0) + 1));
      return [...grouped.entries()].map(([bucket, count]) => ({ bucket, count }));
    }

    if (normalized.startsWith('SELECT a.activity_type AS bucket, COUNT(*) AS count FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      const grouped = new Map();
      rows.forEach((item) => grouped.set(item.activity_type, (grouped.get(item.activity_type) || 0) + 1));
      return [...grouped.entries()].map(([bucket, count]) => ({ bucket, count }));
    }

    if (normalized.startsWith('SELECT DATE(a.created_at) AS bucket, COUNT(*) AS count FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      const grouped = new Map();
      rows.forEach((item) => {
        const bucket = new Date(item.created_at).toISOString().slice(0, 10);
        grouped.set(bucket, (grouped.get(bucket) || 0) + 1);
      });
      return [...grouped.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 14)
        .map(([bucket, count]) => ({ bucket, count }));
    }

    if (normalized.startsWith('SELECT a.user_id, u.email AS user_email, u.display_name AS user_display_name, MAX(a.created_at) AS latest_created_at FROM auth_activity_logs a LEFT JOIN auth_users u ON u.id = a.user_id')) {
      const { rows } = applyActivityFilters(state, normalized, params);
      const grouped = new Map();
      rows.forEach((item) => {
        const user = getUserById(state, item.user_id);
        const current = grouped.get(item.user_id);
        if (!current || toTimestamp(item.created_at) > toTimestamp(current.latest_created_at)) {
          grouped.set(item.user_id, {
            user_id: item.user_id,
            user_email: user?.email || '',
            user_display_name: user?.display_name || '',
            latest_created_at: item.created_at,
          });
        }
      });
      return [...grouped.values()].sort((a, b) => toTimestamp(b.latest_created_at) - toTimestamp(a.latest_created_at));
    }

    throw new Error(`未支持的 SQL: ${normalized}`);
  }

  async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async function withTransaction(handler) {
    const connection = {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, params = []) {
        const normalized = normalizeSql(sql);

        if (normalized.startsWith('SELECT * FROM auth_password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1')) {
          const [tokenHash, now] = params;
          const row = state.passwordResetTokens.find((item) => item.token_hash === tokenHash && !item.used_at && toTimestamp(item.expires_at) > toTimestamp(now)) || null;
          return [row ? [cloneRow(row)] : []];
        }

        if (normalized.startsWith('UPDATE auth_password_reset_tokens SET used_at = ? WHERE id = ?')) {
          const [usedAt, id] = params;
          const target = state.passwordResetTokens.find((item) => item.id === id);
          if (target) {
            target.used_at = usedAt;
          }
          return [{ affectedRows: target ? 1 : 0 }];
        }

        if (normalized.startsWith('SELECT * FROM auth_users WHERE id = ? LIMIT 1')) {
          const [id] = params;
          const row = state.users.find((item) => item.id === id) || null;
          return [row ? [cloneRow(row)] : []];
        }

        const rows = await query(sql, params);
        return [rows];
      },
    };

    await connection.beginTransaction();
    try {
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    testConnection: async () => {},
    query,
    queryOne,
    withTransaction,
    closePool: async () => {},
    ensureMysqlConfigured: () => {},
    getPool: () => ({ query }),
    getPoolStatus: () => ({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE || 'echoflow_test',
      user: process.env.MYSQL_USER || 'test',
      hasPassword: Boolean(process.env.MYSQL_PASSWORD),
      poolSize: 10,
      configured: true,
      initialized: true,
    }),
    pingPool: async () => ({
      ok: true,
      durationMs: 1,
      error: null,
      serverVersion: '8.0.99-mock',
      currentSchema: process.env.MYSQL_DATABASE || 'echoflow_test',
    }),
    __state: state,
  };
}

module.exports = {
  createMockDb,
};