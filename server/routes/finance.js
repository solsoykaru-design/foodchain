const path = require('path');
const fs = require('fs');
const multer = require('multer');
const payrollService = require('../services/payroll.service.js');
const shiftPayrollService = require('../services/shift-payroll.service.js');

module.exports = function(app, db, config) {
  const { upload, safeError, toCamelCase, toCamelCaseArray } = config;

app.get('/api/salary', (req, res) => {
  try {
    const { month, year, staff_id, status } = req.query;
    let sql = 'SELECT s.*, sf.first_name, sf.last_name, sf.role, sf.position FROM salary s JOIN staff sf ON s.staff_id = sf.id WHERE s.tenant_id = current_tenant_id()';
    const params = [];
    if (month) { sql += ' AND s.month = ?'; params.push(Number(month)); }
    if (year) { sql += ' AND s.year = ?'; params.push(Number(year)); }
    if (staff_id) { sql += ' AND s.staff_id = ?'; params.push(Number(staff_id)); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    sql += ' ORDER BY s.year DESC, s.month DESC, sf.first_name ASC';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/salary/calculate', (req, res) => {
  try {
    const { staff_id, month, year, all } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    if (all) {
      const allStaff = db.prepare('SELECT id FROM staff WHERE is_active = 1').all();
      const results = [];
      for (const s of allStaff) {
        const result = payrollService.calculateStaffSalary(db, req.tenant_id || 1, s.id, m, y);
        if (!result) continue;
        payrollService.saveOrUpdateSalary(db, req.tenant_id || 1, result);
        db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail, tenant_id) VALUES (?, \'calculate\', ?, ?, ?)').run(s.id, result.accrued_amount, 'Автоматический расчёт', req.tenant_id || 1);
        results.push(result);
      }
      res.json({ ok: true, count: results.length });
    } else if (staff_id) {
      const result = payrollService.calculateStaffSalary(db, req.tenant_id || 1, staff_id, m, y);
      if (!result) return res.status(404).json({ error: 'Сотрудник не найден' });
      payrollService.saveOrUpdateSalary(db, req.tenant_id || 1, result);
      db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail, tenant_id) VALUES (?, \'calculate\', ?, ?, ?)').run(staff_id, result.accrued_amount, 'Расчёт зарплаты', req.tenant_id || 1);
      res.json(result);
    } else {
      res.status(400).json({ error: 'Укажите staff_id или all = true' });
    }
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/salary/pay', (req, res) => {
  try {
    const { salary_id, staff_id, amount, paid_date, payment_method, note } = req.body;
    if (!salary_id || !staff_id) return res.status(400).json({ error: 'salary_id и staff_id обязательны' });
    const salary = db.prepare('SELECT * FROM salary WHERE id = ? AND staff_id = ?').get(salary_id, staff_id);
    if (!salary) return res.status(404).json({ error: 'Начисление не найдено' });
    const payAmt = amount || salary.accrued_amount;
    const date = paid_date || new Date().toISOString().split('T')[0];
    const pm = payment_method || 'cash';
    const newPaid = (salary.paid_amount || 0) + payAmt;
    const newStatus = newPaid >= salary.accrued_amount ? 'paid' : 'partial';
    db.prepare('UPDATE salary SET paid_amount = ?, paid_date = ?, payment_method = ?, status = ?, paid_at = datetime(\'now\'), note = ? WHERE id = ?').run(newPaid, date, pm, newStatus, note || null, salary_id);
    db.prepare('INSERT INTO salary_log (staff_id, action, amount, detail) VALUES (?, \'pay\', ?, ?)').run(staff_id, payAmt, `Выплата: ${pm}, дата: ${date}${note ? ', ' + note : ''}`);
    db.prepare("INSERT INTO finance_transactions (type, amount, category, date, description) VALUES ('salary', ?, 'salary', ?, ?)").run(payAmt, date, `Зарплата сотруднику #${staff_id}`);
    res.json({ ok: true, salary_id, paid_amount: newPaid, status: newStatus });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/salary/report', (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const { start, end } = calcMonthDates(m, y);

    const totalAccrued = db.prepare("SELECT COALESCE(SUM(accrued_amount),0) as total FROM salary WHERE month = ? AND year = ?").get(m, y).total;
    const totalPaid = db.prepare("SELECT COALESCE(SUM(paid_amount),0) as total FROM salary WHERE month = ? AND year = ?").get(m, y).total;

    const byRole = db.prepare(`
      SELECT sf.role, COUNT(DISTINCT s.staff_id) as count, COALESCE(SUM(s.accrued_amount),0) as total, COALESCE(AVG(s.accrued_amount),0) as avg
      FROM salary s JOIN staff sf ON s.staff_id = sf.id
      WHERE s.tenant_id = current_tenant_id() AND s.month = ? AND s.year = ?
      GROUP BY sf.role
    `).all(m, y);

    const topEarners = db.prepare(`
    SELECT s.staff_id, sf.first_name, sf.last_name, sf.role, s.accrued_amount
    FROM salary s JOIN staff sf ON s.staff_id = sf.id
    WHERE s.tenant_id = current_tenant_id() AND s.month = ? AND s.year = ?
      ORDER BY s.accrued_amount DESC LIMIT 5
    `).all(m, y);

    const monthlyTrend = db.prepare(`
      SELECT s.month, s.year, COALESCE(SUM(s.accrued_amount),0) as total
      FROM salary s
      WHERE s.year = ? OR s.year = ? - 1
      GROUP BY s.year, s.month ORDER BY s.year, s.month
    `).all(y, y).map(r => toCamelCase(r));

    res.json(toCamelCase({ totalAccrued, totalPaid, byRole: toCamelCaseArray(byRole), topEarners: toCamelCaseArray(topEarners), monthlyTrend }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/salary/history/:staff_id', (req, res) => {
  try {
    const salary = db.prepare('SELECT * FROM salary WHERE staff_id = ? ORDER BY year DESC, month DESC').all(req.params.staff_id);
    const log = db.prepare('SELECT * FROM salary_log WHERE staff_id = ? ORDER BY created_at DESC').all(req.params.staff_id);
    res.json({ salary: toCamelCaseArray(salary), log: toCamelCaseArray(log) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/summary', (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = ''; const params = [];
    if (from && to) { dateFilter = ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    const income = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type = 'income'${dateFilter}`).get(...params);
    const expense = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type = 'expense'${dateFilter}`).get(...params);
    const ordersCount = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE 1=1${dateFilter.replace('date(date)', 'date(created_at)')}`).get(...params);
    const byPaymentMethod = db.prepare(`SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE 1=1${dateFilter} GROUP BY payment_method`).all(...params);
    const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE 1=1${dateFilter} GROUP BY category`).all(...params);
    const totalRevenue = income.total;
    const totalExpenses = expense.total;

    const days = parseInt(from && to ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + '' : '30', 10);
    const revenueByDay = [];
    for (let i = Math.max(0, days - 30); i < days; i++) {
      const d = new Date(to || new Date());
      d.setDate(d.getDate() - (days - 1 - i));
      const ds = d.toISOString().slice(0, 10);
      const ords = db.prepare("SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders FROM orders WHERE date(created_at) = ? AND status != 'cancelled'").get(ds);
      revenueByDay.push({ date: ds, revenue: ords.revenue, orders: ords.orders });
    }

    res.json({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      ordersCount: ordersCount.cnt,
      byPaymentMethod: toCamelCaseArray(byPaymentMethod),
      byCategory: toCamelCaseArray(byCategory),
      revenueByDay,
    });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/finance/transactions', (req, res) => {
  try {
    const { from, to, category, payment_method } = req.query;
    let sql = 'SELECT * FROM finance_transactions WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (payment_method) { sql += ' AND payment_method = ?'; params.push(payment_method); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(transactions));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/finance/transactions', (req, res) => {
  try {
    const { type, category, amount, payment_method, description, order_id, date } = req.body;
    if (!type || !amount) return res.status(400).json({ error: 'Тип и сумма обязательны' });
    const info = db.prepare('INSERT INTO finance_transactions (type, category, amount, payment_method, description, order_id, date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      type, category || 'other', amount, payment_method || 'cash', description || '', order_id || null, date || new Date().toISOString().split('T')[0]
    );
    const transaction = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(transaction));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/finance/report', (req, res) => {
  try {
    const { from, to, format } = req.query;
    let sql = 'SELECT * FROM finance_transactions WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    sql += ' ORDER BY created_at DESC';
    const transactions = db.prepare(sql).all(...params);
    if (format === 'csv') {
      const header = 'id,type,category,amount,payment_method,description,order_id,date,created_at';
      const rows = transactions.map(t => `${t.id},${t.type},${t.category},${t.amount},${t.payment_method},"${(t.description || '').replace(/"/g, '""')}",${t.order_id || ''},${t.date || ''},${t.created_at}`);
      res.setHeader('Content-Type', 'text/csv');
      res.send([header, ...rows].join('\n'));
    } else {
      res.json(toCamelCaseArray(transactions));
    }
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM chart_of_accounts ORDER BY code').all();
    res.json(accounts.map(a => ({ ...a, isActive: !!a.is_active, parentId: a.parent_id })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/accounts', (req, res) => {
  try {
    const { code, name, type, parent_id, description } = req.body;
    if (!code || !name || !type) return res.status(400).json({ error: 'code, name, type обязательны' });
    if (!['asset','liability','equity','income','expense'].includes(type)) return res.status(400).json({ error: 'Недопустимый тип счета' });
    const info = db.prepare('INSERT INTO chart_of_accounts (code, name, type, parent_id, description) VALUES (?, ?, ?, ?, ?)').run(code, name, type, parent_id || null, description || '');
    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...account, isActive: !!account.is_active, parentId: account.parent_id });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/accounts/:id', (req, res) => {
  try {
    const { code, name, type, parent_id, description } = req.body;
    db.prepare('UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_id = ?, description = ? WHERE id = ?').run(code, name, type, parent_id || null, description || '', req.params.id);
    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE id = ?').get(req.params.id);
    res.json({ ...account, isActive: !!account.is_active, parentId: account.parent_id });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/accounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM chart_of_accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/journal/entries', (req, res) => {
  try {
    const { entry_date, description, reference_type, reference_id, created_by, lines } = req.body;
    if (!entry_date || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Необходима дата и минимум 2 проводки (дебет/кредит)' });
    }
    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({ error: `Сумма дебета (${totalDebit}) не равна сумме кредита (${totalCredit})` });
    }
    const txn = db.transaction(() => {
      const info = db.prepare('INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?)').run(
        entry_date, description || '', reference_type || null, reference_id || null, created_by || 'system'
      );
      const entryId = info.lastInsertRowid;
      const insert = db.prepare('INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');
      for (const line of lines) {
        const account = db.prepare('SELECT id FROM chart_of_accounts WHERE id = ?').get(line.account_id);
        if (!account) throw new Error(`Счёт с id ${line.account_id} не найден`);
        insert.run(entryId, line.account_id, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0, line.description || '');
      }
      return entryId;
    });
    const entryId = txn();
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId);
    const entryLines = db.prepare('SELECT * FROM journal_entry_lines WHERE entry_id = ?').all(entryId);
    res.status(201).json({ ...entry, lines: entryLines });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/journal/entries', (req, res) => {
  try {
    const { from, to, limit, offset } = req.query;
    let sql = 'SELECT * FROM journal_entries WHERE 1=1';
    const params = [];
    if (from && to) { sql += ' AND date(entry_date) BETWEEN date(?) AND date(?)'; params.push(from, to); }
    sql += ' ORDER BY entry_date DESC, id DESC';
    if (limit) sql += ' LIMIT ?'; params.push(parseInt(limit));
    if (offset) sql += ' OFFSET ?'; params.push(parseInt(offset));
    const entries = db.prepare(sql).all(...params);
    const result = entries.map(e => {
      const lines = db.prepare('SELECT l.*, a.code, a.name as account_name FROM journal_entry_lines l LEFT JOIN chart_of_accounts a ON l.account_id = a.id WHERE l.entry_id = ? AND l.tenant_id = current_tenant_id()').all(e.id);
      return { ...e, lines };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/journal/entries/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Запись не найдена' });
    const lines = db.prepare('SELECT l.*, a.code, a.name as account_name FROM journal_entry_lines l LEFT JOIN chart_of_accounts a ON l.account_id = a.id WHERE l.entry_id = ? AND l.tenant_id = current_tenant_id()').all(entry.id);
    res.json({ ...entry, lines });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/reports/trial-balance', (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    if (from && to) dateFilter = ` AND date(j.entry_date) BETWEEN date('${from}') AND date('${to}')`;
    const rows = db.prepare(`
      SELECT a.id, a.code, a.name, a.type,
        COALESCE(SUM(l.debit), 0) as debit_turnover,
        COALESCE(SUM(l.credit), 0) as credit_turnover
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l ON l.account_id = a.id
      LEFT JOIN journal_entries j ON j.id = l.entry_id
      WHERE a.is_active = 1 AND a.tenant_id = current_tenant_id()${dateFilter}
      GROUP BY a.id
      ORDER BY a.code
    `).all();
    res.json(rows.map(r => ({ ...r, debitTurnover: r.debit_turnover, creditTurnover: r.credit_turnover })));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/reports/balance-sheet', (req, res) => {
  try {
    const { date } = req.query;
    const asOfDate = date || new Date().toISOString().split('T')[0];
    let dateFilter = ` AND date(j.entry_date) <= date('${asOfDate}')`;
    
    const rows = db.prepare(`
      SELECT a.id, a.code, a.name, a.type,
        SUM(l.debit) as total_debit,
        SUM(l.credit) as total_credit
      FROM chart_of_accounts a
      LEFT JOIN journal_entry_lines l ON l.account_id = a.id
      LEFT JOIN journal_entries j ON j.id = l.entry_id
      WHERE a.is_active = 1 AND a.tenant_id = current_tenant_id()${dateFilter}
      GROUP BY a.id
      ORDER BY a.code
    `).all();

    // Calculate balances for each account type
    // Active accounts: balance = debit - credit
    // Passive accounts: balance = credit - debit
    const accounts = rows.map(r => {
      const debit = r.total_debit || 0;
      const credit = r.total_credit || 0;
      let balance = 0;
      if (r.type === 'asset') balance = debit - credit;
      else if (r.type === 'liability') balance = credit - debit;
      else if (r.type === 'equity') balance = credit - debit;
      else if (r.type === 'income') balance = credit - debit;
      else if (r.type === 'expense') balance = debit - credit;
      return { ...r, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, balance: Math.round(balance * 100) / 100 };
    });

    // Group into balance sheet sections
    const nonCurrentAssets = accounts.filter(a => a.type === 'asset' && ['01','02','03','04','07','08'].some(p => a.code.startsWith(p)));
    const currentAssets = accounts.filter(a => a.type === 'asset' && !['01','02','03','04','07','08'].some(p => a.code.startsWith(p)));
    const capitalAndReserves = accounts.filter(a => a.type === 'equity');
    const longTermLiabilities = accounts.filter(a => a.type === 'liability' && a.code.startsWith('67'));
    const shortTermLiabilities = accounts.filter(a => a.type === 'liability' && !a.code.startsWith('67'));
    
    const totalAssets = nonCurrentAssets.reduce((s, a) => s + a.balance, 0) + currentAssets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = capitalAndReserves.reduce((s, a) => s + a.balance, 0) + longTermLiabilities.reduce((s, a) => s + a.balance, 0) + shortTermLiabilities.reduce((s, a) => s + a.balance, 0);

    res.json({
      asOfDate,
      sections: {
        nonCurrentAssets: { label: 'Внеоборотные активы', accounts: nonCurrentAssets, total: Math.round(nonCurrentAssets.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        currentAssets: { label: 'Оборотные активы', accounts: currentAssets, total: Math.round(currentAssets.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        capitalAndReserves: { label: 'Капитал и резервы', accounts: capitalAndReserves, total: Math.round(capitalAndReserves.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        longTermLiabilities: { label: 'Долгосрочные обязательства', accounts: longTermLiabilities, total: Math.round(longTermLiabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
        shortTermLiabilities: { label: 'Краткосрочные обязательства', accounts: shortTermLiabilities, total: Math.round(shortTermLiabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100 },
      },
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      difference: Math.round((totalAssets - totalLiabilities) * 100) / 100,
    });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
const bankUpload = multer({ dest: path.join(require('os').tmpdir(), 'fc-bank'), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/finance/bank-statement/upload', bankUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const bankStmt = require(path.join(__dirname, '..', 'services', 'bank-statement.service.js'));
    const txns = bankStmt.parseStatement(req.file.path);
    const tenantId = req.tenant_id || 1;
    const insert = db.prepare('INSERT INTO bank_transactions (tenant_id, date, description, amount, balance) VALUES (?, ?, ?, ?, ?)');
    const t = db.transaction(() => {
      for (const tx of txns) {
        insert.run(tenantId, tx.date, tx.description, tx.amount, tx.balance);
      }
    });
    t();
    const matches = bankStmt.matchTransactions(db, txns, tenantId);
    const update = db.prepare('UPDATE bank_transactions SET order_id = ?, confidence = ? WHERE date = ? AND amount = ? AND tenant_id = ?');
    for (const m of matches) {
      if (m.order_id) {
        update.run(m.order_id, m.confidence, m.tx_date, m.tx_amount, tenantId);
      }
    }
    fs.unlink(req.file.path, () => {});
    res.json({ imported: txns.length, matched: matches.filter(m => m.order_id).length, unmatched: matches.filter(m => !m.order_id).length });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/bank-statement/summary', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, '..', 'services', 'bank-statement.service.js'));
    res.json(bankStmt.getReconciliationSummary(db, req.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/bank-statement/transactions', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, '..', 'services', 'bank-statement.service.js'));
    res.json(toCamelCaseArray(bankStmt.getTransactions(db, req.tenant_id || 1)));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/finance/bank-statement/clear', (req, res) => {
  try {
    const bankStmt = require(path.join(__dirname, '..', 'services', 'bank-statement.service.js'));
    bankStmt.clearTransactions(db, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/bank-statement/candidates', (req, res) => {
  try {
    const { amount, date } = req.query;
    const tenantId = req.tenant_id || 1;
    let sql = "SELECT id, total, created_at, user_name, order_type FROM orders WHERE tenant_id = ? AND total > 0 AND status != 'cancelled'";
    const params = [tenantId];
    if (amount) { sql += ' AND ABS(total - ?) < 0.5'; params.push(Number(amount)); }
    if (date) { sql += " AND date(created_at) BETWEEN date(?, '-2 days') AND date(?, '+2 days')"; params.push(date, date); }
    sql += ' ORDER BY created_at DESC LIMIT 20';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/finance/bank-statement/transactions/:id/match', (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });
    const existing = db.prepare('SELECT id FROM bank_transactions WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id || 1);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });
    db.prepare('UPDATE bank_transactions SET order_id = ?, confidence = ? WHERE id = ?').run(order_id, 'manual', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/finance/bank-statement/transactions/:id/unmatch', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM bank_transactions WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id || 1);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });
    db.prepare('UPDATE bank_transactions SET order_id = NULL, confidence = ? WHERE id = ?').run('unmatched', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/tax/sales-ledger', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getSalesLedger(db, year, month, req.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/tax/purchase-ledger', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getPurchaseLedger(db, year, month, req.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/tax/declaration', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    res.json(taxAccountingService.getVatDeclaration(db, year, month, req.tenant_id || 1));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

function csvEscape(str) {
  const s = String(str ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

app.get('/api/finance/tax/export', (req, res) => {
  try {
    const { type = 'sales', format = 'csv', year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || (new Date().getMonth() + 1);
    let data;
    let filename;
    if (type === 'sales') {
      data = taxAccountingService.getSalesLedger(db, y, m, req.tenant_id || 1);
      filename = `sales_ledger_${y}_${String(m).padStart(2, '0')}.${format}`;
    } else if (type === 'purchases') {
      data = taxAccountingService.getPurchaseLedger(db, y, m, req.tenant_id || 1);
      filename = `purchase_ledger_${y}_${String(m).padStart(2, '0')}.${format}`;
    } else {
      data = taxAccountingService.getVatDeclaration(db, y, m, req.tenant_id || 1);
      filename = `vat_declaration_${y}_${String(m).padStart(2, '0')}.${format}`;
    }

    if (format === 'csv') {
      let csv = '\uFEFF';
      if (type === 'declaration') {
        csv += 'Раздел,Ставка,Нетто,НДС\n';
        for (const r of data.salesByRate) csv += `Продажи,${csvEscape(r.rate)},${r.net.toFixed(2)},${r.vat.toFixed(2)}\n`;
        for (const r of data.purchaseByRate) csv += `Закупки,${csvEscape(r.rate)},${r.net.toFixed(2)},${r.vat.toFixed(2)}\n`;
        csv += `Итого,,НДС к уплате,${data.summary.payable.toFixed(2)}\n`;
      } else if (type === 'sales') {
        csv += 'Заказ,Дата,Тип,Сумма,НДС\n';
        for (const e of data.entries) csv += `${e.order_id},${csvEscape(e.date)},${csvEscape(e.order_type)},${e.total.toFixed(2)},${e.vatTotal.toFixed(2)}\n`;
        csv += `,,Итого,${data.summary.totalGross.toFixed(2)},${data.summary.totalVat.toFixed(2)}\n`;
      } else {
        csv += 'Документ,Дата,Товар,Сумма,НДС,Ставка\n';
        for (const e of data.entries) csv += `${e.doc_id},${csvEscape(e.date)},${csvEscape(e.item)},${e.gross.toFixed(2)},${e.vat.toFixed(2)},${csvEscape(e.vatRate)}\n`;
        csv += `,,Итого,${data.summary.totalGross.toFixed(2)},${data.summary.totalVat.toFixed(2)},\n`;
      }
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    res.status(400).json({ error: 'Unsupported format' });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/audit-logs', (req, res) => {
  try {
    const { admin_id } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (admin_id) { sql += ' AND admin_id = ?'; params.push(Number(admin_id)); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const logs = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(logs));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.post('/api/audit-logs', (req, res) => {
  try {
    const { admin_id, admin_name, action, details, ip } = req.body;
    const info = db.prepare('INSERT INTO audit_logs (admin_id, admin_name, action, details, ip) VALUES (?, ?, ?, ?, ?)').run(
      admin_id || null, admin_name || '', action || '', details || '', ip || ''
    );
    const log = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toCamelCase(log));
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/dashboard', (req, res) => {
  try {
    const todayRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE date(created_at) = date('now') AND status != 'cancelled'").get().total;
    const todayOrders = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE date(created_at) = date('now')").get().cnt;
    const todayAvgCheck = todayOrders > 0 ? (todayRevenue / todayOrders) : 0;
    const todayNewUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE date(created_at) = date('now')").get().cnt;
    const totalOrders = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'delivered'").get().total;
    const totalDelivered = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status = 'delivered'").get().cnt;
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const ordersByStatus = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();
    const revenueByDay = db.prepare(`
      SELECT date(created_at) as date, COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
      FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-7 days')
      GROUP BY date(created_at) ORDER BY date ASC
    `).all();

    res.json({
      todayRevenue,
      todayOrders,
      todayAvgCheck: Math.round(todayAvgCheck * 100) / 100,
      todayNewUsers,
      totalOrders,
      totalRevenue,
      totalDelivered,
      totalUsers,
      ordersByStatus: toCamelCaseArray(ordersByStatus),
      revenueByDay: toCamelCaseArray(revenueByDay),
    });
  } catch (e) {
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/documents/types', (req, res) => {
  res.json(DOCUMENT_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] })));
});
app.get('/api/documents', (req, res) => {
  try {
    let { type, search, filter_item, page, limit, sort, order } = req.query;
    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (page - 1) * limit;
    const conditions = []; const params = [];
    if (type && type !== 'journal') { conditions.push('d.type = ?'); params.push(type); }
    if (search) {
      conditions.push('(d.number LIKE ? OR d.counterparty LIKE ? OR d.note LIKE ?)');
      const q = '%' + search + '%'; params.push(q, q, q);
    }
    if (filter_item) { conditions.push('d.items LIKE ?'); params.push('%"' + filter_item + '"%'); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents d ${where}`).get(...params);
    const sortCol = sort && ['date', 'number', 'type', 'counterparty', 'sum', 'status'].includes(sort) ? sort : 'date';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const rows = db.prepare(`SELECT * FROM documents d ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ items: rows, total: countRow.total, page, limit, totalPages: Math.ceil(countRow.total / limit) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/documents/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch (e) { doc.items = []; }
    res.json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/documents', (req, res) => {
  try {
    const { type, counterparty, sum, items, note, status, created_by, warehouse_from, warehouse_to, doc_date } = req.body;
    if (!type) return res.status(400).json({ error: 'type is required' });
    if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid document type' });
    const number = docNextNumber(type);
    const info = db.prepare(
      `INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_by, warehouse_from, warehouse_to, doc_date)
       VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(type, number, counterparty || '', parseFloat(sum) || 0, status || 'draft', JSON.stringify(items || []), note || '',
      created_by || '', warehouse_from || '', warehouse_to || '', doc_date || null);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
    processDocStockImpact(doc, null);
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch {}
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/documents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    const { type, counterparty, sum, items, note, status, created_by, warehouse_from, warehouse_to, doc_date, approved_by } = req.body;
    const updates = []; const params = [];
    const oldStatus = existing.status;
    if (type && DOCUMENT_TYPES.includes(type)) { updates.push('type = ?'); params.push(type); }
    if (counterparty !== undefined) { updates.push('counterparty = ?'); params.push(counterparty); }
    if (sum !== undefined) { updates.push('sum = ?'); params.push(parseFloat(sum)); }
    if (items !== undefined) { updates.push('items = ?'); params.push(JSON.stringify(items)); }
    if (note !== undefined) { updates.push('note = ?'); params.push(note); }
    if (created_by !== undefined) { updates.push('created_by = ?'); params.push(created_by); }
    if (warehouse_from !== undefined) { updates.push('warehouse_from = ?'); params.push(warehouse_from); }
    if (warehouse_to !== undefined) { updates.push('warehouse_to = ?'); params.push(warehouse_to); }
    if (doc_date !== undefined) { updates.push('doc_date = ?'); params.push(doc_date); }
    if (status !== undefined) {
      updates.push('status = ?'); params.push(['draft','confirmed','completed','cancelled'].includes(status) ? status : 'draft');
      if (status === 'completed' || status === 'confirmed') { updates.push("approved_at = datetime('now', '+3 hours')"); if (approved_by) { updates.push('approved_by = ?'); params.push(approved_by); } }
    }
    updates.push("updated_at = datetime('now', '+3 hours')");
    if (updates.length > 1) { params.push(req.params.id); db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...params); }
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    processDocStockImpact(doc, oldStatus);
    if (typeof doc.items === 'string') try { doc.items = JSON.parse(doc.items); } catch {}
    res.json(doc);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/documents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/documents/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let imported = 0; const errors = [];
    let rows = [];
    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 2) { fs.unlinkSync(filePath); return res.status(400).json({ error: 'CSV file has no data rows' }); }
      const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const row = {}; header.forEach((h, idx) => row[h] = cols[idx]); rows.push(row);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      } catch { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Ошибка чтения XLSX' }); }
    } else { fs.unlinkSync(filePath); return res.status(400).json({ error: 'Поддерживаются только .csv и .xlsx' }); }
    for (const row of rows) {
      try {
        const type = row.type || row.Type || row.Тип;
        if (!type || !DOCUMENT_TYPES.includes(type)) continue;
        const items = [];
        if (row.item_id || row.item_name) {
          items.push({ itemId: parseInt(row.item_id) || 0, itemName: row.item_name || row.itemName || '', quantity: parseFloat(row.quantity) || 0, unit: row.unit || 'шт', pricePerUnit: parseFloat(row.price) || 0 });
        }
        db.prepare(
          `INSERT INTO documents (type, number, date, counterparty, sum, status, items, note, created_by)
           VALUES (?, ?, datetime('now', '+3 hours'), ?, ?, 'draft', ?, ?, ?)`
        ).run(type, docNextNumber(type), row.counterparty || row.Контрагент || '', parseFloat(row.sum || row.Сумма) || 0,
          JSON.stringify(items), row.note || row.Примечание || '', row.created_by || '');
        imported++;
      } catch (e) { errors.push({ row: rows.indexOf(row) + 1, error: safeError(e.message) }); }
    }
    try { fs.unlinkSync(filePath); } catch (e) {}
    res.json({ imported, errors: errors.length ? errors : undefined });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/wholesale-prices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM wholesale_prices ORDER BY name').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/wholesale-prices', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO wholesale_prices (name, description) VALUES (?, ?)').run(name, description || null);
    res.status(201).json({ id: info.lastInsertRowid, name, description: description || null, is_active: 1 });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/wholesale-prices/:id', (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    db.prepare(`UPDATE wholesale_prices SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM wholesale_prices WHERE id = ?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/wholesale-prices/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM wholesale_prices WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/finance/cashflow', (req, res) => {
  try {
    const { from, to } = req.query;
    let where = ''; const params = [];
    if (from) { where += ' AND date >= ?'; params.push(from); }
    if (to) { where += ' AND date <= ?'; params.push(to); }
    const incoming = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type IN ('income','order_payment') ${where}`).get(...params)?.total || 0;
    const outgoing = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type IN ('expense','refund','salary') ${where}`).get(...params)?.total || 0;
    const byCategory = db.prepare(`SELECT category, type, SUM(amount) as total, COUNT(*) as count FROM finance_transactions WHERE 1=1 ${where} GROUP BY category, type ORDER BY total DESC`).all(...params);
    res.json({ incoming, outgoing, balance: incoming - outgoing, byCategory });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// ─── Enterprise Payroll ─────────────────────────────────────────
app.get('/api/payroll/settings', (req, res) => {
  try {
    const s = payrollService.getSettings(db, req.tenant_id || 1);
    res.json(s);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/payroll/settings', (req, res) => {
  try {
    const { ndfl_rate, night_rate_multiplier, holiday_rate_multiplier, overtime_rate_multiplier, weekly_hours_norm, daily_hours_norm, kpi_enabled } = req.body;
    const tid = req.tenant_id || 1;
    const existing = db.prepare('SELECT id FROM payroll_settings WHERE tenant_id = ?').get(tid);
    if (existing) {
      db.prepare('UPDATE payroll_settings SET ndfl_rate = ?, night_rate_multiplier = ?, holiday_rate_multiplier = ?, overtime_rate_multiplier = ?, weekly_hours_norm = ?, daily_hours_norm = ?, kpi_enabled = ? WHERE tenant_id = ?')
        .run(ndfl_rate ?? 0.13, night_rate_multiplier ?? 1.5, holiday_rate_multiplier ?? 2.0, overtime_rate_multiplier ?? 1.5, weekly_hours_norm ?? 40, daily_hours_norm ?? 8, kpi_enabled ? 1 : 0, tid);
    } else {
      db.prepare('INSERT INTO payroll_settings (tenant_id, ndfl_rate, night_rate_multiplier, holiday_rate_multiplier, overtime_rate_multiplier, weekly_hours_norm, daily_hours_norm, kpi_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(tid, ndfl_rate ?? 0.13, night_rate_multiplier ?? 1.5, holiday_rate_multiplier ?? 2.0, overtime_rate_multiplier ?? 1.5, weekly_hours_norm ?? 40, daily_hours_norm ?? 8, kpi_enabled ? 1 : 0);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/timesheet', (req, res) => {
  try {
    const { staff_id, month, year } = req.query;
    const tid = req.tenant_id || 1;
    let sql = 'SELECT t.*, sf.first_name, sf.last_name FROM timesheet t JOIN staff sf ON sf.id = t.staff_id WHERE t.tenant_id = ?';
    const params = [tid];
    if (staff_id) { sql += ' AND t.staff_id = ?'; params.push(Number(staff_id)); }
    if (month && year) {
      const { start, end } = payrollService.calcMonthDates(Number(month), Number(year));
      sql += ' AND t.date BETWEEN ? AND ?'; params.push(start, end);
    }
    sql += ' ORDER BY t.date DESC, t.start_time DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/timesheet', (req, res) => {
  try {
    const { staff_id, date, start_time, end_time, break_minutes, note } = req.body;
    const info = db.prepare('INSERT INTO timesheet (tenant_id, staff_id, date, start_time, end_time, break_minutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.tenant_id || 1, staff_id, date, start_time || '', end_time || '', break_minutes || 0, note || '');
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/timesheet/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM timesheet WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/timesheet/export', (req, res) => {
  try {
    const { month, year } = req.query;
    const rows = payrollService.exportTimesheetForAuthorities(db, req.tenant_id || 1, Number(month) || new Date().getMonth() + 1, Number(year) || new Date().getFullYear());
    res.json(rows);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

// Courier per-shift payroll
app.get('/api/timesheet/:id/payroll', (req, res) => {
  try {
    const calc = shiftPayrollService.calculateShiftEarnings(db, req.tenant_id || 1, Number(req.params.id));
    if (!calc) return res.status(404).json({ error: 'Смена не найдена' });
    res.json(toCamelCase(calc));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/timesheet/payroll/calculate', (req, res) => {
  try {
    const { month, year, role } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const result = shiftPayrollService.calculateMonthForRole(db, req.tenant_id || 1, m, y, role || 'courier');
    res.json({ calculated: result.length, shifts: result.map(toCamelCase) });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.get('/api/courier-shift-payroll', (req, res) => {
  try {
    const { month, year, staff_id } = req.query;
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();
    const rows = shiftPayrollService.getStoredPayroll(db, req.tenant_id || 1, m, y, staff_id);
    res.json(toCamelCaseArray(rows));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});

app.get('/api/kpi-bonuses', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM kpi_bonuses WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenant_id || 1);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/kpi-bonuses', (req, res) => {
  try {
    const { name, role, metric, threshold, bonus_amount } = req.body;
    const info = db.prepare('INSERT INTO kpi_bonuses (tenant_id, name, role, metric, threshold, bonus_amount) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.tenant_id || 1, name, role || 'all', metric, threshold || 0, bonus_amount || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.delete('/api/kpi-bonuses/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM kpi_bonuses WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id || 1);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
};