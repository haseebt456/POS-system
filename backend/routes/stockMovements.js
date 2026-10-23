const express = require('express');
const router = express.Router();
const { getMovements, REASONS } = require('../models/stockMovement');

// The stock ledger, read-only.
//
// Reading it is admin-only, matching the nav: an operator restocks and sells, and reviewing the
// shop's shrink over a date range is a manager's job. Recording a movement stays open to both —
// completing an order and receiving a delivery both write here, and neither is gated.

// GET /api/stock-movements
// query: ingredient_id, reason, ref_type, ref_id, from, to (YYYY-MM-DD, the shop's days),
//        limit, offset
router.get('/', (req, res) => {
    try {
        res.json(getMovements({
            ingredient_id: req.query.ingredient_id,
            reason: req.query.reason,
            ref_type: req.query.ref_type,
            ref_id: req.query.ref_id,
            from: req.query.from,
            to: req.query.to,
            limit: req.query.limit,
            offset: req.query.offset,
        }));
    } catch (err) {
        // A malformed date or an out-of-range page is the client's mistake.
        res.status(400).json({ error: err.message });
    }
});

// The reason codes the filter offers. Served rather than hard-coded in the screen so the two
// cannot drift — a filter listing a reason nothing writes is a filter that always returns
// nothing, and it looks like a bug in the data rather than in the list.
router.get('/reasons', (req, res) => {
    res.json(REASONS);
});

module.exports = router;
