const express = require('express');
const router = express.Router();
const {
    createPurchase,
    recordSupplierPayment,
    getPurchasesForSupplier,
    getPaymentsForSupplier,
    getPurchaseWithItems,
} = require('../models/purchase');

// POST /api/purchases
router.post('/', (req, res) => {
    try {
        const { supplier_id, items, amount_paid_cents = 0, created_by } = req.body;

        if (!supplier_id) throw new Error('supplier_id is required');
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('items is required and must be a non-empty array');
        }
        if (amount_paid_cents < 0) throw new Error('amount_paid_cents cannot be negative');

        const { purchaseId, total_amount_cents } = createPurchase({
            supplier_id,
            items,
            amount_paid_cents,
            created_by,
        });

        res.status(201).json({ id: purchaseId, total_amount_cents });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/purchases/:id  — one purchase, with its line items
router.get('/:id', (req, res) => {
    try {
        const purchase = getPurchaseWithItems(req.params.id);
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/purchases/supplier/:supplier_id  — all purchases for one supplier
router.get('/supplier/:supplier_id', (req, res) => {
    try {
        res.json(getPurchasesForSupplier(req.params.supplier_id));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/purchases/supplier/:supplier_id/payments  — all payments for one supplier
router.get('/supplier/:supplier_id/payments', (req, res) => {
    try {
        res.json(getPaymentsForSupplier(req.params.supplier_id));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/purchases/payments  — record a payment, separate from a purchase
// (e.g. paying down an existing balance later, not tied to a fresh delivery)
router.post('/payments', (req, res) => {
    try {
        const { supplier_id, purchase_id, amount_cents } = req.body;
        if (!supplier_id) throw new Error('supplier_id is required');
        if (!amount_cents || amount_cents <= 0) throw new Error('amount_cents must be a positive number');

        recordSupplierPayment({ supplier_id, purchase_id: purchase_id ?? null, amount_cents });
        res.status(201).json({ ok: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;