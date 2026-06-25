// ─── Push Notification Routes ───────────────────────────
module.exports = function (app, db, config) {
  const { safeError } = config;

  // Ensure table
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS mobile_push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      platform TEXT DEFAULT 'android',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, token)
    )`);
  } catch (e) {}

  // Register push token
  app.post('/api/mobile/push/register', (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth) return res.status(401).json({ error: 'Требуется авторизация' });
      const crypto = require('crypto');
      const JWT_SECRET = process.env.JWT_SECRET || 'mobile-app-secret-change-in-production';
      const parts = auth.replace('Bearer ', '').split('.');
      if (parts.length !== 3) return res.status(401).json({ error: 'Недействительный токен' });
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp < Math.floor(Date.now() / 1000)) return res.status(401).json({ error: 'Токен истёк' });

      const { token, platform } = req.body;
      if (!token) return res.status(400).json({ error: 'Token required' });

      db.prepare('INSERT OR REPLACE INTO mobile_push_tokens (user_id, token, platform) VALUES (?, ?, ?)').run(
        payload.userId, token, platform || 'android'
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // Unregister push token
  app.delete('/api/mobile/push/register', (req, res) => {
    try {
      const { token } = req.body;
      if (token) db.prepare('DELETE FROM mobile_push_tokens WHERE token = ?').run(token);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });

  // Send push notification (admin endpoint)
  app.post('/api/mobile/push/send', (req, res) => {
    try {
      const { userId, title, body, data } = req.body;
      let tokens;
      if (userId) {
        tokens = db.prepare('SELECT token FROM mobile_push_tokens WHERE user_id = ?').all(userId);
      } else {
        tokens = db.prepare('SELECT token FROM mobile_push_tokens').all();
      }

      // In production: send via Expo Push API or Firebase
      // For now just log
      console.log(`[PUSH] Would send to ${tokens.length} devices: ${title}`);

      res.json({ success: true, sent: tokens.length });
    } catch (e) {
      res.status(500).json({ error: safeError(e.message) });
    }
  });
};
