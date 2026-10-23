const express = require('express');
const router = express.Router();
const {
    getUserByUsername,
    getRawById,
    verifyPassword,
    verifyPin,
    listOperators,
    toPublic,
} = require('../models/user');
const { createSession, deleteSession } = require('../models/session');
const { requireAuth } = require('../middleware/auth');
const { record } = require('../models/audit');

// GET /api/auth/operators — the name list the PIN pad shows before anyone has signed in.
// Public by necessity: you cannot ask someone to type a PIN before telling them whose PIN
// to type. Returns names and roles only — see models/user.js:listOperators.
router.get('/operators', (req, res) => {
    try {
        res.json(listOperators());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
//
//   { username, password }   an admin signing in at Settings or Reports
//   { user_id, pin }         an operator tapping their name on the till
//
// Both paths converge on the same session, so nothing downstream needs to know which
// way someone signed in.
router.post('/login', (req, res) => {
    try {
        const { username, password, user_id, pin } = req.body ?? {};

        let row;

        if (user_id !== undefined && pin !== undefined) {
            row = getRawById(user_id);
            // Same message whether the account is missing, inactive, or the PIN is simply
            // wrong. The operator list is public, so this leaks nothing that isn't already
            // visible, and it avoids telling a guesser which half they got right.
            if (!verifyPin(row, pin)) {
                return res.status(401).json({ error: 'That PIN is not correct' });
            }
        } else if (username && password) {
            row = getUserByUsername(String(username).trim());
            if (!verifyPassword(row, password)) {
                return res.status(401).json({ error: 'Username or password is not correct' });
            }
        } else {
            return res.status(400).json({
                error: 'Provide a username and password, or an operator and PIN',
            });
        }

        const { token, expires_at } = createSession(row.id);
        record({ user_id: row.id, action: 'login' });

        res.json({ token, expires_at, user: toPublic(row) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/logout', requireAuth, (req, res) => {
    try {
        deleteSession(req.token);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Who am I — used on load to restore a session without re-authenticating.
router.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
});

module.exports = router;
