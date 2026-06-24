const nodemailer = require('nodemailer');

let transporter = null;
let cachedSettings = null;

function getSettings(db, tenantId = 1) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND tenant_id = ?').get('email_settings', tenantId);
  if (row) {
    try { return JSON.parse(row.value); } catch {}
  }
  return {};
}

function getMergedSettings(db, tenantId = 1) {
  const dbSettings = getSettings(db, tenantId);
  return {
    enabled: process.env.SMTP_ENABLED ? process.env.SMTP_ENABLED === 'true' : (dbSettings.enabled || false),
    provider: process.env.SMTP_PROVIDER || dbSettings.provider || 'smtp',
    host: process.env.SMTP_HOST || dbSettings.host || '',
    port: parseInt(process.env.SMTP_PORT || dbSettings.port || '587', 10),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (dbSettings.secure || false),
    user: process.env.SMTP_USER || dbSettings.user || '',
    pass: process.env.SMTP_PASS || dbSettings.pass || '',
    from: process.env.SMTP_FROM || dbSettings.from || process.env.SMTP_USER || 'noreply@foodchain.app',
    apiKey: process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY || dbSettings.apiKey || '',
    domain: dbSettings.domain || '',
  };
}

function saveSettings(db, settings, tenantId = 1) {
  const existing = db.prepare('SELECT id FROM settings WHERE key = ? AND tenant_id = ?').get('email_settings', tenantId);
  const data = JSON.stringify(settings);
  if (existing) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ? AND tenant_id = ?').run(data, 'email_settings', tenantId);
  } else {
    db.prepare('INSERT INTO settings (key, value, tenant_id) VALUES (?, ?, ?)').run('email_settings', data, tenantId);
  }
  cachedSettings = null;
  transporter = null;
  return { success: true };
}

function getTransporter(settings) {
  if (transporter) return transporter;
  if (!settings.enabled) return null;
  if (settings.provider === 'sendgrid') {
    if (!settings.apiKey) return null;
    return { provider: 'sendgrid', apiKey: settings.apiKey };
  }
  if (settings.provider === 'mailgun') {
    if (!settings.apiKey || !settings.domain) return null;
    return { provider: 'mailgun', apiKey: settings.apiKey, domain: settings.domain, host: settings.host || 'api.mailgun.net' };
  }
  if (!settings.host || !settings.user || !settings.pass) return null;
  transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port || 587,
    secure: settings.secure || false,
    auth: { user: settings.user, pass: settings.pass },
  });
  return transporter;
}

async function sendMail(db, { to, subject, html, text }, tenantId = 1, logCb) {
  const settings = getMergedSettings(db, tenantId);
  if (!settings.enabled) {
    const err = 'Email not configured';
    if (logCb) logCb('email', to, subject, 'failed', err);
    return { success: false, error: err };
  }
  const t = getTransporter(settings);
  if (!t) {
    const err = 'Email provider not configured';
    if (logCb) logCb('email', to, subject, 'failed', err);
    return { success: false, error: err };
  }
  try {
    const from = settings.from || settings.user || 'noreply@foodchain.app';
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    let messageId;
    if (t.provider === 'sendgrid') {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(t.apiKey);
      const msg = await sgMail.send({ to: recipients, from, subject, text: text || '', html: html || text || '' });
      messageId = msg[0]?.headers?.['x-message-id'];
    } else if (t.provider === 'mailgun') {
      const formData = require('form-data');
      const Mailgun = require('mailgun.js');
      const mg = new Mailgun(formData);
      const client = mg.client({ username: 'api', key: t.apiKey, url: 'https://' + t.host });
      const msg = await client.messages.create(t.domain, { from, to: recipients, subject, text: text || '', html: html || text || '' });
      messageId = msg.id;
    } else {
      const info = await t.sendMail({ from, to: recipients, subject, text, html: html || text });
      messageId = info.messageId;
    }
    if (logCb) logCb('email', to, subject, 'sent', null, messageId);
    return { success: true, messageId };
  } catch (e) {
    if (logCb) logCb('email', to, subject, 'failed', e.message);
    return { success: false, error: e.message };
  }
}

async function testConnection(db, tenantId = 1) {
  const settings = getMergedSettings(db, tenantId);
  if (settings.provider === 'sendgrid') {
    if (!settings.apiKey) return { success: false, error: 'SendGrid API key not configured' };
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(settings.apiKey);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }
  if (settings.provider === 'mailgun') {
    if (!settings.apiKey) return { success: false, error: 'Mailgun API key not configured' };
    if (!settings.domain) return { success: false, error: 'Mailgun domain not configured' };
    return { success: true };
  }
  if (!settings.host || !settings.user || !settings.pass) return { success: false, error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env or configure in admin panel.' };
  const t = getTransporter(settings);
  if (!t) return { success: false, error: 'Failed to create transporter' };
  try { await t.verify(); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
}

module.exports = { getSettings, getMergedSettings, saveSettings, sendMail, testConnection };
