const emailService = require('./email.service');
const pushService = require('./push.service');
const telegramBotService = require('./telegram-bot.service');
const smsService = require('./sms.service');

function interpolate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function buildDiscountText(campaign) {
  const parts = [];
  if (campaign.discount_percent > 0) parts.push(`Скидка ${campaign.discount_percent}%`);
  if (campaign.discount_amount > 0) parts.push(`Скидка ${campaign.discount_amount} ₽`);
  if (campaign.bonus_amount > 0) parts.push(`+${campaign.bonus_amount} бонусов`);
  return parts.join(', ');
}

function makeUserMessage(campaign, variant, user) {
  const title = (variant?.message_title || campaign.message_title || '').trim();
  const body = (variant?.message_body || campaign.message_body || '').trim();
  const discount = buildDiscountText(campaign);
  const vars = {
    name: user.name || '',
    phone: user.phone || '',
    discount: discount || '',
  };
  return {
    title: interpolate(title, vars),
    body: interpolate(body, vars) + (discount ? '\n\n' + discount : ''),
    discount,
  };
}

function logCampaign(db, { campaignId, variantId, userId, channel, status, error }) {
  try {
    db.prepare(`INSERT INTO campaign_logs
      (campaign_id, variant_id, user_id, channel, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(campaignId, variantId || null, userId, channel, status, error || null);
  } catch (e) {
    console.error('[campaign-dispatcher] log error:', e.message);
  }
}

function notifyInApp(db, userId, title, body, campaignId, channel) {
  try {
    db.prepare(`INSERT INTO notifications
      (user_id, title, body, type, data, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(userId, title, body, 'campaign', JSON.stringify({ campaignId, channel }), 1);
  } catch (e) {
    // Notifications table may be missing extended columns in some tests.
  }
}

async function dispatchUser(db, tenantId, user, campaign, variant) {
  const channel = campaign.channel || 'push';
  const { title, body } = makeUserMessage(campaign, variant, user);

  if (channel === 'email') {
    if (!user.email) return { status: 'skipped', reason: 'no email' };
    const res = await emailService.sendMail(db, {
      to: user.email,
      subject: title,
      html: body.replace(/\n/g, '<br>'),
      text: body,
    }, tenantId);
    return { status: res.success ? 'sent' : 'failed', error: res.error, recipient: user.email };
  }

  if (channel === 'sms') {
    if (!user.phone) return { status: 'skipped', reason: 'no phone' };
    const res = await smsService.sendMessage(user.phone, body);
    return { status: res.sent ? (res.fallback ? 'fallback' : 'sent') : 'failed', error: res.error, recipient: user.phone };
  }

  if (channel === 'telegram') {
    if (!user.phone) return { status: 'skipped', reason: 'no phone' };
    const res = await telegramBotService.sendToPhone(db, tenantId, user.phone, body);
    return { status: res.success ? 'sent' : 'failed', error: res.error, recipient: user.phone };
  }

  return { status: 'skipped', reason: `unknown channel ${channel}` };
}

async function dispatchCampaign(db, tenantId, campaign, users, variants = []) {
  const channel = campaign.channel || 'push';
  const campaignId = campaign.id;
  const abEnabled = campaign.ab_enabled && variants.length > 0;
  const result = { channel, total: users.length, sent: 0, failed: 0, skipped: 0, byStatus: {} };

  function pickVariant(userId) {
    if (!abEnabled) return null;
    const weight = variants[0]?.weight || 50;
    const idx = (userId % 100) < weight ? 0 : 1;
    return variants[idx] || variants[0];
  }

  if (channel === 'push') {
    const { title, body } = makeUserMessage(campaign, variants[0] || null, { name: '' });
    const pushRes = await pushService.sendToAll(db, { title, body, data: { campaignId } }, tenantId);
    const status = pushRes.success ? 'sent' : 'failed';
    const error = pushRes.error || null;
    for (const u of users) {
      logCampaign(db, { campaignId, variantId: null, userId: u.id, channel, status, error });
      if (status === 'sent') notifyInApp(db, u.id, title, body, campaignId, channel);
    }
    result.sent = pushRes.success ? users.length : 0;
    result.failed = pushRes.success ? 0 : users.length;
    result.byStatus[status] = users.length;
    result.pushResult = pushRes;
    return result;
  }

  for (const u of users) {
    const variant = pickVariant(u.id);
    const { title, body } = makeUserMessage(campaign, variant, u);
    const res = await dispatchUser(db, tenantId, u, campaign, variant);

    logCampaign(db, {
      campaignId,
      variantId: variant?.id || null,
      userId: u.id,
      channel,
      status: res.status,
      error: res.error || res.reason,
    });

    if (res.status === 'sent' || res.status === 'fallback') {
      if (res.status === 'sent') result.sent++;
      else result.skipped++; // fallback is not a real delivery
      notifyInApp(db, u.id, title, body, campaignId, channel);
    } else if (res.status === 'failed') {
      result.failed++;
    } else {
      result.skipped++;
    }
    result.byStatus[res.status] = (result.byStatus[res.status] || 0) + 1;
  }

  return result;
}

module.exports = { dispatchCampaign, dispatchUser };
