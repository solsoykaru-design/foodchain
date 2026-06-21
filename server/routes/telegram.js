const jwt = require('jsonwebtoken');

module.exports = function(app, db, config) {
  const { JWT_SECRET, broadcast, safeError } = config;

app.get('/api/telegram-bot/settings', (req, res) => {
  try { res.json(telegramBot.getSettings(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.put('/api/telegram-bot/settings', (req, res) => {
  try { res.json(telegramBot.saveSettings(db, req.body, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/telegram-bot/restart', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Auth required' });
    const token = authHeader.slice(7);
    jwt.verify(token, JWT_SECRET);
    telegramBot.stopBot();
    telegramBot.startIfConfigured(db, req.query.tenant_id || 1);
    res.json({ success: true });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Invalid token' });
    res.status(500).json({ error: safeError(e.message) });
  }
});
app.get('/api/telegram-bot/stats', (req, res) => {
  try { res.json(telegramBot.getStats(db, req.query.tenant_id || 1)); }
  catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/telegram-bot/broadcast', (req, res) => {
  try {
    const settings = telegramBot.getSettings(db, req.query.tenant_id || 1);
    if (!settings.token) return res.status(400).json({ error: 'Bot token not configured' });
    telegramBot.broadcast(db, settings.token, req.body.message).then(r => res.json(r)).catch(e => res.status(500).json({ error: safeError(e.message) }));
  } catch (e) { res.status(500).json({ error: safeError(e.message) }); }
});
app.post('/api/telegram-bot/subscribe', (req, res) => {
  const { chat_id, order_id } = req.body;
  if (!chat_id || !order_id) return res.status(400).json({ error: 'Missing params' });
  db.prepare("INSERT OR IGNORE INTO telegram_order_subscriptions (tenant_id, chat_id, order_id) VALUES (?, ?, ?)").run(req.query.tenant_id || 1, chat_id, order_id);
  res.json({ success: true });
});
app.delete('/api/telegram-bot/subscribe', (req, res) => {
  const { chat_id, order_id } = req.body;
  db.prepare('DELETE FROM telegram_order_subscriptions WHERE chat_id = ? AND order_id = ?').run(chat_id, order_id);
  res.json({ success: true });
});
app.get('/api/telegram-bot/analytics', (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM telegram_bot_users WHERE tenant_id = ?').get(tenantId).c;
  const activeToday = db.prepare("SELECT COUNT(*) as c FROM telegram_bot_users WHERE date(last_interaction) = date('now') AND tenant_id = ?").get(tenantId).c;
  const popularCmds = db.prepare("SELECT command, COUNT(*) as count FROM telegram_bot_log WHERE tenant_id = ? AND created_at > datetime('now', '-30 days') GROUP BY command ORDER BY count DESC LIMIT 10").all(tenantId);
  const dailyActive = db.prepare("SELECT date(last_interaction) as day, COUNT(*) as users FROM telegram_bot_users WHERE tenant_id = ? AND last_interaction > datetime('now', '-14 days') GROUP BY date(last_interaction) ORDER BY day").all(tenantId);
  res.json({ totalUsers, activeToday, popularCmds, dailyActive });
});
};