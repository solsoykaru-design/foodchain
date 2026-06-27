const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DISHES = [
  'Борщ','Щи','Уха','Солянка','Рассольник','Окрошка','Пельмени','Вареники',
  'Голубцы','Котлета по-киевски','Бефстроганов','Плов','Жаркое','Шашлык',
  'Блины','Оладьи','Сырники','Драники','Ватрушка','Кулебяка'
];

async function test() {
  const prompt = `Ты технолог общественного питания. Сгенерируй технологические карты для перечисленных блюд.

Для КАЖДОГО блюда верни объект в массиве JSON:
{
  "name": "название",
  "category": "Суп|Салат|Горячее|Закуска|Десерт|Выпечка|Паста|Пицца|Роллы|Напиток",
  "ingredients": [{"name":"ингредиент","quantity":число,"unit":"г"}],
  "kbju": {"calories":число,"proteins":число,"fats":число,"carbs":число},
  "output_g": число,
  "cooking_time_min": число,
  "technology": "технология на русском",
  "temperature": "температура подачи",
  "shelf_life": "срок хранения"
}

Правила:
- ВСЕГО 4-5 ингредиентов на блюдо (не больше!)
- Названия ингредиентов на русском
- КБЖУ реалистичные
- Технология кратко, 1-2 предложения
- Не менять название блюда

Список блюд:
${DISHES.map(d => `- ${d}`).join('\n')}`;

  console.log(`Sending ${DISHES.length} dishes to deepseek-v4-flash-free...`);
  console.time('request');

  const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENCODE_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash-free',
      messages: [
        { role: 'system', content: 'Output ONLY a valid JSON array. No markdown, no explanations, no extra text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 32768,
    }),
    signal: AbortSignal.timeout(180000),
  });

  console.timeEnd('request');
  console.log('Status:', res.status);

  const text = await res.text();
  const json = JSON.parse(text);
  const msg = json.choices?.[0]?.message || {};
  const fc = json.choices?.[0]?.finish_reason;
  const usage = json.usage || {};

  console.log('Finish reason:', fc);
  console.log('Usage:', JSON.stringify(usage));
  console.log('Has content:', !!msg.content, 'len:', (msg.content||'').length);
  console.log('Has reasoning:', !!msg.reasoning_content, 'len:', (msg.reasoning_content||'').length);

  const content = msg.content || '';
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    try {
      const parsed = JSON.parse(content.slice(start, end+1));
      console.log(`✅ Valid JSON array with ${parsed.length} dishes`);
      for (const d of parsed.slice(0, 3)) {
        console.log(`  ${d.name}: ${d.ingredients?.length || 0} ing, ${d.kbju?.calories} kcal, ${d.cooking_time_min} min`);
      }
      if (parsed.length < DISHES.length) {
        const names = parsed.map(d => d.name);
        const missing = DISHES.filter(n => !names.some(p => p.toLowerCase() === n.toLowerCase()));
        console.log(`⚠️ Missing ${missing.length} dishes: ${missing.join(', ')}`);
      }
    } catch (e) {
      console.log('JSON error:', e.message);
      console.log('Content last 500:', content.slice(-500));
    }
  } else {
    console.log('No JSON array found in response');
    console.log('Reasoning (last 800):', (msg.reasoning_content || '').slice(-800));
    console.log('Content (first 500):', content.slice(0, 500));
  }
}

test().catch(e => console.error('ERR:', e.message));
