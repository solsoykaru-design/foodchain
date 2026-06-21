const fs = require('fs');
const lines = fs.readFileSync(__dirname + '\\index.js', 'utf8').split('\n');

const start = 6021; // line 6022
let inStr = false, strChar = null;

for (let j = start; j < Math.min(start + 20, lines.length); j++) {
  const l = lines[j];
  const beforeInStr = inStr;
  for (let k = 0; k < l.length; k++) {
    const ch = l[k];
    const prev = k > 0 ? l[k-1] : '';
    if (!inStr) {
      if ((ch === "'" || ch === '"' || ch === '`') && prev !== '\\') {
        inStr = true; strChar = ch;
        console.log('OPEN STR at line ' + (j+1) + ' col ' + (k+1) + ' char=' + ch + ' context: ...' + l.substring(Math.max(0,k-5), k+10) + '...');
      }
    } else if (ch === strChar && prev !== '\\') {
      inStr = false;
      console.log('CLOSE STR at line ' + (j+1) + ' col ' + (k+1) + ' char=' + ch + ' context: ...' + l.substring(Math.max(0,k-5), k+10) + '...');
    }
  }
  console.log('Line ' + (j+1) + ': inStr=' + (inStr ? strChar : 'false') + ' | ' + l.trim().substring(0, 120));
}
