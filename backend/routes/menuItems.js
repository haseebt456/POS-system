const express = require('express');
const router = express.Router();
const {
    createMenuItem,
    getAllMenuItems,
    getMenuItemById,
    deactivateMenuItem,
    addRecipeItem,
    getRecipeForMenuItem,
    updateRecipeItemQuantity,
    removeRecipeItem,
} = require('../models/menuItem');

// GET /api/menu-items
router.get('/', (req, res) => {
    try {
        res.json(getAllMenuItems());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/menu-items/:id
router.get('/:id', (req, res) => {
    try {
        const item = getMenuItemById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Menu item not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/menu-items
router.post('/', (req, res) => {
    try {
        const id = createMenuItem(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/menu-items/:id  (soft delete)
router.delete('/:id', (req, res) => {
    try {
        deactivateMenuItem(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Recipe sub-resource ---

// GET /api/menu-items/:id/recipe
router.get('/:id/recipe', (req, res) => {
    try {
        res.json(getRecipeForMenuItem(req.params.id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/menu-items/:id/recipe   body: { ingredient_id, quantity_required }
router.post('/:id/recipe', (req, res) => {
    try {
        const recipeItemId = addRecipeItem(req.params.id, req.body.ingredient_id, req.body.quantity_required);
        res.status(201).json({ id: recipeItemId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/menu-items/recipe-item/:recipeItemId   body: { quantity_required }
router.put('/recipe-item/:recipeItemId', (req, res) => {
    try {
        updateRecipeItemQuantity(req.params.recipeItemId, req.body.quantity_required);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/menu-items/recipe-item/:recipeItemId
router.delete('/recipe-item/:recipeItemId', (req, res) => {
    try {
        removeRecipeItem(req.params.recipeItemId);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
