const express = require('express');
const router = express.Router();
const {
    createPurchase,
    recordSupplierPayment,
    getAllPurchases,
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

// GET /api/purchases  — the whole history, newest first.
// Declared before /:id and /supplier/... so the literal paths win over the param route.
router.get('/', (req, res) => {
    try {
        res.json(getAllPurchases());
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// POST /api/purchases/supplier/:supplier_id/payments  — record a payment, separate from a purchase
// (e.g. paying down an existing balance later, not tied to a fresh delivery)
router.post('/supplier/:supplier_id/payments', (req, res) => {
    try {
        // supplier_id comes from the URL, not the body — the path is what identifies
        // which supplier this payment is against, and the client only sends
        // { amount_cents }. Reading it from the body here is what made every payment
        // fail with "supplier_id is required" even though the id was in the request.
        const supplier_id = Number(req.params.supplier_id);
        const { purchase_id, amount_cents } = req.body;

        if (!Number.isInteger(supplier_id)) throw new Error('supplier_id must be a number');
        if (!amount_cents || amount_cents <= 0) throw new Error('amount_cents must be a positive number');

        recordSupplierPayment({ supplier_id, purchase_id: purchase_id ?? null, amount_cents });
        res.status(201).json({ ok: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;