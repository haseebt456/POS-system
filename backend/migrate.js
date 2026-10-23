const db = require('./db');
const fs = require('fs');
const path = require('path');

// Everything the database needs beyond its first release, in one idempotent function.
//
// The split of responsibilities:
//
//   schema.sql   complete CURRENT table definitions, all `IF NOT EXISTS`. Applied first,
//                below, so it creates anything missing on a fresh database and does
//                nothing at all on one that already has the tables.
//   migrate.js   the things schema.sql structurally cannot do — adding a column to a
//                table that already exists, and filling in data that predates a feature.
//
// That gives each table one definition and each column one home, while a fresh install and
// a shop's existing install still converge on the same shape.
//
// Run from setup.js (fresh installs) and from server.js (every start — nobody re-runs
// setup on a machine that is already in use, which is where this used to fall down).

function addColumnIfMissing(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some((c) => c.name === column)) return false;

    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
}

// --- Backfills -------------------------------------------------------------
// Each is guarded by a condition that is naturally false once it has run, so these are
// safe to re-execute on every start without a bookkeeping table.

// Every distinct menu_items.category string becomes a real row in `categories`, and each
// item is linked to it. The category inherits the station its items already point at —
// which is what keeps kitchen tickets going to the right printer after routing moves from
// per-item to per-category.
//
// Items with no category are left unlinked rather than dumped into an invented bucket; the
// UI treats a NULL category_id as "Uncategorised", which is honest and reversible.
function backfillCategories() {
    const orphans = db.prepare(`
        SELECT DISTINCT category FROM menu_items
        WHERE category IS NOT NULL AND TRIM(category) <> '' AND category_id IS NULL
    `).all();
    if (!orphans.length) return false;

    const findCategory = db.prepare(`SELECT id FROM categories WHERE name = ?`);
    const insertCategory = db.prepare(`INSERT INTO categories (name, station_id, sort_order) VALUES (?, ?, ?)`);
    const nextOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories`);
    // The station this category's items most commonly print to already.
    const stationFor = db.prepare(`
        SELECT station_id FROM menu_items
        WHERE category = ? AND station_id IS NOT NULL
        GROUP BY station_id ORDER BY COUNT(*) DESC LIMIT 1
    `);
    const linkItems = db.prepare(`
        UPDATE menu_items SET category_id = ? WHERE category = ? AND category_id IS NULL
    `);

    let order = nextOrder.get().next;
    for (const { category } of orphans) {
        const name = category.trim();
        let row = findCategory.get(name);
        if (!row) {
            const station = stationFor.get(category)?.station_id ?? null;
            row = { id: insertCategory.run(name, station, order++).lastInsertRowid };
        }
        linkItems.run(row.id, category);
    }

    return true;
}

// Stock existed before there was anywhere to record where it came from. One opening row per
// ingredient that currently holds something, so the movement history doesn't start with a
// hole where the shop's actual inventory should be.
function backfillOpeningStock() {
    if (db.prepare(`SELECT 1 FROM stock_movements LIMIT 1`).get()) return false;

    const stocked = db.prepare(`SELECT id, stock_qty FROM ingredients WHERE stock_qty <> 0`).all();
    if (!stocked.length) return false;

    const insert = db.prepare(`
        INSERT INTO stock_movements (ingredient_id, delta, reason, note)
        VALUES (?, ?, 'opening', 'Opening balance recorded when stock history was introduced')
    `);

    for (const ing of stocked) insert.run(ing.id, ing.stock_qty);

    return true;
}

// order_items gained line_total_cents after orders had already been rung up, and those rows
// have no line total recorded. The backfill copies quantity x unit_price_cents rather than
// recomputing it from the deal's price today: that product is what the customer was actually
// charged, and a price change since then must not rewrite what a past order came to. Rows
// that were overcharged by the old deal-pricing bug therefore keep their historical numbers
// and stay consistent with the orders.total_amount_cents stored beside them. The fix applies
// to orders rung up from here on.
function backfillLineTotals() {
    const changed = db.prepare(`
        UPDATE order_items SET line_total_cents = quantity * unit_price_cents
        WHERE line_total_cents IS NULL
    `).run();

    return changed.changes > 0;
}

// Cash first, because it is what the till opens with and what most orders are still paid in.
function seedPaymentMethods() {
    if (db.prepare(`SELECT COUNT(*) AS c FROM payment_methods`).get().c > 0) return false;

    const insert = db.prepare(`INSERT INTO payment_methods (name, sort_order, is_cash) VALUES (?, ?, ?)`);
    ['Cash', 'Card', 'JazzCash', 'Easypaisa'].forEach((name, i) => insert.run(name, i, name === 'Cash' ? 1 : 0));

    return true;
}

// payment_methods.is_cash was added after the table was already seeded, so the existing "Cash"
// row has it at the default 0 and the till would never ask for the amount tendered.
//
// The guard is "nothing is marked as cash yet", not "this row is not marked": the second would
// re-run on every start and undo the owner un-marking Cash deliberately, whereas this one is
// true at most once per database.
function backfillCashMethod() {
    if (db.prepare(`SELECT 1 FROM payment_methods WHERE is_cash = 1 LIMIT 1`).get()) return false;

    const changed = db.prepare(`
        UPDATE payment_methods SET is_cash = 1 WHERE LOWER(TRIM(name)) = 'cash'
    `).run();

    return changed.changes > 0;
}

// Defaults only — INSERT OR IGNORE means a value the shop has since changed is never
// overwritten by a later start.
function seedSettings() {
    const defaults = {
        'business.name': 'Lucky Fast Food',
        'business.address': '',
        'business.phone': '',
        'business.currency_symbol': 'Rs.',
        // Tax is off by default and prices are treated as tax-inclusive, which is how small
        // food businesses in Pakistan normally price a menu. Turning it on is a deliberate act.
        'tax.enabled': '0',
        'tax.rate_percent': '0',
        'tax.prices_include_tax': '1',
        'receipt.footer_text': 'Thank you — please visit again',
        'receipt.print_customer_copy': '1',
        'pos.default_order_type': 'takeaway',
        // 0 = operators may not discount at all. The owner raises this deliberately.
        'pos.operator_discount_cap_cents': '0',
        'pos.require_shift_open': '0',
    };

    const insert = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    let inserted = 0;
    for (const [key, value] of Object.entries(defaults)) {
        if (insert.run(key, value).changes) inserted += 1;
    }

    return inserted > 0;
}

function runMigrations() {
    const applied = [];

    // The whole run is one transaction. DDL is transactional in SQLite, so a failure at any
    // point leaves the database exactly as it was rather than half-migrated — which matters
    // most on the one step that rewrites live data (backfillCategories), where a partial
    // application would be hard to reason about and harder to undo. Every step is
    // idempotent, so fixing the cause and restarting simply resumes.
    //
    // The backfills below deliberately open no transaction of their own. They are called
    // only from here, so a second level would exist purely to lean on savepoint nesting —
    // one flat transaction is one thing to reason about and one thing to get right.
    db.transaction(() => {

        // 1. Tables. Every statement is IF NOT EXISTS, so on an existing database this is a
        //    no-op and on a fresh one it builds everything the current code expects.
        db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

        // 2. Columns. These are the changes schema.sql cannot make, because a table that
        //    already exists is never re-created — so each one is an explicit ALTER.
        const columns = [
            // --- users: accounts, PINs and staff details ---
            ['users', 'pin_hash', 'TEXT'],
            ['users', 'full_name', 'TEXT'],
            ['users', 'phone', 'TEXT'],
            ['users', 'hourly_rate_cents', 'INTEGER'],
            ['users', 'joined_at', 'TEXT'],
            ['users', 'is_active', 'INTEGER DEFAULT 1'],

            // --- menu_items: description, image, cost and availability ---
            // The REFERENCES clauses on these three are deliberate: schema.sql gives a fresh
            // database the constraint, and without it here a migrated one would end up with the
            // column but no foreign key — two installs that look alike and behave differently.
            // SQLite allows ADD COLUMN with REFERENCES only when the column is nullable with a
            // NULL default, which all three are.
            ['menu_items', 'category_id', 'INTEGER REFERENCES categories(id)'],
            ['menu_items', 'description', 'TEXT'],
            ['menu_items', 'image_path', 'TEXT'],
            ['menu_items', 'cost_cents', 'INTEGER'],
            ['menu_items', 'is_available', 'INTEGER DEFAULT 1'],

            // --- deals: the "was / now" comparison ---
            ['deals', 'original_price_cents', 'INTEGER'],

            // --- suppliers: enough to actually contact one ---
            ['suppliers', 'address', 'TEXT'],
            ['suppliers', 'email', 'TEXT'],
            ['suppliers', 'is_active', 'INTEGER DEFAULT 1'],

            // --- orders: money, payment and shift ---
            ['orders', 'subtotal_cents', 'INTEGER'],
            ['orders', 'discount_cents', 'INTEGER DEFAULT 0'],
            ['orders', 'discount_reason', 'TEXT'],
            ['orders', 'tax_cents', 'INTEGER DEFAULT 0'],
            ['orders', 'payment_method_id', 'INTEGER REFERENCES payment_methods(id)'],
            ['orders', 'amount_tendered_cents', 'INTEGER'],
            ['orders', 'change_cents', 'INTEGER'],
            ['orders', 'shift_id', 'INTEGER REFERENCES shifts(id)'],

            // --- order_items: per-kitchen-ticket print tracking (pre-existing) ---
            ['order_items', 'print_error', 'TEXT'],
            ['order_items', 'printed_at', 'TEXT'],
            ['order_items', 'print_attempts', 'INTEGER DEFAULT 0'],
            // How many of a deal were ordered. A deal's component rows store base_qty * deal_qty,
            // so the multiplier itself can't be recovered from them — the receipt needs it to
            // print "2x Burger Combo" as a single line.
            ['order_items', 'deal_quantity', 'INTEGER'],
            // What the row contributed to the order total. Before this existed the money for a
            // deal was smuggled into the first component row's unit_price_cents, which made
            // quantity x unit_price the order total only when that component happened to have
            // quantity 1 — see expandDealToOrderItems in models/order.js.
            ['order_items', 'line_total_cents', 'INTEGER'],

            // --- orders: receipt print tracking (pre-existing) ---
            // The customer receipt is one document for the whole order, not one per station,
            // so its status has nowhere to live on order_items.
            ['orders', 'receipt_print_status', "TEXT DEFAULT 'pending'"],
            ['orders', 'receipt_printed_at', 'TEXT'],
            ['orders', 'receipt_print_error', 'TEXT'],

            // --- stations: printer transport config (pre-existing) ---
            // 9100 is the raw-print port virtually all network thermal printers listen on.
            // paper_width is characters per line: 32 for 58mm paper, 48 for 80mm.
            ['stations', 'port', 'INTEGER DEFAULT 9100'],
            ['stations', 'paper_width', 'INTEGER DEFAULT 32'],

            // --- payment_methods: which method produces change ---
            // The table itself is created by schema.sql; this is for the database that already
            // had it, where CREATE TABLE IF NOT EXISTS does nothing.
            ['payment_methods', 'is_cash', 'INTEGER DEFAULT 0'],
        ];

        for (const [table, column, definition] of columns) {
            if (addColumnIfMissing(table, column, definition)) {
                applied.push(`${table}.${column}`);
            }
        }

        // Indexes on columns the ALTERs above just created. These cannot live in schema.sql:
        // on an existing database the column does not exist until this point in the run, so a
        // CREATE INDEX there fails with "no such column" and takes the entire migration with it
        // — which, now that migrations run at startup, means the app refuses to launch.
        db.exec(`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id)`);

        // 3. Data. Runs after the columns exist, because the backfills write to them.
        if (backfillCategories()) applied.push('categories.backfilled');
        if (backfillOpeningStock()) applied.push('stock_movements.opening');
        if (backfillLineTotals()) applied.push('order_items.line_totals');
        if (seedPaymentMethods()) applied.push('payment_methods.seeded');
        if (backfillCashMethod()) applied.push('payment_methods.cash');
        if (seedSettings()) applied.push('settings.defaults');

    })();

    return applied;
}

module.exports = { runMigrations, addColumnIfMissing };
