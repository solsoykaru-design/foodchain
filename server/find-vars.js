const fs = require('fs');
const lines = fs.readFileSync(__dirname + '\\index.js', 'utf8').split('\n');

// All config variables used by route files
const configVarSet = new Set();
const routeDir = __dirname + '\\routes';
for (const file of fs.readdirSync(routeDir)) {
  if (!file.endsWith('.js')) continue;
  const c = fs.readFileSync(routeDir + '/' + file, 'utf8');
  const m = c.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*config/);
  if (m) {
    m[1].split(',').map(v => v.trim()).filter(Boolean).forEach(v => configVarSet.add(v));
  }
}

// Search for their definitions
for (const v of [...configVarSet].sort()) {
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:const|let|var|function)\\s+' + escaped + '\\b');
    if (re.test(lines[i])) {
      console.log(v + ': line ' + (i+1) + ' | ' + lines[i].trim().substring(0, 120));
      found = true;
      break;
    }
  }
  if (!found) {
    for (let i = 0; i < lines.length; i++) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped + '\\s*=\\s*require\\(');
      if (re.test(lines[i])) {
        console.log(v + ': line ' + (i+1) + ' (require) | ' + lines[i].trim().substring(0, 120));
        found = true;
        break;
      }
    }
  }
  if (!found) {
    console.log(v + ': NOT FOUND');
  }
}
