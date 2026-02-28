const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// The original line
const oldLine = `        return '<div class="file-card" data-filename="' + file.name + '" data-category="' + category + '" onclick="loadLogFile(\\' + file.name + '\\', this)" style="animation: fadeInUp 0.3s ease forwards; animation-delay: ' + (index * 0.05) + 's; opacity: 0;">' +`;

// The fixed line - using proper escaping for HTML attribute
const newLine = `        return '<div class="file-card" data-filename="' + file.name + '" data-category="' + category + '" onclick="loadLogFile(\\'' + file.name + '\\', this)" style="animation: fadeInUp 0.3s ease forwards; animation-delay: ' + (index * 0.05) + 's; opacity: 0;">' +`;

c = c.replace(oldLine, newLine);
fs.writeFileSync('server.js', c);
console.log('Done');
