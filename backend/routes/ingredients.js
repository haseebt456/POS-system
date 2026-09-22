const express = require('express');
const router = express.Router();
const {
    createIngredient,
    getAllIngredients,
    getLowStock,
    updateIngredientDetails,
    setStockAbsolute,
    deactivateIngredient,
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

// POST /api/ingredients
router.post('/', (req, res) => {
    try {
        const id = createIngredient(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/ingredients/:id
router.put('/:id', (req, res) => {
    try {
        updateIngredientDetails(req.params.id, req.body);
        res.json({ ok: true });
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
