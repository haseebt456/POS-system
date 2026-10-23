
const db = require('../db');

function createSupplier({ name, contact_number, address, email, is_active = 1 }) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('A supplier needs a name');
    const stmt = db.prepare(`
        INSERT INTO suppliers (name, contact_number, address, email, balance_owed_cents, is_active)
        VALUES (?, ?, ?, ?, 0, ?)
    `);
    return stmt.run(
        trimmed,
        contact_number ? String(contact_number).trim() : null,
        address ? String(address).trim() : null,
        email ? String(email).trim() : null,
        is_active ? 1 : 0
    ).lastInsertRowid;
}

function updateSupplier(id, { name, contact_number, address, email, is_active }) {
    const existing = getSupplierById(id);
    if (!existing) throw new Error(`Supplier ${id} not found`);

    const trimmed = name == null ? existing.name : String(name).trim();
    if (!trimmed) throw new Error('A supplier needs a name');

    // balance_owed_cents is deliberately not in this UPDATE. It only moves as a side
    // effect of a purchase or a payment, both of which leave a row explaining why.
    db.prepare(`
        UPDATE suppliers SET name = ?, contact_number = ?, address = ?, email = ?, is_active = ?
        WHERE id = ?
    `).run(
        trimmed,
        contact_number === undefined
            ? existing.contact_number
            : (contact_number ? String(contact_number).trim() : null),
        address === undefined
            ? existing.address
            : (address ? String(address).trim() : null),
        email === undefined
            ? existing.email
            : (email ? String(email).trim() : null),
        is_active === undefined ? existing.is_active : (is_active ? 1 : 0),
        id
    );
    return getSupplierById(id);
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

module.exports = { createSupplier, updateSupplier, getAllSuppliers, getSupplierById, adjustSupplierBalance };