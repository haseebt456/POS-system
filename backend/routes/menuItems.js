const express = require('express');
const router = express.Router();
const {
    createMenuItem,
    getAllMenuItems,
    getMenuItemById,
    updateMenuItem,
    deactivateMenuItem,
    saveMenuItemImage,
    addRecipeItem,
    getRecipeForMenuItem,
    updateRecipeItemQuantity,
    removeRecipeItem,
} = require('../models/menuItem');
const { forRole } = require('../middleware/auth');

// GET /api/menu-items
router.get('/', (req, res) => {
    try {
        // cost_cents is removed here, not hidden in the table. Leaving the column out of the
        // JSX still ships every cost in the JSON that built the row, and an operator can read
        // that from the network tab in seconds. The number has to not cross the wire.
        //
        // forRole() returns the array untouched for an admin, so this call site is the same
        // for both roles and there is no branch to get wrong.
        res.json(forRole(req, 'menuItem', getAllMenuItems()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/menu-items/:id
router.get('/:id', (req, res) => {
    try {
        const item = getMenuItemById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Menu item not found' });
        res.json(forRole(req, 'menuItem', item));
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

// PUT /api/menu-items/:id
router.put('/:id', (req, res) => {
    try {
        const item = updateMenuItem(req.params.id, req.body);
        res.json(forRole(req, 'menuItem', item));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/menu-items/:id/image  body: { data_url }
// JSON rather than multipart so the existing request() helper can send it. The file is
// written under data/uploads and served from /uploads, which img tags can load without a
// bearer token — the same local-only tradeoff as GET /api/auth/operators.
router.post('/:id/image', (req, res) => {
    try {
        const item = saveMenuItemImage(req.params.id, req.body.data_url);
        res.json(forRole(req, 'menuItem', item));
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
