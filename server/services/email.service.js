const nodemailer = require('nodemailer');

let transporter = null;
let cachedSettings = null;

function getSettings(db, tenantId = 1) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND tenant_id = ?').get('email_settings', tenantId);
  if (!row) return {};
  try { return JSON.parse(row.value); } catch { return {}; }
}

function saveSettings(db, settings, tenantId = 1) {
  const existing = db.prepare('SELECT id FROM settings WHERE key = ? AND tenant_id = ?').get('email_settings', tenantId);
  const data = JSON.stringify(settings);
  if (existing) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ? AND tenant_id = ?').run(data, 'email_settings', tenantId);
  } else {
    db.prepare('INSERT INTO settings (key, value, tenant_id) VALUES (?, ?, ?)').run('email_settings', data, tenantId);
  }
  cachedSettings = settings;
  transporter = null;
  return { success: true };
}

function getTransporter(db, tenantId = 1) {
  if (transporter) return transporter;
  const settings = getSettings(db, tenantId);
  cachedSettings = settings;
  if (!settings.enabled) return null;
  if (settings.provider === 'sendgrid') {
    return { provider: 'sendgrid', apiKey: settings.apiKey || settings.pass };
  }
  if (settings.provider === 'mailgun') {
    return { provider: 'mailgun', apiKey: settings.apiKey || settings.pass, domain: settings.domain, host: settings.host || 'api.mailgun.net' };
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

async function sendMail(db, { to, subject, html, text }, tenantId = 1) {
  const settings = getSettings(db, tenantId);
  if (!settings.enabled) return { success: false, error: 'Email not configured' };
  const t = getTransporter(db, tenantId);
  if (!t) return { success: false, error: 'Email provider not configured' };
  try {
    const from = settings.from || settings.user || 'noreply@foodchain.app';
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    if (t.provider === 'sendgrid') {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(t.apiKey);
      const msg = await sgMail.send({
        to: recipients,
        from,
        subject,
        text: text || '',
        html: html || text || '',
      });
      return { success: true, messageId: msg[0]?.headers?.['x-message-id'] };
    }
    if (t.provider === 'mailgun') {
      const formData = require('form-data');
      const Mailgun = require('mailgun.js');
      const mg = new Mailgun(formData);
      const client = mg.client({ username: 'api', key: t.apiKey, url: 'https://' + t.host });
      const msg = await client.messages.create(t.domain, {
        from,
        to: recipients,
        subject,
        text: text || '',
        html: html || text || '',
      });
      return { success: true, messageId: msg.id };
    }
    const info = await t.sendMail({
      from,
      to: recipients,
      subject,
      text,
      html: html || text,
    });
    return { success: true, messageId: info.messageId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function testConnection(db, tenantId = 1) {
  const settings = getSettings(db, tenantId);
  if (settings.provider === 'sendgrid') {
    if (!settings.apiKey && !settings.pass) return { success: false, error: 'SendGrid API key not configured' };
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(settings.apiKey || settings.pass);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  if (settings.provider === 'mailgun') {
    if (!settings.apiKey && !settings.pass) return { success: false, error: 'Mailgun API key not configured' };
    if (!settings.domain) return { success: false, error: 'Mailgun domain not configured' };
    return { success: true };
  }
  if (!settings.host || !settings.user || !settings.pass) return { success: false, error: 'SMTP not configured' };
  const t = getTransporter(db, tenantId);
  if (!t) return { success: false, error: 'Failed to create transporter' };
  try {
    await t.verify();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { getSettings, saveSettings, sendMail, testConnection };
