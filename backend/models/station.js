const db = require('../db');

function createStation({ name, printer_type, connection_type, ip_address, port, paper_width }) {
    const stmt = db.prepare(`
        INSERT INTO stations (name, printer_type, connection_type, ip_address, port, paper_width)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
        name,
        printer_type,
        connection_type ?? null,
        ip_address ?? null,
        port ?? 9100,
        paper_width ?? 32
    ).lastInsertRowid;
}

function getAllStations() {
    return db.prepare(`SELECT * FROM stations WHERE is_active = 1 ORDER BY name ASC`).all();
}

function getStationById(id) {
    return db.prepare(`SELECT * FROM stations WHERE id = ?`).get(id);
}

// Where customer receipts go. Only one is expected in practice; if several exist the
// lowest id wins, which at least makes the choice stable and predictable rather than
// depending on row order.
function getReceiptStation() {
    return db.prepare(`
        SELECT * FROM stations
        WHERE printer_type = 'receipt' AND is_active = 1
        ORDER BY id ASC
        LIMIT 1
    `).get() ?? null;
}

function updateStation(id, { name, printer_type, connection_type, ip_address, port, paper_width }) {
    db.prepare(`
        UPDATE stations
        SET name = ?, printer_type = ?, connection_type = ?, ip_address = ?, port = ?, paper_width = ?
        WHERE id = ?
    `).run(name, printer_type, connection_type ?? null, ip_address ?? null, port ?? 9100, paper_width ?? 32, id);
}

// Soft delete, matching ingredients and menu items: order_items reference stations by
// id, so removing the row would orphan historical tickets.
function deactivateStation(id) {
    db.prepare(`UPDATE stations SET is_active = 0 WHERE id = ?`).run(id);
}

module.exports = {
    createStation,
    getAllStations,
    getStationById,
    getReceiptStation,
    updateStation,
    deactivateStation,
};
