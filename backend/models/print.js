const db = require('../db');
const { getStationById, getReceiptStation } = require('./station');

// Builds print documents from the database. Transport-agnostic in the same sense as
// every other model: plain rows in, plain objects out. It never encodes bytes and
// never opens a socket — that's printing/escpos.js and printing/driver.js. That split
// is what lets the ticket layout be tested without a printer attached.

const FOOTER_TEXT = 'Lucky Fast Food';

// deal_quantity is snapshotted at order time (like station_id) because a deal's
// component quantities are expanded into the row quantities and the original
// multiplier can't be recovered from them afterwards.
const ORDER_ITEMS_SQL = `
    SELECT oi.id, oi.menu_item_id, oi.station_id, oi.quantity, oi.unit_price_cents,
           oi.deal_id, oi.deal_quantity, oi.print_status,
           mi.name AS menu_item_name,
           d.name  AS deal_name
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN deals d  ON d.id = oi.deal_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
`;

function timestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function getOrder(orderId) {
    return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
}

function getOrderItems(orderId) {
    return db.prepare(ORDER_ITEMS_SQL).all(orderId);
}

// --- Document builders -------------------------------------------------------

// One document per station that has items on this order. Kitchen tickets are routed,
// so each station's ticket carries only its own items — that's the whole point of
// station_id being snapshotted onto order_items.
//
// Items with no station_id are skipped: without one there's no printer to route to.
// getPrintStatusForOrder reports them as unroutable rather than letting them vanish.
function buildKitchenDocuments(orderId) {
    const order = getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const byStation = new Map();
    for (const item of getOrderItems(orderId)) {
        if (item.station_id == null) continue;
        if (!byStation.has(item.station_id)) byStation.set(item.station_id, []);
        byStation.get(item.station_id).push(item);
    }

    const documents = [];
    for (const [stationId, items] of byStation) {
        const station = getStationById(stationId);
        if (!station) continue; // station hard-deleted out from under historical rows

        documents.push({
            kind: 'kitchen',
            station,
            header: {
                // Plain ASCII colon, not an em dash: sanitize() in escpos.js blanks
                // anything outside printable ASCII to '?', and this header is the
                // double-size line the cook reads across the kitchen.
                title: `Kitchen: ${station.name}`,
                ticket_number: order.ticket_number,
                order_type: order.order_type,
                created_at: order.created_at,
            },
            // Components listed individually: the cook makes each item, so collapsing
            // a deal here would hide work. deal_name just labels which combo it's from.
            items: items.map((i) => ({
                name: i.menu_item_name,
                quantity: i.quantity,
                deal_name: i.deal_name ?? null,
            })),
            receipt_lines: [],
            total_amount_cents: 0,
            footer: { text: FOOTER_TEXT },
        });
    }

    return documents;
}

// The customer receipt is the opposite of the kitchen ticket: deals collapse into a
// single line ("Burger Combo — Rs. 500"), because the customer bought a combo, not
// its parts.
function buildReceiptDocument(orderId) {
    const order = getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const items = getOrderItems(orderId);
    const lines = [];
    const seenDeals = new Set();

    for (const item of items) {
        if (item.deal_id) {
            // First row of a deal carries the whole deal price; the rest are priced 0
            // (see expandDealToOrderItems). Rows are id-ordered, so the first one seen
            // per deal is the priced one — that's the price snapshot.
            if (seenDeals.has(item.deal_id)) continue;
            seenDeals.add(item.deal_id);

            const dealQty = item.deal_quantity ?? 1;
            lines.push({
                name: item.deal_name ?? 'Deal',
                quantity: dealQty,
                amount_cents: dealQty * item.unit_price_cents,
            });
        } else {
            lines.push({
                name: item.menu_item_name,
                quantity: item.quantity,
                amount_cents: item.quantity * item.unit_price_cents,
            });
        }
    }

    return {
        kind: 'receipt',
        station: getReceiptStation(),
        header: {
            title: 'Receipt',
            ticket_number: order.ticket_number,
            order_type: order.order_type,
            created_at: order.created_at,
        },
        items: [],
        receipt_lines: lines,
        total_amount_cents: order.total_amount_cents,
        footer: { text: FOOTER_TEXT },
    };
}

// Used by the "Test print" button on a station — the fastest way to confirm a printer
// works the moment it's plugged in, without ringing up a real order.
function buildTestDocument(station) {
    const isReceipt = station.printer_type === 'receipt';
    return {
        kind: isReceipt ? 'receipt' : 'kitchen',
        station,
        header: {
            title: 'Test print',
            ticket_number: 'TEST',
            order_type: station.name,
            created_at: timestamp(),
        },
        items: [{ name: 'Test item', quantity: 1, deal_name: null }],
        receipt_lines: [{ name: 'Test item', quantity: 1, amount_cents: 10000 }],
        total_amount_cents: 10000,
        footer: { text: FOOTER_TEXT },
    };
}

