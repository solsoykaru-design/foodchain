const https = require('https');
const http = require('http');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const PROMPT_TEMPLATE = `Ты — шеф-повар с 20-летним опытом. Составь технологическую карту для блюда «{name}».

Верни ТОЛЬКО JSON без лишнего текста, без markdown, без комментариев, строго по схеме:
{
  "ingredients": [
    { "name": "Название ингредиента", "quantity": число в граммах, "unit": "г" }
  ],
  "kbju_per_100g": { "calories": число, "proteins": число, "fats": число, "carbs": число },
  "output": число (выход готового блюда в граммах),
  "technology": "Краткое описание технологии приготовления",
  "cooking_time": число (время приготовления в минутах)
}

Пример ответа для "Салат Цезарь":
{"ingredients":[{"name":"Куриное филе","quantity":150,"unit":"г"},{"name":"Салат ромэн","quantity":100,"unit":"г"},{"name":"Пармезан","quantity":30,"unit":"г"},{"name":"Помидоры черри","quantity":50,"unit":"г"},{"name":"Яйцо куриное","quantity":40,"unit":"г"},{"name":"Пшеничный хлеб","quantity":30,"unit":"г"},{"name":"Оливковое масло","quantity":15,"unit":"г"},{"name":"Лимонный сок","quantity":5,"unit":"г"},{"name":"Чеснок","quantity":3,"unit":"г"},{"name":"Соль","quantity":1,"unit":"г"}],"kbju_per_100g":{"calories":210,"proteins":18,"fats":14,"carbs":5},"output":250,"technology":"1. Куриное филе отварить и нарезать кубиками. 2. Салат ромэн нарезать. 3. Пармезан натереть. 4. Помидоры черри разрезать пополам. 5. Яйцо отварить и нарезать. 6. Хлеб нарезать кубиками и подсушить. 7. Смешать оливковое масло с лимонным соком и чесноком. 8. Соединить все ингредиенты с заправкой, посолить, перемешать.","cooking_time":20}`;

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(url, { method: options.method || 'GET', headers: options.headers || { 'Content-Type': 'application/json' }, timeout: options.timeout || 30000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function queryTheMealDB(dishName) {
  const encoded = encodeURIComponent(dishName);
  const data = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encoded}`);
  if (!data.meals || data.meals.length === 0) {
    throw new Error('Not found in TheMealDB');
  }
  const meal = data.meals[0];

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (!name || !name.trim()) break;
    const qty = parseMeasureToGrams(measure, name);
    ingredients.push({ name: name.trim(), quantity: qty, unit: qty > 0 && measure ? detectUnit(measure) : 'г' });
  }

  const totalWeight = ingredients.reduce((s, i) => s + i.quantity, 0);

  const technology = (meal.strInstructions || '').split('\r\n').filter(Boolean).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n') || 'Инструкция не указана';

  return {
    ingredients,
    kbju_per_100g: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    output: totalWeight || 300,
    technology,
    cooking_time: 30,
    source: 'themealdb',
  };
}

function parseMeasureToGrams(measure, ingredientName) {
  if (!measure) return 100;
  const m = measure.trim().toLowerCase();
  const numMatch = m.match(/^(\d+[\.,]?\d*)\s*/);
  let num = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 1;

  if (m.includes('kg') || m.includes('kilogram') || m.includes('kilo') || m.includes('кг')) return num * 1000;
  if (m.includes('g') || m.includes('gram') || m.includes('г')) return num;
  if (m.includes('l') || m.includes('liter') || m.includes('л')) return num * 1000;
  if (m.includes('ml') || m.includes('milliliter') || m.includes('мл')) return num;
  if (m.includes('cup') || m.includes('чашк') || m.includes('стакан')) return num * 200;
  if (m.includes('tbsp') || m.includes('tablespoon') || m.includes('ст.л') || m.includes('стол')) return num * 15;
  if (m.includes('tsp') || m.includes('teaspoon') || m.includes('ч.л') || m.includes('чайн')) return num * 5;
  if (m.includes('oz') || m.includes('ounce')) return num * 28.35;
  if (m.includes('lb') || m.includes('pound')) return num * 453.6;
  if (m.includes('pinch') || m.includes('щепот')) return num * 1;
  if (m.includes('clove') || m.includes('зубч')) return num * 5;
  if (m.includes('slice') || m.includes('ломт') || m.includes('кус') || m.includes('slice')) return num * 30;
  if (m.includes('handful') || m.includes('горст')) return num * 50;
  if (m.includes('bunch') || m.includes('пуч')) return num * 100;
  if (m.includes('can') || m.includes('банк') || m.includes('консерв')) return num * 200;
  if (m.includes('piece') || m.includes('pc') || m.includes('шт') || m.includes('штук')) return num * 50;

  return num * 100;
}

function detectUnit(measure) {
  const m = measure.trim().toLowerCase();
  if (m.includes('kg') || m.includes('kilogram') || m.includes('kilo') || m.includes('кг')) return 'г';
  if (m.includes('l') || m.includes('liter') || m.includes('л') && !m.includes('ml')) return 'мл';
  if (m.includes('ml') || m.includes('milliliter') || m.includes('мл')) return 'мл';
  if (m.includes('tsp') || m.includes('tablespoon') || m.includes('ст.л') || m.includes('ч.л')) return 'г';
  return 'г';
}

async function queryDeepSeek(dishName) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const prompt = PROMPT_TEMPLATE.replace(/\{name\}/g, dishName);
  const body = JSON.stringify({
    model: DEEPSEEK_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const data = await fetchJSON('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body,
    timeout: 60000,
  });

  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Empty response from DeepSeek');

  return parseAIResponse(text, 'deepseek');
}

async function queryOllama(dishName) {
  const prompt = PROMPT_TEMPLATE.replace(/\{name\}/g, dishName);
  const body = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, temperature: 0.3 });

  const data = await fetchJSON(`${OLLAMA_URL}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeout: 120000,
  });

  const text = data.response || '';
  if (!text) throw new Error('Empty response from Ollama');

  return parseAIResponse(text, 'ollama');
}

