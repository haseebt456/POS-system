const db = require('../db');

// How an order was paid. Seeded by migrate.js with Cash / Card / JazzCash / Easypaisa;
// edited in Settings → POS Configuration (M7), which is why nothing here hard-codes them.
//
// Both roles read this list: an operator has to pick one when taking payment, and the order
// history filter offers them. Neither is an administrative act, so the route is read-only
// rather than behind requireRole('admin') the way the printer list is.

function getPaymentMethods({ activeOnly = true } = {}) {
    return db.prepare(`
        SELECT id, name, is_active, is_cash, sort_order
        FROM payment_methods
        ${activeOnly ? 'WHERE is_active = 1' : ''}
        ORDER BY sort_order, name
    `).all();
}

module.exports = { getPaymentMethods };
