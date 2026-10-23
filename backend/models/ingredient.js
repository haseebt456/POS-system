const db = require('../db');
const { recordMovement } = require('./stockMovement');

// An ingredient is normally created with the stock it already has — the shop counts the shelf
// and types it in — so that opening quantity is recorded here rather than appearing as a
// balance with nothing behind it. Wrapped in a transaction for the same reason every other
// two-write path is: a row created but not ledgered is the drift this table exists to prevent.
function createIngredient({ name, unit, stock_qty, low_stock_threshold, is_trackable, created_by = null }) {
    const opening = Number(stock_qty) || 0;

    const insert = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO ingredients (name, unit, stock_qty, low_stock_threshold, is_trackable)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, unit, opening, low_stock_threshold ?? 0, is_trackable ?? 1);

        const id = result.lastInsertRowid;
        recordMovement({
            ingredient_id: id,
            delta: opening,
            reason: 'opening',
            note: 'Opening stock recorded when the ingredient was created',
            created_by,
        });
        return id;
    });

    return insert();
}

function getAllIngredients() {
    return db.prepare(`SELECT * FROM ingredients WHERE is_active = 1`).all();
}

function getIngredientById(id) {
    return db.prepare(`SELECT * FROM ingredients WHERE id = ?`).get(id);
}

// Automatic deduction/addition — called by completeOrder (negative) and purchase receiving (positive)
//
// Kept as the bare primitive it always was, and deliberately not the function the rest of the
// app calls any more: it moves the balance with no record of why. The writing paths use
// applyStockMovement below, which does both.
function adjustStockByDelta(id, quantityChange) {
    const stmt = db.prepare(`UPDATE ingredients SET stock_qty = stock_qty + ? WHERE id = ?`);
    stmt.run(quantityChange, id);
}

// Move stock AND record why, in one call. Every write path goes through here rather than
// adjustStockByDelta, because the two writes have to happen together: a balance that moved with
// no ledger row is exactly the state stock_movements exists to make impossible.
//
// Deliberately not wrapped in a transaction of its own. Its callers — completeOrder, purchase
// receiving — already run inside one, and a nested transaction here would turn a partial order
// completion into something that looks atomic per ingredient while not being atomic per order.
function applyStockMovement({ ingredient_id, delta, reason, ref_type = null, ref_id = null, note = null, created_by = null }) {
    adjustStockByDelta(ingredient_id, delta);
    recordMovement({ ingredient_id, delta, reason, ref_type, ref_id, note, created_by });
}

// Manual reconciliation — operator does a physical count and overwrites the system's number
function setStockAbsolute(id, actualQty) {
    const stmt = db.prepare(`UPDATE ingredients SET stock_qty = ? WHERE id = ?`);
    stmt.run(actualQty, id);
}

// Overwrites stock and records the difference as a movement.
//
// The delta is read *before* the write, because after it the number it was measured against is
// gone — and the difference is the only part of a stock count anyone learns anything from. A
// count that finds what the system already said records nothing, which is correct: nothing
// changed, and a ledger row saying "0" would bury the rows that matter.
function setStockWithMovement({ ingredient_id, actual_qty, reason = 'adjustment', note = null, created_by = null }) {
    const before = getIngredientById(ingredient_id);
    if (!before) throw new Error(`Ingredient ${ingredient_id} not found`);

    const actual = Number(actual_qty);
    if (!Number.isFinite(actual) || actual < 0) {
        throw new Error(`Stock for ${before.name} is not a number of zero or more`);
    }

    const delta = actual - before.stock_qty;

    setStockAbsolute(ingredient_id, actual);
    recordMovement({ ingredient_id, delta, reason, note, created_by });

    return { delta, before: before.stock_qty, after: actual };
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

// Applies a whole physical count at once. Wrapped in a transaction because a
// half-applied stock count is worse than none — the operator would have no way to
// tell which rows took and which didn't, and the numbers would be quietly wrong.
// Reuses setStockWithMovement so there's exactly one place that overwrites stock —
// and so a count leaves a ledger row per ingredient it actually changed.
function reconcileStock(entries, { created_by = null, note = null } = {}) {
    const apply = db.transaction(() => {
        let changed = 0;
        for (const entry of entries) {
            const { delta } = setStockWithMovement({
                ingredient_id: entry.id,
                actual_qty: entry.actual_qty,
                reason: 'adjustment',
                note: note ?? 'Physical stock count',
                created_by,
            });
            if (delta !== 0) changed += 1;
        }
        return changed;
    });

    return apply();
}

module.exports = {
    createIngredient,
    getAllIngredients,
    getIngredientById,
    adjustStockByDelta,
    applyStockMovement,
    setStockAbsolute,
    setStockWithMovement,
    getLowStock,
    deactivateIngredient,
    reconcileStock
};