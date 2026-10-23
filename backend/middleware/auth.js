const { getSessionUser } = require('../models/session');

// Reads the bearer token out of the Authorization header.
//
// A bearer token rather than a cookie: the frontend already funnels every call through one
// request() helper, so attaching a header is a one-line change — whereas cookies would drag
// credentials: 'include', a CORS origin allowlist and SameSite decisions through every call
// for no benefit on a machine that serves one app.
function bearerToken(req) {
    const header = req.get('authorization') || '';
    const [scheme, value] = header.split(' ');
    return scheme && scheme.toLowerCase() === 'bearer' && value ? value : null;
}

// Attaches req.user (a public user — no hashes) or rejects with 401.
function requireAuth(req, res, next) {
    const token = bearerToken(req);
    const user = getSessionUser(token);

    if (!user) {
        return res.status(401).json({ error: 'Your session has ended — please sign in again' });
    }

    req.user = user;
    req.token = token;
    next();
}

// 403, not 404. An operator hitting an admin endpoint is authenticated but not permitted,
// and pretending the route doesn't exist would make a real misconfiguration look like a
// typo in the URL.
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Sign in to continue' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Your account does not have access to this' });
        }
        next();
    };
}

function isAdmin(req) {
    return req.user?.role === 'admin';
}

// --- Field stripping -------------------------------------------------------
//
// The brief is explicit that hiding a button is not authorization. The same goes for a
// column: rendering a table without a Cost column still leaks every cost if the JSON that
// built the row contained cost_cents. These run on the way out, so the number never crosses
// the wire for a role that shouldn't see it.

function omit(row, keys) {
    if (!row) return row;
    const copy = { ...row };
    for (const key of keys) delete copy[key];
    return copy;
}

function omitAll(rows, keys) {
    return Array.isArray(rows) ? rows.map((row) => omit(row, keys)) : rows;
}

// What each entity hides from an operator. Kept in one place so the rule is auditable —
// "what can an operator see?" has a single answer.
const OPERATOR_HIDDEN = {
    menuItem: ['cost_cents'],
    ingredient: ['cost_cents', 'stock_value_cents'],
    supplier: ['balance_owed_cents'],
};

// Strips whatever the given entity hides, when the caller is not an admin. Returns the
// value untouched for admins, so the call site reads the same either way:
//
//     res.json(forRole(req, 'ingredient', ingredients))
function forRole(req, entity, value) {
    if (isAdmin(req)) return value;
    const keys = OPERATOR_HIDDEN[entity];
    if (!keys) return value;
    return Array.isArray(value) ? omitAll(value, keys) : omit(value, keys);
}

module.exports = {
    requireAuth,
    requireRole,
    isAdmin,
    omit,
    omitAll,
    forRole,
    OPERATOR_HIDDEN,
};
