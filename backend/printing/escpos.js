// ESC/POS encoder: print document -> Buffer of raw printer bytes.
//
// Pure function — takes a document, returns bytes. Opens no sockets, reads no
// database. Hand-rolled rather than using a library: the command set needed here is
// small and stable, and this keeps the shop PC's install dependency-free. The layout
// maths is shared with renderText.js via layout.js so paper and preview always agree.

const { formatMoney, padRow, rule, centre, wrapName, DEFAULT_WIDTH } = require('./layout');

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
    init: Buffer.from([ESC, 0x40]), // ESC @  — reset printer state
    alignLeft: Buffer.from([ESC, 0x61, 0x00]),
    alignCentre: Buffer.from([ESC, 0x61, 0x01]),
    boldOn: Buffer.from([ESC, 0x45, 0x01]),
    boldOff: Buffer.from([ESC, 0x45, 0x00]),
    doubleOn: Buffer.from([GS, 0x21, 0x11]), // GS ! 0x11 — double width + height
    doubleOff: Buffer.from([GS, 0x21, 0x00]),
    feed: Buffer.from([ESC, 0x64, 0x03]), // ESC d 3 — feed 3 lines before cutting
    cut: Buffer.from([GS, 0x56, 0x42, 0x00]), // GS V 66 0 — partial cut with feed
};

// Thermal printers print bytes, not Unicode. Anything outside printable ASCII would
// come out as garbage glyphs, so it's replaced with '?' — visibly wrong rather than
// silently wrong. Supporting non-Latin scripts would need an explicit codepage
// command (ESC t n) and a matching codepage selected on the printer.
function sanitize(value) {
    return String(value ?? '').replace(/[^\x20-\x7E\n]/g, '?');
}

function line(value) {
    return Buffer.from(sanitize(value) + '\n', 'latin1');
}

function encodeKitchenBody(doc, width, chunks) {
    for (const item of doc.items) {
        const qtyLabel = `${item.quantity}x `;
        const nameLines = wrapName(item.name, qtyLabel.length, width);

        chunks.push(CMD.boldOn, line(qtyLabel + nameLines[0]), CMD.boldOff);
        for (const extra of nameLines.slice(1)) {
            chunks.push(line(' '.repeat(qtyLabel.length) + extra));
        }
        // Names the parent combo so the cook knows this is one order, not separate items.
        if (item.deal_name) {
            chunks.push(line(' '.repeat(qtyLabel.length) + `[${item.deal_name}]`));
        }
    }
}

function encodeReceiptBody(doc, width, chunks) {
    for (const entry of doc.receipt_lines) {
        for (const l of padRow(`${entry.quantity}x ${entry.name}`, formatMoney(entry.amount_cents), width)) {
            chunks.push(line(l));
        }
    }
    chunks.push(line(rule(width)));
    chunks.push(CMD.boldOn);
    for (const l of padRow('TOTAL', formatMoney(doc.total_amount_cents), width)) {
        chunks.push(line(l));
    }
    chunks.push(CMD.boldOff);
}

function encodeDocument(doc) {
    const width = doc.station?.paper_width ?? DEFAULT_WIDTH;
    const chunks = [CMD.init];

    // Title — centred and double-size so it's readable at a glance across the kitchen.
    chunks.push(CMD.alignCentre, CMD.doubleOn, line(doc.header.title.toUpperCase()), CMD.doubleOff);

    chunks.push(CMD.alignLeft);
    chunks.push(CMD.boldOn, line(`Ticket: ${doc.header.ticket_number}`), CMD.boldOff);
    chunks.push(line(`${doc.header.order_type.toUpperCase()}  ${doc.header.created_at}`));
    chunks.push(line(rule(width, '=')));

    if (doc.kind === 'kitchen') {
        encodeKitchenBody(doc, width, chunks);
    } else {
        encodeReceiptBody(doc, width, chunks);
    }

    chunks.push(line(rule(width, '=')));
    chunks.push(CMD.alignCentre, line(centre(doc.footer?.text ?? '', width)));
    chunks.push(CMD.alignLeft, CMD.feed, CMD.cut);

    return Buffer.concat(chunks);
}

module.exports = { encodeDocument, CMD };
