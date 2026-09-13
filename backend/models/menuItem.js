const db = require('../db');

function createMenuItem({ name, category, price_cents, station_id }) {
    const stmt = db.prepare(`
        INSERT INTO menu_items (name, category, price_cents, station_id)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, category, price_cents, station_id);
    return result.lastInsertRowid;
}

function getAllMenuItems() {
    return db.prepare(`SELECT * FROM menu_items WHERE is_active = 1`).all();
}

function getMenuItemById(id) {
    return db.prepare(`SELECT * FROM menu_items WHERE id = ?`).get(id);
}

function deactivateMenuItem(id) {
    db.prepare(`UPDATE menu_items SET is_active = 0 WHERE id = ?`).run(id);
}

// --- Recipe management ---

function addRecipeItem(menu_item_id, ingredient_id, quantity_required) {
    const stmt = db.prepare(`
        INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity_required)
        VALUES (?, ?, ?)
    `);
    return stmt.run(menu_item_id, ingredient_id, quantity_required).lastInsertRowid;
}

function getRecipeForMenuItem(menu_item_id) {
    // Joined with ingredients so callers get names/units, not just raw IDs
    return db.prepare(`
        SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, i.unit,
               ri.quantity_required
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.menu_item_id = ?
    `).all(menu_item_id);
}

function updateRecipeItemQuantity(recipe_item_id, quantity_required) {
    db.prepare(`UPDATE recipe_items SET quantity_required = ? WHERE id = ?`).run(quantity_required, recipe_item_id);
}

function removeRecipeItem(recipe_item_id) {
    db.prepare(`DELETE FROM recipe_items WHERE id = ?`).run(recipe_item_id);
}

module.exports = {
    createMenuItem,
    getAllMenuItems,
    getMenuItemById,
    deactivateMenuItem,
    addRecipeItem,
    getRecipeForMenuItem,
    updateRecipeItemQuantity,
    removeRecipeItem
};