// --- Print status ------------------------------------------------------------

// Which kitchen stations still need a ticket. With force=false only stations holding
// unprinted or failed items are returned — that's what makes retrying idempotent, so
// a double-click can't emit duplicate tickets to a printer that already printed.
function getStationIdsNeedingPrint(orderId, { force = false } = {}) {
    const items = getOrderItems(orderId);

    if (force) {
        return [...new Set(items.filter((i) => i.station_id != null).map((i) => i.station_id))];
    }

    return [
        ...new Set(
            items
                .filter((i) => i.station_id != null && i.print_status !== 'printed')
                .map((i) => i.station_id)
        ),
    ];
}

function needsReceiptPrint(orderId, { force = false } = {}) {
    if (force) return true;
    const order = getOrder(orderId);
    return !!order && order.receipt_print_status !== 'printed';
}

function recordKitchenPrintResult(orderId, stationId, { ok, error = null }) {
    const apply = db.transaction(() => {
        if (ok) {
            db.prepare(`
                UPDATE order_items
                SET print_status = 'printed', printed_at = ?, print_error = NULL,
                    print_attempts = print_attempts + 1
                WHERE order_id = ? AND station_id = ?
            `).run(timestamp(), orderId, stationId);
        } else {
            db.prepare(`
                UPDATE order_items
                SET print_status = 'failed', print_error = ?,
                    print_attempts = print_attempts + 1
                WHERE order_id = ? AND station_id = ?
            `).run(error, orderId, stationId);
        }
    });
    apply();
}

function recordReceiptPrintResult(orderId, { ok, error = null }) {
    if (ok) {
        db.prepare(`
            UPDATE orders
            SET receipt_print_status = 'printed', receipt_printed_at = ?, receipt_print_error = NULL
            WHERE id = ?
        `).run(timestamp(), orderId);
    } else {
        db.prepare(`
            UPDATE orders
            SET receipt_print_status = 'failed', receipt_print_error = ?
            WHERE id = ?
        `).run(error, orderId);
    }
}

// Everything the UI needs to render a print badge for one order: per-station kitchen
// state, receipt state, and any items that couldn't be routed at all.
function getPrintStatusForOrder(orderId) {
    const order = getOrder(orderId);
    if (!order) return null;

    const items = getOrderItems(orderId);
    const byStation = new Map();
    let unroutable = 0;

    for (const item of items) {
        if (item.station_id == null) {
            unroutable += 1;
            continue;
        }
        if (!byStation.has(item.station_id)) {
            byStation.set(item.station_id, { station_id: item.station_id, item_count: 0, statuses: new Set(), errors: [] });
        }
        const entry = byStation.get(item.station_id);
        entry.item_count += 1;
        entry.statuses.add(item.print_status);
        if (item.print_error) entry.errors.push(item.print_error);
    }

    const stations = [...byStation.values()].map((entry) => {
        const station = getStationById(entry.station_id);
        let status = 'printed';
        if (entry.statuses.has('failed')) status = 'failed';
        else if (entry.statuses.has('pending')) status = 'pending';

        return {
            station_id: entry.station_id,
            station_name: station?.name ?? `Station ${entry.station_id}`,
            status,
            item_count: entry.item_count,
            error: entry.errors[0] ?? null,
        };
    });

    const failedStations = stations.filter((s) => s.status === 'failed').length;
    const receiptFailed = order.receipt_print_status === 'failed';

    return {
        order_id: order.id,
        receipt: {
            status: order.receipt_print_status ?? 'pending',
            error: order.receipt_print_error ?? null,
            printed_at: order.receipt_printed_at ?? null,
        },
        stations,
        unroutable_item_count: unroutable,
        all_printed:
            stations.every((s) => s.status === 'printed') &&
            (order.receipt_print_status ?? 'pending') === 'printed' &&
            unroutable === 0,
        has_failure: failedStations > 0 || receiptFailed,
    };
}

module.exports = {
    buildKitchenDocuments,
    buildReceiptDocument,
    buildTestDocument,
    getStationIdsNeedingPrint,
    needsReceiptPrint,
    recordKitchenPrintResult,
    recordReceiptPrintResult,
    getPrintStatusForOrder,
    getOrderItems,
    FOOTER_TEXT,
};
