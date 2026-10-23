const db = require('../db');

function createDeal({ name, price_cents }) {
    const stmt = db.prepare(`INSERT INTO deals (name, price_cents) VALUES (?, ?)`);
    return stmt.run(name, price_cents).lastInsertRowid;
}

function addDealItem(deal_id, menu_item_id, quantity) {
    const stmt = db.prepare(`
        INSERT INTO deal_items (deal_id, menu_item_id, quantity)
        VALUES (?, ?, ?)
    `);
    return stmt.run(deal_id, menu_item_id, quantity ?? 1).lastInsertRowid;
}

function getAllDeals() {
    return db.prepare(`SELECT * FROM deals WHERE is_active = 1`).all();
}

function getDealWithItems(deal_id) {
    const deal = db.prepare(`SELECT * FROM deals WHERE id = ?`).get(deal_id);
    if (!deal) return null;
    // ORDER BY di.id is load-bearing, not tidiness. The first component row is the one that
    // carries the deal's money (see expandDealToOrderItems), and the receipt finds it by
    // taking the first row per deal in insertion order. Without an explicit order SQLite is
    // free to return the components any way it likes, which would put the price on a row
    // nobody expects and make a receipt's total depend on the query plan.
    const items = db.prepare(`
        SELECT di.menu_item_id, di.quantity, mi.name AS menu_item_name, mi.station_id, mi.price_cents AS normal_price_cents
        FROM deal_items di
        JOIN menu_items mi ON mi.id = di.menu_item_id
        WHERE di.deal_id = ?
        ORDER BY di.id
    `).all(deal_id);
    return { ...deal, items };
}

module.exports = { createDeal, addDealItem, getAllDeals, getDealWithItems };