const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Find the broken line
const search = `onclick="loadLogFile(\\\' + file.name + \\\', this)"`;
// Replace with properly escaped version  
const replace = `onclick="loadLogFile(\\\\\\' + file.name + \\\\\\'\\, this)"`;

c = c.split(search).join(replace);
fs.writeFileSync('server.js', c);
console.log('Done');
