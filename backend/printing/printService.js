// Orchestrates a print run: build documents (models/print.js) -> send them
// (printing/driver.js) -> record the outcome (models/print.js).
//
// This lives outside models/ on purpose. It's the layer that touches I/O, and the
// project rule is that models never do. Routes stay thin by calling in here.

const printModel = require('../models/print');
const { getStationById } = require('../models/station');
const { sendDocument, isLiveStation } = require('./driver');
const { renderText } = require('./renderText');

function transportFor(station) {
    return isLiveStation(station) ? 'lan' : 'dry-run';
}

// Prints every kitchen ticket that still needs sending, then the receipt.
//
// Idempotent by default: already-printed stations are skipped, so tapping Retry can't
// fire duplicate tickets at a printer that already produced one. force=true reprints
// everything deliberately.
async function printOrder(orderId, { force = false } = {}) {
    const status = printModel.getPrintStatusForOrder(orderId);
    if (!status) throw new Error(`Order ${orderId} not found`);

    const neededStationIds = printModel.getStationIdsNeedingPrint(orderId, { force });
    const kitchenDocs = printModel
        .buildKitchenDocuments(orderId)
        .filter((doc) => neededStationIds.includes(doc.station.id));

    const stations = [];
    for (const doc of kitchenDocs) {
        const result = await sendDocument(doc);
        printModel.recordKitchenPrintResult(orderId, doc.station.id, {
            ok: result.ok,
            error: result.error,
        });

        stations.push({
            station_id: doc.station.id,
            station_name: doc.station.name,
            ok: result.ok,
            transport: result.transport,
            error: result.error,
            item_count: doc.items.length,
        });
    }

    let receipt = null;
    if (printModel.needsReceiptPrint(orderId, { force })) {
        const receiptDoc = printModel.buildReceiptDocument(orderId);

        if (receiptDoc.station) {
            const result = await sendDocument(receiptDoc);
            printModel.recordReceiptPrintResult(orderId, { ok: result.ok, error: result.error });
            receipt = {
                station_name: receiptDoc.station.name,
                ok: result.ok,
                transport: result.transport,
                error: result.error,
            };
        } else {
            // No receipt printer exists yet. Deliberately NOT recorded as a failure:
            // before hardware is configured this would paint every order red and make
            // the real failures impossible to spot.
            receipt = {
                station_name: null,
                ok: false,
                transport: 'none',
                configured: false,
                error: 'No receipt printer configured',
            };
        }
    }

    return {
        order_id: Number(orderId),
        stations,
        receipt,
        status: printModel.getPrintStatusForOrder(orderId),
    };
}

// Text previews of everything that would print for this order. Powers the UI
// "View ticket" panel and makes dry-run output inspectable without the server console.
function previewOrder(orderId) {
    const status = printModel.getPrintStatusForOrder(orderId);
    if (!status) throw new Error(`Order ${orderId} not found`);

    const kitchen = printModel.buildKitchenDocuments(orderId).map((doc) => ({
        station_id: doc.station.id,
        station_name: doc.station.name,
        transport: transportFor(doc.station),
        text: renderText(doc),
    }));

    const receiptDoc = printModel.buildReceiptDocument(orderId);

    return {
        order_id: Number(orderId),
        kitchen,
        receipt: {
            station_name: receiptDoc.station?.name ?? null,
            transport: receiptDoc.station ? transportFor(receiptDoc.station) : 'none',
            text: renderText(receiptDoc),
        },
    };
}

async function testStation(stationId) {
    const station = getStationById(stationId);
    if (!station) throw new Error(`Station ${stationId} not found`);

    const doc = printModel.buildTestDocument(station);
    const result = await sendDocument(doc);

    return {
        station_id: station.id,
        station_name: station.name,
        ok: result.ok,
        transport: result.transport,
        error: result.error,
        preview: result.preview,
    };
}

module.exports = { printOrder, previewOrder, testStation };
