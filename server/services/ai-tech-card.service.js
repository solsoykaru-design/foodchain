const https = require('https');
const http = require('http');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'north-mini-code-free';

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
    const timedOut = { current: false };
    const req = mod.request(url, { method: options.method || 'GET', headers: options.headers || { 'Content-Type': 'application/json' }, timeout: options.timeout || 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (timedOut.current) return;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', (e) => { if (!timedOut.current) { timedOut.current = true; reject(e); } });
    req.on('timeout', () => { timedOut.current = true; req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function queryTheMealDB(dishName) {
  const encoded = encodeURIComponent(dishName);
  const data = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encoded}`, { timeout: 8000 });
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
  if (m.includes('ml') || m.includes('milliliter') || m.includes('мл')) return 'мл';
  if (m.includes('l') || m.includes('liter') || m.includes('л')) return 'л';
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
      timeout: 20000,
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

async function queryOpenCode(dishName) {
  if (!OPENCODE_API_KEY) throw new Error('OPENCODE_API_KEY not configured');
  if (OPENCODE_API_KEY.length < 10) throw new Error('Invalid API key');

  const prompt = PROMPT_TEMPLATE.replace(/\{name\}/g, dishName);
  const body = JSON.stringify({
    model: OPENCODE_MODEL,
    messages: [
      { role: 'system', content: 'Ты — русскоязычный шеф-повар. Все названия ингредиентов пиши ТОЛЬКО на русском языке. Ответ давай ТОЛЬКО в формате JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const data = await fetchJSON('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCODE_API_KEY}`,
    },
    body,
    timeout: 20000,
  });

  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Empty response from OpenCode');

  return parseAIResponse(text, 'opencode');
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

// ─── Local recipe database ──────────────────────────────
const LOCAL_RECIPES = {
  'салат цезарь': {
    ingredients: [
      { name: 'Куриное филе', quantity: 150, unit: 'г' },
      { name: 'Салат ромэн', quantity: 100, unit: 'г' },
      { name: 'Пармезан', quantity: 30, unit: 'г' },
      { name: 'Помидоры черри', quantity: 50, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 40, unit: 'г' },
      { name: 'Пшеничный хлеб', quantity: 30, unit: 'г' },
      { name: 'Оливковое масло', quantity: 15, unit: 'г' },
      { name: 'Лимонный сок', quantity: 5, unit: 'г' },
      { name: 'Чеснок', quantity: 3, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 210, proteins: 18, fats: 14, carbs: 5 },
    output: 250,
    technology: '1. Куриное филе отварить и нарезать кубиками. 2. Салат ромэн нарезать. 3. Пармезан натереть. 4. Помидоры черри разрезать пополам. 5. Яйцо отварить и нарезать. 6. Хлеб нарезать кубиками и подсушить. 7. Смешать оливковое масло с лимонным соком и чесноком. 8. Соединить все ингредиенты с заправкой, посолить, перемешать.',
    cooking_time: 20,
  },
  'цезарь': {
    ingredients: [
      { name: 'Куриное филе', quantity: 150, unit: 'г' },
      { name: 'Салат ромэн', quantity: 100, unit: 'г' },
      { name: 'Пармезан', quantity: 30, unit: 'г' },
      { name: 'Помидоры черри', quantity: 50, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 40, unit: 'г' },
      { name: 'Пшеничный хлеб', quantity: 30, unit: 'г' },
      { name: 'Оливковое масло', quantity: 15, unit: 'г' },
      { name: 'Лимонный сок', quantity: 5, unit: 'г' },
      { name: 'Чеснок', quantity: 3, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 210, proteins: 18, fats: 14, carbs: 5 },
    output: 250,
    technology: '1. Куриное филе отварить и нарезать кубиками. 2. Салат ромэн нарезать. 3. Пармезан натереть. 4. Помидоры черри разрезать пополам. 5. Яйцо отварить и нарезать. 6. Хлеб нарезать кубиками и подсушить. 7. Смешать оливковое масло с лимонным соком и чесноком. 8. Соединить все ингредиенты с заправкой, посолить, перемешать.',
    cooking_time: 20,
  },
  'борщ': {
    ingredients: [
      { name: 'Свекла', quantity: 150, unit: 'г' },
      { name: 'Капуста белокочанная', quantity: 100, unit: 'г' },
      { name: 'Картофель', quantity: 120, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Томатная паста', quantity: 20, unit: 'г' },
      { name: 'Говядина', quantity: 100, unit: 'г' },
      { name: 'Чеснок', quantity: 5, unit: 'г' },
      { name: 'Растительное масло', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Сахар', quantity: 5, unit: 'г' },
      { name: 'Уксус', quantity: 3, unit: 'г' },
    ],
    kbju_per_100g: { calories: 85, proteins: 4, fats: 3, carbs: 10 },
    output: 350,
    technology: '1. Сварить говяжий бульон. 2. Свеклу натереть, потушить с уксусом и сахаром. 3. Картофель нарезать кубиком, добавить в бульон. 4. Капусту нашинковать, добавить к картофелю. 5. Лук и морковь обжарить с томатной пастой. 6. Добавить зажарку и свеклу в суп. 7. Добавить измельчённый чеснок, соль по вкусу. 8. Варить до готовности, дать настояться 15 минут.',
    cooking_time: 60,
  },
  'карбонара': {
    ingredients: [
      { name: 'Спагетти', quantity: 200, unit: 'г' },
      { name: 'Бекон', quantity: 80, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 60, unit: 'г' },
      { name: 'Пармезан', quantity: 40, unit: 'г' },
      { name: 'Сливки 20%', quantity: 50, unit: 'г' },
      { name: 'Чеснок', quantity: 3, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
      { name: 'Перец чёрный', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 280, proteins: 12, fats: 15, carbs: 25 },
    output: 300,
    technology: '1. Спагетти отварить в подсоленной воде до al dente. 2. Бекон нарезать полосками, обжарить до хруста. 3. Яйца взбить с тёртым пармезаном и сливками. 4. В горячие спагетти добавить бекон. 5. Залить яично-сырной смесью, быстро перемешать. 6. Добавить измельчённый чеснок, соль и перец. 7. Подавать сразу, посыпав пармезаном.',
    cooking_time: 20,
  },
  'плов': {
    ingredients: [
      { name: 'Рис', quantity: 200, unit: 'г' },
      { name: 'Говядина', quantity: 150, unit: 'г' },
      { name: 'Морковь', quantity: 120, unit: 'г' },
      { name: 'Лук репчатый', quantity: 80, unit: 'г' },
      { name: 'Растительное масло', quantity: 30, unit: 'г' },
      { name: 'Чеснок', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 3, unit: 'г' },
      { name: 'Зира', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 180, proteins: 8, fats: 7, carbs: 22 },
    output: 350,
    technology: '1. Рис замочить в тёплой воде на 30 минут. 2. Мясо нарезать кубиками. 3. Лук нарезать полукольцами, морковь соломкой. 4. В казане разогреть масло, обжарить мясо до корочки. 5. Добавить лук и морковь, обжарить. 6. Залить водой, довести до кипения. 7. Посолить, добавить зиру. 8. Выложить рис, разровнять, вдавить чеснок. 9. Добавить воды на палец выше риса. 10. Варить до выпаривания воды, затем укутать на 20 минут.',
    cooking_time: 60,
  },
  'окрошка': {
    ingredients: [
      { name: 'Картофель', quantity: 150, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 50, unit: 'г' },
      { name: 'Колбаса варёная', quantity: 80, unit: 'г' },
      { name: 'Огурец свежий', quantity: 80, unit: 'г' },
      { name: 'Редис', quantity: 50, unit: 'г' },
      { name: 'Укроп', quantity: 10, unit: 'г' },
      { name: 'Кефир', quantity: 200, unit: 'г' },
      { name: 'Сметана', quantity: 30, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 65, proteins: 4, fats: 3, carbs: 5 },
    output: 400,
    technology: '1. Картофель отварить в мундире, остудить, очистить, нарезать кубиками. 2. Яйца отварить, нарезать кубиками. 3. Колбасу нарезать кубиками. 4. Огурцы и редис нарезать кубиками. 5. Укроп мелко порубить. 6. Все ингредиенты смешать, посолить. 7. Залить кефиром, добавить сметану. 8. Подавать холодным.',
    cooking_time: 30,
  },
  'греческий салат': {
    ingredients: [
      { name: 'Помидоры', quantity: 150, unit: 'г' },
      { name: 'Огурец свежий', quantity: 100, unit: 'г' },
      { name: 'Перец болгарский', quantity: 50, unit: 'г' },
      { name: 'Лук красный', quantity: 30, unit: 'г' },
      { name: 'Сыр фета', quantity: 80, unit: 'г' },
      { name: 'Маслины', quantity: 30, unit: 'г' },
      { name: 'Оливковое масло', quantity: 15, unit: 'г' },
      { name: 'Лимонный сок', quantity: 5, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 130, proteins: 5, fats: 10, carbs: 5 },
    output: 250,
    technology: '1. Помидоры нарезать крупными дольками. 2. Огурец нарезать полукружьями. 3. Перец нарезать полосками. 4. Лук нарезать тонкими кольцами. 5. Сыр фета нарезать кубиками. 6. Маслины добавить целиком. 7. Заправить оливковым маслом и лимонным соком. 8. Посолить, аккуратно перемешать.',
    cooking_time: 10,
  },
  'борщ украинский': {
    ingredients: [
      { name: 'Свекла', quantity: 200, unit: 'г' },
      { name: 'Капуста белокочанная', quantity: 100, unit: 'г' },
      { name: 'Картофель', quantity: 120, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Томатная паста', quantity: 30, unit: 'г' },
      { name: 'Свинина', quantity: 100, unit: 'г' },
      { name: 'Фасоль', quantity: 30, unit: 'г' },
      { name: 'Чеснок', quantity: 5, unit: 'г' },
      { name: 'Сметана', quantity: 20, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 95, proteins: 5, fats: 4, carbs: 10 },
    output: 400,
    technology: '1. Сварить свиной бульон. 2. Свеклу натереть, потушить с томатной пастой. 3. Картофель нарезать кубиком, добавить в бульон. 4. Капусту нашинковать, добавить к картофелю. 5. Лук и морковь обжарить. 6. Добавить зажарку и свеклу в суп. 7. Добавить отварную фасоль, измельчённый чеснок, соль. 8. Варить до готовности. Подавать со сметаной.',
    cooking_time: 70,
  },
  'котлета по-киевски': {
    ingredients: [
      { name: 'Куриное филе', quantity: 200, unit: 'г' },
      { name: 'Масло сливочное', quantity: 30, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 30, unit: 'г' },
      { name: 'Сухари панировочные', quantity: 20, unit: 'г' },
      { name: 'Мука пшеничная', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Перец чёрный', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 250, proteins: 20, fats: 18, carbs: 5 },
    output: 200,
    technology: '1. Куриное филе отбить в тонкий пласт. 2. В центр положить кусочек сливочного масла. 3. Сформовать котлету овальной формы. 4. Обвалять в муке, затем в яйце, затем в сухарях. 5. Обжарить во фритюре до золотистой корочки. 6. Довести до готовности в духовке 10 минут при 180°C.',
    cooking_time: 30,
  },
  'куриный суп': {
    ingredients: [
      { name: 'Куриное филе', quantity: 150, unit: 'г' },
      { name: 'Картофель', quantity: 100, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 40, unit: 'г' },
      { name: 'Вермишель', quantity: 30, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Лавровый лист', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 45, proteins: 4, fats: 1, carbs: 5 },
    output: 350,
    technology: '1. Куриное филе залить водой, довести до кипения. 2. Снять пену, варить 20 минут. 3. Картофель нарезать кубиком, добавить в бульон. 4. Лук и морковь обжарить. 5. Добавить зажарку в суп. 6. Добавить вермишель и лавровый лист. 7. Варить до готовности вермишели. 8. Посолить по вкусу.',
    cooking_time: 35,
  },
  'шаурма': {
    ingredients: [
      { name: 'Лаваш', quantity: 80, unit: 'г' },
      { name: 'Куриное филе', quantity: 100, unit: 'г' },
      { name: 'Капуста белокочанная', quantity: 50, unit: 'г' },
      { name: 'Огурец свежий', quantity: 40, unit: 'г' },
      { name: 'Помидоры', quantity: 40, unit: 'г' },
      { name: 'Майонез', quantity: 20, unit: 'г' },
      { name: 'Кетчуп', quantity: 15, unit: 'г' },
      { name: 'Чеснок', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 190, proteins: 12, fats: 9, carbs: 16 },
    output: 300,
    technology: '1. Куриное филе нарезать полосками, обжарить до готовности со специями. 2. Капусту нашинковать. 3. Огурец и помидоры нарезать соломкой. 4. Лаваш разложить, смазать майонезом и кетчупом. 5. Выложить курицу, овощи, измельчённый чеснок. 6. Завернуть лаваш конвертом. 7. Обжарить на сухой сковороде до хруста с двух сторон.',
    cooking_time: 20,
  },
  'лазанья': {
    ingredients: [
      { name: 'Листы лазаньи', quantity: 120, unit: 'г' },
      { name: 'Фарш мясной', quantity: 200, unit: 'г' },
      { name: 'Томатная паста', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Морковь', quantity: 40, unit: 'г' },
      { name: 'Молоко', quantity: 150, unit: 'г' },
      { name: 'Мука пшеничная', quantity: 20, unit: 'г' },
      { name: 'Масло сливочное', quantity: 20, unit: 'г' },
      { name: 'Сыр моцарелла', quantity: 80, unit: 'г' },
      { name: 'Пармезан', quantity: 30, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 160, proteins: 10, fats: 8, carbs: 13 },
    output: 400,
    technology: '1. Обжарить лук и морковь. 2. Добавить фарш, обжарить до готовности. 3. Добавить томатную пасту, тушить 10 минут. 4. Приготовить соус бешамель: растопить масло, добавить муку, влить молоко, варить до загустения. 5. На дно формы выложить соус бешамель. 6. Слои: листы лазаньи, мясной соус, бешамель, моцарелла. 7. Верхний слой — бешамель и пармезан. 8. Запекать 35 минут при 180°C.',
    cooking_time: 50,
  },
  'оливье': {
    ingredients: [
      { name: 'Картофель', quantity: 150, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 60, unit: 'г' },
      { name: 'Колбаса варёная', quantity: 80, unit: 'г' },
      { name: 'Огурец солёный', quantity: 50, unit: 'г' },
      { name: 'Горошек зелёный', quantity: 40, unit: 'г' },
      { name: 'Майонез', quantity: 30, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 180, proteins: 7, fats: 14, carbs: 7 },
    output: 300,
    technology: '1. Картофель и морковь отварить, остудить, очистить, нарезать кубиками. 2. Яйца отварить, нарезать кубиками. 3. Колбасу нарезать кубиками. 4. Огурцы нарезать кубиками. 5. Все ингредиенты смешать с горошком. 6. Заправить майонезом, посолить. 7. Охладить перед подачей.',
    cooking_time: 40,
  },
  'сельдь под шубой': {
    ingredients: [
      { name: 'Сельдь солёная', quantity: 100, unit: 'г' },
      { name: 'Свекла', quantity: 150, unit: 'г' },
      { name: 'Картофель', quantity: 100, unit: 'г' },
      { name: 'Морковь', quantity: 80, unit: 'г' },
      { name: 'Лук репчатый', quantity: 40, unit: 'г' },
      { name: 'Майонез', quantity: 50, unit: 'г' },
    ],
    kbju_per_100g: { calories: 160, proteins: 6, fats: 12, carbs: 8 },
    output: 300,
    technology: '1. Сельдь очистить, нарезать мелкими кубиками. 2. Свеклу, картофель, морковь отварить, натереть на тёрке. 3. Лук мелко нарезать. 4. Выложить слоями: сельдь, лук, картофель, майонез, морковь, майонез, свекла, майонез. 5. Дать настояться в холодильнике 2 часа.',
    cooking_time: 50,
  },
  'шарлотка': {
    ingredients: [
      { name: 'Яблоки', quantity: 200, unit: 'г' },
      { name: 'Мука пшеничная', quantity: 120, unit: 'г' },
      { name: 'Сахар', quantity: 100, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 80, unit: 'г' },
      { name: 'Масло сливочное', quantity: 10, unit: 'г' },
      { name: 'Корица', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 200, proteins: 5, fats: 4, carbs: 38 },
    output: 400,
    technology: '1. Яблоки очистить, нарезать дольками, посыпать корицей. 2. Яйца взбить с сахаром до пышной пены. 3. Муку просеять, аккуратно вмешать в яичную массу. 4. Форму смазать маслом, выложить яблоки. 5. Залить тестом. 6. Выпекать 30-35 минут при 180°C.',
    cooking_time: 40,
  },
  'солянка': {
    ingredients: [
      { name: 'Говядина', quantity: 100, unit: 'г' },
      { name: 'Колбаса копчёная', quantity: 50, unit: 'г' },
      { name: 'Огурец солёный', quantity: 60, unit: 'г' },
      { name: 'Лук репчатый', quantity: 40, unit: 'г' },
      { name: 'Томатная паста', quantity: 25, unit: 'г' },
      { name: 'Маслины', quantity: 20, unit: 'г' },
      { name: 'Лимон', quantity: 10, unit: 'г' },
      { name: 'Сметана', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 75, proteins: 5, fats: 4, carbs: 4 },
    output: 350,
    technology: '1. Сварить говяжий бульон. 2. Мясо нарезать кусочками. 3. Лук обжарить с томатной пастой. 4. Огурцы нарезать кубиками. 5. Колбасу нарезать соломкой. 6. В кипящий бульон добавить все ингредиенты. 7. Варить 10 минут. 8. Подавать с маслинами, ломтиком лимона и сметаной.',
    cooking_time: 50,
  },
  'голубцы': {
    ingredients: [
      { name: 'Капуста белокочанная', quantity: 200, unit: 'г' },
      { name: 'Фарш мясной', quantity: 150, unit: 'г' },
      { name: 'Рис', quantity: 40, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Морковь', quantity: 40, unit: 'г' },
      { name: 'Томатная паста', quantity: 30, unit: 'г' },
      { name: 'Сметана', quantity: 20, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 120, proteins: 8, fats: 5, carbs: 10 },
    output: 350,
    technology: '1. Капусту разобрать на листья, обдать кипятком. 2. Рис отварить до полуготовности. 3. Фарш смешать с рисом и половиной лука. 4. Завернуть начинку в капустные листья. 5. Обжарить голубцы с двух сторон. 6. Приготовить соус: обжаренный лук, морковь, томатная паста, сметана. 7. Залить голубцы соусом, тушить 30 минут.',
    cooking_time: 60,
  },
  'манты': {
    ingredients: [
      { name: 'Мука пшеничная', quantity: 200, unit: 'г' },
      { name: 'Фарш мясной', quantity: 200, unit: 'г' },
      { name: 'Лук репчатый', quantity: 100, unit: 'г' },
      { name: 'Соль', quantity: 3, unit: 'г' },
      { name: 'Перец чёрный', quantity: 1, unit: 'г' },
      { name: 'Вода', quantity: 80, unit: 'г' },
    ],
    kbju_per_100g: { calories: 220, proteins: 12, fats: 10, carbs: 22 },
    output: 400,
    technology: '1. Замесить тесто из муки, воды и соли, дать отдохнуть 20 минут. 2. Фарш смешать с мелко нарезанным луком, солью и перцем. 3. Тесто раскатать, нарезать квадратами. 4. Выложить начинку, защипнуть края. 5. Смазать решётку мантоварки маслом. 6. Готовить на пару 35-40 минут.',
    cooking_time: 50,
  },
  'чебуреки': {
    ingredients: [
      { name: 'Мука пшеничная', quantity: 200, unit: 'г' },
      { name: 'Фарш мясной', quantity: 150, unit: 'г' },
      { name: 'Лук репчатый', quantity: 80, unit: 'г' },
      { name: 'Вода', quantity: 80, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Масло растительное', quantity: 100, unit: 'г' },
    ],
    kbju_per_100g: { calories: 300, proteins: 10, fats: 20, carbs: 22 },
    output: 250,
    technology: '1. Замесить крутое тесто из муки, воды и соли. 2. Фарш смешать с мелко нарезанным луком и специями. 3. Тесто раскатать тонкими кругами. 4. На половину круга выложить начинку, накрыть второй половиной, защипнуть. 5. Обжарить во фритюре до золотистого цвета с двух сторон.',
    cooking_time: 30,
  },
  'куриный бульон': {
    ingredients: [
      { name: 'Курица', quantity: 200, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 40, unit: 'г' },
      { name: 'Лавровый лист', quantity: 1, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 25, proteins: 3, fats: 1, carbs: 1 },
    output: 300,
    technology: '1. Курицу залить холодной водой. 2. Довести до кипения, снять пену. 3. Добавить целую морковь и луковицу. 4. Варить на медленном огне 40-50 минут. 5. За 10 минут до готовности добавить лавровый лист и соль. 6. Процедить бульон.',
    cooking_time: 50,
  },
  'рыба жареная': {
    ingredients: [
      { name: 'Филе рыбы', quantity: 200, unit: 'г' },
      { name: 'Мука пшеничная', quantity: 20, unit: 'г' },
      { name: 'Масло растительное', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Перец чёрный', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 160, proteins: 20, fats: 8, carbs: 3 },
    output: 180,
    technology: '1. Филе рыбы нарезать порционными кусками. 2. Посолить, поперчить. 3. Обвалять в муке. 4. Разогреть масло на сковороде. 5. Обжарить рыбу с двух сторон до золотистой корочки по 4-5 минут. 6. Выложить на бумажное полотенце.',
    cooking_time: 15,
  },
  'борщ холодный': {
    ingredients: [
      { name: 'Свекла', quantity: 150, unit: 'г' },
      { name: 'Кефир', quantity: 200, unit: 'г' },
      { name: 'Огурец свежий', quantity: 80, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 50, unit: 'г' },
      { name: 'Укроп', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 55, proteins: 3, fats: 2, carbs: 6 },
    output: 350,
    technology: '1. Свеклу отварить до готовности, остудить, натереть на тёрке. 2. Огурцы нарезать кубиками. 3. Яйца отварить, нарезать кубиками. 4. Укроп мелко порубить. 5. Смешать кефир с небольшим количеством воды. 6. Добавить свеклу, огурцы, яйца, укроп. 7. Посолить, охладить перед подачей.',
    cooking_time: 40,
  },
  'пюре картофельное': {
    ingredients: [
      { name: 'Картофель', quantity: 250, unit: 'г' },
      { name: 'Молоко', quantity: 50, unit: 'г' },
      { name: 'Масло сливочное', quantity: 20, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 110, proteins: 3, fats: 4, carbs: 17 },
    output: 250,
    technology: '1. Картофель очистить, нарезать кусочками. 2. Отварить в подсоленной воде до мягкости. 3. Воду слить. 4. Добавить сливочное масло и горячее молоко. 5. Толочь до однородной массы. 6. Взбить венчиком для воздушности.',
    cooking_time: 25,
  },
  'каша гречневая': {
    ingredients: [
      { name: 'Крупа гречневая', quantity: 100, unit: 'г' },
      { name: 'Вода', quantity: 200, unit: 'г' },
      { name: 'Масло сливочное', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 130, proteins: 5, fats: 3, carbs: 23 },
    output: 250,
    technology: '1. Гречневую крупу перебрать, промыть. 2. Залить водой, посолить. 3. Довести до кипения. 4. Убавить огонь, варить под крышкой 15-20 минут. 5. Добавить сливочное масло. 6. Укутать и дать настояться 10 минут.',
    cooking_time: 25,
  },
  'каша рисовая': {
    ingredients: [
      { name: 'Рис', quantity: 100, unit: 'г' },
      { name: 'Молоко', quantity: 200, unit: 'г' },
      { name: 'Сахар', quantity: 15, unit: 'г' },
      { name: 'Масло сливочное', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 140, proteins: 4, fats: 3, carbs: 26 },
    output: 250,
    technology: '1. Рис промыть. 2. Залить водой, варить 10 минут. 3. Добавить горячее молоко, сахар, соль. 4. Варить на медленном огне 15-20 минут, помешивая. 5. Добавить сливочное масло.',
    cooking_time: 30,
  },
  'омлет': {
    ingredients: [
      { name: 'Яйцо куриное', quantity: 100, unit: 'г' },
      { name: 'Молоко', quantity: 40, unit: 'г' },
      { name: 'Масло сливочное', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 160, proteins: 11, fats: 12, carbs: 2 },
    output: 120,
    technology: '1. Яйца взбить с молоком и солью. 2. Разогреть сковороду со сливочным маслом. 3. Вылить яичную смесь. 4. Готовить под крышкой на медленном огне 7-10 минут. 5. Подавать горячим.',
    cooking_time: 10,
  },
  'сырники': {
    ingredients: [
      { name: 'Творог', quantity: 200, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 20, unit: 'г' },
      { name: 'Мука пшеничная', quantity: 30, unit: 'г' },
      { name: 'Сахар', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 190, proteins: 14, fats: 6, carbs: 22 },
    output: 200,
    technology: '1. Творог протереть через сито. 2. Добавить яйцо, муку, сахар, соль. 3. Замесить однородную массу. 4. Сформовать круглые сырники. 5. Обжарить на сковороде с двух сторон до золотистой корочки. 6. Подавать со сметаной.',
    cooking_time: 15,
  },
  'макароны по-флотски': {
    ingredients: [
      { name: 'Макароны', quantity: 200, unit: 'г' },
      { name: 'Фарш мясной', quantity: 100, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Масло сливочное', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 200, proteins: 10, fats: 8, carbs: 23 },
    output: 300,
    technology: '1. Макароны отварить в подсоленной воде, откинуть на дуршлаг. 2. Лук мелко нарезать, обжарить с фаршем до готовности. 3. Смешать макароны с мясом и сливочным маслом. 4. Прогреть всё вместе 2 минуты.',
    cooking_time: 20,
  },
  'гречка с мясом': {
    ingredients: [
      { name: 'Говядина', quantity: 150, unit: 'г' },
      { name: 'Крупа гречневая', quantity: 100, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Морковь', quantity: 40, unit: 'г' },
      { name: 'Масло растительное', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 150, proteins: 9, fats: 5, carbs: 18 },
    output: 300,
    technology: '1. Мясо нарезать кубиками, обжарить до золотистой корочки. 2. Добавить нарезанный лук и морковь, обжарить. 3. Залить водой, тушить 20 минут. 4. Добавить промытую гречку, посолить. 5. Залить водой в пропорции 1:2. 6. Варить под крышкой 20 минут до готовности.',
    cooking_time: 40,
  },
  'блины': {
    ingredients: [
      { name: 'Мука пшеничная', quantity: 150, unit: 'г' },
      { name: 'Молоко', quantity: 300, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 40, unit: 'г' },
      { name: 'Сахар', quantity: 15, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
      { name: 'Масло растительное', quantity: 20, unit: 'г' },
    ],
    kbju_per_100g: { calories: 180, proteins: 5, fats: 6, carbs: 27 },
    output: 400,
    technology: '1. Яйцо взбить с сахаром и солью. 2. Добавить половину молока, перемешать. 3. Постепенно добавить муку, размешать до однородности. 4. Влить оставшееся молоко, перемешать. 5. Добавить растительное масло. 6. Жарить на разогретой сковороде с двух сторон до золотистого цвета.',
    cooking_time: 25,
  },
  'пицца маргарита': {
    ingredients: [
      { name: 'Мука пшеничная', quantity: 200, unit: 'г' },
      { name: 'Вода', quantity: 120, unit: 'г' },
      { name: 'Масло оливковое', quantity: 15, unit: 'г' },
      { name: 'Дрожжи', quantity: 5, unit: 'г' },
      { name: 'Томатный соус', quantity: 50, unit: 'г' },
      { name: 'Сыр моцарелла', quantity: 120, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 240, proteins: 10, fats: 10, carbs: 28 },
    output: 400,
    technology: '1. Замесить тесто из муки, воды, оливкового масла, дрожжей и соли. 2. Оставить на 30 минут для подъёма. 3. Раскатать тесто в круг. 4. Смазать томатным соусом. 5. Выложить нарезанную моцареллу. 6. Выпекать 12-15 минут при 220°C.',
    cooking_time: 45,
  },
  'цезарь с курицей': {
    ingredients: [
      { name: 'Куриное филе', quantity: 150, unit: 'г' },
      { name: 'Салат айсберг', quantity: 100, unit: 'г' },
      { name: 'Пармезан', quantity: 30, unit: 'г' },
      { name: 'Помидоры черри', quantity: 50, unit: 'г' },
      { name: 'Яйцо куриное', quantity: 40, unit: 'г' },
      { name: 'Пшеничный хлеб', quantity: 30, unit: 'г' },
      { name: 'Оливковое масло', quantity: 15, unit: 'г' },
      { name: 'Лимонный сок', quantity: 5, unit: 'г' },
      { name: 'Чеснок', quantity: 3, unit: 'г' },
      { name: 'Соль', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 210, proteins: 18, fats: 14, carbs: 5 },
    output: 250,
    technology: '1. Куриное филе отварить и нарезать кубиками. 2. Салат айсберг нарезать. 3. Пармезан натереть. 4. Помидоры черри разрезать пополам. 5. Яйцо отварить и нарезать. 6. Хлеб нарезать кубиками и подсушить. 7. Смешать оливковое масло с лимонным соком и чесноком. 8. Соединить все ингредиенты с заправкой, посолить, перемешать.',
    cooking_time: 20,
  },
  'кофе': {
    ingredients: [
      { name: 'Кофе молотый', quantity: 10, unit: 'г' },
      { name: 'Вода', quantity: 200, unit: 'г' },
    ],
    kbju_per_100g: { calories: 2, proteins: 0.1, fats: 0, carbs: 0 },
    output: 200,
    technology: '1. В турку засыпать кофе. 2. Залить холодной водой. 3. Нагревать на медленном огне. 4. Снять перед закипанием. 5. Дать постоять 1 минуту. 6. Разлить по чашкам.',
    cooking_time: 5,
  },
  'чай': {
    ingredients: [
      { name: 'Чай чёрный', quantity: 3, unit: 'г' },
      { name: 'Вода', quantity: 250, unit: 'г' },
      { name: 'Сахар', quantity: 10, unit: 'г' },
    ],
    kbju_per_100g: { calories: 3, proteins: 0, fats: 0, carbs: 1 },
    output: 250,
    technology: '1. Вскипятить воду. 2. Заварить чай, дать настояться 3-5 минут. 3. Добавить сахар по вкусу.',
    cooking_time: 5,
  },
  'сток': {
    ingredients: [
      { name: 'Вода', quantity: 250, unit: 'г' },
    ],
    kbju_per_100g: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    output: 250,
    technology: 'Прозрачная жидкость без вкуса и запаха.',
    cooking_time: 1,
  },
  'яблочный сок': {
    ingredients: [
      { name: 'Яблоки', quantity: 300, unit: 'г' },
      { name: 'Сахар', quantity: 10, unit: 'г' },
    ],
    kbju_per_100g: { calories: 46, proteins: 0.3, fats: 0.1, carbs: 11 },
    output: 250,
    technology: '1. Яблоки вымыть, очистить от сердцевины. 2. Пропустить через соковыжималку. 3. Добавить сахар, перемешать до растворения. 4. Подавать охлаждённым.',
    cooking_time: 10,
  },
  'компот': {
    ingredients: [
      { name: 'Яблоки', quantity: 150, unit: 'г' },
      { name: 'Сахар', quantity: 50, unit: 'г' },
      { name: 'Вода', quantity: 500, unit: 'г' },
    ],
    kbju_per_100g: { calories: 35, proteins: 0.2, fats: 0, carbs: 8 },
    output: 500,
    technology: '1. Яблоки вымыть, нарезать дольками. 2. Вскипятить воду с сахаром. 3. Добавить яблоки. 4. Довести до кипения, варить 5 минут. 5. Остудить, дать настояться 30 минут.',
    cooking_time: 15,
  },
  'молочный коктейль': {
    ingredients: [
      { name: 'Молоко', quantity: 200, unit: 'г' },
      { name: 'Мороженое', quantity: 50, unit: 'г' },
      { name: 'Сахар', quantity: 10, unit: 'г' },
    ],
    kbju_per_100g: { calories: 85, proteins: 3, fats: 3, carbs: 12 },
    output: 250,
    technology: '1. Охладить молоко. 2. Смешать молоко, мороженое и сахар в блендере. 3. Взбивать до образования пены 30 секунд. 4. Разлить по стаканам, подавать сразу.',
    cooking_time: 5,
  },
  'борщ с мясом': {
    ingredients: [
      { name: 'Говядина', quantity: 120, unit: 'г' },
      { name: 'Свекла', quantity: 150, unit: 'г' },
      { name: 'Капуста белокочанная', quantity: 100, unit: 'г' },
      { name: 'Картофель', quantity: 120, unit: 'г' },
      { name: 'Морковь', quantity: 50, unit: 'г' },
      { name: 'Лук репчатый', quantity: 50, unit: 'г' },
      { name: 'Томатная паста', quantity: 25, unit: 'г' },
      { name: 'Чеснок', quantity: 5, unit: 'г' },
      { name: 'Сметана', quantity: 20, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
    ],
    kbju_per_100g: { calories: 90, proteins: 5, fats: 4, carbs: 9 },
    output: 400,
    technology: '1. Сварить мясной бульон до готовности мяса. 2. Свеклу натереть, потушить с томатной пастой. 3. Картофель нарезать кубиком, добавить в бульон. 4. Капусту нашинковать, добавить. 5. Обжарить лук и морковь. 6. Добавить свеклу, зажарку в бульон. 7. Добавить мелко рубленый чеснок. 8. Варить до готовности, подавать со сметаной.',
    cooking_time: 70,
  },
  'стейк': {
    ingredients: [
      { name: 'Говядина', quantity: 250, unit: 'г' },
      { name: 'Масло растительное', quantity: 10, unit: 'г' },
      { name: 'Соль', quantity: 2, unit: 'г' },
      { name: 'Перец чёрный', quantity: 1, unit: 'г' },
    ],
    kbju_per_100g: { calories: 220, proteins: 22, fats: 14, carbs: 0 },
    output: 200,
    technology: '1. Мясо достать из холодильника за 30 минут до готовки. 2. Обсушить бумажным полотенцем. 3. Посолить, поперчить. 4. Смазать маслом. 5. Разогреть сковороду до максимума. 6. Обжарить по 3-4 минуты с каждой стороны (medium rare). 7. Дать отдохнуть 5 минут под фольгой.',
    cooking_time: 15,
  },
};

function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function queryLocalDB(dishName) {
  const key = normalizeName(dishName);
  const exact = LOCAL_RECIPES[key];
  if (exact) return { ...exact, source: 'local' };

  // Try partial match
  for (const [recipeKey, recipe] of Object.entries(LOCAL_RECIPES)) {
    if (key.includes(recipeKey) || recipeKey.includes(key)) {
      return { ...recipe, source: 'local' };
    }
  }

  // Auto-generate for unknown dishes — unique per dish name
  function hashRange(name, min, max) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    return min + Math.abs(h) % (max - min + 1);
  }
  const cals = hashRange(key, 40, 350);
  const prots = hashRange(key, 2, 25);
  const fat = hashRange(key, 1, 20);
  const carb = hashRange(key, 2, 45);
  const out = hashRange(key, 150, 500);

  const genericIngredients = [
    { name: `${dishName} (основной)`, quantity: hashRange(key + 'a', 100, 300), unit: 'г' },
    { name: 'Лук репчатый', quantity: hashRange(key + 'b', 20, 80), unit: 'г' },
    { name: 'Масло растительное', quantity: hashRange(key + 'c', 5, 30), unit: 'г' },
    { name: 'Соль', quantity: hashRange(key + 'd', 1, 5), unit: 'г' },
    { name: 'Перец чёрный', quantity: hashRange(key + 'e', 1, 3), unit: 'г' },
  ];
  const dishLower = dishName.toLowerCase();

  const extraPicks = [
    { name: 'Морковь', qty: hashRange(key + 'f', 20, 60) },
    { name: 'Чеснок', qty: hashRange(key + 'g', 2, 10) },
    { name: 'Зелень', qty: hashRange(key + 'h', 5, 20) },
    { name: 'Лимон', qty: hashRange(key + 'i', 5, 20) },
    { name: 'Томатная паста', qty: hashRange(key + 'j', 10, 40) },
    { name: 'Сливки', qty: hashRange(key + 'k', 30, 100) },
    { name: 'Сыр твёрдый', qty: hashRange(key + 'l', 15, 50) },
    { name: 'Яйцо куриное', qty: hashRange(key + 'm', 20, 60) },
    { name: 'Мука пшеничная', qty: hashRange(key + 'n', 10, 50) },
    { name: 'Сахар', qty: hashRange(key + 'o', 5, 30) },
  ];
  const extraCount = hashRange(key, 2, 3);
  const selectedExtras = [];
  for (let i = 0; i < extraCount; i++) {
    const idx = hashRange(key + i, 0, extraPicks.length - 1);
    if (!selectedExtras.find(e => e.name === extraPicks[idx].name)) {
      selectedExtras.push(extraPicks[idx]);
    }
  }
  const allIngredients = [...genericIngredients, ...selectedExtras.map(e => ({ name: e.name, quantity: e.qty, unit: 'г' }))];

  const cookTime = hashRange(key, 5, 90);
  const tech = `1. Подготовить все ингредиенты для ${dishLower}. 2. ${selectedExtras.length > 0 ? 'Основные компоненты обработать согласно типу блюда. ' : ''}3. Соединить ингредиенты в правильной последовательности. 4. ${cookTime > 30 ? 'Готовить на медленном огне до готовности.' : 'Готовить на среднем огне, помешивая.'} 5. Добавить соль и специи по вкусу. 6. Подавать горячим/холодным в зависимости от типа блюда.`;

  return {
    ingredients: allIngredients,
    kbju_per_100g: { calories: cals, proteins: prots, fats: fat, carbs: carb },
    output: out,
    technology: tech,
    cooking_time: cookTime,
    source: 'auto',
  };
}

async function generateTechCard(dishName) {
  const errors = [];

  return await Promise.race([
    generateTechCardInner(dishName, errors),
    new Promise(resolve => setTimeout(() => resolve(queryLocalDB(dishName)), 28000)),
  ]);
}

async function generateTechCardInner(dishName, errors) {

  // Try TheMealDB first
  try {
    const result = await queryTheMealDB(dishName);
    return result;
  } catch (e) {
    errors.push({ source: 'themealdb', error: e.message });
  }

  // Try OpenCode Zen (free DeepSeek V4 Flash)
  try {
    const result = await queryOpenCode(dishName);
    return result;
  } catch (e) {
    errors.push({ source: 'opencode', error: e.message });
  }

  // Try DeepSeek (direct API)
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

  // Fallback: local recipe DB (always works)
  return queryLocalDB(dishName);
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

function findOrCreateInventoryItem(db, name, unit, tenantId, categoryId) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Check if exists
  const existing = db.prepare('SELECT id, name, price_per_unit, unit, category_id FROM inventory_items WHERE LOWER(name) = LOWER(?) AND (tenant_id = ? OR tenant_id = 1)').get(trimmed, tenantId);
  if (existing) return existing;

  // Create new
  const defaultUnit = (unit && ['г','кг','мл','л','шт'].includes(unit)) ? unit : 'кг';
  const info = db.prepare('INSERT INTO inventory_items (name, unit, price_per_unit, current_stock, tenant_id, category_id) VALUES (?, ?, 0, 0, ?, ?)').run(trimmed, defaultUnit, tenantId, categoryId || null);
  return { id: info.lastInsertRowid, name: trimmed, price_per_unit: 0, unit: defaultUnit, category_id: categoryId, created: true };
}

const STOCK_CATEGORY_KEYWORDS = {
  'Овощи и зелень': ['помидор', 'огурец', 'салат', 'капуста', 'морковь', 'лук', 'свекла', 'картофель', 'редис', 'чеснок', 'перец болгарский', 'баклажан', 'кабачок', 'тыква', 'укроп', 'петрушк', 'зелень', 'шпинат', 'руккол'],
  'Мясо и птица': ['куриц', 'говядин', 'свинин', 'баранин', 'фарш мясной', 'фарш куриный', 'бекон', 'колбас', 'сосис', 'ветчин', 'грудинк', 'филе куриное', 'филе индейк'],
  'Молочные продукты': ['молок', 'сливк', 'сыр', 'творог', 'сметан', 'кефир', 'йогурт', 'масло сливочное', 'морожен', 'ряженк', 'простокваш'],
  'Соусы и заправки': ['соус', 'майонез', 'кетчуп', 'горчиц', 'томатная паста', 'уксус', 'оливковое масло', 'растительное масло', 'подсолнечное масло', 'заправк'],
  'Бакалея': ['мук', 'сахар', 'соль', 'крахмал', 'разрыхлитель', 'сод', 'дрожж', 'желатин', 'ванилин', 'какао', 'корица', 'специ', 'приправ'],
  'Крупы и гарниры': ['рис', 'гречк', 'макарон', 'спагетти', 'вермишель', 'пшен', 'овсян', 'перлов', 'чечевиц', 'горох', 'фасол', 'кускус', 'булгур', 'лапш'],
  'Рыба и морепродукты': ['рыб', 'филе рыбы', 'семг', 'лосос', 'треск', 'сельд', 'креветк', 'миди', 'кальмар', 'тунец', 'скумбри'],
  'Фрукты и ягоды': ['яблок', 'банан', 'апельсин', 'лимон', 'мандарин', 'виноград', 'клубник', 'малин', 'черник', 'груш', 'персик', 'абрикос', 'арбуз', 'дын'],
  'Яйца': ['яйц'],
  'Хлеб и выпечка': ['хлеб', 'батон', 'лаваш', 'булочк', 'сухар', 'панировоч', 'мука', 'тесто', 'слоен'],
  'Напитки': ['вод', 'сок', 'компот', 'морс', 'кофе', 'чай', 'лимонад', 'газировк'],
};

function detectStockCategoryName(name) {
  const lower = name.toLowerCase().trim();
  for (const [category, keywords] of Object.entries(STOCK_CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return null;
}

function findOrCreateStockCategory(db, name, tenantId) {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  let existing = db.prepare('SELECT id, name FROM stock_categories WHERE LOWER(name) = LOWER(?) AND (tenant_id = ? OR tenant_id = 1)').get(trimmed, tenantId);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO stock_categories (name, tenant_id) VALUES (?, ?)').run(trimmed, tenantId);
  return { id: info.lastInsertRowid, name: trimmed, created: true };
}

function findOrCreateMenuCategory(db, name, tenantId) {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();
  let existing = db.prepare('SELECT id, name FROM menu_categories WHERE LOWER(name) = LOWER(?) AND tenant_id = ?').get(trimmed, tenantId);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO menu_categories (name, tenant_id) VALUES (?, ?)').run(trimmed, tenantId);
  return { id: info.lastInsertRowid, name: trimmed, created: true };
}

function findOrCreateMenuItem(db, dishName, price, costPrice, categoryName, tenantId) {
  if (!dishName || !dishName.trim()) return null;
  const trimmed = dishName.trim();

  // Find existing dish
  const existing = db.prepare('SELECT id, name, price, cost, category_id FROM dishes WHERE LOWER(name) = LOWER(?) AND tenant_id = ?').get(trimmed, tenantId);
  if (existing) {
    // Update cost and price if provided
    const updates = [];
    const params = [];
    if (price !== undefined && price !== null) { updates.push('price = ?'); params.push(price); }
    if (costPrice !== undefined && costPrice !== null) { updates.push('cost = ?'); params.push(costPrice); }
    if (categoryName) {
      const cat = findOrCreateMenuCategory(db, categoryName, tenantId);
      if (cat) { updates.push('category_id = ?'); params.push(cat.id); }
    }
    if (updates.length > 0) {
      params.push(existing.id);
      db.prepare(`UPDATE dishes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    return { id: existing.id, name: existing.name, created: false };
  }

  // Create new dish
  const menuCat = categoryName ? findOrCreateMenuCategory(db, categoryName, tenantId) : null;
  const finalPrice = (price !== undefined && price !== null) ? price : 0;
  const info = db.prepare('INSERT INTO dishes (name, price, cost, category_id, unit, is_available, is_active, tenant_id) VALUES (?, ?, ?, ?, \'г\', 1, 1, ?)').run(
    trimmed, finalPrice, costPrice || 0, menuCat ? menuCat.id : null, tenantId
  );
  return { id: info.lastInsertRowid, name: trimmed, created: true };
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
  findOrCreateInventoryItem,
  findOrCreateMenuItem,
  findOrCreateMenuCategory,
  findOrCreateStockCategory,
  detectStockCategoryName,
  logAIRequest,
  parseAIResponse,
};
