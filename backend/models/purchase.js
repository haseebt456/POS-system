const db = require('../db');
const { adjustStockByDelta } = require('./ingredient');
const { adjustSupplierBalance } = require('./supplier');

// Creates a purchase: records the transaction, adds stock for every ingredient
// received, and increases the supplier's balance by whatever wasn't paid
// upfront. All in one transaction — a purchase either fully applies or not at all.
//
// items: [{ ingredient_id, quantity, unit_cost_cents }]
function createPurchase({ supplier_id, items, amount_paid_cents = 0, created_by }) {
    const total_amount_cents = items.reduce((sum, i) => sum + i.quantity * i.unit_cost_cents, 0);

    const insertPurchase = db.prepare(`
        INSERT INTO purchases (supplier_id, total_amount_cents, amount_paid_cents, created_by)
        VALUES (?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
        INSERT INTO purchase_items (purchase_id, ingredient_id, quantity, unit_cost_cents)
        VALUES (?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
        INSERT INTO supplier_payments (supplier_id, purchase_id, amount_cents)
        VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
        const purchaseResult = insertPurchase.run(supplier_id, total_amount_cents, amount_paid_cents, created_by);
        const purchaseId = purchaseResult.lastInsertRowid;

        for (const item of items) {
            insertItem.run(purchaseId, item.ingredient_id, item.quantity, item.unit_cost_cents);
            // Stock goes UP on a purchase — positive delta, opposite of order completion
            adjustStockByDelta(item.ingredient_id, item.quantity);
        }

        const amountOwed = total_amount_cents - amount_paid_cents;
        adjustSupplierBalance(supplier_id, amountOwed);

        if (amount_paid_cents > 0) {
            insertPayment.run(supplier_id, purchaseId, amount_paid_cents);
        }

        return purchaseId;
    });

    const purchaseId = transaction();
    return { purchaseId, total_amount_cents };
}

// A payment made separately from the original purchase — e.g. paying down
// an existing balance later, possibly not tied to one specific purchase.
function recordSupplierPayment({ supplier_id, purchase_id = null, amount_cents }) {
    const insertPayment = db.prepare(`
        INSERT INTO supplier_payments (supplier_id, purchase_id, amount_cents)
        VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
        insertPayment.run(supplier_id, purchase_id, amount_cents);
        adjustSupplierBalance(supplier_id, -amount_cents);
    });

    transaction();
}

// The history list. purchase_date is CURRENT_TIMESTAMP — second resolution — so two
// deliveries recorded in the same second would tie and the "newest first" order would
// wobble between refreshes. id DESC breaks the tie in insertion order.
function getAllPurchases() {
    return db.prepare(`SELECT * FROM purchases ORDER BY purchase_date DESC, id DESC`).all();
}

function getPurchasesForSupplier(supplier_id) {
    return db.prepare(`SELECT * FROM purchases WHERE supplier_id = ? ORDER BY purchase_date DESC`).all(supplier_id);
}

function getPaymentsForSupplier(supplier_id) {
    return db.prepare(`SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY paid_date DESC`).all(supplier_id);
}

function getPurchaseWithItems(purchase_id) {
    const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchase_id);
    if (!purchase) return null;
    const items = db.prepare(`
        SELECT pi.*, i.name AS ingredient_name, i.unit
        FROM purchase_items pi
        JOIN ingredients i ON i.id = pi.ingredient_id
        WHERE pi.purchase_id = ?
    `).all(purchase_id);
    return { ...purchase, items };
}

module.exports = {
    createPurchase,
    recordSupplierPayment,
    getAllPurchases,
    getPurchasesForSupplier,
    getPaymentsForSupplier,
    getPurchaseWithItems,
};