const r = await fetch('https://foodchain-qpxh.onrender.com/api/health');
const d = await r.json();
console.log('uptime:', d.uptime, 's');

const r2 = await fetch('https://foodchain-qpxh.onrender.com/admin/');
const html = await r2.text();
const m = html.match(/src="\.\/assets\/([^"]+\.js)"/);
console.log('admin JS:', m ? m[1] : 'not found');

const r3 = await fetch('https://foodchain-qpxh.onrender.com/api/auth/admin-login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:'admin',password:'admin'}) });
const t3 = await r3.text();
console.log('admin:admin:', r3.status, t3.slice(0,80));

const r4 = await fetch('https://foodchain-qpxh.onrender.com/portal/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'test@test.com',password:'test123'}) });
const t4 = await r4.text();
console.log('portal login:', r4.status, t4.slice(0,80));

const r5 = await fetch('https://foodchain-qpxh.onrender.com/api/internal/sync-tenant', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) });
console.log('internal sync:', r5.status, (await r5.text()).slice(0,80));
