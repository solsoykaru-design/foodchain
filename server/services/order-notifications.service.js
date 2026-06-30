const emailService = require('./email.service');
const smsService = require('./sms.service');
const telegramBotService = require('./telegram-bot.service');

function formatItems(items) {
  try {
    const list = Array.isArray(items) ? items : JSON.parse(items || '[]');
    return list.map(i => `${i.name || 'Блюдо'} x${i.quantity || 1}`).join(', ');
  } catch {
    return '';
  }
}

function getStatusMessage(status, order) {
  const id = order.id;
  const total = order.total || 0;
  const items = formatItems(order.items);
  switch (status) {
    case 'new': return { subject: `Заказ #${id} принят`, body: `Ваш заказ #${id} принят.\nСумма: ${total} ₽\n${items ? 'Состав: ' + items : ''}` };
    case 'confirmed': return { subject: `Заказ #${id} подтверждён`, body: `Заказ #${id} подтверждён рестораном. Ожидайте приготовления.` };
    case 'preparing': return { subject: `Заказ #${id} готовится`, body: `Ваш заказ #${id} сейчас готовится.` };
    case 'ready': return { subject: `Заказ #${id} готов`, body: `Заказ #${id} готов. Можно забирать.` };
    case 'assigned': return { subject: `Заказ #${id} передан курьеру`, body: `Заказ #${id} передан курьеру.` };
    case 'en_route': return { subject: `Заказ #${id} в пути`, body: `Курьер везёт заказ #${id}.` };
    case 'delivered': return { subject: `Заказ #${id} доставлен`, body: `Заказ #${id} доставлен. Приятного аппетита!` };
    case 'cancelled': return { subject: `Заказ #${id} отменён`, body: `Заказ #${id} отменён. Подробности уточняйте в ресторане.` };
    default: return { subject: `Заказ #${id}: ${status}`, body: `Статус заказа #${id} изменён: ${status}.` };
  }
}

async function notifyCustomer(db, tenantId, order, status) {
  if (!order) return { sent: false, reason: 'no order' };
  const userId = order.user_id || 0;
  const phone = order.user_phone || '';
  let email = '';
  if (userId > 0) {
    try {
      const user = db.prepare('SELECT email FROM users WHERE id = ? AND tenant_id = ?').get(userId, tenantId);
      email = user?.email || '';
    } catch {}
  }

  const { subject, body } = getStatusMessage(status, order);
  const results = { email: false, sms: false, telegram: false };

  if (email) {
    try {
      const res = await emailService.sendMail(db, { to: email, subject, html: body.replace(/\n/g, '<br>'), text: body }, tenantId);
      results.email = res.success;
    } catch (e) { console.error('[OrderNotify] email error:', e.message); }
  }

  if (phone) {
    try {
      const smsRes = await smsService.sendMessage(phone, body);
      results.sms = smsRes.sent && !smsRes.fallback;
      // Fallback console log is not a real delivery.
    } catch (e) { console.error('[OrderNotify] sms error:', e.message); }

    try {
      const tgRes = await telegramBotService.sendToPhone(db, tenantId, phone, body);
      results.telegram = tgRes.success;
    } catch (e) { console.error('[OrderNotify] telegram error:', e.message); }
  }

  const sentAny = results.email || results.sms || results.telegram;
  return { sent: sentAny, channels: results };
}

module.exports = { notifyCustomer };
