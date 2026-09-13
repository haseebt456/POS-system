const db  = require('./db');

console.log("sqllite connscted. DB file at :", db.name);

db.exec('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, note TEXT)');
db.prepare('INSERT INTO test_table (note) VALUES (?)').run('Hello, world!');

const row = db.prepare('SELECT * FROM test_table').all();

console.log("test read",row);
db.exec('DROP TABLE test_table');
console.log('Cleanup done. Step 1 confirmed working.');