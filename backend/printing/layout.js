// Pure text-layout helpers shared by both renderers.
//
// Both the plain-text renderer and the ESC/POS encoder need identical column maths —
// if they each did their own, a ticket would look one way in the preview and another
// way on paper, which is exactly the kind of bug that only shows up at the till.
// No I/O and no ESC/POS knowledge lives here.

const DEFAULT_WIDTH = 32; // 58mm thermal paper. 80mm printers use 48.

// Deliberately NOT toLocaleString(): that follows the machine's system locale. On a
// shop PC set to Urdu it returns Arabic-Indic digits ("١٬٠٠٠"), which the ESC/POS
// encoder's sanitize() then turns into "Rs. ????" — a price silently destroyed on
// paper, and only on the customer's machine, never on the developer's. Grouping is
// done by hand so the output is byte-for-byte identical everywhere.
function formatMoney(cents) {
    const value = cents ?? 0;
    const abs = Math.abs(value);
    const rupees = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const paisa = abs % 100;
    // Paisa only when they exist — every price in this shop is whole rupees, and
    // "Rs. 300" reads better in 32 columns than "Rs. 300.00".
    const fraction = paisa === 0 ? '' : `.${String(paisa).padStart(2, '0')}`;
    return `Rs. ${value < 0 ? '-' : ''}${rupees}${fraction}`;
}

// Pads both sides so the row fills the paper width. If the label is too long to
// leave room for the amount, the amount drops to its own line rather than silently
// truncating a price — a wrong price on a ticket is worse than an ugly one.
function padRow(left, right, width) {
    const gap = width - left.length - right.length;
    if (gap < 1) return [left, right.padStart(width)];
    return [left + ' '.repeat(gap) + right];
}

function rule(width, char = '-') {
    return char.repeat(width);
}

function centre(text, width) {
    const gap = width - text.length;
    if (gap <= 0) return text;
    return ' '.repeat(Math.floor(gap / 2)) + text;
}

// Wraps a long item name onto continuation lines so it never collides with the
// quantity column on the left.
function wrapName(name, indent, width) {
    const available = width - indent;
    if (available <= 0 || name.length <= available) return [name];

    const lines = [];
    let current = '';
    for (const word of name.split(' ')) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > available) {
            if (current) lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines;
}

module.exports = { formatMoney, padRow, rule, centre, wrapName, DEFAULT_WIDTH };
