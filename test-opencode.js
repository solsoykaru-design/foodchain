const k = 'sk-Qh0LRmRShhI6TTd2KA3PoNiiaMKCg6OJvBfsY9qVb3JyPgBSrZS6HO22B6a0HblV';
const https = require('https');
const body = JSON.stringify({model:'deepseek-v4-flash-free',messages:[{role:'user',content:'Say hi as JSON: {msg:hi}'}],temperature:0.3,max_tokens:100});
const url = new URL('https://opencode.ai/zen/v1/chat/completions');
const req = https.request(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},timeout:20000},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log('status:',res.statusCode,'body:',d.slice(0,500)))});
req.on('error',e=>console.log('ERROR:',e.message));
req.write(body);
req.end();
