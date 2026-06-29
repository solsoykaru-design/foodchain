const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'north-mini-code-free';
const OPENCODE_TIMEOUT = parseInt(process.env.OPENCODE_TIMEOUT || '25000', 10);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || { 'Content-Type': 'application/json' },
    body: options.body,
    signal: options.signal || null,
  });
  const text = await res.text();
  if (res.ok) return JSON.parse(text);
  throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
}

async function callOpencode(messages, model = OPENCODE_MODEL) {
  if (!OPENCODE_API_KEY || OPENCODE_API_KEY.length < 10) throw new Error('API key not configured');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENCODE_TIMEOUT);
  try {
    const data = await fetchJSON('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_API_KEY}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1500 }),
      signal: controller.signal,
    });
    const msg = data.choices?.[0]?.message || {};
    return msg.content || msg.reasoning_content || msg.reasoning || '';
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOllama(messages) {
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
  const data = await fetchJSON(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, temperature: 0.3 }),
  });
  return data.response || '';
}

function formatCurrency(n, currency = '₽') {
  return Number(n || 0).toLocaleString('ru-RU') + ' ' + currency;
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function collectFacts(db, tenantId) {
  const { start, end } = getTodayRange();
  const todayOrders = db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as sum FROM orders WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND status != 'cancelled'").get(tenantId, start, end);
  const lowStock = db.prepare("SELECT name, current_balance, min_balance, unit FROM inventory_items WHERE tenant_id = ? AND COALESCE(current_balance,0) <= COALESCE(min_balance,0) ORDER BY current_balance ASC LIMIT 10").all(tenantId);
  const topDishes = db.prepare(`SELECT items FROM orders WHERE tenant_id = ? AND created_at >= datetime('now','-7 days') AND status != 'cancelled'`).all(tenantId);
  const dishCounts = {};
  for (const row of topDishes) {
    try {
      const items = JSON.parse(row.items || '[]');
      for (const it of items) {
        const name = it.name || it.dish_name || 'Unknown';
        dishCounts[name] = (dishCounts[name] || 0) + (it.quantity || 1);
      }
    } catch (e) {}
  }
  const topDishesList = Object.entries(dishCounts).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5);
  const activeStaff = db.prepare("SELECT COUNT(*) as cnt FROM staff WHERE tenant_id = ? AND is_active = 1").get(tenantId);
  const openShifts = db.prepare("SELECT COUNT(*) as cnt FROM shifts WHERE tenant_id = ? AND closed_at IS NULL").get(tenantId);
  const pendingOrders = db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE tenant_id = ? AND status IN ('new','confirmed','preparing','ready','assigned','en_route')").get(tenantId);
  const revenueWeek = db.prepare("SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE tenant_id = ? AND created_at >= datetime('now','-7 days') AND status != 'cancelled'").get(tenantId);
  const revenueMonth = db.prepare("SELECT COALESCE(SUM(total),0) as sum FROM orders WHERE tenant_id = ? AND created_at >= datetime('now','-30 days') AND status != 'cancelled'").get(tenantId);

  return {
    todayOrders,
    lowStock,
    topDishesList,
    activeStaff,
    openShifts,
    pendingOrders,
    revenueWeek,
    revenueMonth,
  };
}

function buildSystemPrompt(facts) {
  return `Ты — AI-ассистент управляющего ресторана в системе FoodChain. Отвечай кратко, по делу, на русском языке. Используй только предоставленные факты, не выдумывай цифры.

Текущие данные:
- Заказов сегодня: ${facts.todayOrders.cnt}, выручка: ${formatCurrency(facts.todayOrders.sum)}
- Выручка за 7 дней: ${formatCurrency(facts.revenueWeek.sum)}
- Выручка за 30 дней: ${formatCurrency(facts.revenueMonth.sum)}
- Заказов в работе: ${facts.pendingOrders.cnt}
- Открытых смен: ${facts.openShifts.cnt}
- Активных сотрудников: ${facts.activeStaff.cnt}
- Топ блюд за 7 дней: ${facts.topDishesList.map(([name, qty]) => `${name} (${qty})`).join(', ') || 'нет данных'}
- Товары на исходе: ${facts.lowStock.map(i => `${i.name} ${i.current_balance}/${i.min_balance} ${i.unit || 'г'}`).join(', ') || 'нет'}

Если спрашивают что-то, чего нет в данных, скажи, что нужно проверить в соответствующем разделе системы.`;
}

