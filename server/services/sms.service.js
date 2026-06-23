const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_NOTIFY_CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT_ID;

let twilioClient = null;
const twilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);

if (twilioConfigured) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('[SMS] Twilio client initialized successfully');
  } catch (e) {
    console.warn('[SMS] Failed to initialize Twilio client:', e.message);
  }
} else {
  console.log('[SMS] Twilio not configured');
}

let tgBot = null;
const telegramConfigured = !!TELEGRAM_BOT_TOKEN;

if (telegramConfigured) {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const ctor = TelegramBot.TelegramBot || TelegramBot.default || TelegramBot;
    tgBot = new ctor(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('[SMS] Telegram Bot configured for verification codes');
  } catch (e) {
    console.warn('[SMS] Failed to initialize Telegram Bot:', e.message);
  }
} else {
  console.log('[SMS] Telegram Bot not configured');
}

const SMS_LOG = [];
const MAX_LOG_SIZE = 100;

function getLog() {
  return SMS_LOG;
}

async function sendViaTwilio(phone, message) {
  if (!twilioClient) return null;
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });
    console.log(`[SMS] Sent via Twilio to ${phone}, SID: ${result.sid}`);
    return { provider: 'twilio', sid: result.sid };
  } catch (e) {
    console.error(`[SMS] Twilio failed for ${phone}:`, e.message);
    return null;
  }
}

async function sendViaTelegram(chatId, message) {
  if (!tgBot) return null;
  try {
    await tgBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`[SMS] Sent via Telegram to chat ${chatId}`);
    return { provider: 'telegram', chatId };
  } catch (e) {
    console.error(`[SMS] Telegram failed for chat ${chatId}:`, e.message);
    return null;
  }
}

function getDb() {
  try {
    const Database = require('better-sqlite3');
    return new Database(path.join(__dirname, '..', 'foodchain.db'), { readonly: true });
  } catch {
    return null;
  }
}

async function sendSms(phone, code) {
  const message = `FoodChain: ваш код подтверждения: ${code}`;
  const logEntry = { phone, code, timestamp: new Date().toISOString(), status: 'pending' };

  let result = null;

  if (twilioConfigured) {
    result = await sendViaTwilio(phone, message);
    if (result) {
      logEntry.status = 'sent';
      logEntry.provider = 'twilio';
      logEntry.sid = result.sid;
      SMS_LOG.push(logEntry);
      return logEntry;
    }
  }

  if (telegramConfigured) {
    const db = getDb();
    if (db) {
      try {
        const user = db.prepare('SELECT chat_id FROM telegram_bot_users WHERE phone = ?').get(phone);
        if (user && user.chat_id) {
          result = await sendViaTelegram(user.chat_id, message);
        }
      } catch (e) {
        console.warn('[SMS] Failed to lookup Telegram chat_id:', e.message);
      } finally {
        db.close();
      }
    }

    if (result) {
      logEntry.status = 'sent';
      logEntry.provider = 'telegram';
      logEntry.chatId = result.chatId;
      SMS_LOG.push(logEntry);
      return logEntry;
    }
  }

  if (TELEGRAM_NOTIFY_CHAT_ID && telegramConfigured) {
    const notifyMessage = `📱 *Код подтверждения*\n\nТелефон: \`${phone}\nКод: *${code}*\n\n_Доставлен в консоль сервера_`;
    await sendViaTelegram(TELEGRAM_NOTIFY_CHAT_ID, notifyMessage).catch(() => {});
  }

  console.log(`[SMS Fallback] Code for ${phone}: ${code}`);
  logEntry.status = 'fallback';
  logEntry.provider = 'console';

  if (SMS_LOG.length >= MAX_LOG_SIZE) SMS_LOG.shift();
  SMS_LOG.push(logEntry);
  return logEntry;
}

module.exports = { sendSms, getLog, isTwilioConfigured: () => twilioConfigured, isTelegramConfigured: () => telegramConfigured };
