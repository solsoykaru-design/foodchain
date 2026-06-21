const fs = require('fs');
const lines = fs.readFileSync(__dirname + '\\index.js', 'utf8').split('\n');

function scanFrom(lineIdx, label) {
  let braceDepth = 0, parenDepth = 0, bodyStarted = false;
  let inStr = false, strChar = null;
  let lastLine = '';
  let problemLines = [];
  
  for (let j = lineIdx; j < lines.length; j++) {
    const l = lines[j];
    lastLine = l;
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
      if (ch === '(') { parenDepth++; }
      else if (ch === ')') { parenDepth--; bodyStarted = true; }
      else if (ch === '{') { braceDepth++; if (!bodyStarted) bodyStarted = true; }
      else if (ch === '}') { braceDepth--; }
    }
    if (bodyStarted && braceDepth === 0 && parenDepth === 0) {
      console.log(label + ' END at line ' + (j+1));
      return { endLine: j, endCode: l };
    }
    if (bodyStarted && (braceDepth !== 0 || parenDepth !== 0)) {
      problemLines.push({ line: j+1, brace: braceDepth, paren: parenDepth, text: l.substring(0, 120) });
    }
    if (j - lineIdx > 1000) {
      console.log(label + ' NOT FOUND. Depths brace=' + braceDepth + ' paren=' + parenDepth);
      for (const p of problemLines.slice(-5)) {
        console.log('  Line ' + p.line + ': brace=' + p.brace + ' paren=' + p.paren + ' | ' + p.text);
      }
      return { error: 'not found', depth: {braceDepth, parenDepth, bodyStarted}, lastLine: l };
    }
  }
  return { error: 'EOF', depth: {braceDepth, parenDepth, bodyStarted} };
}

// Test first few routes
const routes = [
  { label: 'staff list', idx: 6022 },
  { label: 'order payment', idx: 10438 },
];
for (const r of routes) {
  const result = scanFrom(r.idx, r.label);
  if (result.endLine) {
    console.log(r.label + ' -> end at line ' + (result.endLine + 1));
  }
}
