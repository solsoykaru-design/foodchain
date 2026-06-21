const VAT_RATES = { none: 0, vat0: 0, vat10: 10, vat20: 20, vat10_110: 10 / 110, vat20_120: 20 / 120 };

function getVatMultiplier(rate) {
  return VAT_RATES[rate] ?? 0;
}

function getVatFromTotal(total, rate) {
  const r = getVatMultiplier(rate);
  if (r === 0) return 0;
  if (rate === 'vat10_110' || rate === 'vat20_120') return total * r;
  return total - (total / (1 + r / 100));
}

function getSalesLedger(db, year, month, tenantId = 1) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = year && month ? getMonthEnd(year, month) : null;
  const orders = db.prepare(`
    SELECT o.id, o.created_at, o.total, o.payment_method, o.order_type,
      d.name as dish_name, oi.price, oi.quantity,
      d.tax_rate
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN dishes d ON d.id = oi.dish_id
    WHERE o.tenant_id = ?
      AND o.status NOT IN ('cancelled')
      AND o.total > 0
      ${end ? 'AND date(o.created_at) BETWEEN ? AND ?' : ''}
    ORDER BY o.created_at
  `).all(tenantId, ...(end ? [start, end] : []));

  const byInvoice = {};
  for (const row of orders) {
    const invKey = `${row.id}_${row.created_at}`;
    if (!byInvoice[invKey]) {
      byInvoice[invKey] = {
        order_id: row.id, date: (row.created_at || '').split('T')[0],
        payment_method: row.payment_method, order_type: row.order_type,
        total: row.total, items: [],
      };
    }
    const vatRate = row.tax_rate || 'vat20';
    const vatAmount = getVatFromTotal(row.price * row.quantity, vatRate);
    const netAmount = row.price * row.quantity - vatAmount;
    byInvoice[invKey].items.push({ dish: row.dish_name, qty: row.quantity, price: row.price, vatRate, vatAmount, netAmount });
  }

  const entries = Object.values(byInvoice);
  const summary = { totalVat: 0, totalNet: 0, totalGross: 0, count: entries.length };
  for (const e of entries) {
    e.vatTotal = e.items.reduce((s, i) => s + i.vatAmount, 0);
    e.netTotal = e.items.reduce((s, i) => s + i.netAmount, 0);
    summary.totalVat += e.vatTotal;
    summary.totalNet += e.netTotal;
    summary.totalGross += e.total;
  }
  return { entries: Object.values(byInvoice), summary };
}

function getPurchaseLedger(db, year, month, tenantId = 1) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = getMonthEnd(year, month);
  const docs = db.prepare(`
    SELECT d.id, d.created_at, d.total, d.type, d.type_label,
      di.item_name, di.quantity, di.price,
      i.tax_rate
    FROM documents d
    JOIN document_items di ON di.document_id = d.id
    LEFT JOIN inventory_items i ON i.id = di.item_id
    WHERE d.tenant_id = ?
      AND d.type IN ('receipt', 'contractor_order')
      AND d.status = 'confirmed'
      AND date(d.created_at) BETWEEN ? AND ?
    ORDER BY d.created_at
  `).all(tenantId, start, end);

  const entries = [];
  let totalVat = 0, totalNet = 0, totalGross = 0;
  for (const row of docs) {
    const vatRate = row.tax_rate || 'vat20';
    const gross = row.price * row.quantity;
    const vat = getVatFromTotal(gross, vatRate);
    const net = gross - vat;
    totalVat += vat; totalNet += net; totalGross += gross;
    entries.push({
      doc_id: row.id, date: (row.created_at || '').split('T')[0],
      type: row.type_label || row.type, item: row.item_name,
      qty: row.quantity, price: row.price, gross,
      vatRate, vat, net,
    });
  }
  return { entries, summary: { totalVat, totalNet, totalGross, count: entries.length } };
}

function getVatDeclaration(db, year, month, tenantId = 1) {
  const sales = getSalesLedger(db, year, month, tenantId);
  const purchases = getPurchaseLedger(db, year, month, tenantId);

  const bySalesRate = {};
  for (const e of sales.entries) {
    for (const i of e.items) {
      const rate = i.vatRate;
      if (!bySalesRate[rate]) bySalesRate[rate] = { rate, net: 0, vat: 0 };
      bySalesRate[rate].net += i.netAmount;
      bySalesRate[rate].vat += i.vatAmount;
    }
  }
  const byPurchaseRate = {};
  for (const e of purchases.entries) {
    const rate = e.vatRate;
    if (!byPurchaseRate[rate]) byPurchaseRate[rate] = { rate, net: 0, vat: 0, gross: 0 };
    byPurchaseRate[rate].net += e.net;
    byPurchaseRate[rate].vat += e.vat;
    byPurchaseRate[rate].gross += e.gross;
  }

  const summary = {
    salesVat: sales.summary.totalVat,
    purchaseVat: purchases.summary.totalVat,
    payable: sales.summary.totalVat - purchases.summary.totalVat,
    salesGross: sales.summary.totalGross,
    purchaseGross: purchases.summary.totalGross,
  };

  return { salesByRate: Object.values(bySalesRate), purchaseByRate: Object.values(byPurchaseRate), summary };
}

function getMonthEnd(year, month) {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { getSalesLedger, getPurchaseLedger, getVatDeclaration };
