const fs = require('fs');
const lines = fs.readFileSync(__dirname + '\\index.js', 'utf8').split('\n');

function debugLines(start, count) {
  let braceDepth = 0, parenDepth = 0, bodyStarted = false;
  let inStr = false, strChar = null;

  for (let j = start; j < Math.min(start + count, lines.length); j++) {
    const l = lines[j];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k];
      const prev = k > 0 ? l[k-1] : '';
      if (!inStr) {
        if ((ch === "'" || ch === '"' || ch === '`') && prev !== '\\') {
          inStr = true; strChar = ch;
        }
      } else if (ch === strChar && prev !== '\\') {
        inStr = false; strChar = null; continue;
      }
      if (inStr) continue;
      if (ch === '(') parenDepth++;
      else if (ch === ')') { parenDepth--; bodyStarted = true; }
      else if (ch === '{') { braceDepth++; if (!bodyStarted) bodyStarted = true; }
      else if (ch === '}') braceDepth--;
    }
    console.log('Line ' + (j+1) + ': B=' + braceDepth + ' P=' + parenDepth + ' inStr=' + (inStr ? strChar : 'false') + ' body=' + bodyStarted + ' | ' + l.trim().substring(0, 120));
    if (bodyStarted && braceDepth === 0 && parenDepth === 0) {
      console.log('  >>> HANDLER END <<<');
      break;
    }
  }
}

console.log('=== STAFF LIST (line 6022) ===');
debugLines(6021, 50);
