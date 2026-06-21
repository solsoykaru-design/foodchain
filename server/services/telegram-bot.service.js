let TelegramBotCtor;
try {
  const mod = require('node-telegram-bot-api');
  TelegramBotCtor = mod.TelegramBot || mod.default || mod;
} catch (e) {
  console.warn('[TelegramBot] Package not available:', e.message);
  TelegramBotCtor = null;
}

let bot = null;
let botSettings = null;
const reviewState = {};

function getSettings(db, tenantId = 1) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND tenant_id = ?').get('telegram_bot', tenantId);
  if (!row) return {};
  try { return JSON.parse(row.value); } catch { return {}; }
}

function saveSettings(db, settings, tenantId = 1) {
  const existing = db.prepare('SELECT id FROM settings WHERE key = ? AND tenant_id = ?').get('telegram_bot', tenantId);
  const data = JSON.stringify(settings);
  if (existing) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ? AND tenant_id = ?').run(data, 'telegram_bot', tenantId);
  } else {
    db.prepare('INSERT INTO settings (key, value, tenant_id) VALUES (?, ?, ?)').run('telegram_bot', data, tenantId);
  }
  botSettings = settings;
  if (settings.enabled && settings.token) {
    startBot(db, settings, tenantId);
  } else if (bot) {
    bot.stopPolling().catch(() => {});
    bot = null;
  }
  return { success: true };
}

