/**
 * Fix: add variation to temperature and shelf_life for non-AI dishes.
 */
const Database = require('better-sqlite3');
const db = new Database('foodchain.db');

const TEMP_VARIANTS = {
  'Суп': ['65-70°C','70-75°C','65°C','70°C'],
  'Салат': ['8-12°C','10-14°C','12°C','6-10°C'],
  'Горячее': ['65-70°C','70-75°C','65°C','75°C'],
  'Закуска': ['10-14°C','12°C','8-12°C','14°C'],
  'Десерт': ['4-6°C','6°C','2-4°C','5°C'],
  'Выпечка': ['20-25°C','18°C','22°C','комнатная'],
  'Паста': ['65-70°C','70°C','65°C','60-65°C'],
  'Пицца': ['60-65°C','65-70°C','60°C','65°C'],
  'Роллы': ['8-12°C','10-14°C','12°C','6-10°C'],
  'Напиток': ['2-4°C','4-6°C','2°C','5°C'],
};

const SHELF_VARIANTS = {
  'Суп': ['24ч при 2-6°C','48ч при 2-6°C','36ч при 2-6°C','24 часа'],
  'Салат': ['6ч при 2-6°C','12ч при 2-6°C','8ч при 2-6°C','6 часов'],
  'Горячее': ['24ч при 2-6°C','48ч при 2-6°C','36ч при 2-6°C','24 часа'],
  'Закуска': ['6ч при 2-6°C','12ч при 2-6°C','24ч при 2-6°C','6 часов'],
  'Десерт': ['24ч при 2-6°C','48ч при 2-6°C','36ч при 2-6°C','12 часов'],
  'Выпечка': ['72ч при 2-6°C','48ч при 2-6°C','36ч при 2-6°C','3 суток'],
  'Паста': ['12ч при 2-6°C','24ч при 2-6°C','18ч при 2-6°C','12 часов'],
  'Пицца': ['12ч при 2-6°C','24ч при 2-6°C','18ч при 2-6°C','12 часов'],
  'Роллы': ['6ч при 2-6°C','12ч при 2-6°C','24ч при 2-6°C','6 часов'],
  'Напиток': ['24ч при 2-6°C','48ч при 2-6°C','36ч при 2-6°C','24 часа'],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Only fix dishes that DON'T have AI-generated description (no ingredients)
const rows = db.prepare("SELECT id, name, category FROM dish_catalog WHERE description NOT LIKE '%Ингредиенты%'").all();
console.log('Fixing ' + rows.length + ' non-AI dishes...');

const update = db.prepare('UPDATE dish_catalog SET temperature = ?, shelf_life = ? WHERE id = ?');
const tx = db.transaction((items) => {
  for (const r of items) {
    const cat = r.category || 'Горячее';
    const temps = TEMP_VARIANTS[cat] || TEMP_VARIANTS['Горячее'];
    const shelves = SHELF_VARIANTS[cat] || SHELF_VARIANTS['Горячее'];
    update.run(pick(temps), pick(shelves), r.id);
  }
});

tx(rows);

const sample = db.prepare("SELECT name, category, temperature, shelf_life FROM dish_catalog LIMIT 10").all();
console.log('\nSample after fix:');
for (const s of sample) console.log(`  ${s.name} | ${s.category} | ${s.temperature} | ${s.shelf_life}`);

const distinct = db.prepare("SELECT COUNT(DISTINCT temperature || shelf_life) as c FROM dish_catalog").get().c;
console.log('\nUnique temp+shelf combos:', distinct);
db.close();
