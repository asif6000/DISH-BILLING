try {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t(a INTEGER, b TEXT)');
  db.prepare('INSERT INTO t VALUES (?,?)').run(1, 'hello');
  console.log('node:sqlite OK, rows:', JSON.stringify(db.prepare('SELECT * FROM t').all()));
} catch (e) { console.log('node:sqlite FAIL:', e.message); }
console.log('node', process.versions.node, '/ electron', process.versions.electron);
