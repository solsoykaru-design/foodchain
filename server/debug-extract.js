const fs = require('fs');
const text = fs.readFileSync(__dirname + '/index.js', 'utf8');

// Test finding auth/login route
const start = text.indexOf("app.post('/api/auth/login'");
console.log('Start index:', start);
const snippet = text.substring(start, start + 200);
console.log('Snippet:', JSON.stringify(snippet));

// Test the extraction
const regex = /^(\s*)app\.(get|post|put|delete|patch)\(/gm;
// Set position near the start
regex.lastIndex = start;
const m = regex.exec(text);
console.log('\nMatch found:', !!m);
if (m) {
  console.log('Match position:', m.index, 'match text:', JSON.stringify(m[0]));
  const after = text.substring(m.index + m[0].length);
  const pathMatch = after.match(/'([^']+)'/);
  console.log('Path:', pathMatch ? pathMatch[1] : 'no path');
  
  // Now try to find the end
  const rest = text.substring(m.index);
  let depth = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    const prev = i > 0 ? rest[i-1] : '';
    
    if (ch === "'" && !inDouble && !inTemplate && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !inTemplate && prev !== '\\') inDouble = !inDouble;
    else if (ch === '`' && !inSingle && !inDouble && prev !== '\\') inTemplate = !inTemplate;
    
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '{') depth += 1000;
      else if (ch === '}') depth -= 1000;
    }
    
    if (depth === 0 && i > 10) {
      console.log('Found end at position:', i);
      console.log('Ending chars:', JSON.stringify(rest.substring(i-5, i+5)));
      console.log('Extracted code length:', rest.substring(0, i+1).length);
      const code = rest.substring(0, i+1);
      console.log('Code ends with:', JSON.stringify(code.slice(-50)));
      break;
    }
  }
}
