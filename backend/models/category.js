const db = require('../db');

function getAllCategories({ all = false } = {}) {
    const where = all ? '' : 'WHERE is_active = 1';
    return db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = c.id AND m.is_active = 1) AS item_count
        FROM categories c
        ${where}
        ORDER BY c.sort_order ASC, c.id ASC
    `).all();
}

function getCategoryById(id) {
    return db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
}

function findCategoryByName(name) {
    return db.prepare(`SELECT * FROM categories WHERE LOWER(name) = LOWER(?)`).get(name);
}

function nextSortOrder() {
    return db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories`).get().next;
}

function createCategory({ name, station_id = null, sort_order, is_active = 1 }) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new Error('A category needs a name');
    if (findCategoryByName(trimmed)) throw new Error(`A category named ${trimmed} already exists`);

    const station = station_id == null || station_id === '' ? null : Number(station_id);
    const order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : nextSortOrder();

    const result = db.prepare(`
        INSERT INTO categories (name, station_id, sort_order, is_active)
        VALUES (?, ?, ?, ?)
    `).run(trimmed, station, order, is_active ? 1 : 0);

    return result.lastInsertRowid;
}

function updateCategory(id, { name, station_id, sort_order, is_active }) {
    const existing = getCategoryById(id);
    if (!existing) throw new Error(`Category ${id} not found`);

    const trimmed = name == null ? existing.name : String(name).trim();
    if (!trimmed) throw new Error('A category needs a name');

    const clash = findCategoryByName(trimmed);
    if (clash && Number(clash.id) !== Number(existing.id)) {
        throw new Error(`A category named ${trimmed} already exists`);
    }

    const station = station_id === undefined
        ? existing.station_id
        : (station_id == null || station_id === '' ? null : Number(station_id));
    const order = sort_order === undefined ? existing.sort_order : Number(sort_order);
    const active = is_active === undefined ? existing.is_active : (is_active ? 1 : 0);

    const write = db.transaction(() => {
        db.prepare(`
            UPDATE categories SET name = ?, station_id = ?, sort_order = ?, is_active = ?
            WHERE id = ?
        `).run(trimmed, station, order, active, id);

        // The free-text column is still what the till tabs read. Keep it in step with the
        // name of the row it points at, or a rename would only show up on new items.
        if (trimmed !== existing.name) {
            db.prepare(`UPDATE menu_items SET category = ? WHERE category_id = ?`).run(trimmed, id);
        }
    });
    write();
}

function deactivateCategory(id) {
    const existing = getCategoryById(id);
    if (!existing) throw new Error(`Category ${id} not found`);
    db.prepare(`UPDATE categories SET is_active = 0 WHERE id = ?`).run(id);
}

function reorderCategories(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('A reorder needs the list of category ids in the new order');
    }

    const existing = db.prepare(`SELECT id FROM categories`).all().map((row) => row.id);
    const incoming = ids.map((id) => Number(id));
    if (incoming.some((id) => !Number.isInteger(id))) {
        throw new Error('A reorder needs numeric category ids');
    }
    if (incoming.length !== existing.length || new Set(incoming).size !== incoming.length) {
        throw new Error('The reorder list must contain every category exactly once');
    }
    const existingSet = new Set(existing);
    if (incoming.some((id) => !existingSet.has(id))) {
        throw new Error('The reorder list contains a category that does not exist');
    }

    const setOrder = db.prepare(`UPDATE categories SET sort_order = ? WHERE id = ?`);
    const write = db.transaction(() => {
        incoming.forEach((id, index) => setOrder.run(index, id));
    });
    write();
}

module.exports = {
    getAllCategories,
    getCategoryById,
    findCategoryByName,
    createCategory,
    updateCategory,
    deactivateCategory,
    reorderCategories,
};
