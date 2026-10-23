const db = require('../db');
const { applyStockMovement } = require('./ingredient');
const { localDayStartUtc, localDayEndUtc } = require('../lib/dates');
const { getDealWithItems } = require('./deal');
const { record } = require('./audit');


function generateTicketNumber() {
    // Timestamp-based, human-readable enough for kitchen callouts. Two things it has
    // to get right:
    //
    //  - Date and time must come from the same clock. The date part used to be sliced
    //    out of toISOString() (UTC) while the time part came from getHours() (local),
    //    so on this PKT machine an order rung up at 02:00 on the 4th was labelled with
    //    the 3rd — and a ticket number is read aloud and matched by eye across the
    //    counter. Local time throughout: the shop's day, not UTC's.
    //
    //  - It must actually be unique. ticket_number is UNIQUE but this resolved only to
    //    the second, so two orders rung up in the same second — a completely normal
    //    moment at a till — made the second INSERT fail outright.
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const base = `T${datePart}-${timePart}`;

    // better-sqlite3 is synchronous and Node is single-threaded, so this check-then-insert
    // cannot race with a concurrent request. The suffix only appears on a genuine
    // same-second collision, so normal tickets stay short.
    let candidate = base;
    let suffix = 0;
    while (db.prepare(`SELECT 1 FROM orders WHERE ticket_number = ?`).get(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
    return candidate;
}
function expandDealToOrderItems(deal_id, dealQuantity = 1) {
    const deal = getDealWithItems(deal_id);
    if (!deal) throw new Error(`Deal ${deal_id} not found`);

    // deal_quantity has to be snapshotted onto every component row. The row quantity is
    // (component qty x deal qty), which is lossy — a 2x Combo and a 1x Combo with doubled
    // components produce identical rows. The receipt collapses each deal into one line and
    // needs the original multiplier to do it, so it can't be recovered after the fact.
    //
    // The money for the deal lives in exactly one place: line_total_cents on the FIRST
    // component row. It used to live in that row's unit_price_cents instead, and that was
    // wrong in a way only some deals revealed. A row's quantity is (component qty x deal
    // qty), so a total built as quantity x unit_price came out as
    // (first component qty) x (deal qty) x (deal price):
    //
    //   "1 burger + 1 drink, Rs. 500"  ->  1 x 1 x 500 = 500    correct, by luck
    //   "2 burgers + 1 drink, Rs. 800" ->  2 x 1 x 800 = 1600   the shop's own combo price ignored
    //
    // A component row now carries quantity alone and no price of its own, which is the
    // honest shape: nobody bought one burger for Rs. 800, they bought a bundle for Rs. 800.
    const lineTotalCents = deal.price_cents * dealQuantity;

    return deal.items.map((component, index) => ({
        menu_item_id: component.menu_item_id,
        station_id: component.station_id,
        quantity: component.quantity * dealQuantity,
        unit_price_cents: 0,
        line_total_cents: index === 0 ? lineTotalCents : 0,
        deal_id: deal.id,
        deal_quantity: dealQuantity,
    }));
}


// Money is integer cents throughout, and the arithmetic lives here rather than at the route
// so there is one place that decides what an order costs. items: [{ menu_item_id, station_id,
// quantity, unit_price_cents, line_total_cents?, deal_id?, deal_quantity? }]
//
// `line_total_cents` is optional because a plain menu item's line total is just
// quantity x unit_price — the fallback below. Only a deal needs to supply it, because a
// component row's price is 0 and its quantity is the component count, so neither number
// says what the bundle cost.
//
// Shared by a new order and by saving a held one, because those two paths have to answer the
// same questions — can this discount exist, does it have a reason, does the cash cover it — and
// two copies of that arithmetic is two chances for a recalled order to total differently from
// the same order rung up fresh.
function resolveTotals({ items, discount_cents, discount_reason, tax_cents, amount_tendered_cents }) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('An order needs at least one item');
    }

    const lines = items.map((item) => ({
        ...item,
        line_total_cents: item.line_total_cents ?? item.quantity * item.unit_price_cents,
    }));

    const subtotal_cents = lines.reduce((sum, item) => sum + item.line_total_cents, 0);

    const discount = Math.trunc(Number(discount_cents) || 0);
    const tax = Math.trunc(Number(tax_cents) || 0);

    if (discount < 0) throw new Error('A discount cannot be negative');
    if (discount > subtotal_cents) throw new Error('The discount is larger than the order total');
    // A discount is money leaving the till, so it carries a reason. Without one the only
    // record of why Rs. 200 came off is the number Rs. 200.
    if (discount > 0 && !discount_reason) throw new Error('A discount needs a reason');

    const total_amount_cents = subtotal_cents - discount + tax;

    // Cash handed over, which is the only payment detail the till has to capture. Left null
    // for anything that isn't cash — a card does not produce change.
    let tendered = null;
    let change_cents = null;
    if (amount_tendered_cents !== null && amount_tendered_cents !== undefined) {
        tendered = Math.trunc(Number(amount_tendered_cents));
        if (!Number.isFinite(tendered) || tendered < 0) throw new Error('The amount tendered is not a number');
        if (tendered < total_amount_cents) throw new Error('The amount tendered is less than the total');
        change_cents = tendered - total_amount_cents;
    }

    return { lines, subtotal_cents, discount, tax, total_amount_cents, tendered, change_cents };
}

