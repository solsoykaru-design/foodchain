/**
 * AI-generate tech cards for ALL 5000 dishes in dish_catalog.
 * Batch: 20 dishes per call, deepseek-v4-flash-free.
 * Resume support: saves progress to ai_progress.json.
 * 
 * Run: node seed-ai-5000.js
 */

const path = require('path');
const fs = require('fs');

// Force unbuffered stdout for log redirect
if (process.stdout._handle) process.stdout._handle.setBlocking(true);
if (process.stderr._handle) process.stderr._handle.setBlocking(true);

// Log to file directly (flush immediately)
const LOG_PATH = path.join(__dirname, 'seed-ai-5000.log');
function log(msg) {
  const line = `${new Date().toISOString().slice(11,19)} ${msg}`;
  console.log(msg);
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
}
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const DB_PATH = path.join(__dirname, 'foodchain.db');
const PROGRESS_PATH = path.join(__dirname, 'ai_progress.json');
const API_URL = 'https://opencode.ai/zen/v1/chat/completions';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';
const BATCH_SIZE = 5;

const PROMPT_PREFIX = `Ты технолог общественного питания. Составь технологические карты для списка блюд.

Для КАЖДОГО блюда верни объект в массиве JSON (строго):
{
  "name": "название (не менять)",
  "category": "Суп|Салат|Горячее|Закуска|Десерт|Выпечка|Паста|Пицца|Роллы|Напиток",
  "ingredients": [{"name":"ингредиент на русском","quantity":число,"unit":"г"}],
  "kbju": {"calories":число,"proteins":число,"fats":число,"carbs":число},
  "output_g": число,
  "cooking_time_min": число,
  "technology": "технология на русском, 1-2 предложения",
  "temperature": "температура подачи",
  "shelf_life": "срок хранения"
}

ВАЖНО:
- Названия НЕ менять, писать как в запросе
- 3-5 ингредиентов, quantity в граммах на 1 порцию
- КБЖУ на 100г
- Технология кратко
- Категорию определить самостоятельно

Список блюд:`;

const CATEGORY_DATA = {
  'Суп': { temp:'65-75°C', shelf:'48ч при 2-6°C' },
  'Салат': { temp:'10-14°C', shelf:'6ч при 2-6°C' },
  'Горячее': { temp:'65-75°C', shelf:'24ч при 2-6°C' },
  'Закуска': { temp:'10-14°C', shelf:'6ч при 2-6°C' },
  'Десерт': { temp:'4-6°C', shelf:'24ч при 2-6°C' },
  'Выпечка': { temp:'20-25°C', shelf:'72ч при 2-6°C' },
  'Паста': { temp:'65-70°C', shelf:'12ч при 2-6°C' },
  'Пицца': { temp:'60-70°C', shelf:'12ч при 2-6°C' },
  'Роллы': { temp:'10-14°C', shelf:'6ч при 2-6°C' },
  'Напиток': { temp:'2-6°C', shelf:'24ч при 2-6°C' },
};

function loadProgress() {
  try { return JSON.parse(require('fs').readFileSync(PROGRESS_PATH, 'utf8')); } catch { return { completed: [], total: 0 }; }
}

