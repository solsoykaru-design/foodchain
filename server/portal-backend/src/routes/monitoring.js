import { Router } from 'express';
import { query, get, run } from '../db.js';

export const monitoringRouter = Router();

monitoringRouter.get('/uptime', (req, res, next) => {
  try {
    const { tenant_id, days } = req.query;
    const since = days ? new Date(Date.now() - parseInt(days) * 86400000).toISOString().slice(0, 19).replace('T', ' ') : null;
    let sql = 'SELECT * FROM uptime_checks WHERE 1=1';
    const params = [];
    if (tenant_id) { sql += ' AND tenant_id = ?'; params.push(tenant_id); }
    if (since) { sql += ' AND checked_at >= ?'; params.push(since); }
    sql += ' ORDER BY checked_at DESC LIMIT 500';
    res.json(query(sql, params));
  } catch (err) { next(err); }
});

monitoringRouter.get('/status', (req, res, next) => {
  try {
    const tenants = query('SELECT id, name FROM tenants WHERE status = ?', ['active']);
    const results = [];
    for (const t of tenants) {
      const last = get(
        "SELECT * FROM uptime_checks WHERE tenant_id = ? ORDER BY checked_at DESC LIMIT 1",
        [t.id]
      );
      results.push({
        tenant_id: t.id,
        tenant_name: t.name,
        last_check: last,
        status: last ? last.status : 'unknown',
      });
    }
    res.json(results);
  } catch (err) { next(err); }
});

monitoringRouter.post('/check', (req, res, next) => {
  try {
    const tenants = query('SELECT id, name FROM tenants WHERE status = ?', ['active']);
    const results = [];
    for (const t of tenants) {
      const ok = Math.random() > 0.1;
      const status = ok ? 'ok' : (Math.random() > 0.5 ? 'degraded' : 'down');
      const responseTime = ok ? Math.floor(Math.random() * 500) + 50 : null;
      run(
        "INSERT INTO uptime_checks (tenant_id, check_type, status, response_time, error_message) VALUES (?,?,?,?,?)",
        [t.id, 'api', status, responseTime, ok ? null : 'Service unreachable']
      );
      results.push({ tenant_id: t.id, status, response_time: responseTime });
    }
    res.json({ checked: results.length, results });
  } catch (err) { next(err); }
});

monitoringRouter.get('/usage', (req, res, next) => {
  try {
    const tenants = query('SELECT id, name FROM tenants');
    const results = tenants.map(t => {
      const apiCalls = query("SELECT COUNT(*) as c FROM audit_logs WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')", [t.id])[0]?.c || 0;
      return {
        tenant_id: t.id,
        tenant_name: t.name,
        api_requests_30d: apiCalls,
      };
    });
    res.json(results);
  } catch (err) { next(err); }
});
