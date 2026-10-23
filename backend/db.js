const database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// POS_DB_PATH lets the test runner point at a throwaway database instead of the shop's
// live one. Everything else resolves to backend/data/POSdb.db.
const dbPath = process.env.POS_DB_PATH
  ? path.resolve(process.env.POS_DB_PATH)
  : path.join(__dirname, 'data', 'POSdb.db');

// A fresh clone has no data/ directory, and a custom POS_DB_PATH may name a directory that
// doesn't exist yet either. mkdirSync with recursive is a no-op when it already exists.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// No `verbose` hook. It printed every statement to the console, which buried the server's
// own output — useful while the schema was settling, pure noise now.
const db = new database(dbPath);

db.pragma('journal_mode = WAL'); // better concurrency, safer writes — standard for SQLite apps
db.pragma('foreign_keys = ON');

module.exports = db;
