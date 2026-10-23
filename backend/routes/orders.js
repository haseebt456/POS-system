    const express = require('express');
    const router = express.Router();
    const {
        createOrder,
        updateOrder,
        discardHeldOrder,
        completeOrder,
        getOrderById,
        getOrders,
        getHeldOrders,
        expandDealToOrderItems,
        getPendingOrders,
    } = require('../models/order');
    const { getPrintStatusForOrder } = require('../models/print');
    const { printOrder, previewOrder } = require('../printing/printService');
    const { isAdmin } = require('../middleware/auth');
    const { getNumberSetting } = require('../models/setting');
    const { getMenuItemById } = require('../models/menuItem');

    // Expands the till's cart lines into the flat menu-item rows createOrder and updateOrder work in.
    // Deals are a till concept: "1 x Combo" becomes the real items the kitchen makes, and neither
    // model ever learns that deals exist. Shared by both so a recalled order expands exactly the way
    // it did when it was first rung up.
    function expandLines(lines) {
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
        // is_available is a real flag, not a till filter. Hiding a sold-out item in React is
        // exactly the thing the brief says not to rely on — POST /orders would otherwise still
        // take the money.
        for (const item of items) {
            const menuItem = getMenuItemById(item.menu_item_id);
            if (!menuItem || menuItem.is_active === 0) {
                throw new Error('That item is not on the menu');
            }
            if (menuItem.is_available === 0) {
                throw new Error(`${menuItem.name} is sold out`);
            }
        }
        return items;
    }

    // The discount ceiling is checked here rather than in createOrder because it is a permission,
    // not arithmetic — createOrder has no idea who is holding the till, and shouldn't. The till is
    // told the same number by GET /api/pos-config so it can grey out the field rather than let the
    // operator type an amount and be refused; this is the check that actually holds.
    //
    // Returns the message to refuse with, or null to allow. Shared by create and save, because a
    // discount an operator may not take is one they may not take whichever route they send it down.
    function discountRefusal(req, discount) {
        if (discount <= 0 || isAdmin(req)) return null;

        // 0 is the seeded default and means operators may not discount at all until the owner
        // raises it — so this is a live branch on a fresh install, not a corner case.
        const cap = getNumberSetting('pos.operator_discount_cap_cents', 0);
        if (discount <= cap) return null;

        return cap > 0
            ? `You can take up to Rs. ${cap / 100} off an order — ask a manager for more`
            : 'Discounts need a manager to approve them';
    }

    // GET /api/orders/pending  — must come before /:id or Express will treat "pending" as an id
    router.get('/pending', (req, res) => {
        try {
            res.json(getPendingOrders());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/orders/held — carts set aside, oldest first. Declared before /:id for the same reason
    // as /pending: Express would otherwise read "held" as a ticket id.
    //
    // Same scoping rule as the history below — an operator sees their own held orders and no one
    // else's, and an admin sees all of them.
    router.get('/held', (req, res) => {
        try {
            res.json(getHeldOrders({ created_by: isAdmin(req) ? null : req.user.id }));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/orders — the history, newest first.
    //
    // query: from, to (YYYY-MM-DD, the shop's local days), status, payment_method_id,
    //        created_by, search (ticket number), limit, offset
    //
    // An operator gets their own orders and only their own, whatever `created_by` they send. The
    // brief's permission matrix gives operators "basic order history"; the shop's takings for the
    // day, and who else was on the till, are not theirs to browse. Enforced here rather than by
    // omitting the filter in the UI, because a filter is a query parameter anyone can type.
    router.get('/', (req, res) => {
        try {
            const filters = {
                from: req.query.from,
                to: req.query.to,
                status: req.query.status,
                payment_method_id: req.query.payment_method_id,
                search: req.query.search,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            // An admin may narrow to one operator; an operator is narrowed for them.
            filters.created_by = isAdmin(req) ? req.query.created_by : req.user.id;

            res.json(getOrders(filters));
        } catch (err) {
            // A malformed date is the client's mistake, not a server fault.
            res.status(400).json({ error: err.message });
        }
    });

    // GET /api/orders/:id
    router.get('/:id', (req, res) => {
        try {
            const order = getOrderById(req.params.id);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            // Same rule as the list: an operator may look up an order they rang up, and a 404 is
            // the right answer for one they didn't — saying "not yours" would confirm it exists.
            if (!isAdmin(req) && order.created_by !== req.user.id) {
                return res.status(404).json({ error: 'Order not found' });
            }

            res.json(order);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/orders
    // body: {
    //   order_type: 'dine-in' | 'takeaway',
    //   payment_method_id, discount_cents, discount_reason, tax_cents, amount_tendered_cents,
    //   hold: true to park it as a held cart instead of a sale,
    //   lines: [
    //     { type: 'menu_item', menu_item_id, station_id, quantity, unit_price_cents },
    //     { type: 'deal', deal_id, quantity }
    //   ]
    // }
    //
    // `created_by` is deliberately NOT read from the body. It is the session's user, so an order
    // cannot be filed against someone else's name — which matters because the history is filtered
    // by it and an operator's own sales are what they are answerable for at close.
    router.post('/', (req, res) => {
        try {
            const { order_type, lines, payment_method_id, discount_cents, discount_reason, tax_cents, amount_tendered_cents, hold } = req.body;

            if (!Array.isArray(lines) || lines.length === 0) {
                return res.status(400).json({ error: 'An order needs at least one item' });
            }

            const refusal = discountRefusal(req, Math.trunc(Number(discount_cents) || 0));
            if (refusal) return res.status(403).json({ error: refusal });

            const result = createOrder({
                order_type,
                items: expandLines(lines),
                created_by: req.user.id,
                payment_method_id,
                discount_cents,
                discount_reason,
                tax_cents,
                amount_tendered_cents,
                hold: hold === true,
            });
            res.status(201).json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // PUT /api/orders/:id — save an order that is still open. This is the recall path: the till sends
    // back the cart as it now stands, and the same body as POST either keeps it held or releases it.
    // body: as POST. `hold: true` writes it back as a held cart; omitting it releases the order.
    //
    // An operator may only rewrite their own, and gets a 404 for anyone else's — the same answer
    // GET /:id gives, because "not yours" would confirm the order exists.
    router.put('/:id', (req, res) => {
        try {
            const existing = getOrderById(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Order not found' });
            if (!isAdmin(req) && existing.created_by !== req.user.id) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const { order_type, lines, payment_method_id, discount_cents, discount_reason, tax_cents, amount_tendered_cents, hold } = req.body;

            if (!Array.isArray(lines) || lines.length === 0) {
                return res.status(400).json({ error: 'An order needs at least one item' });
            }

            const refusal = discountRefusal(req, Math.trunc(Number(discount_cents) || 0));
            if (refusal) return res.status(403).json({ error: refusal });

            const result = updateOrder(req.params.id, {
                order_type,
                items: expandLines(lines),
                created_by: req.user.id,
                payment_method_id,
                discount_cents,
                discount_reason,
                tax_cents,
                amount_tendered_cents,
                hold: hold === true,
            });
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // DELETE /api/orders/:id — discard a held cart.
    // Only a held order can go: it is the only one that is not a record of a sale, so it is the only
    // one whose removal loses nothing. A completed order is refused by the model.
    router.delete('/:id', (req, res) => {
        try {
            const existing = getOrderById(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Order not found' });
            if (!isAdmin(req) && existing.created_by !== req.user.id) {
                return res.status(404).json({ error: 'Order not found' });
            }

            discardHeldOrder(req.params.id, { created_by: req.user.id });
            res.json({ ok: true });
        } catch (err) {
            // "not on hold" is the client asking for something the server will not do, not a fault.
            res.status(400).json({ error: err.message });
        }
    });

    // PUT /api/orders/:id/complete
    router.put('/:id/complete', (req, res) => {
        try {
            // created_by is the session's user, so the stock the completion deducts is attributed
            // to whoever actually pressed it rather than to whoever created the order.
            completeOrder(req.params.id, { created_by: req.user.id });
            res.json({ ok: true });
        } catch (err) {
            // completeOrder throws on "not found" or "already completed" — both are
            // client errors (400), not server errors (500)
            res.status(400).json({ error: err.message });
        }
    });

    // GET /api/orders/:id/print-status — per-station and receipt print state
    router.get('/:id/print-status', (req, res) => {
        try {
            const status = getPrintStatusForOrder(req.params.id);
            if (!status) return res.status(404).json({ error: 'Order not found' });
            res.json(status);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/orders/:id/preview — rendered ticket text, nothing is sent to a printer
    router.get('/:id/preview', (req, res) => {
        try {
            res.json(previewOrder(req.params.id));
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    // POST /api/orders/:id/print
    // body: { force?: boolean }
    // Idempotent by default — already-printed stations are skipped so a retry click
    // can't emit duplicate kitchen tickets. force=true reprints everything.
    router.post('/:id/print', async (req, res) => {
        try {
            const result = await printOrder(req.params.id, { force: req.body?.force === true });
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    module.exports = router;
