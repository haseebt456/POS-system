const express = require('express');
const router = express.Router();
const { getPaymentMethods } = require('../models/paymentMethod');

// GET /api/payment-methods
// The till's payment options and the order history's filter options. Read-only for now —
// adding and renaming them is Settings → POS Configuration, which is M7.
//
// `?all=1` includes deactivated methods, for the history filter: an order paid by "Card"
// before Card was retired still has to be findable by that name.
router.get('/', (req, res) => {
    try {
        res.json(getPaymentMethods({ activeOnly: req.query.all !== '1' }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
