const express = require('express');
const router = express.Router();
const { getSetting, getNumberSetting } = require('../models/setting');
const { isAdmin } = require('../middleware/auth');

// The POS settings the till itself needs, as opposed to the settings the Settings screen edits.
//
// This is separate from M7's `/api/settings/*` group, which will be admin-only and will return
// every key including the business details. An operator has to know what they are allowed to
// discount in order to do their job, and telling them does not hand them the shop's address
// book — so this returns the two values the till acts on and nothing else.

// GET /api/pos-config
router.get('/', (req, res) => {
    try {
        res.json({
            default_order_type: getSetting('pos.default_order_type') || 'takeaway',

            // What THIS user may take off an order. null means "no cap", not "a cap of zero" —
            // an admin is not capped, and a till that read null as 0 would refuse to let the
            // manager give a discount at all.
            //
            // Defaults to 0 for an operator, which is the closed answer: migrate.js seeds the
            // same value, so a database where the row is somehow missing behaves like one where
            // the owner has not enabled operator discounts yet — rather than like one where
            // they had.
            discount_cap_cents: isAdmin(req) ? null : getNumberSetting('pos.operator_discount_cap_cents', 0),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
