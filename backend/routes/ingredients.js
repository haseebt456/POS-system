const express = require('express');
const router = express.Router();
const {
    createIngredient,
    getAllIngredients,
    getLowStock,
    setStockAbsolute,
    deactivateIngredient,
    reconcileStock,
} = require('../models/ingredient');

// GET /api/ingredients
router.get('/', (req, res) => {
    try {
        res.json(getAllIngredients());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ingredients/low-stock
router.get('/low-stock', (req, res) => {
    try {
        res.json(getLowStock());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ingredients/reconcile  — apply a whole physical count at once
// body: { entries: [{ id, actual_qty }] }
// Declared above the /:id routes for the same reason /low-stock is: a literal path
// must not be shadowed by a parameterised one.
router.post('/reconcile', (req, res) => {
    try {
        const { entries } = req.body;
        if (!Array.isArray(entries) || entries.length === 0) {
            throw new Error('entries is required and must be a non-empty array');
        }
        for (const entry of entries) {
            if (entry.id == null) throw new Error('every entry needs an id');
            if (entry.actual_qty == null || Number.isNaN(Number(entry.actual_qty))) {
                throw new Error(`entry ${entry.id} needs a numeric actual_qty`);
            }
            if (Number(entry.actual_qty) < 0) {
                throw new Error(`entry ${entry.id} cannot have negative stock`);
            }
        }

        const count = reconcileStock(
            entries.map((e) => ({ id: Number(e.id), actual_qty: Number(e.actual_qty) }))
        );
        res.json({ ok: true, updated: count });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/ingredients
router.post('/', (req, res) => {
    try {
        const id = createIngredient(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// PUT /api/ingredients/:id/stock  (manual reconciliation — overwrite, not delta)
router.put('/:id/stock', (req, res) => {
    try {
        setStockAbsolute(req.params.id, req.body.qty);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/ingredients/:id  (soft delete — sets is_active = 0)
router.delete('/:id', (req, res) => {
    try {
        deactivateIngredient(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
