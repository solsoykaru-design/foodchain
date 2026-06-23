var D = require('better-sqlite3');
var bcrypt = require('bcrypt');
var hash = bcrypt.hashSync('admi1', 10);
console.log('Generated hash:', hash);

// Portal
var pdb = new D('portal.db');
pdb.prepare('UPDATE staff_accounts SET password_hash = ? WHERE username = ?').run(hash, 'admi1');
console.log('Portal updated');

// Main server
var mdb = new D('D:\\program\\server\\foodchain.db');
mdb.prepare('UPDATE staff SET password = ? WHERE username = ?').run(hash, 'admi1');
console.log('Main server updated');

// Verify
var ph = pdb.prepare('SELECT password_hash FROM staff_accounts WHERE username = ?').get('admi1').password_hash;
console.log('Portal verify:', bcrypt.compareSync('admi1', ph));

var mh = mdb.prepare('SELECT password FROM staff WHERE username = ?').get('admi1').password;
console.log('Main verify:', bcrypt.compareSync('admi1', mh));
