const express = require('express');
const router = express.Router();
const {
    createIngredient,
    getAllIngredients,
    getLowStock,
    setStockWithMovement,
    deactivateIngredient,
    reconcileStock,
} = require('../models/ingredient');
const { forRole } = require('../middleware/auth');

// GET /api/ingredients
router.get('/', (req, res) => {
    try {
        // Nothing on this row is hidden from an operator today: the ingredients table has no
        // cost column, so cost_cents and stock_value_cents (OPERATOR_HIDDEN.ingredient) match
        // no key and the call is a no-op.
        //
        // It is here anyway, and deliberately. Ingredient cost is coming — it is what makes
        // stock value and food-cost reporting possible — and the day it arrives it lands on a
        // route that already strips it, rather than on one where nobody remembered to.
        res.json(forRole(req, 'ingredient', getAllIngredients()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ingredients/low-stock
router.get('/low-stock', (req, res) => {
    try {
        res.json(forRole(req, 'ingredient', getLowStock()));
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
            entries.map((e) => ({ id: Number(e.id), actual_qty: Number(e.actual_qty) })),
            { created_by: req.user.id }
        );
        // `updated` counts the ingredients whose number actually moved, not the entries that
        // were submitted. A count that confirms the shelf already matched the system is a
        // successful count that changed nothing, and reporting it as nine updates is how
        // someone concludes the count was applied when there was nothing to apply.
        res.json({ ok: true, updated: count });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/ingredients
router.post('/', (req, res) => {
    try {
        // created_by comes from the session, not the body — it is who the opening balance in
        // the ledger is attributed to, and the ledger is read by people asking who did what.
        const id = createIngredient({ ...req.body, created_by: req.user.id });
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// PUT /api/ingredients/:id/stock  (manual reconciliation — overwrite, not delta)
//
// Goes through setStockWithMovement rather than setStockAbsolute so the row this overwrites
// leaves a trace: the difference between what the system thought and what the shelf held is the
// only part of a manual correction worth keeping.
router.put('/:id/stock', (req, res) => {
    try {
        const { delta, before, after } = setStockWithMovement({
            ingredient_id: req.params.id,
            actual_qty: req.body.qty,
            reason: 'adjustment',
            note: req.body.note ?? 'Manual correction',
            created_by: req.user.id,
        });
        res.json({ ok: true, delta, before, after });
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
