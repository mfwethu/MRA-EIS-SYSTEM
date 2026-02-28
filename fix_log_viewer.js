const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Find and replace the problematic line
const oldStr = "loadLogFile(\\'' + file.name + '\\', this)";
const newStr = "loadLogFile(\\\\\\' + file.name + \\\\\\', this)";

c = c.replace(new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newStr);

fs.writeFileSync('server.js', c);
console.log('Done');
