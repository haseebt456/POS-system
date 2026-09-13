const db = require('../db');

function createIngredient({ name, unit, stock_qty, low_stock_threshold, is_trackable }) {
    const stmt = db.prepare(`
        INSERT INTO ingredients (name, unit, stock_qty, low_stock_threshold, is_trackable)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        name,
        unit,
        stock_qty ?? 0,
        low_stock_threshold ?? 0,
        is_trackable ?? 1
    );
    return result.lastInsertRowid;
}

function getAllIngredients() {
    return db.prepare(`SELECT * FROM ingredients WHERE is_active = 1`).all();
}

function getIngredientById(id) {
    return db.prepare(`SELECT * FROM ingredients WHERE id = ?`).get(id);
}

// Automatic deduction/addition — called by completeOrder (negative) and purchase receiving (positive)
function adjustStockByDelta(id, quantityChange) {
    const stmt = db.prepare(`UPDATE ingredients SET stock_qty = stock_qty + ? WHERE id = ?`);
    stmt.run(quantityChange, id);
}

// Manual reconciliation — operator does a physical count and overwrites the system's number
function setStockAbsolute(id, actualQty) {
    const stmt = db.prepare(`UPDATE ingredients SET stock_qty = ? WHERE id = ?`);
    stmt.run(actualQty, id);
}

function getLowStock() {
    // Only meaningful for trackable ingredients — untrackable items (ketchup, sauces)
    // never get an automatic number worth alerting on
    return db.prepare(`
        SELECT * FROM ingredients
        WHERE is_trackable = 1 AND stock_qty <= low_stock_threshold AND is_active = 1
    `).all();
}

function deactivateIngredient(id) {
    db.prepare(`UPDATE ingredients SET is_active = 0 WHERE id = ?`).run(id);
}

module.exports = {
    createIngredient,
    getAllIngredients,
    getIngredientById,
    adjustStockByDelta,
    setStockAbsolute,
    getLowStock,
    deactivateIngredient
};