// Renders a print document as plain text.
//
// Deliberately pure: takes a document object, returns a string. No I/O, no bytes.
// This is what makes the dry-run path and the UI "view ticket" preview work without
// duplicating layout logic — the same document that becomes ESC/POS bytes for a
// printer becomes readable text here.

const { formatMoney, padRow, rule, centre, wrapName, DEFAULT_WIDTH } = require('./layout');

function renderHeader(doc, width) {
    const out = [
        centre(doc.header.title.toUpperCase(), width),
        rule(width, '='),
        ...padRow(`Ticket: ${doc.header.ticket_number}`, doc.header.order_type.toUpperCase(), width),
        doc.header.created_at,
        rule(width),
    ];
    return out;
}

function renderKitchenBody(doc, width) {
    const out = [];
    for (const item of doc.items) {
        const qtyLabel = `${item.quantity}x `;
        const nameLines = wrapName(item.name, qtyLabel.length, width);
        out.push(qtyLabel + nameLines[0]);
        for (const extra of nameLines.slice(1)) {
            out.push(' '.repeat(qtyLabel.length) + extra);
        }
        // Names the parent combo so the cook knows this component goes out as part
        // of one order rather than as a separate item.
        if (item.deal_name) {
            out.push(' '.repeat(qtyLabel.length) + `[${item.deal_name}]`);
        }
    }
    return out;
}

function renderReceiptBody(doc, width) {
    const out = [];
    for (const line of doc.receipt_lines) {
        out.push(...padRow(`${line.quantity}x ${line.name}`, formatMoney(line.amount_cents), width));
    }
    out.push(rule(width));
    out.push(...padRow('TOTAL', formatMoney(doc.total_amount_cents), width));
    return out;
}

function renderText(doc, widthOverride) {
    const width = widthOverride ?? doc.station?.paper_width ?? DEFAULT_WIDTH;
    const out = [...renderHeader(doc, width)];

    if (doc.kind === 'kitchen') {
        out.push(...renderKitchenBody(doc, width));
    } else {
        out.push(...renderReceiptBody(doc, width));
    }

    out.push(rule(width, '='));
    out.push(centre(doc.footer?.text ?? '', width));
    return out.join('\n');
}

module.exports = { renderText };
