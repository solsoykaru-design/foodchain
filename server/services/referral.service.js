const crypto = require('crypto');

function generateCode() {
  return 'FC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getSettings(db, tenantId) {
  let s = db.prepare('SELECT * FROM referral_settings WHERE tenant_id = ?').get(tenantId);
  if (!s) {
    db.prepare('INSERT INTO referral_settings (tenant_id) VALUES (?)').run(tenantId);
    s = db.prepare('SELECT * FROM referral_settings WHERE tenant_id = ?').get(tenantId);
  }
  return {
    enabled: s?.enabled ?? 0,
    referrer_bonus: s?.referrer_bonus ?? 100,
    referee_bonus: s?.referee_bonus ?? 100,
    min_order_amount: s?.min_order_amount ?? 500,
    bonus_type: s?.bonus_type ?? 'points',
  };
}

function getUserReferralCode(db, tenantId, userId) {
  let row = db.prepare('SELECT * FROM referral_codes WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId);
  if (!row) {
    const code = generateCode();
    const info = db.prepare('INSERT INTO referral_codes (tenant_id, user_id, code) VALUES (?, ?, ?)').run(tenantId, userId, code);
    row = { id: info.lastInsertRowid, tenant_id: tenantId, user_id: userId, code, used_count: 0 };
  }
  return row;
}

function applyReferralCode(db, tenantId, refereeUserId, code) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) throw new Error('Реферальная программа отключена');
  if (!code) throw new Error('Укажите код');

  const referrerCode = db.prepare('SELECT * FROM referral_codes WHERE code = ? AND tenant_id = ?').get(code, tenantId);
  if (!referrerCode) throw new Error('Код не найден');
  if (referrerCode.user_id === refereeUserId) throw new Error('Нельзя использовать свой код');

  const existing = db.prepare('SELECT * FROM referrals WHERE referee_id = ? AND tenant_id = ?').get(refereeUserId, tenantId);
  if (existing) throw new Error('Вы уже участвуете в реферальной программе');

  const info = db.prepare('INSERT INTO referrals (tenant_id, referrer_id, referee_id, code, status) VALUES (?, ?, ?, ?, ?)')
    .run(tenantId, referrerCode.user_id, refereeUserId, code, 'pending');

  // Credit referee bonus immediately
  if (settings.bonus_type === 'points') {
    creditBonus(db, tenantId, refereeUserId, settings.referee_bonus, `Бонус по реферальному коду ${code}`);
  }

  return { id: info.lastInsertRowid, referrer_id: referrerCode.user_id };
}

function creditBonus(db, tenantId, userId, amount, description) {
  const bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ?').get(userId);
  if (bonus) {
    db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?').run(amount, amount, bonus.id);
  } else {
    db.prepare('INSERT INTO user_bonuses (user_id, balance, lifetime_earned) VALUES (?, ?, ?)').run(userId, amount, amount);
  }
  db.prepare('UPDATE users SET bonus_balance = COALESCE(bonus_balance, 0) + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO bonus_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)').run(userId, 'referral', amount, description);
}

function completeReferral(db, tenantId, refereeUserId, orderAmount) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) return;
  const referral = db.prepare('SELECT * FROM referrals WHERE referee_id = ? AND tenant_id = ? AND status = ?').get(refereeUserId, tenantId, 'pending');
  if (!referral) return;
  if (orderAmount < settings.min_order_amount) return;

  db.prepare("UPDATE referrals SET status = 'completed', completed_at = datetime('now'), order_amount = ? WHERE id = ?").run(orderAmount, referral.id);
  db.prepare('UPDATE referral_codes SET used_count = used_count + 1 WHERE user_id = ? AND tenant_id = ?').run(referral.referrer_id, tenantId);

  if (settings.bonus_type === 'points') {
    creditBonus(db, tenantId, referral.referrer_id, settings.referrer_bonus, `Бонус за приглашённого пользователя #${refereeUserId}`);
  }
}

function getReferrals(db, tenantId, userId) {
  return db.prepare('SELECT r.*, u.name as referee_name, u.phone as referee_phone FROM referrals r LEFT JOIN users u ON u.id = r.referee_id WHERE r.referrer_id = ? AND r.tenant_id = ? ORDER BY r.created_at DESC').all(userId, tenantId);
}

function getStats(db, tenantId) {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM referrals WHERE tenant_id = ?').get(tenantId).cnt;
  const completed = db.prepare("SELECT COUNT(*) as cnt FROM referrals WHERE tenant_id = ? AND status = 'completed'").get(tenantId).cnt;
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM referrals WHERE tenant_id = ? AND status = 'pending'").get(tenantId).cnt;
  const top = db.prepare('SELECT rc.code, rc.user_id, rc.used_count, u.name, u.phone FROM referral_codes rc LEFT JOIN users u ON u.id = rc.user_id WHERE rc.tenant_id = ? ORDER BY rc.used_count DESC LIMIT 10').all(tenantId);
  return { total, completed, pending, top };
}

function updateSettings(db, tenantId, data) {
  const existing = db.prepare('SELECT id FROM referral_settings WHERE tenant_id = ?').get(tenantId);
  if (existing) {
    db.prepare('UPDATE referral_settings SET enabled = ?, referrer_bonus = ?, referee_bonus = ?, min_order_amount = ?, bonus_type = ? WHERE tenant_id = ?')
      .run(data.enabled ? 1 : 0, data.referrer_bonus ?? 100, data.referee_bonus ?? 100, data.min_order_amount ?? 500, data.bonus_type || 'points', tenantId);
  } else {
    db.prepare('INSERT INTO referral_settings (tenant_id, enabled, referrer_bonus, referee_bonus, min_order_amount, bonus_type) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tenantId, data.enabled ? 1 : 0, data.referrer_bonus ?? 100, data.referee_bonus ?? 100, data.min_order_amount ?? 500, data.bonus_type || 'points');
  }
  return { ok: true };
}

module.exports = { generateCode, getSettings, getUserReferralCode, applyReferralCode, completeReferral, getReferrals, getStats, updateSettings, creditBonus };
