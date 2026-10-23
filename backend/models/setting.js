const db = require('../db');

// Application settings, one row per key. The keys are namespaced ("business.name",
// "pos.operator_discount_cap_cents") so the Settings screen can group them and a new setting
// never needs a migration.
//
// Values are TEXT on purpose. A settings table that had to know the type of every value would
// need altering every time a setting was added, which is the thing this table exists to avoid.
//
// migrate.js seeds the starting values with INSERT OR IGNORE, so a fresh install and the shop's
// install begin from the same place and the owner's later changes are never overwritten by a
// restart. This module is the read side of that; the write side is M7's Settings screen.

function getSetting(key) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    return row ? row.value : null;
}

// A number a caller can do arithmetic with, or the fallback.
//
// The empty-string check is load-bearing rather than defensive: `Number('')` is 0 and
// `Number(null)` is 0, so a setting that was never set — or was cleared in the Settings screen
// to an empty box — would otherwise read as a deliberate zero. Here that distinction is passed
// to the caller, which is the only place that knows whether an absent value means "no" or
// "unknown".
function getNumberSetting(key, fallback = null) {
    const raw = getSetting(key);
    if (raw === null || raw === undefined || String(raw).trim() === '') return fallback;

    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

module.exports = { getSetting, getNumberSetting };
