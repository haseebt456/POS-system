const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

// Cost factor. 10 is bcrypt's default and lands around 50-100ms on the shop's hardware —
// slow enough that guessing a 4-digit PIN by hand is tedious, fast enough that signing in
// at a busy counter doesn't feel like waiting.
const ROUNDS = 10;

const ROLES = ['operator', 'admin'];

// users.password_hash is NOT NULL, but an operator who only ever signs in with a PIN has no
// password. Rather than make the column nullable and branch on null at every call site,
// those accounts get a hash of a random 32-byte token that is generated here and never
// shown to anyone — a password nobody can guess because nobody, including the shop, knows it.
function unusablePasswordHash() {
    return bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), ROUNDS);
}

// The only shape of a user that leaves this module. Hashes are dropped rather than
// forgotten — a route that returns a user row directly cannot leak one by accident.
function toPublic(row) {
    if (!row) return null;
    const { password_hash, pin_hash, ...rest } = row;
    return { ...rest, has_pin: Boolean(pin_hash) };
}

function getRawById(id) {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function getUserById(id) {
    return toPublic(getRawById(id));
}

function getUserByUsername(username) {
    return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

function listUsers() {
    return db.prepare(`SELECT * FROM users ORDER BY is_active DESC, full_name, username`)
        .all()
        .map(toPublic);
}

// What the PIN pad at the till renders: the people who can ring up an order, and nothing
// else. Deliberately no username, no role breakdown, no contact details.
//
// This is readable without signing in, which is a real trade-off: staff first names are
// visible to anyone who opens the app. It is how every counter POS works — you cannot ask
// someone to type a PIN before telling them whose PIN to type — and the alternative (type a
// username first) costs a keyboard interaction on every shift change, at the one screen in
// the app that has to be fast. Nothing else about an account is exposed here.
function listOperators() {
    return db.prepare(`
        SELECT id, full_name, role FROM users
        WHERE is_active = 1 AND pin_hash IS NOT NULL
        ORDER BY full_name
    `).all();
}

function createUser({ username, password, pin, full_name, role = 'operator', phone = null, hourly_rate_cents = null }) {
    if (!username || !String(username).trim()) throw new Error('A username is required');
    if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
    if (!password && !pin) throw new Error('Set a password or a PIN — otherwise nobody can sign in');
    if (pin && !/^\d{4,6}$/.test(String(pin))) throw new Error('A PIN must be 4 to 6 digits');

    const trimmed = String(username).trim();
    if (db.prepare(`SELECT id FROM users WHERE username = ?`).get(trimmed)) {
        throw new Error(`The username "${trimmed}" is already taken`);
    }

    const id = db.prepare(`
        INSERT INTO users (username, password_hash, pin_hash, full_name, role, phone, hourly_rate_cents, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        trimmed,
        password ? bcrypt.hashSync(String(password), ROUNDS) : unusablePasswordHash(),
        pin ? bcrypt.hashSync(String(pin), ROUNDS) : null,
        full_name ?? null,
        role,
        phone,
        hourly_rate_cents,
        new Date().toISOString().slice(0, 10),
    ).lastInsertRowid;

    return getUserById(id);
}

// bcrypt hashes always start with $2a$ / $2b$ / $2y$ and a two-digit cost.
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;

// bcryptjs *throws* on a malformed hash rather than returning false. This database has been
// hand-edited in DB Browser before now — there is a row in it with the literal string
// 'placeholder' where a hash belongs — and without this guard that row turns a wrong
// password into a 400 carrying a bcrypt library error, instead of the plain "not correct"
// the caller is owed. A value that cannot be a hash simply cannot match.
function compareHash(plain, hash) {
    if (typeof hash !== 'string' || !BCRYPT_HASH.test(hash)) return false;
    try {
        return bcrypt.compareSync(String(plain), hash);
    } catch {
        return false;
    }
}

// Both verifiers take the row (with its hashes), not a public user — they are called
// between loading an account and handing anything back to a client, never after.
function verifyPassword(row, password) {
    if (!row || !password) return false;
    if (!compareHash(password, row.password_hash)) return false;
    return row.is_active === 1;
}

function verifyPin(row, pin) {
    if (!row || !pin || !row.pin_hash) return false;
    if (!compareHash(pin, row.pin_hash)) return false;
    return row.is_active === 1;
}

// Is this stored hash a real password a human could ever type? Used by create-admin.js to
// report on the database — a row whose password_hash is not a bcrypt hash is an account
// nobody can sign into, which is invisible from the users table otherwise.
function isUsableHash(hash) {
    return typeof hash === 'string' && BCRYPT_HASH.test(hash);
}

function setPassword(id, password) {
    if (!password) throw new Error('A password is required');
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
        .run(bcrypt.hashSync(String(password), ROUNDS), id);
    return getUserById(id);
}

function setPin(id, pin) {
    if (pin === null || pin === '') {
        db.prepare(`UPDATE users SET pin_hash = NULL WHERE id = ?`).run(id);
        return getUserById(id);
    }
    if (!/^\d{4,6}$/.test(String(pin))) throw new Error('A PIN must be 4 to 6 digits');
    db.prepare(`UPDATE users SET pin_hash = ? WHERE id = ?`)
        .run(bcrypt.hashSync(String(pin), ROUNDS), id);
    return getUserById(id);
}

const EDITABLE = ['full_name', 'role', 'phone', 'hourly_rate_cents', 'is_active'];

function updateUser(id, fields) {
    if (!getRawById(id)) throw new Error(`User ${id} not found`);
    if (fields.role !== undefined && !ROLES.includes(fields.role)) {
        throw new Error(`Unknown role: ${fields.role}`);
    }

    const updates = EDITABLE.filter((key) => fields[key] !== undefined);
    if (!updates.length) return getUserById(id);

    const assignments = updates.map((key) => `${key} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${assignments} WHERE id = ?`)
        .run(...updates.map((key) => fields[key]), id);

    return getUserById(id);
}

// How many active admins exist — used to refuse the last admin deactivating or demoting
// themselves, which would lock the shop out of Settings with no way back in.
function countActiveAdmins(excludeId = null) {
    return db.prepare(`
        SELECT COUNT(*) AS c FROM users
        WHERE role = 'admin' AND is_active = 1 AND (? IS NULL OR id <> ?)
    `).get(excludeId, excludeId).c;
}

module.exports = {
    ROLES,
    toPublic,
    createUser,
    getUserById,
    getUserByUsername,
    getRawById,
    listUsers,
    listOperators,
    verifyPassword,
    verifyPin,
    isUsableHash,
    setPassword,
    setPin,
    updateUser,
    countActiveAdmins,
};
