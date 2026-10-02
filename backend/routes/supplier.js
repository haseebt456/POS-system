const express = require('express');
const router = express.Router();
const { createSupplier, getAllSuppliers, getSupplierById } = require('../models/supplier');

// POST /api/suppliers
router.post('/', (req, res) => {
    try {
        const id = createSupplier(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/suppliers
router.get('/', (req, res) => {
    try {
        res.json(getAllSuppliers());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/:id
router.get('/:id', (req, res) => {
    try {
        const supplier = getSupplierById(req.params.id);
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
        res.json(supplier);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deliberately no PUT/:id route here to edit balance_owed_cents directly.
// Balance only ever changes as a side effect of createPurchase or
// recordSupplierPayment (see routes/purchase.js) — both of those leave a real
// record behind explaining *why* the balance moved. A direct balance editor
// would let the number drift out of sync with reality with no audit trail.

module.exports = router;