// Ejecuta todas las pruebas: node tests/run.js
const fs = require('fs');
const path = require('path');
for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort()) {
  console.log('\n=== ' + f + ' ===');
  require(path.join(__dirname, f));
}
require('./harness.js').summary();
