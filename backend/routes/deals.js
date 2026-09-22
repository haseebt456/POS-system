const express = require('express');
const router = express.Router();
const {
    createDeal,
    addDealItem,
    getAllDeals,
    getDealWithItems,
} = require('../models/deal');

// GET /api/deals
router.get('/', (req, res) => {
    try {
        res.json(getAllDeals());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/deals/:id
router.get('/:id', (req, res) => {
    try {
        const deal = getDealWithItems(req.params.id);
        if (!deal) return res.status(404).json({ error: 'Deal not found' });
        res.json(deal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/deals   body: { name, price_cents }
router.post('/', (req, res) => {
    try {
        const id = createDeal(req.body);
        res.status(201).json({ id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/deals/:id/items   body: { menu_item_id, quantity }
router.post('/:id/items', (req, res) => {
    try {
        const itemId = addDealItem(req.params.id, req.body.menu_item_id, req.body.quantity);
        res.status(201).json({ id: itemId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