// The INSERT for order_items, shared by creating an order and by saving a held one. Prepared per
// call rather than at module load: this file is required before server.js has run its
// migrations, so a module-level prepare would compile against a schema that may not exist yet.
function insertItemStatement() {
    return db.prepare(`
        INSERT INTO order_items (
            order_id, menu_item_id, station_id, quantity, unit_price_cents, line_total_cents,
            print_status, deal_id, deal_quantity
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);
}

function insertItems(orderId, lines) {
    const insertItem = insertItemStatement();
    for (const item of lines) {
        insertItem.run(
            orderId, item.menu_item_id, item.station_id, item.quantity,
            item.unit_price_cents, item.line_total_cents,
            item.deal_id ?? null, item.deal_quantity ?? null
        );
    }
}

// `hold` parks the order as a cart rather than a sale: the lines and the total are real, but
// nothing has been paid for, printed, or taken off the shelf. The three statuses —
// pending | held | completed — are decided here rather than by the caller, because
// orders.status is plain TEXT with no CHECK constraint and this file is the only thing keeping
// that list honest.
function createOrder({
    order_type,
    items,
    created_by,
    payment_method_id = null,
    discount_cents = 0,
    discount_reason = null,
    tax_cents = 0,
    amount_tendered_cents = null,
    hold = false,
}) {
    // Resolved before a ticket number is drawn, so a rejected order does not burn one.
    const { lines, subtotal_cents, discount, tax, total_amount_cents, tendered, change_cents } =
        resolveTotals({ items, discount_cents, discount_reason, tax_cents, amount_tendered_cents });

    const ticket_number = generateTicketNumber();

    const insertOrder = db.prepare(`
        INSERT INTO orders (
            ticket_number, order_type, status, subtotal_cents, discount_cents, discount_reason,
            tax_cents, total_amount_cents, payment_method_id, amount_tendered_cents, change_cents,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
        const orderResult = insertOrder.run(
            ticket_number,
            order_type ?? 'takeaway',
            hold ? 'held' : 'pending',
            subtotal_cents,
            discount,
            discount > 0 ? discount_reason : null,
            tax,
            total_amount_cents,
            payment_method_id,
            tendered,
            change_cents,
            created_by
        );
        const orderId = orderResult.lastInsertRowid;
        insertItems(orderId, lines);
        return orderId;
    });

    const orderId = transaction();

    // Money left the till without a sale behind it, so this is one of the actions the audit
    // log exists for. Written after the transaction commits, so a rolled-back order leaves
    // no trace of a discount that never happened.
    if (discount > 0) {
        record({
            user_id: created_by,
            action: 'order.discount',
            entity_type: 'order',
            entity_id: orderId,
            detail: `${discount} cents off a ${subtotal_cents} cent order — ${discount_reason}`,
        });
    }

    return { orderId, ticket_number, subtotal_cents, discount_cents: discount, total_amount_cents };
}

// --- Held orders -----------------------------------------------------------

