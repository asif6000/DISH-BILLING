try {
  console.log('node', process.versions.node, '/ electron', process.versions.electron);
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t(a)');
  console.log('node:sqlite OK');
  process.exit(0);
} catch (e) { console.log('FAIL:', e.message); process.exit(1); }
