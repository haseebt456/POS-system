const express = require('express');
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deactivateCategory,
    reorderCategories,
} = require('../models/category');

// GET /api/categories
// Active rows by default, which is what the till and the item form want. `?all=1` includes
// deactivated ones so the Categories screen can still see a row it just hid.
router.get('/', (req, res) => {
    try {
        res.json(getAllCategories({ all: req.query.all === '1' }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/categories/reorder  body: { ids: [3, 1, 2] }
// Declared before /:id so "reorder" is never read as an id.
router.put('/reorder', (req, res) => {
    try {
        reorderCategories(req.body.ids);
        res.json(getAllCategories({ all: true }));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/categories/:id
router.get('/:id', (req, res) => {
    try {
        const category = getCategoryById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/categories
router.post('/', (req, res) => {
    try {
        const id = createCategory(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
    try {
        updateCategory(req.params.id, req.body);
        const category = getCategoryById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/categories/:id  (soft delete)
router.delete('/:id', (req, res) => {
    try {
        deactivateCategory(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