// Saving an order that is still open: the recall path. The till hands back the cart as it stands
// now and this rewrites the order to match — lines replaced wholesale rather than diffed, because
// a cart is what the operator is looking at and reconciling it line by line would be an attempt
// to guess which edits were which. Replacing keeps the ticket number, so the customer's order is
// one row from the moment it is held to the moment it is paid for, not a held one plus a paid one.
//
// `hold: true` writes it back as a held cart; `hold: false` releases it to pending, which is the
// moment it becomes a sale waiting to be handed over and printed.
//
// Only an open order may be rewritten. A completed order is the record of a sale that has already
// taken money and moved stock, and editing one afterwards would leave the ledger describing a
// sale that never happened.
function updateOrder(orderId, {
    order_type,
    items,
    payment_method_id = null,
    discount_cents = 0,
    discount_reason = null,
    tax_cents = 0,
    amount_tendered_cents = null,
    hold = false,
    created_by = null,
}) {
    const existing = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!existing) throw new Error(`Order ${orderId} not found`);
    if (existing.status === 'completed') throw new Error(`Order ${orderId} is already completed`);

    const { lines, subtotal_cents, discount, tax, total_amount_cents, tendered, change_cents } =
        resolveTotals({ items, discount_cents, discount_reason, tax_cents, amount_tendered_cents });

    const writeOrder = db.prepare(`
        UPDATE orders SET
            order_type = ?, status = ?, subtotal_cents = ?, discount_cents = ?, discount_reason = ?,
            tax_cents = ?, total_amount_cents = ?, payment_method_id = ?, amount_tendered_cents = ?,
            change_cents = ?
        WHERE id = ?
    `);

    const transaction = db.transaction(() => {
        // The old rows go first so the order never briefly holds a mix of both carts. Foreign
        // keys are on, but nothing else references order_items, so the delete is safe on its own.
        db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(orderId);
        insertItems(orderId, lines);
        writeOrder.run(
            order_type ?? existing.order_type ?? 'takeaway',
            hold ? 'held' : 'pending',
            subtotal_cents,
            discount,
            discount > 0 ? discount_reason : null,
            tax,
            total_amount_cents,
            payment_method_id,
            tendered,
            change_cents,
            orderId
        );
    });

    transaction();

    // Written after the commit, like createOrder's: a rolled-back save leaves no trace of a
    // discount that never happened.
    if (discount > 0) {
        record({
            user_id: created_by,
            action: 'order.discount',
            entity_type: 'order',
            entity_id: orderId,
            detail: `${discount} cents off a ${subtotal_cents} cent order — ${discount_reason}`,
        });
    }

    return {
        // existing.id is the integer SQLite stored. The route parameter is a string, and
        // createOrder returns lastInsertRowid as a number — the till compares them with ===
        // to know it rewrote the same row instead of opening a second ticket.
        orderId: existing.id,
        ticket_number: existing.ticket_number,
        subtotal_cents,
        discount_cents: discount,
        total_amount_cents,
    };
}

// Discarding a held order deletes it, and it is the only order that can be deleted — because it
// is the only order that is not a record of anything. It was never printed, never took money and
// never moved stock, so there is no sale behind it to preserve, only a cart somebody decided not
// to sell. Without this the held list would grow for the rest of the shop's life with the carts
// of customers who walked out.
//
// The audit row is what keeps that from being a silent disappearance: the order is gone, but
// "T260101-143012 was discarded" is not.
function discardHeldOrder(orderId, { created_by = null } = {}) {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'held') throw new Error(`Order ${orderId} is not on hold`);

    // order_items has ON DELETE CASCADE, so the lines go with it.
    db.prepare(`DELETE FROM orders WHERE id = ?`).run(orderId);

    record({
        user_id: created_by,
        action: 'order.discard',
        entity_type: 'order',
        entity_id: orderId,
        detail: `${order.ticket_number} discarded — held order for ${order.total_amount_cents} cents, never printed`,
    });
}

// --- Order history ---------------------------------------------------------

// Orders are filtered by the shop's days, and created_at is stored as UTC. The conversion —
// and the reasoning behind it — lives in lib/dates.js, which the stock movement ledger shares,
// so "today" cannot come to mean two different things in two screens.

