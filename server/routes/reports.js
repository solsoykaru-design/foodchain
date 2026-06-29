module.exports = function(app, db, config) {
  const { authenticateToken, requireRole, safeError } = config;

  function dateRange(req) {
    const from = req.query.from || '';
    const to = req.query.to || '';
    return { from, to };
  }

  function periodWhere(from, to, alias) {
    const a = alias ? `${alias}.` : '';
    if (from && to) return ` AND date(${a}created_at) BETWEEN ? AND ? `;
    if (from) return ` AND date(${a}created_at) >= ? `;
    if (to) return ` AND date(${a}created_at) <= ? `;
    return '';
  }

  function periodParams(from, to) {
    if (from && to) return [from, to];
    if (from) return [from];
    if (to) return [to];
    return [];
  }

  // ─── Network dashboard: compare branches / tenants ─────────────
  app.get('/api/reports/network/dashboard', authenticateToken, requireRole('admin', 'manager', 'owner', 'superadmin'), (req, res) => {
    try {
      const { from, to } = dateRange(req);
      const role = req.user?.role;
      const tenantFilter = role === 'superadmin' ? '' : ' AND o.tenant_id = ? ';
      const tenantParam = role === 'superadmin' ? [] : [req.tenant_id];

      const where = `${periodWhere(from, to, 'o')} ${tenantFilter} AND o.status != 'cancelled'`;
      const params = [...periodParams(from, to), ...tenantParam];

      const rows = db.prepare(`
        SELECT
          o.tenant_id AS branch_id,
          COALESCE(t.name, t.nickname, 'Точка ' || o.tenant_id) AS branch_name,
          COUNT(*) AS orders,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_check,
          COUNT(DISTINCT o.user_id) AS guests
        FROM orders o
        LEFT JOIN foodchain_portal_tenants t ON t.id = o.tenant_id
        WHERE 1=1 ${where}
        GROUP BY o.tenant_id
        ORDER BY revenue DESC
      `).all(...params);

      const overall = db.prepare(`
        SELECT
          COUNT(*) AS orders,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_check,
          COUNT(DISTINCT o.user_id) AS guests
        FROM orders o
        WHERE 1=1 ${where}
      `).get(...params);

      // previous period for growth
      let prevFrom = '', prevTo = '';
      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);
        const len = t.getTime() - f.getTime();
        const pf = new Date(f.getTime() - len - 86400000);
        const pt = new Date(t.getTime() - len - 86400000);
        prevFrom = pf.toISOString().slice(0, 10);
        prevTo = pt.toISOString().slice(0, 10);
      }
      const prevWhere = `${periodWhere(prevFrom, prevTo, 'o')} ${tenantFilter} AND o.status != 'cancelled'`;
      const prevParams = [...periodParams(prevFrom, prevTo), ...tenantParam];
      const prevOverall = db.prepare(`
        SELECT ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue
        FROM orders o
        WHERE 1=1 ${prevWhere}
      `).get(...prevParams);

      const prevByTenant = db.prepare(`
        SELECT o.tenant_id AS branch_id, ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue
        FROM orders o
        WHERE 1=1 ${prevWhere}
        GROUP BY o.tenant_id
      `).all(...prevParams);
      const prevMap = Object.fromEntries(prevByTenant.map(r => [r.branch_id, r.revenue]));

      const branches = rows.map(r => {
        const prev = prevMap[r.branch_id] || 0;
        const growth = prev > 0 ? Math.round(((r.revenue - prev) / prev) * 1000) / 10 : null;
        return { ...r, prev_revenue: prev, revenue_growth_percent: growth };
      });

      const totalGrowth = prevOverall.revenue > 0
        ? Math.round(((overall.revenue - prevOverall.revenue) / prevOverall.revenue) * 1000) / 10
        : null;

      // daily trend per branch
      const trend = db.prepare(`
        SELECT
          date(o.created_at) AS date,
          o.tenant_id AS branch_id,
          COALESCE(t.name, t.nickname, 'Точка ' || o.tenant_id) AS branch_name,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          COUNT(*) AS orders
        FROM orders o
        LEFT JOIN foodchain_portal_tenants t ON t.id = o.tenant_id
        WHERE 1=1 ${where}
        GROUP BY date(o.created_at), o.tenant_id
        ORDER BY date(o.created_at) ASC
      `).all(...params);

      res.json({
        overall: {
          ...overall,
          branches_count: branches.length,
          revenue_growth_percent: totalGrowth,
        },
        branches,
        trend,
      });
    } catch (e) {
      console.error('[Reports] network dashboard error:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── Sales by branches (daily) ─────────────────────────────────
  app.get('/api/reports/sales/branches-daily', authenticateToken, requireRole('admin', 'manager', 'owner', 'superadmin'), (req, res) => {
    try {
      const { from, to } = dateRange(req);
      const role = req.user?.role;
      const tenantFilter = role === 'superadmin' ? '' : ' AND o.tenant_id = ? ';
      const tenantParam = role === 'superadmin' ? [] : [req.tenant_id];
      const where = `${periodWhere(from, to, 'o')} ${tenantFilter} AND o.status != 'cancelled'`;
      const params = [...periodParams(from, to), ...tenantParam];

      const rows = db.prepare(`
        SELECT
          date(o.created_at) AS date,
          COALESCE(t.name, t.nickname, 'Точка ' || o.tenant_id) AS branch,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          COUNT(*) AS orders,
          ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_check
        FROM orders o
        LEFT JOIN foodchain_portal_tenants t ON t.id = o.tenant_id
        WHERE 1=1 ${where}
        GROUP BY date(o.created_at), o.tenant_id
        ORDER BY date(o.created_at) ASC
      `).all(...params);
      res.json({ data: rows });
    } catch (e) {
      console.error('[Reports] branches-daily error:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── Sales by branches (monthly) ───────────────────────────────
  app.get('/api/reports/sales/branches-monthly', authenticateToken, requireRole('admin', 'manager', 'owner', 'superadmin'), (req, res) => {
    try {
      const { from, to } = dateRange(req);
      const role = req.user?.role;
      const tenantFilter = role === 'superadmin' ? '' : ' AND o.tenant_id = ? ';
      const tenantParam = role === 'superadmin' ? [] : [req.tenant_id];
      const where = `${periodWhere(from, to, 'o')} ${tenantFilter} AND o.status != 'cancelled'`;
      const params = [...periodParams(from, to), ...tenantParam];

      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m', o.created_at) AS month,
          COALESCE(t.name, t.nickname, 'Точка ' || o.tenant_id) AS branch,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          COUNT(*) AS orders,
          ROUND(COALESCE(AVG(o.total), 0), 2) AS avg_check
        FROM orders o
        LEFT JOIN foodchain_portal_tenants t ON t.id = o.tenant_id
        WHERE 1=1 ${where}
        GROUP BY strftime('%Y-%m', o.created_at), o.tenant_id
        ORDER BY month ASC
      `).all(...params);
      res.json({ data: rows });
    } catch (e) {
      console.error('[Reports] branches-monthly error:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // ─── Profit by branches (revenue/cost approximation) ───────────
  app.get('/api/reports/finance/profit-branches', authenticateToken, requireRole('admin', 'manager', 'owner', 'superadmin'), (req, res) => {
    try {
      const { from, to } = dateRange(req);
      const role = req.user?.role;
      const tenantFilter = role === 'superadmin' ? '' : ' AND o.tenant_id = ? ';
      const tenantParam = role === 'superadmin' ? [] : [req.tenant_id];
      const where = `${periodWhere(from, to, 'o')} ${tenantFilter} AND o.status != 'cancelled'`;
      const params = [...periodParams(from, to), ...tenantParam];

      const rows = db.prepare(`
        SELECT
          COALESCE(t.name, t.nickname, 'Точка ' || o.tenant_id) AS branch,
          ROUND(COALESCE(SUM(o.total), 0), 2) AS revenue,
          ROUND(COALESCE(SUM(o.subtotal * 0.35), 0), 2) AS cost,
          ROUND(COALESCE(SUM(o.total) - SUM(o.subtotal * 0.35), 0), 2) AS gross_profit,
          ROUND(COALESCE((SUM(o.total) - SUM(o.subtotal * 0.35)) / NULLIF(SUM(o.total), 0) * 100, 0), 2) AS margin,
          COUNT(*) AS orders
        FROM orders o
        LEFT JOIN foodchain_portal_tenants t ON t.id = o.tenant_id
        WHERE 1=1 ${where}
        GROUP BY o.tenant_id
        ORDER BY revenue DESC
      `).all(...params);
      res.json({ data: rows });
    } catch (e) {
      console.error('[Reports] profit-branches error:', e.message);
      res.status(500).json({ error: safeError(e.message) });
    }
  });
};
