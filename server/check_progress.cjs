const Database = require('better-sqlite3');
const db = new Database('foodchain.db');

const olivier = db.prepare("SELECT name, category, temperature, shelf_life, cooking_time FROM dish_catalog WHERE name = 'Оливье'").all();
console.log('Оливье in DB:');
for (const o of olivier) console.log(JSON.stringify(o));

const allOlivier = db.prepare("SELECT name, category, temperature, shelf_life FROM dish_catalog WHERE name LIKE '%Оливье%'").all();
console.log('\nAll Оливье variants (' + allOlivier.length + '):');
for (const o of allOlivier) console.log(o.name + ' | ' + o.category + ' | ' + o.temperature + ' | ' + o.shelf_life);

console.log('\nCheck if server is running:');
const http = require('http');
const req = http.get('http://localhost:3001/api/mobile/catalog?search=Оливье&limit=5', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('API response:');
      if (json.items) for (const i of json.items) console.log(i.name + ' | ' + i.category + ' | ' + i.temperature + ' | ' + i.shelf_life);
    } catch { console.log('Raw:', data.slice(0, 500)); }
  });
});
req.on('error', (e) => console.log('Server not running:', e.message));
req.end();
db.close();
