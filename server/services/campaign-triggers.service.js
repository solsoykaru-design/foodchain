const cron = require('node-cron');

let cronJob = null;

function getTenantId() {
  return 1; // default tenant; multi-tenant scheduler can be extended later
}

function parseJson(str, fallback = {}) {
  try { return JSON.parse(str || '{}'); } catch { return fallback; }
}

function findMatchingUsers(db, tenantId, campaign) {
  const triggerType = campaign.trigger_type || 'manual';
  const triggerConfig = parseJson(campaign.trigger_config);
  const segmentFilter = parseJson(campaign.segment_filter);
  const now = new Date();
  const users = [];

  // Base query: all guest users of the tenant
  const baseSql = 'SELECT id, name, phone, email, birthday, loyalty_level, created_at FROM users WHERE tenant_id = ? AND role = ?';
  const allUsers = db.prepare(baseSql).all(tenantId, 'guest');

  for (const u of allUsers) {
    // Segment filter (RFM)
    if (segmentFilter.segment) {
      const rfm = db.prepare('SELECT segment FROM user_rfm WHERE user_id = ? AND tenant_id = ?').get(u.id, tenantId);
      if (!rfm || rfm.segment !== segmentFilter.segment) continue;
    }
    if (segmentFilter.minMonetary) {
      const rfm = db.prepare('SELECT monetary FROM user_rfm WHERE user_id = ? AND tenant_id = ?').get(u.id, tenantId);
      if (!rfm || (rfm.monetary || 0) < segmentFilter.minMonetary) continue;
    }

    // Trigger-specific logic
    if (triggerType === 'birthday') {
      if (!u.birthday || u.birthday === '1990-01-01') continue;
      const daysBefore = triggerConfig.daysBefore || 0;
      const bdate = new Date(u.birthday);
      const target = new Date(now.getFullYear(), bdate.getMonth(), bdate.getDate());
      const diff = Math.ceil((target - now) / 86400000);
      if (diff < 0) continue; // birthday passed this year
      if (diff !== daysBefore) continue;
      users.push(u);
    }

    else if (triggerType === 'inactive_days') {
      const days = triggerConfig.days || 30;
      const lastOrder = db.prepare(`
        SELECT created_at FROM orders
        WHERE user_id = ? AND status IN ('paid', 'closed', 'delivered')
        ORDER BY created_at DESC LIMIT 1
      `).get(u.id);
      if (!lastOrder) continue;
      const last = new Date(lastOrder.created_at).getTime();
      const inactiveDays = Math.floor((Date.now() - last) / 86400000);
      if (inactiveDays !== days && inactiveDays !== days + 1) continue;
      users.push(u);
    }

    else if (triggerType === 'abandoned_cart') {
      const minutes = triggerConfig.minutes || 30;
      const cart = db.prepare(`
        SELECT updated_at FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
      `).get(u.id);
      if (!cart) continue;
      const updated = new Date(cart.updated_at).getTime();
      const elapsedMin = Math.floor((Date.now() - updated) / 60000);
      if (elapsedMin < minutes || elapsedMin > minutes + 10) continue;
      // Ensure there is at least one item in cart
      const items = db.prepare('SELECT COUNT(*) as cnt FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1)').get(u.id);
      if (!items || items.cnt === 0) continue;
      users.push(u);
    }

    else if (triggerType === 'loyalty_level_up') {
      const targetLevel = triggerConfig.level || 'серебряный';
      if (u.loyalty_level !== targetLevel) continue;
      // Only send once per level - check recent logs
      const recent = db.prepare(`
        SELECT COUNT(*) as cnt FROM campaign_logs
        WHERE campaign_id = ? AND user_id = ? AND sent_at > datetime('now', '-30 days')
      `).get(campaign.id, u.id);
      if (recent.cnt > 0) continue;
      users.push(u);
    }

    else if (triggerType === 'manual') {
      // Manual campaigns should not be auto-processed here
      continue;
    }
  }

  return users;
}

function wasRecentlySent(db, campaignId, userId, minDays = 30) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM campaign_logs
    WHERE campaign_id = ? AND user_id = ? AND sent_at > datetime('now', '-${minDays} days')
  `).get(campaignId, userId);
  return row.cnt > 0;
}

function sendCampaign(db, tenantId, campaign, users) {
  const channel = campaign.channel || 'push';
  const title = campaign.message_title || '';
  const body = campaign.message_body || '';
  let sent = 0;

  const logStmt = db.prepare('INSERT INTO campaign_logs (campaign_id, variant_id, user_id, channel, status) VALUES (?, ?, ?, ?, ?)');
  const notifyStmt = db.prepare('INSERT INTO notifications (user_id, title, body, type, data) VALUES (?, ?, ?, ?, ?)');

  for (const u of users) {
    if (wasRecentlySent(db, campaign.id, u.id)) continue;

    logStmt.run(campaign.id, null, u.id, channel, 'sent');
    notifyStmt.run(u.id, title, body, 'campaign', JSON.stringify({ campaignId: campaign.id, channel }));
    sent++;
  }

  if (sent > 0) {
    db.prepare("UPDATE campaigns SET sent_count = sent_count + ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(sent, 'active', campaign.id);
  }

  return { sent };
}

function processTriggeredCampaigns(db, tenantId = 1) {
  const campaigns = db.prepare(`
    SELECT * FROM campaigns
    WHERE tenant_id = ? AND trigger_type != 'manual' AND status IN ('draft', 'active')
    ORDER BY created_at ASC
  `).all(tenantId);

  const results = [];
  for (const campaign of campaigns) {
    try {
      const users = findMatchingUsers(db, tenantId, campaign);
      if (users.length === 0) {
        results.push({ campaignId: campaign.id, name: campaign.name, sent: 0 });
        continue;
      }
      const r = sendCampaign(db, tenantId, campaign, users);
      results.push({ campaignId: campaign.id, name: campaign.name, sent: r.sent });
    } catch (e) {
      results.push({ campaignId: campaign.id, name: campaign.name, error: e.message });
    }
  }
  return results;
}

function scheduleCampaignTriggers(db) {
  if (cronJob) cronJob.stop();
  cronJob = cron.schedule('0 * * * *', () => {
    try {
      processTriggeredCampaigns(db, getTenantId());
    } catch (e) {
      console.error('Campaign trigger scheduler error:', e);
    }
  });
  return cronJob;
}

function shutdown() {
  if (cronJob) cronJob.stop();
}

module.exports = { processTriggeredCampaigns, scheduleCampaignTriggers, shutdown };
