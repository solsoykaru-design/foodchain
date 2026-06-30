const CHALLENGES = [
  { id: 'orders_5', title: 'Постоянный гость', desc: 'Сделайте 5 заказов', icon: '🛵', max: 5, reward_points: 50 },
  { id: 'orders_10', title: 'Завсегдатай', desc: 'Сделайте 10 заказов', icon: '⭐', max: 10, reward_points: 150 },
  { id: 'reviews_3', title: 'Критик', desc: 'Оставьте 3 отзыва', icon: '✍️', max: 3, reward_points: 75 },
  { id: 'bonus_500', title: 'Бонус-хантер', desc: 'Накопите 500 бонусов', icon: '💰', max: 500, reward_points: 100 },
  { id: 'visit_7', title: '7 дней подряд', desc: 'Делайте заказы 7 дней подряд', icon: '📅', max: 7, reward_points: 200 },
];

function getOrdersCount(db, tenantId, userId) {
  return db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId)?.c || 0;
}

function getReviewsCount(db, tenantId, userId) {
  return db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId)?.c || 0;
}

function getBonusBalance(db, tenantId, userId) {
  return db.prepare('SELECT COALESCE(balance,0) as b FROM user_bonuses WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId)?.b || 0;
}

function getConsecutiveVisitDays(db, tenantId, userId) {
  const rows = db.prepare(`
    SELECT DISTINCT date(created_at) as d FROM orders
    WHERE user_id = ? AND tenant_id = ? AND status != 'cancelled'
    ORDER BY d DESC
  `).all(userId, tenantId);
  if (rows.length === 0) return 0;

  let streak = 1;
  const dates = rows.map(r => new Date(r.d + 'T00:00:00'));
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    prev.setDate(prev.getDate() - 1);
    const prevStr = prev.toISOString().slice(0, 10);
    const currStr = dates[i].toISOString().slice(0, 10);
    if (currStr === prevStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function creditBonus(db, tenantId, userId, amount, description) {
  if (amount <= 0) return;
  let bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId);
  if (bonus) {
    db.prepare('UPDATE user_bonuses SET balance = balance + ?, lifetime_earned = lifetime_earned + ? WHERE id = ?')
      .run(amount, amount, bonus.id);
  } else {
    db.prepare('INSERT INTO user_bonuses (user_id, tenant_id, balance, lifetime_earned) VALUES (?, ?, ?, ?)')
      .run(userId, tenantId, amount, amount);
    bonus = db.prepare('SELECT * FROM user_bonuses WHERE user_id = ? AND tenant_id = ?').get(userId, tenantId);
  }
  db.prepare('UPDATE users SET bonus_balance = COALESCE(bonus_balance, 0) + ? WHERE id = ? AND tenant_id = ?')
    .run(amount, userId, tenantId);
  db.prepare('INSERT INTO bonus_transactions (user_id, bonus_id, type, amount, description) VALUES (?, ?, ?, ?, ?)')
    .run(userId, bonus.id, 'challenge', amount, description);
}

function isRewarded(db, tenantId, userId, challengeId) {
  const row = db.prepare(`
    SELECT COUNT(*) as c FROM game_participations
    WHERE tenant_id = ? AND guest_id = ? AND game_type = 'challenge' AND prize = ?
  `).get(tenantId, userId, challengeId);
  return row.c > 0;
}

function markRewarded(db, tenantId, userId, challengeId, points) {
  db.prepare(`
    INSERT INTO game_participations (tenant_id, guest_id, game_id, game_type, points, prize)
    VALUES (?, ?, ?, 'challenge', ?, ?)
  `).run(tenantId, userId, 0, points, challengeId);
}

function getProgress(db, tenantId, userId) {
  const ordersCount = getOrdersCount(db, tenantId, userId);
  const reviewsCount = getReviewsCount(db, tenantId, userId);
  const bonusBalance = getBonusBalance(db, tenantId, userId);
  const visitDays = getConsecutiveVisitDays(db, tenantId, userId);

  const progressMap = {
    orders_5: ordersCount,
    orders_10: ordersCount,
    reviews_3: reviewsCount,
    bonus_500: bonusBalance,
    visit_7: visitDays,
  };

  return CHALLENGES.map(ch => ({
    ...ch,
    progress: Math.min(progressMap[ch.id] || 0, ch.max),
    completed: (progressMap[ch.id] || 0) >= ch.max,
  }));
}

function checkAndReward(db, tenantId, userId) {
  const challenges = getProgress(db, tenantId, userId);
  const rewardedIds = [];
  for (const ch of challenges) {
    if (ch.completed && !isRewarded(db, tenantId, userId, ch.id)) {
      creditBonus(db, tenantId, userId, ch.reward_points, `Награда за челлендж "${ch.title}"`);
      markRewarded(db, tenantId, userId, ch.id, ch.reward_points);
      rewardedIds.push(ch.id);
    }
  }
  // Re-fetch with rewarded flag
  const result = getProgress(db, tenantId, userId).map(ch => ({
    ...ch,
    rewarded: isRewarded(db, tenantId, userId, ch.id),
    just_rewarded: rewardedIds.includes(ch.id),
  }));
  return { challenges: result, rewarded: rewardedIds };
}

module.exports = { CHALLENGES, getProgress, checkAndReward };