function saveProgress(state) {
  require('fs').writeFileSync(PROGRESS_PATH, JSON.stringify(state), 'utf8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function queryAI(names, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
        await sleep(delay);
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-v4-flash-free',
          messages: [
            { role: 'system', content: 'Output ONLY a valid JSON array. No markdown, no explanations, no extra text.' },
            { role: 'user', content: PROMPT_PREFIX + '\n' + names.map(n => `- ${n}`).join('\n') }
          ],
          temperature: 0.3,
          max_tokens: 32768,
        }),
        signal: AbortSignal.timeout(180000),
      });

      const text = await res.text();
      if (!res.ok) {
        if (res.status === 503 && attempt < retries) continue;
        throw new Error(`HTTP ${res.status}`);
      }

      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content || '';
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error('No JSON array');

      return JSON.parse(content.slice(start, end + 1));
    } catch (e) {
      if (attempt >= retries) throw e;
      if (e.message.includes('fetch failed') && attempt < retries) {
        await sleep(10000);
        continue;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

async function main() {
  const startTime = Date.now();
  log('🧠 AI-generating tech cards for 5000 dishes...\n');
  log(`Batch size: ${BATCH_SIZE}, Model: deepseek-v4-flash-free\n`);

  const db = new Database(DB_PATH);
  const prog = loadProgress();
  
  // Get all unique dish names from DB
  const allRows = db.prepare('SELECT id, name, cuisine FROM dish_catalog ORDER BY cuisine, name').all();
  const allNames = allRows.map(r => r.name);
  const completed = new Set(prog.completed || []);
  const total = allNames.length;

  log(`Total dishes: ${total}`);
  log(`Already completed: ${completed.size}`);
  log(`Remaining: ${total - completed.size}\n`);

  if (completed.size >= total) {
    log('✅ All dishes already processed!');
    db.close();
    return;
  }

  // Batch unprocessed names
  const unprocessed = allNames.filter(n => !completed.has(n));

  const update = db.prepare(`UPDATE dish_catalog SET
    category = ?, description = ?, temperature = ?, shelf_life = ?,
    output = ?, cooking_time = ?, calories = ?, proteins = ?, fats = ?, carbs = ?, technology = ?
    WHERE name = ?`);

  let updated = 0;
  let failed = 0;
  let batchNum = 0;
  const totalBatches = Math.ceil(unprocessed.length / BATCH_SIZE);

  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = unprocessed.slice(i, i + BATCH_SIZE);
    
    const batchPrefix = `[${batchNum}/${totalBatches}] ${batch[0]}...${batch.length > 1 ? ' +' + (batch.length-1) : ''}... `;
    process.stdout.write(batchPrefix);

    try {
      const result = await queryAI(batch);
      log(`${batchPrefix}✓ ${result.length} tech cards (${Math.round((completed.size + updated + failed) / total * 100)}%)`);

      for (const item of result) {
        if (!item || !item.name) continue;
        const base = allRows.find(r => r.name.toLowerCase() === item.name.toLowerCase());
        if (!base) continue;

        const kbju = item.kbju || {};
        const cat = item.category || '';
        const cd = CATEGORY_DATA[cat] || { temp: '', shelf: '' };
        const ingStr = (item.ingredients || []).map(i => `${i.name} ${i.quantity}${i.unit}`).join(', ');
        const desc = `${base.cuisine} кухня. Категория: ${cat}. Ингредиенты: ${ingStr || '—'}. Выход: ${item.output_g || 0} г.`;

        update.run(
          cat, desc,
          item.temperature || cd.temp,
          item.shelf_life || cd.shelf,
          item.output_g || 0,
          item.cooking_time_min || 0,
          kbju.calories || 0, kbju.proteins || 0, kbju.fats || 0, kbju.carbs || 0,
          item.technology || '',
          base.name
        );
        updated++;
        completed.add(base.name);
      }
    } catch (e) {
      const errMsg = `✗ ${e.message.slice(0, 80)}`;
      process.stdout.write(errMsg + '\n');
      log(`${batchPrefix}${errMsg}`);
      failed += batch.length;
    }

    // Save progress every batch + rate-limit delay
    saveProgress({ completed: [...completed], total });
    const progMsg = `  [${completed.size}/${total}]`;
    process.stdout.write(progMsg + '\n');
    log(`${batchPrefix}${progMsg}`);

    // Heartbeat every 5 batches
    if (batchNum % 5 === 0) log(`[HEARTBEAT] batch ${batchNum}/${totalBatches}, updated ${updated}, failed ${failed}, running ${Math.round((Date.now() - startTime) / 1000)}s`);

    // Delay between batches to avoid 503
    if (i + BATCH_SIZE < unprocessed.length) {
      await sleep(10000 + Math.random() * 5000);
    }
  }

  saveProgress({ completed: [...completed], total });

  const stats = db.prepare("SELECT COUNT(1) as c FROM dish_catalog WHERE calories > 0").get().c;
  log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}`);
  log(`   Dishes with calories: ${stats}/${total}`);

  const sample = db.prepare("SELECT name, category, calories, output, cooking_time FROM dish_catalog WHERE calories > 0 LIMIT 5").all();
  log('\nSample:');
  for (const s of sample) log(`  ${s.name}: ${s.calories} kcal, ${s.output}g, ${s.cooking_time}min`);

  db.close();
}

process.on('uncaughtException', (e) => { log(`💥 UNCAUGHT: ${e.message}\n${e.stack}`); process.exit(1); });
process.on('unhandledRejection', (e) => { log(`💥 UNHANDLED: ${e.message}`); });

main().catch(e => { log(`❌ FATAL: ${e.message}\n${e.stack}`); process.exit(1); });
