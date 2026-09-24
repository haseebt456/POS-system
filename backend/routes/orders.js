const express = require('express');
const router = express.Router();
const {
    createOrder,
    completeOrder,
    getOrderById,
    expandDealToOrderItems,
} = require('../models/order');

// GET /api/orders/pending  — must come before /:id or Express will treat "pending" as an id
router.get('/pending', (req, res) => {
    try {
        res.json(getPendingOrders());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
    try {
        const order = getOrderById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders
// body: {
//   order_type: 'dine-in' | 'takeaway',
//   created_by: <user id>,
//   lines: [
//     { type: 'menu_item', menu_item_id, station_id, quantity, unit_price_cents },
//     { type: 'deal', deal_id, quantity }
//   ]
// }
router.post('/', (req, res) => {
    try {
        const { order_type, created_by, lines } = req.body;

        // Expand any deal lines into their real component menu items before
        // they ever reach createOrder — createOrder only ever deals with flat,
        // real menu items, it has no knowledge that "deals" exist.
        const items = [];
        for (const line of lines) {
            if (line.type === 'deal') {
                items.push(...expandDealToOrderItems(line.deal_id, line.quantity ?? 1));
            } else {
                items.push({
                    menu_item_id: line.menu_item_id,
                    station_id: line.station_id,
                    quantity: line.quantity,
                    unit_price_cents: line.unit_price_cents,
                    deal_id: null,
                });
            }
        }

        const result = createOrder({ order_type, items, created_by });
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/orders/:id/complete
router.put('/:id/complete', (req, res) => {
    try {
        completeOrder(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        // completeOrder throws on "not found" or "already completed" — both are
        // client errors (400), not server errors (500)
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
