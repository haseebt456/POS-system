// Reports what a database actually contains, so a migration can be judged by evidence
// rather than by "it didn't print an error".
//
//   node check-migration.js                    -> backend/data/POSdb.db
//   node check-migration.js data/POSdb.check.db -> a specific file
//
// Opens the database read-only and never writes to it, so pointing it at the live one is
// safe. Exits non-zero if anything the current code expects is missing.

const fs = require('fs');
const path = require('path');
const database = require('better-sqlite3');

const target = path.resolve(process.argv[2] || path.join(__dirname, 'data', 'POSdb.db'));

if (!fs.existsSync(target)) {
    console.error(`No database at ${target}`);
    process.exit(1);
}

// What the code needs to exist, table by table. The columns listed here are exactly the
// ones migrate.js adds with an ALTER — the ones CREATE TABLE IF NOT EXISTS cannot supply on
// a database whose tables already exist. They are therefore the tell: if these are present,
// migrations have run; if they are absent, nothing has.
const EXPECTED = {
    users: ['id', 'username', 'password_hash', 'pin_hash', 'full_name', 'role', 'phone',
        'hourly_rate_cents', 'joined_at', 'is_active'],
    stations: ['id', 'name', 'printer_type', 'connection_type', 'ip_address', 'port',
        'paper_width', 'is_active'],
    ingredients: ['id', 'name', 'unit', 'stock_qty', 'low_stock_threshold', 'is_trackable',
        'is_active'],
    menu_items: ['id', 'name', 'category', 'category_id', 'description', 'image_path',
        'price_cents', 'cost_cents', 'station_id', 'is_available', 'is_active'],
    recipe_items: ['id', 'menu_item_id', 'ingredient_id', 'quantity_required'],
    deals: ['id', 'name', 'price_cents', 'original_price_cents', 'is_active'],
    deal_items: ['id', 'deal_id', 'menu_item_id', 'quantity'],
    suppliers: ['id', 'name', 'contact_number', 'address', 'email', 'balance_owed_cents',
        'is_active'],
    purchases: ['id', 'supplier_id', 'total_amount_cents', 'amount_paid_cents',
        'purchase_date', 'created_by'],
    purchase_items: ['id', 'purchase_id', 'ingredient_id', 'quantity', 'unit_cost_cents'],
    supplier_payments: ['id', 'supplier_id', 'purchase_id', 'amount_cents', 'paid_date'],
    orders: ['id', 'ticket_number', 'order_type', 'status', 'total_amount_cents',
        'subtotal_cents', 'discount_cents', 'discount_reason', 'tax_cents',
        'payment_method_id', 'amount_tendered_cents', 'change_cents', 'shift_id',
        'created_by', 'created_at', 'receipt_print_status', 'receipt_printed_at',
        'receipt_print_error'],
    order_items: ['id', 'order_id', 'menu_item_id', 'station_id', 'quantity',
        'unit_price_cents', 'print_status', 'print_error', 'printed_at', 'print_attempts',
        'deal_id', 'deal_quantity'],
    categories: ['id', 'name', 'station_id', 'sort_order', 'is_active'],
    stock_movements: ['id', 'ingredient_id', 'delta', 'reason', 'ref_type', 'ref_id', 'note',
        'created_by', 'created_at'],
    settings: ['key', 'value', 'updated_at'],
    payment_methods: ['id', 'name', 'is_active', 'sort_order'],
    shifts: ['id', 'user_id', 'opened_at', 'closed_at', 'opening_float_cents', 'closing_note'],
    staff_payments: ['id', 'user_id', 'amount_cents', 'paid_date', 'note'],
    attendance: ['id', 'user_id', 'date', 'status', 'check_in', 'check_out', 'note'],
    audit_log: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'detail', 'created_at'],
    sessions: ['id', 'user_id', 'token', 'created_at', 'expires_at'],
};

const db = new database(target, { readonly: true });
const problems = [];

// Every probe is guarded: the point of this script is to report a broken database, so it
// must not be the thing that throws first.
function rows(sql, ...args) {
    try { return db.prepare(sql).all(...args); } catch { return null; }
}
function one(sql, ...args) {
    try { return db.prepare(sql).get(...args); } catch { return null; }
}

console.log(`Database: ${target}\n`);
console.log('Schema');
console.log('-'.repeat(66));

for (const [table, columns] of Object.entries(EXPECTED)) {
    const present = rows(`PRAGMA table_info(${table})`);
    if (!present || !present.length) {
        problems.push(`table ${table} is MISSING`);
        console.log(`  ${table.padEnd(18)} MISSING`);
        continue;
    }
    const names = present.map((c) => c.name);
    const missing = columns.filter((c) => !names.includes(c));
    if (missing.length) {
        problems.push(`${table}: missing column(s) ${missing.join(', ')}`);
        console.log(`  ${table.padEnd(18)} missing: ${missing.join(', ')}`);
    } else {
        console.log(`  ${table.padEnd(18)} ok (${names.length} columns)`);
    }
}

console.log('\nRows');
console.log('-'.repeat(66));
for (const table of ['users', 'stations', 'ingredients', 'menu_items', 'deals', 'suppliers',
    'purchases', 'orders', 'order_items', 'categories', 'stock_movements', 'settings',
    'payment_methods']) {
    const r = one(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`  ${table.padEnd(18)} ${r ? r.c : '— (no such table)'}`);
}

console.log('\nBackfills');
console.log('-'.repeat(66));

const link = one(`SELECT COUNT(*) AS total, SUM(category_id IS NOT NULL) AS linked FROM menu_items`);
if (link) {
    console.log(`  menu_items with a category_id:   ${link.linked ?? 0} of ${link.total}`);
}

const withText = one(`
    SELECT COUNT(*) AS c FROM menu_items
    WHERE category IS NOT NULL AND TRIM(category) <> '' AND category_id IS NULL
`);
if (withText) {
    console.log(`  ...still unlinked but categorised: ${withText.c}`);
    // Not necessarily a fault: it means the backfill did not cover them, which is worth
    // knowing before the menu screens start filtering by category.
    if (withText.c > 0) problems.push(`${withText.c} menu_items have category text but no category_id`);
}

const opening = one(`SELECT COUNT(*) AS c FROM stock_movements WHERE reason = 'opening'`);
if (opening) console.log(`  opening stock movements:         ${opening.c}`);

const seeded = one(`SELECT GROUP_CONCAT(name, ', ') AS names FROM payment_methods`);
if (seeded) console.log(`  payment methods:                 ${seeded.names ?? '(none)'}`);

const settings = one(`SELECT COUNT(*) AS c FROM settings`);
if (settings) console.log(`  settings rows:                   ${settings.c}`);

console.log('\nIntegrity');
console.log('-'.repeat(66));
const fk = rows(`PRAGMA foreign_key_check`);
if (fk) {
    console.log(`  foreign key violations:          ${fk.length}`);
    if (fk.length) {
        problems.push(`${fk.length} row(s) violate a foreign key — run PRAGMA foreign_key_check for detail`);
    }
}

const dupes = one(`
    SELECT COUNT(*) AS c FROM (
        SELECT ticket_number FROM orders GROUP BY ticket_number HAVING COUNT(*) > 1
    )
`);
if (dupes) console.log(`  duplicate ticket numbers:        ${dupes.c}`);

db.close();

console.log('\n' + '='.repeat(66));
if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
}
console.log('Everything the current code expects is present.');
