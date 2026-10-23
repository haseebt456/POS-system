const crypto = require('crypto');
const db = require('../db');
const { toPublic } = require('./user');

// A till is switched off overnight and often left running for days. A session that expires
// mid-service, with a queue at the counter, is far worse than a long-lived one — and the
// machine is physically behind the counter, not on a network. Thirty days.
const SESSION_DAYS = 30;

function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`)
        .run(userId, token, expiresAt);

    return { token, expires_at: expiresAt };
}

// Returns the signed-in user, or null for a missing, expired, or deactivated session.
function getSessionUser(token) {
    if (!token) return null;

    const row = db.prepare(`
        SELECT u.*, s.expires_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
    `).get(token);

    if (!row) return null;

    // Expiry is compared here rather than in the WHERE clause on purpose. expires_at is
    // written as ISO-8601 with a trailing Z, while SQLite's CURRENT_TIMESTAMP — used by
    // created_at on every other table — is UTC with no Z and a space instead of a T.
    // Comparing the two formats in SQL silently matches nothing, which would read as
    // "every session is valid" or "every session is expired" depending on the comparison.
    if (new Date(row.expires_at).getTime() < Date.now()) {
        deleteSession(token);
        return null;
    }

    // A deactivated account keeps its row; the session dies with it.
    if (row.is_active !== 1) return null;

    return toPublic(row);
}

function deleteSession(token) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

// Used when a user is deactivated or their password changes — an existing session must not
// outlive the credential it was issued against.
function deleteSessionsForUser(userId) {
    return db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId).changes;
}

function purgeExpired() {
    // ISO strings compare correctly against each other as text, which is the one place this
    // format difference doesn't bite: both sides here are ISO.
    return db.prepare(`DELETE FROM sessions WHERE expires_at < ?`)
        .run(new Date().toISOString()).changes;
}

module.exports = {
    SESSION_DAYS,
    createSession,
    getSessionUser,
    deleteSession,
    deleteSessionsForUser,
    purgeExpired,
};
