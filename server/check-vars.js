const fs = require('fs');
const content = fs.readFileSync(__dirname + '/index.refactored.js', 'utf8');

const configMatch = content.match(/const config = \{([^}]+)\}/);
if (!configMatch) { console.log('ERROR: config object not found'); process.exit(1); }

const configVars = configMatch[1].split(',').map(v => v.trim().replace(/\n/g, '').trim()).filter(Boolean);

const definedVars = new Set();
const lines = content.split('\n');
let configLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const config = {')) { configLine = i; break; }
}

for (let i = 0; i < configLine; i++) {
  const m = lines[i].match(/^\s*(?:const|let|var|function)\s+(\w+)/);
  if (m) definedVars.add(m[1]);
}

const missing = configVars.filter(v => !definedVars.has(v));
if (missing.length) {
  console.log('MISSING in config:', missing.join(', '));
} else {
  console.log('All config vars defined ✓');
}
console.log('Config vars count:', configVars.length);

// Check for hoisted require imports
const missingImports = configVars.filter(v => {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`require`)) {
      const m = lines[i].match(/^\s*const\s+(\w+)\s*=\s*require\(/);
      if (m && m[1] === v) return false;
    }
  }
  return !definedVars.has(v);
});
if (missingImports.length) {
  console.log('Also missing as require imports:', missingImports.join(', '));
}
