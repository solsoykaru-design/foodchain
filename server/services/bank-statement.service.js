const XLSX = require('xlsx');

function parseStatement(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const transactions = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const date = parseDate(r[0]);
    const description = String(r[1] || '');
    const amount = parseFloat(String(r[2] || '0').replace(/\s/g, '').replace(',', '.'));
    const balance = parseFloat(String(r[3] || '0').replace(/\s/g, '').replace(',', '.'));
    if (date && amount) {
      transactions.push({ date: date.toISOString().split('T')[0], description, amount, balance: isNaN(balance) ? null : balance });
    }
  }
  return transactions;
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  const s = String(v).trim();
  const parts = s.split(/[.\-\/]/);
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function matchTransactions(db, transactions, tenantId = 1) {
  const matches = [];
  const orders = db.prepare("SELECT id, total, created_at, order_type FROM orders WHERE tenant_id = ? AND total > 0 AND status != 'cancelled' ORDER BY created_at").all(tenantId);
  const matchedOrderIds = new Set();

  function tryMatch(tx) {
    // 1. Exact date + amount
    for (const o of orders) {
      if (matchedOrderIds.has(o.id)) continue;
      const oDate = (o.created_at || '').split('T')[0];
      if (Math.abs(o.total - tx.amount) < 0.5 && oDate === tx.date) {
        matchedOrderIds.add(o.id);
        return { order_id: o.id, confidence: 'high' };
      }
    }
    // 2. Amount within ±2 days
    const txDate = new Date(tx.date);
    for (const o of orders) {
      if (matchedOrderIds.has(o.id)) continue;
      const oDate = new Date(o.created_at);
      const daysDiff = Math.abs((txDate - oDate) / 86400000);
      if (daysDiff <= 2 && Math.abs(o.total - tx.amount) < 0.5) {
        matchedOrderIds.add(o.id);
        return { order_id: o.id, confidence: 'medium' };
      }
    }
    // 3. Order ID in description
    const orderIdMatch = tx.description && tx.description.match(/#?\b(\d{1,10})\b/);
    if (orderIdMatch) {
      const orderId = Number(orderIdMatch[1]);
      const o = orders.find(oo => oo.id === orderId && !matchedOrderIds.has(oo.id));
      if (o) {
        matchedOrderIds.add(o.id);
        return { order_id: o.id, confidence: 'medium' };
      }
    }
    return { order_id: null, confidence: 'unmatched' };
  }

  for (const tx of transactions) {
    const m = tryMatch(tx);
    matches.push({ tx_date: tx.date, tx_description: tx.description, tx_amount: tx.amount, order_id: m.order_id, order_total: m.order_id ? orders.find(o => o.id === m.order_id)?.total : null, confidence: m.confidence });
  }
  return matches;
}

function getReconciliationSummary(db, tenantId = 1) {
  const total = db.prepare("SELECT COUNT(*) as c FROM bank_transactions WHERE tenant_id = ?").get(tenantId);
  const matched = db.prepare("SELECT COUNT(*) as c FROM bank_transactions WHERE tenant_id = ? AND order_id IS NOT NULL").get(tenantId);
  const unmatched = db.prepare("SELECT COUNT(*) as c FROM bank_transactions WHERE tenant_id = ? AND order_id IS NULL").get(tenantId);
  return { total: total.c, matched: matched.c, unmatched: unmatched.c };
}

function getTransactions(db, tenantId = 1) {
  return db.prepare("SELECT * FROM bank_transactions WHERE tenant_id = ? ORDER BY date DESC LIMIT 500").all(tenantId);
}

function clearTransactions(db, tenantId = 1) {
  db.prepare("DELETE FROM bank_transactions WHERE tenant_id = ?").run(tenantId);
}

module.exports = { parseStatement, matchTransactions, getReconciliationSummary, getTransactions, clearTransactions };
