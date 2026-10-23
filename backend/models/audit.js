const db = require('../db');

// Records things worth being able to answer questions about later: money moved, a price
// changed, a stock count corrected, someone signed in. Append-only — nothing in the app
// edits or deletes these rows.
function record({ user_id = null, action, entity_type = null, entity_id = null, detail = null }) {
    db.prepare(`
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, detail)
        VALUES (?, ?, ?, ?, ?)
    `).run(user_id, action, entity_type, entity_id, detail === null ? null : String(detail));
}

function listRecent(limit = 200) {
    return db.prepare(`
        SELECT a.*, u.full_name, u.username
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC
        LIMIT ?
    `).all(limit);
}

// Everything that happened to one thing — "who changed this price, and to what".
function listForEntity(entity_type, entity_id) {
    return db.prepare(`
        SELECT a.*, u.full_name, u.username
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.entity_type = ? AND a.entity_id = ?
        ORDER BY a.id DESC
    `).all(entity_type, entity_id);
}

module.exports = { record, listRecent, listForEntity };