function startBot(db, settings, tenantId) {
  if (!TelegramBotCtor) { console.warn('[TelegramBot] Package not loaded, cannot start'); return; }
  if (bot) {
    bot.stopPolling().catch(() => {});
    bot = null;
  }
  if (!settings.token) return;
  try {
    bot = new TelegramBotCtor(settings.token, { polling: true });
    const appUrl = settings.webapp_url || 'http://localhost:4000/tg-app';
    if (appUrl.startsWith('https://')) {
      bot.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Меню', web_app: { url: appUrl } } }).catch(() => {});
    }

    bot.setMyCommands([
      { command: '/start', description: 'Приветствие' },
      { command: '/menu', description: 'Меню ресторана' },
      { command: '/order', description: 'Статус заказа' },
      { command: '/orderstatus', description: 'Детальный статус заказа' },
      { command: '/review', description: 'Оценить заказ' },
      { command: '/promo', description: 'Акции и скидки' },
      { command: '/feedback', description: 'Оставить отзыв' },
      { command: '/contacts', description: 'Контакты' },
    ]).catch(() => {});

    bot.onText(/\/start/, (msg) => {
      const text = settings.welcome_message || 'Добро пожаловать! Выберите команду в меню.';
      const appUrl = settings.webapp_url || 'https://t.me/foooodchain_bot/tg-app';
      // Send keyboard for commands
      bot.sendMessage(msg.chat.id, text, {
        reply_markup: { keyboard: [['📋 Меню', '🛒 Заказ'], ['🎉 Акции', '📞 Контакты'], ['✍️ Отзыв']], resize_keyboard: true }
      });
      // Send inline button with Web App (separate message to avoid conflicts)
      bot.sendMessage(msg.chat.id, '🚀 Откройте полное меню в приложении:', {
        reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url: appUrl } }]] }
      });
    });

    bot.onText(/\/menu|📋 Меню/, async (msg) => {
      try {
        const cats = db.prepare('SELECT id, name FROM menu_categories ORDER BY sort_order, name LIMIT 10').all();
        if (cats.length === 0) return bot.sendMessage(msg.chat.id, 'Меню временно недоступно');
        const buttons = cats.map(c => [{ text: c.name, callback_data: `menu_cat_${c.id}` }]);
        bot.sendMessage(msg.chat.id, '📋 *Категории меню:*', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      } catch (e) { bot.sendMessage(msg.chat.id, 'Ошибка загрузки меню'); console.error('[TelegramBot] /menu error:', e.message); }
    });

    bot.onText(/\/order|🛒 Заказ/, (msg) => {
      const subscriptions = db.prepare('SELECT order_id FROM telegram_order_subscriptions WHERE chat_id = ?').all(msg.chat.id);
      let subText = '';
      if (subscriptions.length > 0) {
        subText = '\n\nВы подписаны на уведомления по заказам: #' + subscriptions.map(s => s.order_id).join(', #');
      }
      bot.sendMessage(msg.chat.id, 'Введите номер заказа:' + subText, { reply_markup: { force_reply: true } });
    });

    bot.onText(/\/promo|🎉 Акции/, async (msg) => {
      try {
        const campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'active' AND (ends_at IS NULL OR ends_at >= date('now')) LIMIT 5").all();
        if (campaigns.length === 0) return bot.sendMessage(msg.chat.id, 'Сейчас нет активных акций 😊');
        const lines = campaigns.map(c => `🎁 *${c.name}*${c.message ? '\n' + c.message : ''}`);
        bot.sendMessage(msg.chat.id, '🎉 *Наши акции:*\n\n' + lines.join('\n\n'), { parse_mode: 'Markdown' });
      } catch (e) { bot.sendMessage(msg.chat.id, 'Ошибка загрузки акций'); console.error('[TelegramBot] /promo error:', e.message); }
    });

    bot.onText(/\/feedback|✍️ Отзыв/, (msg) => {
      bot.sendMessage(msg.chat.id, 'Напишите ваш отзыв:', { reply_markup: { force_reply: true } });
    });

    bot.onText(/\/orderstatus/, async (msg) => {
      try {
        const orders = db.prepare("SELECT id, total, status, address, courier_name, created_at, items, payment_method, type FROM orders WHERE user_phone = (SELECT phone FROM users WHERE id = (SELECT user_id FROM orders WHERE user_name = ? ORDER BY id DESC LIMIT 1)) ORDER BY id DESC LIMIT 5").all(msg.from.first_name || '');
        if (orders.length === 0) return bot.sendMessage(msg.chat.id, 'Введите номер заказа:', { reply_markup: { force_reply: true } });
        const text = orders.map(o => {
          const items = (() => { try { return JSON.parse(o.items || '[]'); } catch { return []; } })();
          const itemLines = items.map(i => `  ${i.name || 'Блюдо'} x${i.qty || i.quantity || 1} — ${(i.price || 0) * (i.qty || i.quantity || 1)} ₽`).join('\n');
          return `#${o.id} — ${o.status}\nСумма: ${o.total} ₽\n${o.address ? 'Адрес: ' + o.address : ''}${o.courier_name ? '\nКурьер: ' + o.courier_name : ''}\n${itemLines ? '\n' + itemLines : ''}`;
        }).join('\n\n');
        bot.sendMessage(msg.chat.id, '📦 *Ваши последние заказы:*\n\n' + text + '\n\nВведите номер заказа для деталей:', {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true }
        });
      } catch (e) {
        bot.sendMessage(msg.chat.id, 'Введите номер заказа:', { reply_markup: { force_reply: true } });
        console.error('[TelegramBot] /orderstatus error:', e.message);
      }
    });

    bot.onText(/\/review/, (msg) => {
      bot.sendMessage(msg.chat.id, 'Введите номер заказа для отзыва:', { reply_markup: { force_reply: true } });
    });

    bot.onText(/\/contacts|📞 Контакты/, (msg) => {
      const contacts = settings.contacts_text || 'Наш адрес: г. Город, ул. Улица\nТелефон: +7 (000) 000-00-00\nЧасы работы: круглосуточно';
      bot.sendMessage(msg.chat.id, contacts, { parse_mode: 'Markdown' });
    });

    bot.on('message', async (msg) => {
      trackUser(db, msg);
      // Handle Web App data (order from Mini App)
      if (msg.web_app_data?.data) {
        try {
          const data = JSON.parse(msg.web_app_data.data);
          if (data.action === 'order') {
            const total = data.total || (data.items || []).reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0) || 0;
            const itemsStr = (data.items || []).map((i) => `${i.name} x${i.qty || 1} — ${(i.price || 0) * (i.qty || 1)} ₽`).join('\n');
            const info = db.prepare('INSERT INTO orders (user_id, user_name, items, subtotal, total, payment_method, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))').run(
              0, msg.from?.first_name || 'Telegram', JSON.stringify(data.items || []), total, total, 'telegram_stars', 'delivery', 'new'
            );
            await bot.sendMessage(msg.chat.id, `✅ *Заказ #${info.lastInsertRowid} принят!*\n\n${itemsStr}\n\nСумма: ${total} ₽\n\nСкоро подтвердим.`, { parse_mode: 'Markdown' });
          }
        } catch (e) { bot.sendMessage(msg.chat.id, '❌ Ошибка обработки заказа'); console.error('[TelegramBot] web_app_data error:', e); }
        return;
      }
      if (msg.text && !msg.text.startsWith('/') && !['📋 Меню', '🛒 Заказ', '🎉 Акции', '📞 Контакты', '✍️ Отзыв'].includes(msg.text)) {
        if (msg.reply_to_message) {
          const replyText = msg.reply_to_message.text;
          if (replyText === 'Введите номер заказа:' || replyText.startsWith('📦')) {
            handleOrderStatus(db, bot, msg);
          } else if (replyText === 'Напишите ваш отзыв:') {
            handleFeedback(db, bot, msg, tenantId);
          } else if (replyText === 'Введите номер заказа для отзыва:') {
            handleReviewOrderCheck(db, bot, msg, tenantId);
          } else if (replyText === 'Напишите текст отзыва:') {
            handleReviewText(db, bot, msg);
          }
        }
      }
    });

    bot.on('callback_query', async (query) => {
      const data = query.data;
      if (data.startsWith('sub_') || data.startsWith('unsub_')) {
        const orderId = parseInt(data.split('_')[1]);
        if (!orderId) return;
        if (data.startsWith('sub_')) {
          db.prepare("INSERT OR IGNORE INTO telegram_order_subscriptions (tenant_id, chat_id, order_id) VALUES (?, ?, ?)").run(tenantId, query.message.chat.id, orderId);
          await bot.sendMessage(query.message.chat.id, `✅ Вы подписались на уведомления по заказу #${orderId}`);
        } else {
          db.prepare('DELETE FROM telegram_order_subscriptions WHERE chat_id = ? AND order_id = ?').run(query.message.chat.id, orderId);
          await bot.sendMessage(query.message.chat.id, `🔕 Вы отписались от уведомлений по заказу #${orderId}`);
        }
        bot.answerCallbackQuery(query.id).catch(() => {});
      } else if (data.startsWith('menu_cat_')) {
        const catId = parseInt(data.split('_')[2]);
        try {
          const cat = db.prepare('SELECT name FROM menu_categories WHERE id = ?').get(catId);
          const dishes = db.prepare("SELECT id, name, price FROM dishes WHERE category_id = ? AND is_available = 1 AND is_active = 1 ORDER BY display_order, name LIMIT 10").all(catId);
          if (dishes.length === 0) {
            await bot.sendMessage(query.message.chat.id, 'В этой категории пока нет блюд.');
          } else {
            const buttons = dishes.map(d => [{ text: `${d.name} — ${d.price} ₽`, callback_data: `menu_dish_${d.id}` }]);
            buttons.push([{ text: '« Назад к категориям', callback_data: 'menu_back_cats' }]);
            await bot.sendMessage(query.message.chat.id, `🍽 *${cat.name}*`, {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: buttons }
            });
          }
        } catch (e) { console.error('[TelegramBot] menu_cat error:', e.message); }
        bot.answerCallbackQuery(query.id).catch(() => {});
      } else if (data === 'menu_back_cats') {
        try {
          const cats = db.prepare('SELECT id, name FROM menu_categories ORDER BY sort_order, name LIMIT 10').all();
          if (cats.length > 0) {
            const buttons = cats.map(c => [{ text: c.name, callback_data: `menu_cat_${c.id}` }]);
            await bot.sendMessage(query.message.chat.id, '📋 *Категории меню:*', {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: buttons }
            });
          }
        } catch (e) { console.error('[TelegramBot] menu_back_cats error:', e.message); }
        bot.answerCallbackQuery(query.id).catch(() => {});
      } else if (data.startsWith('menu_dish_')) {
        const dishId = parseInt(data.split('_')[2]);
        try {
          const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId);
          if (!dish) {
            await bot.sendMessage(query.message.chat.id, 'Блюдо не найдено.');
          } else {
            const desc = dish.description ? `\n${dish.description}` : '';
            const compound = (() => { try { const c = JSON.parse(dish.compound || '[]'); return c.length > 0 ? '\nСостав: ' + c.join(', ') : ''; } catch { return ''; } })();
            const weight = dish.weight ? `\nВес: ${dish.weight}${dish.unit || 'г'}` : '';
            const priceInfo = dish.old_price ? `~~${dish.old_price} ₽~~ ` : '';
            const text = `*${dish.name}*\nЦена: ${priceInfo}${dish.price} ₽${desc}${compound}${weight}`;
            const backCatId = dish.category_id;
            const buttons = [[{ text: '« Назад', callback_data: `menu_cat_${backCatId}` }]];
            if (dish.image_url) {
              try { await bot.sendPhoto(query.message.chat.id, dish.image_url, { caption: text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }); } catch {
                await bot.sendMessage(query.message.chat.id, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
              }
            } else {
              await bot.sendMessage(query.message.chat.id, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            }
          }
        } catch (e) { console.error('[TelegramBot] menu_dish error:', e.message); }
        bot.answerCallbackQuery(query.id).catch(() => {});
      } else if (data.startsWith('review_rate_')) {
        const parts = data.split('_');
        const orderId = parseInt(parts[2]);
        const rating = parseInt(parts[3]);
        if (!orderId || !rating) return;
        reviewState[query.message.chat.id] = { orderId, rating };
        await bot.sendMessage(query.message.chat.id, 'Напишите текст отзыва:', { reply_markup: { force_reply: true } });
        bot.answerCallbackQuery(query.id).catch(() => {});
      }
    });

    console.log(`[TelegramBot] Started for tenant ${tenantId}`);
  } catch (e) {
    console.error('[TelegramBot] Error:', e.message);
    bot = null;
  }
}

