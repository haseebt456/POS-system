const db = require('../db');
const { localDayStartUtc, localDayEndUtc } = require('../lib/dates');

// The ledger behind ingredients.stock_qty.
//
// The running balance has always existed; what did not was any record of how it got there. An
// ingredient that reads 3kg short had no answer beyond "somebody must have adjusted it", which
// is not an answer a shop can act on — it is the difference between a delivery entered wrong
// and a freezer that is not being rotated.

// The reasons, listed once so the screen's filter and every writer agree on the spelling.
// 'opening' is written by migrate.js when it records the stock a shop already had.
const REASONS = ['opening', 'purchase', 'sale', 'adjustment', 'waste'];

function recordMovement({
    ingredient_id,
    delta,
    reason,
    ref_type = null,
    ref_id = null,
    note = null,
    created_by = null,
}) {
    const amount = Number(delta);

    if (!REASONS.includes(reason)) {
        // Thrown rather than logged: this can only be a mistake in our own code, and a ledger
        // row with a reason nothing can interpret is worse than a loud failure at the call site.
        throw new Error(`Unknown stock movement reason: ${reason}`);
    }

    // A movement of zero says nothing and would clutter a ledger whose whole value is being
    // short enough to read. It is a legitimate case: a recipe line of 0, or a stock count that
    // matched.
    if (!Number.isFinite(amount) || amount === 0) return null;

    const result = db.prepare(`
        INSERT INTO stock_movements (ingredient_id, delta, reason, ref_type, ref_id, note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ingredient_id, amount, reason, ref_type, ref_id, note, created_by);

    return result.lastInsertRowid;
}

// --- Reading it back -------------------------------------------------------

const MOVEMENT_SELECT = `
    SELECT sm.id, sm.ingredient_id, sm.delta, sm.reason, sm.ref_type, sm.ref_id,
           sm.note, sm.created_by, sm.created_at,
           i.name AS ingredient_name, i.unit,
           COALESCE(u.full_name, u.username) AS created_by_name
    FROM stock_movements sm
    LEFT JOIN ingredients i ON i.id = sm.ingredient_id
    LEFT JOIN users u ON u.id = sm.created_by
`;

// Same shape as the order history filter, and for the same reason: the count and the page must
// not be able to disagree about which rows are in scope.
function movementFilter({ ingredient_id, reason, ref_type, ref_id, from, to }) {
    const clauses = [];
    const params = [];

    if (from) {
        clauses.push('sm.created_at >= ?');
        params.push(localDayStartUtc(from, 'from'));
    }
    if (to) {
        clauses.push('sm.created_at < ?');
        params.push(localDayEndUtc(to, 'to'));
    }
    if (reason) {
        clauses.push('sm.reason = ?');
        params.push(reason);
    }
    if (ref_type) {
        clauses.push('sm.ref_type = ?');
        params.push(ref_type);
    }
    // Numeric filters only when they are actually numbers — better-sqlite3 refuses to bind NaN,
    // so `?ingredient_id=abc` would otherwise be a thrown error rather than simply no filter.
    if (ingredient_id && Number.isFinite(Number(ingredient_id))) {
        clauses.push('sm.ingredient_id = ?');
        params.push(Number(ingredient_id));
    }
    if (ref_id && Number.isFinite(Number(ref_id))) {
        clauses.push('sm.ref_id = ?');
        params.push(Number(ref_id));
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function getMovements(filters = {}) {
    const { where, params } = movementFilter(filters);

    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    // Newest first, with id breaking the tie: created_at is CURRENT_TIMESTAMP at second
    // resolution and one order completion writes a row per recipe ingredient, so a whole
    // morning's worth of identical timestamps is normal rather than a corner case.
    const movements = db
        .prepare(`${MOVEMENT_SELECT} ${where} ORDER BY sm.created_at DESC, sm.id DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM stock_movements sm ${where}`).get(...params);

    // Net change over the whole filtered set, not just the page — "how much mince came in this
    // week" is the question, and it is not answered by the 100 rows currently on screen.
    const totals = db.prepare(`
        SELECT COALESCE(SUM(sm.delta), 0)  AS net_delta,
               COALESCE(SUM(CASE WHEN sm.delta > 0 THEN sm.delta ELSE 0 END), 0) AS added,
               COALESCE(SUM(CASE WHEN sm.delta < 0 THEN sm.delta ELSE 0 END), 0) AS removed
        FROM stock_movements sm ${where}
    `).get(...params);

    return { movements, total, limit, offset, totals };
}

module.exports = { REASONS, recordMovement, getMovements };
