const fs = require('fs');
const text = fs.readFileSync(__dirname + '/index.js', 'utf8');

// Replicate the extraction logic exactly
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
    console.log('Found login route at', startIdx);
    console.log('match[0]:', JSON.stringify(match[0]));
    
    // Find end
    const rest = text.substring(startIdx);
    let depth = 0;
    let inSingle = false, inDouble = false, inTemplate = false;
    let foundEnd = false;
    let endPos = 0;
    
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
      
      if (depth === 0 && i > 0) {
        endPos = i;
        foundEnd = true;
        break;
      }
    }
    
    if (foundEnd) {
      const code = rest.substring(0, endPos + 1);
      console.log('Code length:', code.length);
      console.log('Code ends with:', JSON.stringify(code.slice(-60)));
      console.log('Code preview:', JSON.stringify(code.substring(0, 300)));
    } else {
      console.log('END NOT FOUND');
    }
    break;
  }
  count++;
}
console.log('Total matches before:', count);
