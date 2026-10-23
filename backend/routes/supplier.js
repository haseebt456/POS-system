const express = require('express');
const router = express.Router();
const { createSupplier, updateSupplier, getAllSuppliers, getSupplierById } = require('../models/supplier');

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

// PUT /api/suppliers/:id — contact details only. Balance is not in the body on
// purpose: it only ever changes as a side effect of createPurchase or
// recordSupplierPayment (see routes/purchase.js), both of which leave a real
// record behind explaining *why* the balance moved. A direct balance editor
// would let the number drift out of sync with reality with no audit trail.
router.put('/:id', (req, res) => {
    try {
        const { balance_owed_cents, ...rest } = req.body ?? {};
        if (balance_owed_cents !== undefined) {
            return res.status(400).json({ error: 'Balance is not editable — record a purchase or a payment instead' });
        }
        const supplier = updateSupplier(req.params.id, rest);
        res.json(supplier);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;