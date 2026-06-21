module.exports = function setupReports(app, db) {
  function getDateRange(from, to) {
    const d = new Date(); d.setDate(1);
    return {
      fromDate: from || d.toISOString().split('T')[0],
      toDate: to || new Date().toISOString().split('T')[0]
    };
  }

  // ─── SALES GROUP ────────────────────────────────────────────────

  app.get('/api/reports/sales/summary', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      let sql = `SELECT date(created_at) as day, COUNT(*) as order_count, SUM(total) as revenue, AVG(total) as avg_check FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`;
      const params = [fromDate, toDate];
      const rows = db.prepare(sql + ` GROUP BY date(created_at) ORDER BY day`).all(...params);
      const totals = db.prepare(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_revenue, COALESCE(AVG(total),0) as avg_check FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).get(...params);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/daily', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const sql = `SELECT date(created_at) as day, COUNT(*) as order_count, SUM(total) as revenue, SUM(subtotal) as subtotal, SUM(discount) as total_discount, AVG(total) as avg_check FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY date(created_at) ORDER BY day`;
      const rows = db.prepare(sql).all(fromDate, toDate);
      const totals = db.prepare(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_revenue, COALESCE(SUM(subtotal),0) as total_subtotal, COALESCE(SUM(discount),0) as total_discount, COALESCE(AVG(total),0) as avg_check FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/hourly', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as order_count, SUM(total) as revenue FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY hour ORDER BY hour`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/weekday', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT CAST(strftime('%w', created_at) AS INTEGER) as weekday, COUNT(*) as order_count, SUM(total) as revenue, AVG(total) as avg_check FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY weekday ORDER BY weekday`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/cumulative', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(created_at) as day, SUM(total) as daily_revenue, SUM(SUM(total)) OVER (ORDER BY date(created_at)) as cumulative FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY date(created_at) ORDER BY day`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/discounts', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(o.created_at) as day, COUNT(*) as discount_count, SUM(o.discount) as discount_sum FROM orders o WHERE o.discount > 0 AND date(o.created_at) BETWEEN ? AND ? GROUP BY date(o.created_at) ORDER BY day`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT COUNT(*) as total_discounts, COALESCE(SUM(discount),0) as total_discount_sum FROM orders WHERE discount > 0 AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/payment-sources', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT payment_method, COUNT(*) as count, SUM(total) as total FROM orders WHERE status NOT IN ('cancelled') AND is_paid = 1 AND date(created_at) BETWEEN ? AND ? GROUP BY payment_method`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/monthly', (req, res) => {
    try {
      const { year } = req.query;
      const y = year || new Date().getFullYear();
      const rows = db.prepare(`SELECT CAST(strftime('%m', created_at) AS INTEGER) as month, CAST(strftime('%Y', created_at) AS INTEGER) as year, COUNT(*) as order_count, SUM(total) as revenue FROM orders WHERE status NOT IN ('cancelled') AND strftime('%Y', created_at) = ? GROUP BY month ORDER BY month`).all(String(y));
      const totals = db.prepare(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_revenue FROM orders WHERE status NOT IN ('cancelled') AND strftime('%Y', created_at) = ?`).get(String(y));
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/order-source', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT type, COUNT(*) as count, SUM(total) as total FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY type`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/order-type', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT type, COUNT(*) as count, SUM(total) as total FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY type`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/payment-type', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT payment_method, SUM(total) as total, COUNT(*) as count FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY payment_method`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/branches-daily', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      let sql = `SELECT COALESCE(b.name, 'Unknown') as branch_name, date(o.created_at) as day, COUNT(*) as orders, SUM(o.total) as revenue FROM orders o LEFT JOIN branches b ON o.branch_id = b.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ?`;
      const params = [fromDate, toDate];
      sql += ` GROUP BY b.name, date(o.created_at) ORDER BY b.name, day`;
      const rows = db.prepare(sql).all(...params);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/sales/branches-monthly', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const sql = `SELECT COALESCE(b.name, 'Unknown') as branch_name, CAST(strftime('%Y-%m', o.created_at) AS TEXT) as month, COUNT(*) as orders, SUM(o.total) as revenue FROM orders o LEFT JOIN branches b ON o.branch_id = b.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ? GROUP BY b.name, month ORDER BY b.name, month`;
      const rows = db.prepare(sql).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── FINANCE GROUP ──────────────────────────────────────────────

  app.get('/api/reports/finance/profit-daily', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(o.created_at) as day, SUM(o.total) as revenue, SUM(o.discount) as discount, SUM(o.total) + SUM(o.discount) as gross, COUNT(*) as orders FROM orders o WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ? GROUP BY date(o.created_at) ORDER BY day`).all(fromDate, toDate);
      const costRows = db.prepare(`SELECT o.id, o.items FROM orders o WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ?`).all(fromDate, toDate);
      let totalCost = 0;
      const dishCosts = {};
      for (const order of costRows) {
        let items = [];
        try { items = JSON.parse(order.items); } catch (e) { items = []; }
        for (const item of items) {
          const dishId = item.dish_id || item.dishId || item.id;
          if (dishId) {
            if (!dishCosts[dishId]) {
              const dish = db.prepare('SELECT cost FROM dishes WHERE id = ?').get(dishId);
              dishCosts[dishId] = dish ? (dish.cost || 0) : 0;
            }
            totalCost += dishCosts[dishId] * (item.quantity || 1);
          }
        }
      }
      const revenueTotal = rows.reduce((s, r) => s + r.revenue, 0);
      res.json({ data: rows, totals: { revenue: revenueTotal, cost: totalCost, profit: revenueTotal - totalCost } });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/profit-branches', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      let sql = `SELECT COALESCE(b.name, 'Unknown') as branch_name, SUM(o.total) as revenue, SUM(o.discount) as discount, COUNT(*) as orders FROM orders o LEFT JOIN branches b ON o.branch_id = b.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ?`;
      const params = [fromDate, toDate];
      sql += ` GROUP BY b.name ORDER BY revenue DESC`;
      const rows = db.prepare(sql).all(...params);
      const orderRows = db.prepare(`SELECT o.id, o.items, b.name as bname FROM orders o LEFT JOIN branches b ON o.branch_id = b.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ?`).all(...params);
      const costs = {};
      const dishCosts = {};
      for (const order of orderRows) {
        const branch = order.bname || 'Unknown';
        if (!costs[branch]) costs[branch] = 0;
        let items = [];
        try { items = JSON.parse(order.items); } catch (e) { items = []; }
        for (const item of items) {
          const dishId = item.dish_id || item.dishId || item.id;
          if (dishId) {
            if (!dishCosts[dishId]) {
              const dish = db.prepare('SELECT cost FROM dishes WHERE id = ?').get(dishId);
              dishCosts[dishId] = dish ? (dish.cost || 0) : 0;
            }
            costs[branch] += dishCosts[dishId] * (item.quantity || 1);
          }
        }
      }
      const data = rows.map(r => ({ ...r, cost: costs[r.branch_name] || 0, profit: r.revenue - (costs[r.branch_name] || 0) }));
      res.json({ data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/profit-products', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const orderRows = db.prepare(`SELECT items FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).all(fromDate, toDate);
      const productMap = {};
      const dishCache = {};
      for (const row of orderRows) {
        let items = [];
        try { items = JSON.parse(row.items); } catch (e) { items = []; }
        for (const item of items) {
          const name = item.name || item.dish_name || 'Unknown';
          const dishId = item.dish_id || item.dishId || item.id;
          if (!productMap[name]) productMap[name] = { name, revenue: 0, quantity: 0, cost: 0 };
          productMap[name].revenue += (item.price || item.total || 0) * (item.quantity || 1);
          productMap[name].quantity += item.quantity || 1;
          if (dishId) {
            if (!dishCache[dishId]) {
              const dish = db.prepare('SELECT cost FROM dishes WHERE id = ?').get(dishId);
              dishCache[dishId] = dish ? (dish.cost || 0) : 0;
            }
            productMap[name].cost += dishCache[dishId] * (item.quantity || 1);
          }
        }
      }
      const data = Object.values(productMap).map(p => ({ ...p, profit: p.revenue - p.cost })).sort((a, b) => b.profit - a.profit).slice(0, 20);
      res.json({ data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/profit-categories', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const orderRows = db.prepare(`SELECT items FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).all(fromDate, toDate);
      const catMap = {};
      const dishCache = {};
      for (const row of orderRows) {
        let items = [];
        try { items = JSON.parse(row.items); } catch (e) { items = []; }
        for (const item of items) {
          const dishId = item.dish_id || item.dishId || item.id;
          if (dishId) {
            if (!dishCache[dishId]) {
              const dish = db.prepare('SELECT d.name, d.cost, d.price, mc.name as cat_name FROM dishes d LEFT JOIN menu_categories mc ON d.category_id = mc.id WHERE d.id = ?').get(dishId);
              dishCache[dishId] = dish || { name: 'Unknown', cost: 0, price: 0, cat_name: 'Uncategorized' };
            }
            const d = dishCache[dishId];
            const cat = d.cat_name || 'Uncategorized';
            if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, cost: 0, quantity: 0 };
            catMap[cat].revenue += (item.price || item.total || d.price || 0) * (item.quantity || 1);
            catMap[cat].cost += (d.cost || 0) * (item.quantity || 1);
            catMap[cat].quantity += item.quantity || 1;
          }
        }
      }
      const data = Object.values(catMap).map(c => ({ ...c, profit: c.revenue - c.cost })).sort((a, b) => b.profit - a.profit);
      res.json({ data });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/abc-analysis', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const orderRows = db.prepare(`SELECT items FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).all(fromDate, toDate);
      const productMap = {};
      for (const row of orderRows) {
        let items = [];
        try { items = JSON.parse(row.items); } catch (e) { items = []; }
        for (const item of items) {
          const name = item.name || item.dish_name || 'Unknown';
          if (!productMap[name]) productMap[name] = { name, revenue: 0 };
          productMap[name].revenue += (item.price || item.total || 0) * (item.quantity || 1);
        }
      }
      const sorted = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
      const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0);
      let cum = 0;
      const data = sorted.map(p => {
        cum += p.revenue;
        const cumPct = totalRevenue > 0 ? (cum / totalRevenue) * 100 : 0;
        let category;
        if (cumPct <= 70) category = 'A';
        else if (cumPct <= 90) category = 'B';
        else category = 'C';
        return { ...p, share: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0, cumulative_percent: cumPct, category };
      });
      res.json({ data, totals: { total_revenue: totalRevenue, a_count: data.filter(d => d.category === 'A').length, b_count: data.filter(d => d.category === 'B').length, c_count: data.filter(d => d.category === 'C').length } });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/pnl', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const revenueRow = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      const revenue = revenueRow.total;
      const orderRows = db.prepare(`SELECT items FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).all(fromDate, toDate);
      let cogs = 0;
      const dishCache = {};
      for (const row of orderRows) {
        let items = [];
        try { items = JSON.parse(row.items); } catch (e) { items = []; }
        for (const item of items) {
          const dishId = item.dish_id || item.dishId || item.id;
          if (dishId) {
            if (!dishCache[dishId]) {
              const dish = db.prepare('SELECT cost FROM dishes WHERE id = ?').get(dishId);
              dishCache[dishId] = dish ? (dish.cost || 0) : 0;
            }
            cogs += dishCache[dishId] * (item.quantity || 1);
          }
        }
      }
      const grossProfit = revenue - cogs;
      const expensesRow = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type = 'expense' AND date BETWEEN ? AND ?`).get(fromDate, toDate);
      const expenses = expensesRow.total;
      const netProfit = grossProfit - expenses;
      res.json({
        sections: {
          revenue: { label: 'Выручка', value: revenue },
          cogs: { label: 'Себестоимость', value: cogs },
          grossProfit: { label: 'Валовая прибыль', value: grossProfit },
          expenses: { label: 'Расходы', value: expenses },
          netProfit: { label: 'Чистая прибыль', value: netProfit }
        },
        revenue, cogs, grossProfit, expenses, netProfit
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/income-expense', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT type, category, SUM(amount) as total FROM finance_transactions WHERE date BETWEEN ? AND ? GROUP BY type, category ORDER BY type, category`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT type, SUM(amount) as total FROM finance_transactions WHERE date BETWEEN ? AND ? GROUP BY type`).all(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/payments-daily', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(created_at) as day, payment_method, COUNT(*) as count, SUM(amount) as total FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY date(created_at), payment_method ORDER BY day`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/finance/reconciliation', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT counterparty, COUNT(*) as doc_count, SUM(sum) as total_sum, GROUP_CONCAT(DISTINCT type) as types FROM documents WHERE date BETWEEN ? AND ? AND counterparty != '' GROUP BY counterparty ORDER BY total_sum DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── STOCK GROUP ────────────────────────────────────────────────

  app.get('/api/reports/stock/low-stock', (req, res) => {
    try {
      const { branch_id } = req.query;
      let sql = `SELECT id, name, article, current_balance, min_stock, category_name FROM inventory_items WHERE current_balance < min_stock AND min_stock > 0`;
      const params = [];
      sql += ` ORDER BY (current_balance - min_stock) ASC`;
      const rows = db.prepare(sql).all(...params);
      res.json({ data: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/purchase-prices-monthly', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT item_id, strftime('%Y-%m', arrival_date) as month, AVG(cost) as avg_price FROM batches WHERE date(arrival_date) BETWEEN ? AND ? GROUP BY item_id, month ORDER BY month`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/movement-log', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT type, COUNT(*) as count, SUM(sum) as total_sum, date(date) as day FROM documents WHERE type IN ('receipt', 'write_off', 'transfer', 'production') AND date(date) BETWEEN ? AND ? GROUP BY type, date(date) ORDER BY day`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT type, COUNT(*) as count, SUM(sum) as total_sum FROM documents WHERE type IN ('receipt', 'write_off', 'transfer', 'production') AND date(date) BETWEEN ? AND ? GROUP BY type`).all(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/estimated-balance', (req, res) => {
    try {
      const { branch_id } = req.query;
      let sql = `SELECT i.id, i.name, i.article, i.current_balance, i.last_price, (COALESCE(i.current_balance,0) * COALESCE(i.last_price,0)) as estimated_value FROM inventory_items i WHERE i.current_balance > 0`;
      const params = [];
      sql += ` ORDER BY estimated_value DESC`;
      const rows = db.prepare(sql).all(...params);
      const total = rows.reduce((s, r) => s + r.estimated_value, 0);
      res.json({ data: rows, total });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/detailed-balance', (req, res) => {
    try {
      const { branch_id } = req.query;
      let sql = `SELECT * FROM inventory_items WHERE 1=1`;
      const params = [];
      sql += ` ORDER BY name`;
      const rows = db.prepare(sql).all(...params);
      res.json({ data: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/transfers', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT * FROM documents WHERE type = 'transfer' AND date(date) BETWEEN ? AND ? ORDER BY date DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/stock/calories', (req, res) => {
    try {
      const rows = db.prepare(`SELECT id, name, kcal, proteins, fats, carbs FROM inventory_items WHERE kcal > 0 ORDER BY name`).all();
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── MARKETING GROUP ────────────────────────────────────────────

  app.get('/api/reports/marketing/sales-by-customer', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT user_id, user_name, user_phone, COUNT(*) as order_count, SUM(total) as total_spent, AVG(total) as avg_check, MAX(created_at) as last_order FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ? GROUP BY user_id ORDER BY total_spent DESC LIMIT 20`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT COUNT(DISTINCT user_id) as customer_count, COALESCE(SUM(total),0) as total_revenue FROM orders WHERE status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/marketing/promo-history', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT o.promo_code, COUNT(*) as use_count, SUM(o.discount) as total_discount, SUM(o.total) as order_total FROM orders o WHERE o.promo_code IS NOT NULL AND o.promo_code != '' AND date(o.created_at) BETWEEN ? AND ? GROUP BY o.promo_code ORDER BY use_count DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/marketing/bonus-report', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT type, SUM(amount) as total, COUNT(*) as count FROM bonus_transactions WHERE date(created_at) BETWEEN ? AND ? GROUP BY type`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/marketing/card-connections', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(created_at) as day, COUNT(*) as new_cards FROM users WHERE date(created_at) BETWEEN ? AND ? GROUP BY date(created_at) ORDER BY day`).all(fromDate, toDate);
      const total = db.prepare(`SELECT COUNT(*) as total_cards FROM users`).get();
      res.json({ data: rows, total_cards: total.total_cards });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/marketing/contacts', (req, res) => {
    try {
      const { branch_id } = req.query;
      let sql = `SELECT id, name, phone, email, total_spent, visits_count, last_order_date FROM users WHERE is_active ORDER BY total_spent DESC`;
      const rows = db.prepare(sql).all();
      res.json({ data: rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── STAFF GROUP ────────────────────────────────────────────────

  app.get('/api/reports/staff/sales-by-cashier', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT s.first_name || ' ' || COALESCE(s.last_name, '') as staff_name, COUNT(o.id) as order_count, SUM(o.total) as total_revenue FROM orders o LEFT JOIN staff s ON o.waiter_id = s.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ? GROUP BY s.id ORDER BY total_revenue DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/staff/sales-by-staff', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT s.first_name || ' ' || COALESCE(s.last_name, '') as staff_name, s.role, COUNT(o.id) as order_count, SUM(o.total) as total FROM orders o LEFT JOIN staff s ON o.waiter_id = s.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ? GROUP BY s.id ORDER BY total DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/staff/bonuses', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT s.first_name || ' ' || COALESCE(s.last_name, '') as staff_name, s.role, COALESCE(sl.accrued,0) as accrued, COALESCE(sl.paid,0) as paid FROM staff s LEFT JOIN (SELECT staff_id, SUM(CASE WHEN action = 'accrue' THEN amount ELSE 0 END) as accrued, SUM(CASE WHEN action = 'pay' THEN amount ELSE 0 END) as paid FROM salary_log WHERE date(created_at) BETWEEN ? AND ? GROUP BY staff_id) sl ON s.id = sl.staff_id WHERE s.is_active = 1 ORDER BY s.first_name`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/staff/tips', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT s.first_name || ' ' || COALESCE(s.last_name, '') as staff_name, COUNT(o.id) as order_count, SUM(o.total) as total_revenue FROM orders o LEFT JOIN staff s ON o.waiter_id = s.id WHERE o.status NOT IN ('cancelled') AND date(o.created_at) BETWEEN ? AND ? GROUP BY s.id ORDER BY total_revenue DESC`).all(fromDate, toDate);
      res.json({ data: rows, note: 'Tips data not available in current schema; showing waiter sales instead' });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── FULFILLMENT GROUP ──────────────────────────────────────────

  app.get('/api/reports/fulfillment/issuers', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT osh.created_by as staff_id, s.first_name || ' ' || COALESCE(s.last_name, '') as staff_name, COUNT(*) as actions_count FROM order_status_history osh LEFT JOIN staff s ON osh.created_by = s.id WHERE osh.status IN ('ready', 'served') AND date(osh.created_at) BETWEEN ? AND ? GROUP BY osh.created_by ORDER BY actions_count DESC`).all(fromDate, toDate);
      res.json({ data: rows });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/fulfillment/delivery-orders', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT id, user_name, address, courier_name, created_at, updated_at, status, total FROM orders WHERE type = 'delivery' AND date(created_at) BETWEEN ? AND ? ORDER BY created_at DESC`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(total),0) as revenue FROM orders WHERE type = 'delivery' AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/fulfillment/orders', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const rows = db.prepare(`SELECT date(created_at) as day, COUNT(*) as total_orders, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled, AVG(CASE WHEN julianday(updated_at) - julianday(created_at) < 1 THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 ELSE NULL END) as avg_minutes FROM orders WHERE date(created_at) BETWEEN ? AND ? GROUP BY date(created_at) ORDER BY day`).all(fromDate, toDate);
      const totals = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled, AVG(CASE WHEN julianday(updated_at) - julianday(created_at) < 1 THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 ELSE NULL END) as avg_minutes FROM orders WHERE date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({ data: rows, totals });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/fulfillment/summary', (req, res) => {
    try {
      const { from, to, branch_id } = req.query;
      const { fromDate, toDate } = getDateRange(from, to);
      const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      const cancelledOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled' AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      const avgProcessing = db.prepare(`SELECT AVG(CASE WHEN julianday(updated_at) - julianday(created_at) < 1 THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 ELSE NULL END) as avg_min FROM orders WHERE status != 'cancelled' AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM orders WHERE date(created_at) BETWEEN ? AND ? GROUP BY status`).all(fromDate, toDate);
      const deliveryData = db.prepare(`SELECT AVG(CASE WHEN julianday(updated_at) - julianday(created_at) < 1 THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 ELSE NULL END) as avg_delivery_min FROM orders WHERE type = 'delivery' AND status NOT IN ('cancelled') AND date(created_at) BETWEEN ? AND ?`).get(fromDate, toDate);
      res.json({
        total_orders: totalOrders.count,
        cancelled_orders: cancelledOrders.count,
        cancellation_rate: totalOrders.count > 0 ? (cancelledOrders.count / totalOrders.count) * 100 : 0,
        avg_processing_minutes: avgProcessing.avg_min || 0,
        avg_delivery_minutes: deliveryData.avg_delivery_min || 0,
        by_status: byStatus
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  // ─── FOOD COST GROUP ──────────────────────────────────────────────

  app.get('/api/reports/food-cost', (req, res) => {
    try {
      const dishes = db.prepare(`
        SELECT d.id, d.name, d.price, d.weight, d.is_available, mc.name as category_name,
               tc.id as tc_id, tc.output, tc.technology
        FROM dishes d
        LEFT JOIN menu_categories mc ON d.category_id = mc.id
        LEFT JOIN dish_tech_cards tc ON tc.dish_id = d.id
        WHERE d.is_available = 1
        ORDER BY mc.sort_order, d.name
      `).all();

      const results = [];
      for (const dish of dishes) {
        let totalCost = 0;
        let ingredients = [];
        
        if (dish.tc_id) {
          ingredients = db.prepare(`
            SELECT tci.item_name, tci.quantity, tci.unit,
                   ii.price_per_unit, ii.last_price
            FROM dish_tech_card_ingredients tci
            LEFT JOIN inventory_items ii ON tci.item_id = ii.id
            WHERE tci.tech_card_id = ?
          `).all(dish.tc_id);

          for (const ing of ingredients) {
            const price = ing.price_per_unit || ing.last_price || 0;
            totalCost += price * ((ing.quantity || 0) / 1000);
          }
        }

        results.push({
          id: dish.id,
          name: dish.name,
          category: dish.category_name || '—',
          price: dish.price || 0,
          cost: Math.round(totalCost * 100) / 100,
          margin: dish.price > 0 ? Math.round((1 - totalCost / dish.price) * 10000) / 100 : 0,
          has_tech_card: !!dish.tc_id,
          ingredient_count: ingredients.length,
        });
      }

      const withTc = results.filter(r => r.has_tech_card);
      const avgCost = withTc.length ? withTc.reduce((s, r) => s + r.cost, 0) / withTc.length : 0;
      const avgMargin = withTc.length ? withTc.reduce((s, r) => s + r.margin, 0) / withTc.length : 0;

      res.json({
        data: results,
        totals: {
          total_dishes: results.length,
          with_tech_card: withTc.length,
          without_tech_card: results.length - withTc.length,
          avg_cost: Math.round(avgCost * 100) / 100,
          avg_margin: Math.round(avgMargin * 100) / 100,
        }
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });

  app.get('/api/reports/food-cost/dish/:id', (req, res) => {
    try {
      const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
      if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });

      const tc = db.prepare('SELECT * FROM dish_tech_cards WHERE dish_id = ?').get(dish.id);
      if (!tc) return res.json({ dish, tech_card: null, ingredients: [], totalCost: 0 });

      const ingredients = db.prepare(`
        SELECT tci.*, ii.price_per_unit, ii.last_price, ii.current_balance
        FROM dish_tech_card_ingredients tci
        LEFT JOIN inventory_items ii ON tci.item_id = ii.id
        WHERE tci.tech_card_id = ?
      `).all(tc.id);

      let totalCost = 0;
      for (const ing of ingredients) {
        const price = ing.price_per_unit || ing.last_price || 0;
        ing.cost = Math.round(price * ((ing.quantity || 0) / 1000) * 100) / 100;
        totalCost += ing.cost;
      }

      res.json({
        dish: { id: dish.id, name: dish.name, price: dish.price },
        tech_card: tc,
        ingredients,
        totalCost: Math.round(totalCost * 100) / 100,
        margin: dish.price > 0 ? Math.round((1 - totalCost / dish.price) * 10000) / 100 : 0,
      });
    } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
  });
};