async function handleOrderStatus(db, bot, msg) {
  const orderId = parseInt(msg.text);
  if (!orderId || isNaN(orderId)) return bot.sendMessage(msg.chat.id, 'Пожалуйста, введите номер заказа (только цифры)');
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return bot.sendMessage(msg.chat.id, '❌ Заказ с таким номером не найден');
    const statusLabels = { new: '🆕 Новый', confirmed: '✅ Подтверждён', preparing: '👨‍🍳 Готовится', ready: '🍽️ Готов', assigned: '🚀 Передан курьеру', en_route: '🛵 В пути', delivered: '📦 Доставлен', cancelled: '❌ Отменён' };
    const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
    const itemLines = items.map(i => `  ${i.name || 'Блюдо'} x${i.qty || i.quantity || 1} — ${(i.price || 0) * (i.qty || i.quantity || 1)} ₽`).join('\n');
    const isSubscribed = db.prepare('SELECT id FROM telegram_order_subscriptions WHERE chat_id = ? AND order_id = ?').get(msg.chat.id, orderId);
    const subBtn = isSubscribed
      ? [{ text: '🔕 Отписаться от уведомлений', callback_data: `unsub_${orderId}` }]
      : [{ text: '🔔 Подписаться на уведомления', callback_data: `sub_${orderId}` }];
    bot.sendMessage(msg.chat.id, `📋 *Заказ #${order.id}*\n\nСтатус: ${statusLabels[order.status] || order.status}\nСумма: ${order.total} ₽\nСпособ оплаты: ${order.payment_method}\nТип: ${order.type}\n${order.address ? 'Адрес: ' + order.address : ''}${order.courier_name ? '\nКурьер: ' + order.courier_name : ''}\n\n*Состав заказа:*\n${itemLines || '  (нет данных)'}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [subBtn] }
    });
  } catch { bot.sendMessage(msg.chat.id, 'Ошибка получения статуса заказа'); }
}

async function handleReviewOrderCheck(db, bot, msg, tenantId) {
  const orderId = parseInt(msg.text);
  if (!orderId || isNaN(orderId)) return bot.sendMessage(msg.chat.id, 'Пожалуйста, введите номер заказа (только цифры)');
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return bot.sendMessage(msg.chat.id, '❌ Заказ с таким номером не найден');
    const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(orderId);
    if (existing) return bot.sendMessage(msg.chat.id, '❌ Отзыв на этот заказ уже есть');
    const buttons = [[1,2,3,4,5].map(r => ({ text: `${r} ⭐`, callback_data: `review_rate_${orderId}_${r}` }))];
    bot.sendMessage(msg.chat.id, `Оцените заказ #${orderId} от 1 до 5:`, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch { bot.sendMessage(msg.chat.id, 'Ошибка проверки заказа'); }
}

async function handleReviewText(db, bot, msg) {
  const chatId = msg.chat.id;
  const state = reviewState[chatId];
  if (!state) return;
  try {
    const userId = (db.prepare("SELECT id FROM users WHERE name = ?").get(msg.from.first_name || '') || {}).id || 0;
    db.prepare('INSERT INTO reviews (order_id, user_id, user_name, rating, text, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run(
      state.orderId, userId, msg.from.first_name || 'Telegram', state.rating, msg.text
    );
    await bot.sendMessage(chatId, `✅ Спасибо! Ваш отзыв на заказ #${state.orderId} сохранён (оценка: ${state.rating}/5).`);
  } catch (e) {
    await bot.sendMessage(chatId, '❌ Ошибка сохранения отзыва');
    console.error('[TelegramBot] review text error:', e.message);
  }
  delete reviewState[chatId];
}

async function notifyOrderStatus(bot, db, orderId, status) {
  try {
    const subscribers = db.prepare('SELECT chat_id FROM telegram_order_subscriptions WHERE order_id = ?').all(orderId);
    if (subscribers.length === 0) return;
    const statusLabels = { new: '🆕 Новый', confirmed: '✅ Подтверждён', preparing: '👨‍🍳 Готовится', ready: '🍽️ Готов', assigned: '🚀 Передан курьеру', en_route: '🛵 В пути', delivered: '📦 Доставлен', cancelled: '❌ Отменён' };
    const label = statusLabels[status] || status;
    for (const sub of subscribers) {
      try {
        await bot.sendMessage(sub.chat_id, `📦 *Статус заказа #${orderId} изменён*\n\nНовый статус: ${label}`, { parse_mode: 'Markdown' });
      } catch {}
    }
  } catch (e) { console.error('[TelegramBot] notifyOrderStatus error:', e.message); }
}

async function handleFeedback(db, bot, msg, tenantId) {
  try {
    db.prepare('INSERT INTO reviews (order_id, user_id, user_name, text, rating, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run(
      0, 0, msg.from.first_name || 'Telegram', msg.text, 5
    );
    bot.sendMessage(msg.chat.id, '✅ Спасибо за ваш отзыв! Мы ценим ваше мнение.');
  } catch { bot.sendMessage(msg.chat.id, '❌ Ошибка сохранения отзыва'); }
}

function startIfConfigured(db, tenantId = 1) {
  const settings = getSettings(db, tenantId);
  if (settings.enabled && settings.token) {
    startBot(db, settings, tenantId);
  }
}

function stopBot() {
  if (bot) {
    bot.stopPolling().catch(() => {});
    bot = null;
  }
}

function trackUser(db, msg) {
  if (!msg.from) return;
  try {
    const existing = db.prepare('SELECT id FROM telegram_bot_users WHERE chat_id = ?').get(msg.chat.id);
    if (!existing) {
      db.prepare('INSERT INTO telegram_bot_users (chat_id, first_name, username, last_interaction) VALUES (?, ?, ?, datetime(\'now\'))').run(
        msg.chat.id, msg.from.first_name || '', msg.from.username || ''
      );
    } else {
      db.prepare('UPDATE telegram_bot_users SET first_name = ?, username = ?, last_interaction = datetime(\'now\'), interaction_count = interaction_count + 1 WHERE chat_id = ?').run(
        msg.from.first_name || '', msg.from.username || '', msg.chat.id
      );
    }
  } catch {}
}

function getStats(db, tenantId = 1) {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM telegram_bot_users').get()?.count || 0;
  const todayActive = db.prepare("SELECT COUNT(*) as count FROM telegram_bot_users WHERE date(last_interaction) = date('now')").get()?.count || 0;
  return { totalUsers, todayActive };
}

async function broadcast(db, botToken, message) {
  const tmpBot = bot || new TelegramBotCtor(botToken, { polling: false });
  try {
    const users = db.prepare('SELECT chat_id FROM telegram_bot_users').all();
    let sent = 0, failed = 0;
    for (const u of users) {
      try {
        await tmpBot.sendMessage(u.chat_id, message, { parse_mode: 'Markdown' });
        sent++;
      } catch { failed++; }
    }
    return { sent, failed, total: users.length };
  } finally {
    if (!bot && tmpBot) tmpBot.stopPolling().catch(() => {});
  }
}

module.exports = { getSettings, saveSettings, startIfConfigured, stopBot, startBot, getStats, broadcast, notifyOrderStatus };
