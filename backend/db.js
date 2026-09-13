const database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(__dirname,'data', 'POSdb.db');//--dirname to be check on deployment
const db = new database(dbPath, { verbose: console.log });  // verbose logs every query — remove later once stable

db.pragma('journal_mode = WAL'); // better concurrency, safer writes — standard for SQLite apps
db.pragma('foreign_keys = ON');

module.exports = db;