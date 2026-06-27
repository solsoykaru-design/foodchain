/**
 * Update 217 TRUE base dishes with real AI tech cards.
 * Uses the hardcoded CUISINE list (not derived from DB).
 * Batch: 5 dishes/call, ~44 calls, ~5-10 min.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const DB_PATH = path.join(__dirname, 'foodchain.db');
const API_URL = 'https://opencode.ai/zen/v1/chat/completions';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';
const BATCH_SIZE = 3;

const CUISINES = {
  'Русская': ['Борщ','Щи','Уха','Солянка','Рассольник','Окрошка','Пельмени','Вареники','Голубцы','Котлета по-киевски','Бефстроганов','Плов','Жаркое','Шашлык','Блины','Оладьи','Сырники','Драники','Ватрушка','Кулебяка','Расстегай','Оливье','Винегрет','Сельдь под шубой','Мимоза','Кисель','Компот','Квас','Морс'],
  'Итальянская': ['Пицца Маргарита','Пицца Пепперони','Пицца Гавайская','Пицца Четыре сыра','Пицца Четыре сезона','Пицца Капричоза','Спагетти Болоньезе','Спагетти Карбонара','Феттуччине Альфредо','Лазанья','Равиоли','Тальятелле','Пенне Арабьята','Ризотто','Минестроне','Брускетта','Капрезе','Карпаччо','Тирамису','Панна-котта','Джелато','Канноли','Полента'],
  'Французская': ['Луковый суп','Буйабес','Вишисуаз','Консоме','Кок-о-вен','Беф Бургиньон','Рататуй','Кассуле','Киш Лорен','Круассан','Мадлен','Эклер','Профитроли','Крем-брюле','Мусс шоколадный','Тарт Татен','Багет'],
  'Японская': ['Суши Филадельфия','Суши Калифорния','Ролл Унаги','Ролл Дракон','Ролл Огненный','Ролл Чидори','Нигири лосось','Сашими','Темпура','Тэрияки','Рамен','Мисо-суп','Удон','Соба','Гёдза','Эдамаме','Якитори','Окономияки','Моти','Данго'],
  'Мексиканская': ['Тако','Буррито','Кесадилья','Начос','Фахитас','Энчилада','Тортилья','Гуакамоле','Сальса','Чили-кон-карне','Тамалес','Арепа'],
  'Китайская': ['Курица Гунгбао','Курица в апельсинах','Свинина в кисло-сладком','Утка по-пекински','Яичный суп','Суп Вонтон','Чоу Мейн','Ло Мейн','Спринг-ролл','Димсам','Тофу с овощами','Жареный рис','Хого'],
  'Индийская': ['Курица Карри','Баранина Карри','Тикка Масала','Чиккен Тикка','Наан','Самоса','Дхал','Бирьяни','Пакора','Малай-кофта','Панир','Чатни','Ласси','Гулаб Джамун'],
  'Кавказская': ['Харчо','Чихиртма','Шашлык из баранины','Чашушули','Сациви','Лобио','Хачапури','Хинкали','Чебуреки','Бастурма','Лаваш','Кутабы','Пахлава','Чурчхела'],
  'Американская': ['Бургер классический','Чизбургер','Хот-дог','Клаб-сэндвич','Крылышки Баффало','Картофель фри','Макарони с сыром','Мясной рулет','Барбекю-ребрышки','Панкейки','Пирог тыквенный','Чизкейк','Кекс','Шейк'],
  'Тайская': ['Пад Тай','Том Ям','Том Кха','Сом Там','Массаман карри','Грин карри','Пад Кра Пао','Ларб','Сатай','Куитиао'],
  'Греческая': ['Греческий салат','Муссака','Дзадзики','Спанакопита','Тиропита','Гирос','Сувлаки','Баклава','Фава','Каламараки'],
  'Испанская': ['Паэлья','Гаспачо','Тортилья испанская','Тапас','Крокеты','Чуррос','Эскаливада','Альбондигас'],
  'Турецкая': ['Кебаб','Долма','Манти','Лахмаджун','Шакшука','Хумус','Баба-гануш','Менемен','Кунефе','Айран'],
  'Корейская': ['Кимчи','Бибимбап','Пулькоги','Кальби','Самгёпсаль','Кимчи-ччиге','Пхаджон','Токпоки','Хотпот'],
  'Вьетнамская': ['Фо Бо','Фо Га','Нэм','Бан Ми','Бун Ча','Као Лау','Ком'],
  'Узбекская': ['Плов узбекский','Лагман','Манты','Шурпа','Самса','Бешбармак','Чак-чак'],
};

const PROMPT = `Ты профессиональный технолог общественного питания. Составь технологические карты для перечисленных блюд.

Для КАЖДОГО блюда верни объект в JSON массиве:
{
  "name": "название (в точности как в запросе)",
  "category": "Суп|Салат|Горячее|Закуска|Десерт|Выпечка|Паста|Пицца|Роллы|Напиток",
  "ingredients": [{"name":"ингредиент","quantity":число,"unit":"г"}],
  "kbju": {"calories":число,"proteins":число,"fats":число,"carbs":число},
  "output_g": число,
  "cooking_time_min": число,
  "technology": "технология на русском, 2-3 предложения",
  "temperature": "температура подачи",
  "shelf_life": "срок хранения"
}

Правила: 4-8 ингредиентов, реалистичные КБЖУ, название не менять.`;

async function queryAI(names) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash-free',
      messages: [
        { role: 'system', content: 'Output ONLY a valid JSON array. No markdown, no explanations.' },
        { role: 'user', content: PROMPT + '\n' + names.map(n => `- ${n}`).join('\n') },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(90000),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content || '';
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array');
  return JSON.parse(content.slice(start, end + 1));
}

async function main() {
  console.log('🧠 Updating 217 base dishes with AI tech cards...\n');

  const db = new Database(DB_PATH);

  // Build flat list of all base dishes
  const allBase = [];
  for (const [cuisine, names] of Object.entries(CUISINES)) {
    for (const name of names) {
      allBase.push({ name, cuisine });
    }
  }
  console.log(`📋 Base dishes: ${allBase.length}\n`);

  let updated = 0;
  let failed = 0;

  const updateStmt = db.prepare(`UPDATE dish_catalog SET
    category = ?, description = ?, temperature = ?, shelf_life = ?,
    output = ?, cooking_time = ?, calories = ?, proteins = ?, fats = ?, carbs = ?, technology = ?
    WHERE name = ? AND id = (SELECT MIN(id) FROM dish_catalog WHERE name = ?)`);

  for (let i = 0; i < allBase.length; i += BATCH_SIZE) {
    const batch = allBase.slice(i, i + BATCH_SIZE);
    const names = batch.map(b => b.name);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allBase.length / BATCH_SIZE);

    process.stdout.write(`  [${batchNum}/${totalBatches}] ${names[0]}${names.length > 1 ? ', ...' : ''}... `);

    let result;
    try {
      result = await queryAI(names);
    } catch (e) {
      process.stdout.write(`✗ ${e.message}\n`);
      failed += batch.length;
      continue;
    }

    process.stdout.write(`✓ ${result.length}\n`);

    for (const item of result) {
      if (!item || !item.name) continue;
      // Find the exact base dish name match in our original list
      const baseItem = batch.find(b => b.name.toLowerCase() === item.name.toLowerCase());
      if (!baseItem) {
        process.stdout.write(`      ✗ name mismatch: "${item.name}" not in ${names.join(', ')}\n`);
        continue;
      }

      const kbju = item.kbju || {};
      const cat = item.category || '';
      const ingStr = (item.ingredients || []).map(i => `${i.name} ${i.quantity}${i.unit}`).join(', ');
      
      updateStmt.run(
        cat,
        `${baseItem.cuisine} кухня. Категория: ${cat}. Ингредиенты: ${ingStr || '—'}. Выход: ${item.output_g || 0} г.`,
        item.temperature || '',
        item.shelf_life || '',
        item.output_g || 0,
        item.cooking_time_min || 0,
        kbju.calories || 0,
        kbju.proteins || 0,
        kbju.fats || 0,
        kbju.carbs || 0,
        item.technology || '',
        baseItem.name,
        baseItem.name
      );
      updated++;
    }
  }

  console.log(`\n✅ Updated: ${updated} base dishes, Failed: ${failed}`);

  const sample = db.prepare("SELECT name, cuisine, category, substr(description,1,60) as desc_short FROM dish_catalog WHERE category != '' AND description != '' LIMIT 5").all();
  console.log('\nSample:');
  for (const s of sample) console.log(`  ${s.name} | ${s.cuisine} | ${s.category}`);

  db.close();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
