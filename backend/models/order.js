const db = require('../db');
const { adjustStockByDelta } = require('./ingredient');
const { getDealWithItems } = require('./deal');


function generateTicketNumber() {
    // Simple daily-reset-friendly ticket number: timestamp-based, human-readable enough for kitchen callouts
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
    const timePart = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
    return `T${datePart}-${timePart}`;
}
function expandDealToOrderItems(deal_id, dealQuantity = 1) {
    const deal = getDealWithItems(deal_id);
    if (!deal) throw new Error(`Deal ${deal_id} not found`);

    return deal.items.map((component, index) => ({
        menu_item_id: component.menu_item_id,
        station_id: component.station_id,
        quantity: component.quantity * dealQuantity,
        unit_price_cents: index === 0 ? deal.price_cents : 0,
        deal_id: deal.id
    }));
}


function createOrder({ order_type, items, created_by }) {
    // items: [{ menu_item_id, station_id, quantity, unit_price_cents }]
    const ticket_number = generateTicketNumber();
    const total_amount_cents = items.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);

    const insertOrder = db.prepare(`
        INSERT INTO orders (ticket_number, order_type, status, total_amount_cents, created_by)
        VALUES (?, ?, 'pending', ?, ?)
    `);
    const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, station_id, quantity, unit_price_cents, print_status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `);

    const transaction = db.transaction(() => {
        const orderResult = insertOrder.run(ticket_number, order_type ?? 'takeaway', total_amount_cents, created_by);
        const orderId = orderResult.lastInsertRowid;
        for (const item of items) {
            insertItem.run(orderId, item.menu_item_id, item.station_id, item.quantity, item.unit_price_cents);
        }
        return orderId;
    });

    const orderId = transaction();
    return { orderId, ticket_number };
}

function getOrderById(id) {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
    if (!order) return null;
    const items = db.prepare(`
        SELECT oi.*, mi.name AS menu_item_name
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = ?
    `).all(id);
    return { ...order, items };
}

function getRecipeForMenuItemRaw(menu_item_id) {
    return db.prepare(`SELECT ingredient_id, quantity_required FROM recipe_items WHERE menu_item_id = ?`).all(menu_item_id);
}

function completeOrder(orderId) {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'completed') throw new Error(`Order ${orderId} already completed`);

    const items = db.prepare(`SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?`).all(orderId);

    const transaction = db.transaction(() => {
        for (const item of items) {
            const recipe = getRecipeForMenuItemRaw(item.menu_item_id);
            for (const ingredient of recipe) {
                adjustStockByDelta(ingredient.ingredient_id, -(ingredient.quantity_required * item.quantity));
            }
        }
        db.prepare(`UPDATE orders SET status = 'completed' WHERE id = ?`).run(orderId);
    });

    transaction();
}

module.exports = { expandDealToOrderItems, createOrder, getOrderById, completeOrder, generateTicketNumber };