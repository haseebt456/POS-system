const db = require('../db');

function createStation({ name, printer_type, connection_type, ip_address }) {
    const stmt = db.prepare(`
        INSERT INTO stations (name, printer_type, connection_type, ip_address)
        VALUES (?, ?, ?, ?)
    `);
    return stmt.run(name, printer_type, connection_type ?? null, ip_address ?? null).lastInsertRowid;
}

function getAllStations() {
    return db.prepare(`SELECT * FROM stations WHERE is_active = 1`).all();
}

module.exports = { createStation, getAllStations };