async function chat(db, tenantId, message, history = []) {
  const facts = collectFacts(db, tenantId);
  const systemPrompt = buildSystemPrompt(facts);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: message },
  ];

  let answer = '';
  let source = 'rule';

  // Try LLM if configured
  try {
    if (OPENCODE_API_KEY && OPENCODE_API_KEY.length >= 10) {
      answer = await callOpencode(messages);
      source = 'opencode';
    } else {
      answer = await callOllama(messages);
      source = 'ollama';
    }
  } catch (e) {
    // Fallback to rule-based response
    answer = generateRuleAnswer(message, facts);
    source = 'rule';
  }

  return { answer, source, facts };
}

function generateRuleAnswer(message, facts) {
  const lower = message.toLowerCase();
  if (/продаж|выручк|сколько заработ|денег|оборот/.test(lower)) {
    if (/сегодня|сутки|день/.test(lower)) {
      return `Сегодня ${facts.todayOrders.cnt} заказов на сумму ${formatCurrency(facts.todayOrders.sum)}.`;
    }
    if (/недел|7 дн/.test(lower)) {
      return `За последние 7 дней выручка ${formatCurrency(facts.revenueWeek.sum)}.`;
    }
    if (/месяц|30 дн/.test(lower)) {
      return `За последние 30 дней выручка ${formatCurrency(facts.revenueMonth.sum)}.`;
    }
    return `Сегодня ${facts.todayOrders.cnt} заказов на ${formatCurrency(facts.todayOrders.sum)}. За неделю — ${formatCurrency(facts.revenueWeek.sum)}, за месяц — ${formatCurrency(facts.revenueMonth.sum)}.`;
  }
  if (/заказов|заказы/.test(lower)) {
    return `Сейчас в работе ${facts.pendingOrders.cnt} заказов. Сегодня создано ${facts.todayOrders.cnt} заказов.`;
  }
  if (/склад|остат|заканчива|не хвата|дефицит/.test(lower)) {
    if (facts.lowStock.length === 0) return 'Все запасы в норме, критических остатков нет.';
    return 'Товары на исходе:\n' + facts.lowStock.map(i => `- ${i.name}: ${i.current_balance} ${i.unit || 'г'} (мин. ${i.min_balance})`).join('\n');
  }
  if (/топ|популярн|лучше прода|часто заказыва/.test(lower)) {
    if (facts.topDishesList.length === 0) return 'Нет данных о продажах блюд за последние 7 дней.';
    return 'Топ блюд за 7 дней:\n' + facts.topDishesList.map(([name, qty], idx) => `${idx + 1}. ${name} — ${qty} шт.`).join('\n');
  }
  if (/смен|сотрудник|персонал|курьер/.test(lower)) {
    return `Открыто смен: ${facts.openShifts.cnt}. Активных сотрудников: ${facts.activeStaff.cnt}.`;
  }
  if (/закуп|купить|пополнить/.test(lower)) {
    if (facts.lowStock.length === 0) return 'Пополнение складов не требуется — критических остатков нет.';
    return 'Рекомендую закупить:\n' + facts.lowStock.map(i => `- ${i.name}: до ${i.min_balance} ${i.unit || 'г'} (сейчас ${i.current_balance})`).join('\n');
  }
  return 'Я могу рассказать о продажах, заказах, остатках на складе, топе блюд и сменах. Задайте вопрос по одной из этих тем.';
}

module.exports = { chat, collectFacts };
