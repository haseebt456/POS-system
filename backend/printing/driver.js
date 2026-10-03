// Print transport: the ONLY place in the codebase that opens a socket.
//
// Everything else deals in documents (models/print.js) and bytes (escpos.js). Keeping
// the I/O isolated here is the same seam that made the IPC->HTTP migration cheap: the
// day these printers get wired up, or swapped for a different model, this is the only
// file that changes.

const net = require('net');
const { encodeDocument } = require('./escpos');
const { renderText } = require('./renderText');

// A dead printer must never hang an order. 5s is comfortably longer than a healthy
// WiFi print and short enough that the operator isn't left staring at a spinner.
const SOCKET_TIMEOUT_MS = 5000;
const DEFAULT_PORT = 9100;

// A station is only "live" if it has actually been configured with a network address.
// Everything else falls back to dry-run, which is what makes the whole pipeline
// testable before any hardware exists.
function isLiveStation(station) {
    return station?.connection_type === 'lan' && !!station?.ip_address;
}

function sendOverTcp(buffer, station) {
    const port = station.port ?? DEFAULT_PORT;

    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        // Both 'timeout' and 'error' can fire on the same bad host, so the first
        // result wins and the rest are ignored.
        function finish(result) {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        }

        socket.setTimeout(SOCKET_TIMEOUT_MS);
        socket.once('timeout', () => finish({
            ok: false,
            error: `Timed out after ${SOCKET_TIMEOUT_MS}ms connecting to ${station.ip_address}:${port}`,
        }));
        socket.once('error', (err) => finish({
            ok: false,
            error: `${err.code ?? 'ERROR'}: ${err.message} (${station.ip_address}:${port})`,
        }));

        socket.connect(port, station.ip_address, () => {
            // end() flushes and closes; the callback fires once the bytes are away.
            socket.end(buffer, () => finish({ ok: true, error: null }));
        });
    });
}

// Sends one document to one station. Always resolves — never throws — so a printer
// problem can't take down order creation. The caller records the result.
async function sendDocument(doc) {
    const station = doc.station ?? null;
    const preview = renderText(doc);

    if (!isLiveStation(station)) {
        console.log(`[print:dry-run] ${doc.kind} -> ${station?.name ?? 'no station'}\n${preview}\n`);
        return {
            ok: true,
            transport: 'dry-run',
            error: null,
            preview,
            bytes: 0,
        };
    }

    const buffer = encodeDocument(doc);
    const result = await sendOverTcp(buffer, station);

    return {
        ok: result.ok,
        transport: 'lan',
        error: result.error ?? null,
        preview,
        bytes: buffer.length,
    };
}

module.exports = { sendDocument, isLiveStation, SOCKET_TIMEOUT_MS, DEFAULT_PORT };
