const math = {
  mean: arr => arr.reduce((a,b) => a+b, 0) / arr.length,
  round: (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d)
};

function weightedMovingAverage(values, weights) {
  if (!values.length) return 0;
  let sum = 0, weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] ?? 1;
    sum += values[i] * w;
    weightSum += w;
  }
  return weightSum ? sum / weightSum : 0;
}

function generateForecast(db, tenantId = 1) {
  const items = db.prepare('SELECT * FROM inventory_items WHERE tenant_id = ?').all(tenantId);
  const now = new Date();
  const forecasts = [];

  for (const item of items) {
    const usage = db.prepare(`
      SELECT DATE(created_at) as day, SUM(quantity) as qty
      FROM inventory_transactions
      WHERE item_id = ? AND type = 'writeoff'
        AND created_at >= datetime('now', '-90 days')
      GROUP BY DATE(created_at)
      ORDER BY day
    `).all(item.id);

    const dayOfWeekUsage = {};
    const dailyUsage = [];
    for (const row of usage) {
      const dow = new Date(row.day).getDay();
      const qty = Math.abs(row.qty || 0);
      if (!dayOfWeekUsage[dow]) dayOfWeekUsage[dow] = [];
      dayOfWeekUsage[dow].push(qty);
      dailyUsage.push(qty);
    }

    const globalAvg = dailyUsage.length ? math.mean(dailyUsage) : 0;

    for (let i = 1; i <= 7; i++) {
      const forecastDate = new Date(now);
      forecastDate.setDate(forecastDate.getDate() + i);
      const dow = forecastDate.getDay();
      const history = dayOfWeekUsage[dow] || [];

      let forecastQty = 0;
      if (history.length > 0) {
        // Weighted moving average: recent weeks matter more
        const weights = history.map((_, idx) => idx + 1);
        const dowAvg = weightedMovingAverage(history, weights);
        // Trend over last 8 weeks
        const recent4 = history.slice(-4);
        const previous4 = history.length > 8 ? history.slice(-8, -4) : recent4;
        const recentAvg = math.mean(recent4);
        const prevAvg = math.mean(previous4);
        let trend = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0;
        trend = Math.max(-0.5, Math.min(0.5, trend));
        forecastQty = math.round(dowAvg * (1 + trend), 2);
      } else if (globalAvg > 0) {
        // Fallback to global daily average if no data for this weekday
        forecastQty = math.round(globalAvg, 2);
      }

      // Ensure recommended purchase covers min stock buffer
      const stock = item.current_stock || 0;
      const minStock = item.min_stock || 0;
      const needed = Math.max(0, forecastQty - stock + minStock);
      const recommended_purchase = math.round(needed, 2);

      const existing = db.prepare('SELECT id FROM forecasts WHERE product_id = ? AND forecast_date = ? AND tenant_id = ?').get(item.id, forecastDate.toISOString().split('T')[0], tenantId);
      if (existing) {
        db.prepare('UPDATE forecasts SET forecast_quantity = ?, recommended_purchase = ?, updated_at = datetime(\'now\') WHERE id = ?').run(forecastQty, recommended_purchase, existing.id);
      } else {
        db.prepare('INSERT INTO forecasts (tenant_id, product_id, forecast_date, forecast_quantity, recommended_purchase, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run(tenantId, item.id, forecastDate.toISOString().split('T')[0], forecastQty, recommended_purchase);
      }

      forecasts.push({
        product_id: item.id,
        product_name: item.name,
        unit: item.unit || 'шт',
        forecast_date: forecastDate.toISOString().split('T')[0],
        forecast_quantity: forecastQty,
        current_stock: stock,
        min_stock: minStock,
        recommended_purchase,
      });
    }
  }

  return forecasts;
}

function getForecastAccuracy(db, tenantId = 1, days = 14) {
  const rows = db.prepare(`
    SELECT f.product_id, i.name as product_name, f.forecast_date, f.forecast_quantity,
      COALESCE((SELECT SUM(ABS(quantity)) FROM inventory_transactions WHERE item_id = f.product_id AND type = 'writeoff' AND DATE(created_at) = f.forecast_date), 0) as actual
    FROM forecasts f
    JOIN inventory_items i ON i.id = f.product_id
    WHERE f.tenant_id = ? AND f.forecast_date >= date('now', ?) AND f.forecast_date <= date('now')
    ORDER BY f.product_id, f.forecast_date
  `).all(tenantId, `-${days} days`);

  const byProduct = {};
  for (const r of rows) {
    if (!byProduct[r.product_id]) {
      byProduct[r.product_id] = { productId: r.product_id, productName: r.product_name, totalError: 0, totalActual: 0, count: 0 };
    }
    const forecast = Number(r.forecast_quantity || 0);
    const actual = Number(r.actual || 0);
    byProduct[r.product_id].totalError += Math.abs(forecast - actual);
    byProduct[r.product_id].totalActual += actual;
    byProduct[r.product_id].count++;
  }

  return Object.values(byProduct).map((p) => {
    const mape = p.totalActual > 0 ? (p.totalError / p.totalActual) * 100 : (p.totalError > 0 ? 100 : 0);
    return { ...p, mape: Math.round(mape * 100) / 100 };
  });
}

module.exports = { generateForecast, getForecastAccuracy };
