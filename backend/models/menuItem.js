const fs = require('fs');
const path = require('path');
const db = require('../db');
const { createCategory, findCategoryByName, getCategoryById } = require('./category');

const UPLOAD_ROOT = path.join(__dirname, '..', 'data', 'uploads');
const MENU_IMAGE_DIR = path.join(UPLOAD_ROOT, 'menu-items');
const IMAGE_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function asCents(value, label) {
    if (value === undefined || value === null || value === '') return null;
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} has to be zero or a positive amount`);
    return n;
}

function asFlag(value, fallback) {
    if (value === undefined || value === null) return fallback;
    return value ? 1 : 0;
}

// category_id is the relationship; category is the denormalised name the till still reads.
// Creating an item with only the old free-text field finds or creates the matching row, so
// the two columns cannot drift on a path that existed before the Categories screen did.
function resolveCategory({ category_id, category }) {
    if (category_id != null && category_id !== '') {
        const row = getCategoryById(category_id);
        if (!row) throw new Error(`Category ${category_id} not found`);
        return { category_id: row.id, category: row.name };
    }
    const name = typeof category === 'string' ? category.trim() : '';
    if (!name) return { category_id: null, category: null };
    const existing = findCategoryByName(name);
    if (existing) return { category_id: existing.id, category: existing.name };
    return { category_id: createCategory({ name }), category: name };
}

function createMenuItem({
    name,
    category,
    category_id,
    description,
    price_cents,
    cost_cents,
    station_id,
    is_available,
    is_active,
}) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('A menu item needs a name');

    const price = asCents(price_cents, 'The price');
    if (price === null) throw new Error('A menu item needs a price');

    const resolved = resolveCategory({ category_id, category });
    const categoryRow = resolved.category_id ? getCategoryById(resolved.category_id) : null;
    const station = station_id == null || station_id === ''
        ? (categoryRow?.station_id ?? null)
        : Number(station_id);

    const result = db.prepare(`
        INSERT INTO menu_items (
            name, category, category_id, description, price_cents, cost_cents,
            station_id, is_available, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        trimmed,
        resolved.category,
        resolved.category_id,
        description == null || description === '' ? null : String(description),
        price,
        asCents(cost_cents, 'The cost'),
        station,
        asFlag(is_available, 1),
        asFlag(is_active, 1)
    );
    return result.lastInsertRowid;
}

function getAllMenuItems() {
    return db.prepare(`SELECT * FROM menu_items WHERE is_active = 1`).all();
}

function getMenuItemById(id) {
    return db.prepare(`SELECT * FROM menu_items WHERE id = ?`).get(id);
}

function updateMenuItem(id, {
    name,
    category,
    category_id,
    description,
    price_cents,
    cost_cents,
    station_id,
    is_available,
    is_active,
}) {
    const existing = getMenuItemById(id);
    if (!existing) throw new Error(`Menu item ${id} not found`);

    const trimmed = name == null ? existing.name : String(name).trim();
    if (!trimmed) throw new Error('A menu item needs a name');

    const resolved = (category_id !== undefined || category !== undefined)
        ? resolveCategory({ category_id, category })
        : { category_id: existing.category_id, category: existing.category };

    const categoryRow = resolved.category_id ? getCategoryById(resolved.category_id) : null;
    const station = station_id === undefined
        ? existing.station_id
        : (station_id == null || station_id === ''
            ? (categoryRow?.station_id ?? null)
            : Number(station_id));

    const price = price_cents === undefined ? existing.price_cents : asCents(price_cents, 'The price');
    if (price === null) throw new Error('A menu item needs a price');

    db.prepare(`
        UPDATE menu_items SET
            name = ?, category = ?, category_id = ?, description = ?,
            price_cents = ?, cost_cents = ?, station_id = ?,
            is_available = ?, is_active = ?
        WHERE id = ?
    `).run(
        trimmed,
        resolved.category,
        resolved.category_id,
        description === undefined
            ? existing.description
            : (description == null || description === '' ? null : String(description)),
        price,
        cost_cents === undefined ? existing.cost_cents : asCents(cost_cents, 'The cost'),
        station,
        is_available === undefined ? existing.is_available : asFlag(is_available, existing.is_available),
        is_active === undefined ? existing.is_active : asFlag(is_active, existing.is_active),
        id
    );

    return getMenuItemById(id);
}

function deactivateMenuItem(id) {
    db.prepare(`UPDATE menu_items SET is_active = 0 WHERE id = ?`).run(id);
}

function saveMenuItemImage(id, dataUrl) {
    const item = getMenuItemById(id);
    if (!item) throw new Error(`Menu item ${id} not found`);

    const match = String(dataUrl ?? '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw new Error('The image has to be a PNG, JPEG, WebP or GIF');

    const mime = match[1].toLowerCase();
    const ext = IMAGE_TYPES[mime];
    if (!ext) throw new Error('The image has to be a PNG, JPEG, WebP or GIF');

    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) throw new Error('The image file was empty');
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Images have to be 2 MB or smaller');

    fs.mkdirSync(MENU_IMAGE_DIR, { recursive: true });

    if (item.image_path) {
        const previous = path.resolve(UPLOAD_ROOT, item.image_path);
        if (previous.startsWith(path.resolve(UPLOAD_ROOT)) && fs.existsSync(previous)) {
            fs.unlinkSync(previous);
        }
    }

    const relative = `menu-items/${id}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_ROOT, relative), buffer);
    db.prepare(`UPDATE menu_items SET image_path = ? WHERE id = ?`).run(relative, id);
    return getMenuItemById(id);
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
    updateMenuItem,
    deactivateMenuItem,
    saveMenuItemImage,
    addRecipeItem,
    getRecipeForMenuItem,
    updateRecipeItemQuantity,
    removeRecipeItem
};