function parseAIResponse(text, source) {
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }

  const start = json.indexOf('{');
  const end = json.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    json = json.slice(start, end + 1);
  }

  const parsed = JSON.parse(json);

  const ingredients = (parsed.ingredients || []).map(i => ({
    name: i.name || i.ingredient || '',
    quantity: parseFloat(i.quantity) || 100,
    unit: i.unit || 'г',
  }));

  const kbju = parsed.kbju_per_100g || parsed.kbju || {};
  const technology = parsed.technology || parsed.instructions || parsed.instruction || '';
  const techSteps = parsed.steps || parsed.step_instructions || [];

  let techText = technology;
  if (Array.isArray(techSteps) && techSteps.length > 0) {
    techText = techSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  if (Array.isArray(technology)) {
    techText = technology.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }

  return {
    ingredients,
    kbju_per_100g: {
      calories: parseFloat(kbju.calories || kbju.kcal || kbju.calories_per_100g || 0),
      proteins: parseFloat(kbju.proteins || kbju.protein || 0),
      fats: parseFloat(kbju.fats || kbju.fat || 0),
      carbs: parseFloat(kbju.carbs || kbju.carbohydrates || kbju.carb || 0),
    },
    output: parseFloat(parsed.output || parsed.total_weight || parsed.weight || ingredients.reduce((s, i) => s + i.quantity, 0)) || 300,
    technology: techText || 'Технология не указана',
    cooking_time: parseInt(parsed.cooking_time || parsed.cookingTime || parsed.cook_time || 0) || 20,
    source,
  };
}

async function generateTechCard(dishName) {
  const errors = [];

  // Try TheMealDB first
  try {
    const result = await queryTheMealDB(dishName);
    return result;
  } catch (e) {
    errors.push({ source: 'themealdb', error: e.message });
  }

  // Try DeepSeek
  try {
    const result = await queryDeepSeek(dishName);
    return result;
  } catch (e) {
    errors.push({ source: 'deepseek', error: e.message });
  }

  // Try Ollama
  try {
    const result = await queryOllama(dishName);
    return result;
  } catch (e) {
    errors.push({ source: 'ollama', error: e.message });
  }

  throw { message: `Не удалось сгенерировать техкарту для блюда «${dishName}»`, errors };
}

function matchIngredientsWithStock(ingredients, db, tenantId) {
  const inventoryItems = db.prepare('SELECT id, name, price_per_unit, unit FROM inventory_items WHERE tenant_id = ? OR tenant_id = 1').all(tenantId);

  const matched = [];
  const unmatched = [];

  for (const ing of ingredients) {
    const name = ing.name.toLowerCase().trim();
    const found = inventoryItems.find(item => item.name.toLowerCase().trim() === name ||
      item.name.toLowerCase().trim().includes(name) || name.includes(item.name.toLowerCase().trim()));

    if (found) {
      matched.push({
        item_id: found.id,
        item_name: found.name,
        quantity: ing.quantity,
        unit: ing.unit || found.unit || 'г',
        price_per_unit: found.price_per_unit || 0,
        cost: ((found.price_per_unit || 0) * ing.quantity) / 1000,
      });
    } else {
      unmatched.push({
        item_id: null,
        item_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit || 'г',
        price_per_unit: 0,
        cost: 0,
      });
    }
  }

  return { matched, unmatched };
}

function logAIRequest(db, action, dishName, result, error) {
  try {
    db.prepare(`INSERT INTO ai_logs (action, dish_name, result, error, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))`).run(
      action, dishName,
      result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null,
      error || null
    );
  } catch {}
}

module.exports = {
  generateTechCard,
  matchIngredientsWithStock,
  logAIRequest,
  parseAIResponse,
};
