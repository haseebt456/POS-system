
const db = require('../db');

function createSupplier({ name, contact_number }) {
    const stmt = db.prepare(`
        INSERT INTO suppliers (name, contact_number, balance_owed_cents)
        VALUES (?, ?, 0)
    `);
    return stmt.run(name, contact_number ?? null).lastInsertRowid;
}

function getAllSuppliers() {
    return db.prepare(`SELECT * FROM suppliers ORDER BY name ASC`).all();
}

function getSupplierById(id) {
    return db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id);
}

// Internal helper — only ever called from within purchase.js's transactions,
// never called directly from a route. Balance is a derived running total,
// not something a user edits by hand.
function adjustSupplierBalance(supplierId, deltaCents) {
    db.prepare(`UPDATE suppliers SET balance_owed_cents = balance_owed_cents + ? WHERE id = ?`).run(deltaCents, supplierId);
}

module.exports = { createSupplier, getAllSuppliers, getSupplierById, adjustSupplierBalance };