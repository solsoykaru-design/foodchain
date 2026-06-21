const fs = require('fs');
const text = fs.readFileSync(__dirname + '/index.js', 'utf8');

const regex = /^(\s*)app\.(get|post|put|delete|patch)\(/gm;
let match;
let count = 0;

while ((match = regex.exec(text)) !== null) {
  const startIdx = match.index;
  const method = match[2];
  
  const afterApp = text.substring(startIdx + match[0].length);
  const pathMatch = afterApp.match(/'([^']+)'/);
  if (!pathMatch) continue;
  const routePath = pathMatch[1];
  
  if (routePath === '/api/auth/login') {
    console.log('Found login route');
    console.log('match[0]:', JSON.stringify(match[0]));
    console.log('startIdx:', startIdx);
    console.log('First 50 chars of file at that position:', JSON.stringify(text.substring(startIdx, startIdx+50)));
    
    const rest = text.substring(startIdx);
    console.log('First 50 of rest:', JSON.stringify(rest.substring(0, 50)));
    
    let depth = 0;
    let inSingle = false, inDouble = false, inTemplate = false;
    let foundEnd = false;
    let endPos = 0;
    let depthHistory = [];
    
    for (let i = 0; i < 100; i++) {
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
      
      depthHistory.push({i, ch, depth, inSingle, inDouble});
      
      if (depth === 0 && i > 0) {
        console.log('Depth returned to 0 at position', i, 'char:', JSON.stringify(ch));
        console.log('History of first 20 chars:');
        for (let h = 0; h < Math.min(20, depthHistory.length); h++) {
          console.log(`  ${h}: '${depthHistory[h].ch}' depth=${depthHistory[h].depth} s=${depthHistory[h].inSingle} d=${depthHistory[h].inDouble}`);
        }
        foundEnd = true;
        endPos = i;
        break;
      }
    }
    
    if (foundEnd) {
      console.log('End found at', endPos);
      const code = rest.substring(0, endPos + 1);
      console.log('Code length:', code.length);
      console.log('Code:', JSON.stringify(code.substring(0, 200)));
    }
    break;
  }
  count++;
}