// The columns every history row needs, whatever the filters were. LEFT JOINs throughout:
// an order whose operator account was deleted is still an order, and created_by_name is a
// convenience, not a reason to drop the row.
const HISTORY_SELECT = `
    SELECT o.id, o.ticket_number, o.order_type, o.status,
           o.subtotal_cents, o.discount_cents, o.discount_reason, o.tax_cents,
           o.total_amount_cents, o.amount_tendered_cents, o.change_cents,
           o.payment_method_id, o.created_by, o.created_at, o.receipt_print_status,
           COALESCE(u.full_name, u.username) AS created_by_name,
           pm.name AS payment_method_name,
           (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS line_count
    FROM orders o
    LEFT JOIN users u ON u.id = o.created_by
    LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
`;

// Builds the WHERE clause and its parameters once, so the count and the page can never
// disagree about which orders are in scope — a total that doesn't match the rows it is
// counting is worse than no total.
function historyFilter({ from, to, status, payment_method_id, created_by, search }) {
    const clauses = [];
    const params = [];

    if (from) {
        clauses.push('o.created_at >= ?');
        params.push(localDayStartUtc(from, 'from'));
    }
    if (to) {
        clauses.push('o.created_at < ?');
        params.push(localDayEndUtc(to, 'to'));
    }
    if (status) {
        clauses.push('o.status = ?');
        params.push(status);
    } else {
        // A held cart is not a sale, so it is not in the history and its money is not in the
        // day's takings. It carries a real total — that is what makes it worth holding — and
        // summing it in would mean the shop's takings moved when a customer walked out without
        // paying. Asking for status=held explicitly still returns them, which is how an admin
        // goes looking for the carts that were parked and never finished.
        clauses.push("o.status != 'held'");
    }
    // Numeric filters are only applied when they are actually numbers. better-sqlite3 refuses
    // to bind NaN, so `?payment_method_id=abc` would otherwise turn a nonsense filter into a
    // thrown error rather than simply not filtering by it.
    if (payment_method_id && Number.isFinite(Number(payment_method_id))) {
        clauses.push('o.payment_method_id = ?');
        params.push(Number(payment_method_id));
    }
    if (created_by && Number.isFinite(Number(created_by))) {
        clauses.push('o.created_by = ?');
        params.push(Number(created_by));
    }
    if (search && String(search).trim()) {
        // Ticket numbers are read aloud and typed back in, so a partial match is the useful
        // behaviour here — half a ticket number is what someone has when they reach the till.
        clauses.push('o.ticket_number LIKE ?');
        params.push(`%${String(search).trim()}%`);
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function getOrders(filters = {}) {
    const { where, params } = historyFilter(filters);

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    const orders = db.prepare(`${HISTORY_SELECT} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM orders o ${where}`).get(...params);

    // The money for the whole filtered set, not just this page — a day's takings is the
    // question being asked, and summing the 50 rows on screen would answer a different one.
    // Reads total_amount_cents, which already has discount and tax applied.
    const totals = db.prepare(`
        SELECT COALESCE(SUM(o.total_amount_cents), 0) AS total_cents,
               COALESCE(SUM(o.discount_cents), 0)    AS discount_cents,
               COALESCE(SUM(o.tax_cents), 0)         AS tax_cents,
               COUNT(*)                              AS order_count
        FROM orders o ${where}
    `).get(...params);

    return { orders, total, limit, offset, totals };
}

// The detail view: one order, its lines, and who rang it up. A superset of a history row —
// the history query deliberately doesn't carry the items, because a page of 50 orders with
// their lines is 50 queries' worth of data for a table that shows none of it.
function getOrderById(id) {
    const order = db.prepare(`
        SELECT o.*, COALESCE(u.full_name, u.username) AS created_by_name,
               pm.name AS payment_method_name
        FROM orders o
        LEFT JOIN users u ON u.id = o.created_by
        LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
        WHERE o.id = ?
    `).get(id);
    if (!order) return null;

    // LEFT JOINs on menu_items and deals, not inner: both are deactivate-only everywhere
    // else in the app, but an order line is a record of something that was sold and must
    // survive whatever happens to the menu afterwards. An inner join here would silently
    // drop the line and make the order's items disagree with its total.
    const items = db.prepare(`
        SELECT oi.*, mi.name AS menu_item_name, d.name AS deal_name, s.name AS station_name
        FROM order_items oi
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN deals d ON d.id = oi.deal_id
        LEFT JOIN stations s ON s.id = oi.station_id
        WHERE oi.order_id = ?
        ORDER BY oi.id
    `).all(id);

    return { ...order, items };
}

function getRecipeForMenuItemRaw(menu_item_id) {
    return db.prepare(`SELECT ingredient_id, quantity_required FROM recipe_items WHERE menu_item_id = ?`).all(menu_item_id);
}

// Completing an order is where stock actually leaves the shop: it deducts every ingredient in
// each item's recipe and writes a movement row for each deduction, in one transaction.
//
// `created_by` is the session's user, passed down from the route rather than read from the
// body. It is who the ledger attributes the deduction to — and unlike a manual adjustment,
// nobody chose to make it, so the note says what caused it instead.
function completeOrder(orderId, { created_by = null } = {}) {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'completed') throw new Error(`Order ${orderId} already completed`);
    // Deliberately not allowed. Completing a held cart would deduct stock, mark the order
    // completed and file it as a sale that never collected any money — the payment step is the
    // only thing that is supposed to turn a cart into a sale, and skipping it here would be
    // skipping it silently.
    if (order.status === 'held') {
        throw new Error(`Order ${orderId} is on hold — open it and take payment instead`);
    }

    const items = db.prepare(`SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?`).all(orderId);

    const transaction = db.transaction(() => {
        for (const item of items) {
            const recipe = getRecipeForMenuItemRaw(item.menu_item_id);
            for (const ingredient of recipe) {
                applyStockMovement({
                    ingredient_id: ingredient.ingredient_id,
                    delta: -(ingredient.quantity_required * item.quantity),
                    reason: 'sale',
                    ref_type: 'order',
                    ref_id: orderId,
                    note: `Sold on ${order.ticket_number}`,
                    created_by,
                });
            }
        }
        db.prepare(`UPDATE orders SET status = 'completed' WHERE id = ?`).run(orderId);
    });

    transaction();
}

// Returns the REAL item rows. This used to be `new Array(count)` — empty slots padded
// to the item count purely so `.length` worked in the UI. But JSON has no holes, so it
// crossed the wire as [null, null, null], and the print badge reading `.print_status`
// off each entry crashed the whole Sales screen on null.
//
// Both open-order lists share this: they differ only in which status they ask for.
function ordersWithItems(status, { created_by = null } = {}) {
    const clauses = ['status = ?'];
    const params = [status];
    if (created_by) {
        clauses.push('created_by = ?');
        params.push(created_by);
    }

    const orders = db.prepare(
        `SELECT * FROM orders WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC`
    ).all(...params);

    const itemsStmt = db.prepare(`
        SELECT oi.id, oi.menu_item_id, oi.station_id, oi.quantity, oi.unit_price_cents,
               oi.line_total_cents, oi.print_status, oi.print_error, oi.deal_id, oi.deal_quantity,
               mi.name AS menu_item_name, d.name AS deal_name
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN deals d ON d.id = oi.deal_id
        WHERE oi.order_id = ?
        ORDER BY oi.id
    `);
    return orders.map((order) => ({ ...order, items: itemsStmt.all(order.id) }));
}

function getPendingOrders() {
    return ordersWithItems('pending');
}

// Carts the till set aside, not yet paid for. A different question from the pending list, which
// means "rung up and waiting to be handed over" — an order is only ever one or the other.
//
// `created_by` narrows it to one operator, and the route passes the session's user for anyone who
// is not an admin. Same rule as the order history, for the same reason: an operator's held carts
// are theirs, and an order they resume becomes a sale they are answerable for at close.
function getHeldOrders({ created_by = null } = {}) {
    return ordersWithItems('held', { created_by });
}

module.exports = {
    getPendingOrders,
    getHeldOrders,
    getOrders,
    expandDealToOrderItems,
    createOrder,
    updateOrder,
    discardHeldOrder,
    getOrderById,
    completeOrder,
    generateTicketNumber,
};