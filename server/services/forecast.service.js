const math = {
  mean: arr => arr.reduce((a,b) => a+b, 0) / arr.length,
  round: (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d)
};

function generateForecast(db, tenantId = 1) {
  const items = db.prepare('SELECT * FROM inventory_items').all();
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

    // Even with 1 day of data we can produce a forecast
    const dayOfWeekUsage = {};
    for (const row of usage) {
      const dow = new Date(row.day).getDay();
      if (!dayOfWeekUsage[dow]) dayOfWeekUsage[dow] = [];
      dayOfWeekUsage[dow].push(Math.abs(row.qty || 0));
    }

    // If absolutely no data, use a default of 0 for each day
    for (let i = 1; i <= 7; i++) {
      const forecastDate = new Date(now);
      forecastDate.setDate(forecastDate.getDate() + i);
      const dow = forecastDate.getDay();
      const history = dayOfWeekUsage[dow] || [];

      let forecastQty = 0;
      if (history.length > 0) {
        const recent4 = history.slice(-4);
        const previous4 = history.length > 8 ? history.slice(-8, -4) : recent4;
        const recentAvg = math.mean(recent4);
        const prevAvg = math.mean(previous4);
        let trend = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0;
        trend = Math.max(-0.5, Math.min(0.5, trend));
        forecastQty = math.round(recentAvg * (1 + trend), 2);
      }

      const recommended_purchase = Math.max(0, math.round(forecastQty - (item.current_stock || 0), 2));

      // Insert forecast into DB with all fields
      const existing = db.prepare('SELECT id FROM forecasts WHERE product_id = ? AND forecast_date = ?').get(item.id, forecastDate.toISOString().split('T')[0]);
      if (existing) {
        db.prepare('UPDATE forecasts SET forecast_quantity = ?, recommended_purchase = ?, updated_at = datetime(\'now\') WHERE id = ?').run(forecastQty, recommended_purchase, existing.id);
      } else {
        db.prepare('INSERT INTO forecasts (product_id, forecast_date, forecast_quantity, recommended_purchase, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(item.id, forecastDate.toISOString().split('T')[0], forecastQty, recommended_purchase);
      }

      forecasts.push({
        product_id: item.id,
        product_name: item.name,
        unit: item.unit || 'шт',
        forecast_date: forecastDate.toISOString().split('T')[0],
        forecast_quantity: forecastQty,
        current_stock: item.current_stock || 0,
        min_stock: item.min_stock || 0,
        recommended_purchase,
      });
    }
  }

  return forecasts;
}

module.exports = { generateForecast };
