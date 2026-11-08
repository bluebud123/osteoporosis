const { runAll } = require('./cases.js'); const r = runAll();
r.rows.forEach(x => { console.log((x.pass ? 'PASS ' : 'FAIL ') + x.id + ' ' + x.expected + ' ' + x.title); if (!x.pass) x.checks.filter(c => !c[1]).forEach(c => console.log('     x ' + c[0])); });
console.log('\n' + r.passed + '/' + r.total + ' cases pass'); console.log(JSON.stringify(r.headline)); process.exit(r.passed === r.total ? 0 : 1);
