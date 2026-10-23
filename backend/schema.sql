-- Users (operator and admin login)
--
-- password_hash is NOT NULL and always holds a real bcrypt hash. An operator who signs in
-- with a PIN only still gets one: it is the hash of a random token generated at creation,
-- so it can never match anything typed. That is the "password disabled" case, and it keeps
-- one rule — every account has a hash — rather than a nullable column the code must branch on.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin_hash TEXT,                       -- short numeric PIN; NULL means PIN login is disabled
    full_name TEXT,
    role TEXT DEFAULT 'operator',        -- 'operator' | 'admin'
    phone TEXT,
    hourly_rate_cents INTEGER,
    joined_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Printer stations
CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    printer_type TEXT NOT NULL,        -- 'kitchen' or 'receipt'
    connection_type TEXT,              -- 'usb' or 'lan'
    ip_address TEXT,
    port INTEGER DEFAULT 9100,         -- raw-print port used by network thermal printers
    paper_width INTEGER DEFAULT 32,    -- characters per line: 32 = 58mm, 48 = 80mm
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_qty REAL NOT NULL DEFAULT 0,
    low_stock_threshold REAL DEFAULT 0,
    is_trackable INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    -- The original free-text category is kept and still written, so nothing that reads it
    -- breaks. category_id is the real relationship; the backfill in migrate.js populates it
    -- from these strings and the two stay in step from then on.
    category TEXT,
    category_id INTEGER REFERENCES categories(id),
    description TEXT,
    image_path TEXT,
    price_cents INTEGER NOT NULL,
    cost_cents INTEGER,                  -- what it costs to make; drives profit reports
    station_id INTEGER REFERENCES stations(id),   -- per-item override of the category's printer
    is_available INTEGER DEFAULT 1,      -- today's "sold out" switch, separate from is_active
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id),
    quantity_required REAL NOT NULL
);

-- Deals (combos/bundles)
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,        -- bundled price, usually less than the sum of its parts
    -- Sum of the components' own prices, stored so the UI can show "Rs. 620 → Rs. 500"
    -- without recomputing it from deal_items on every read (and so it survives a price change).
    original_price_cents INTEGER,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS deal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_number TEXT,
    address TEXT,
    email TEXT,
    balance_owed_cents INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    total_amount_cents INTEGER NOT NULL,
    amount_paid_cents INTEGER DEFAULT 0,
    purchase_date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id),
    quantity INTEGER NOT NULL,
    unit_cost_cents INTEGER NOT NULL
);

-- Supplier payments
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_id INTEGER REFERENCES purchases(id),
    amount_cents INTEGER NOT NULL,
    paid_date TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    order_type TEXT DEFAULT 'takeaway',
    status TEXT DEFAULT 'pending',       -- pending, printed, completed
    -- What the customer actually owes after discount and tax. Kept as the single
    -- authoritative total so the receipt, the reports and the order history agree.
    total_amount_cents INTEGER NOT NULL,
    subtotal_cents INTEGER,              -- before discount and tax
    discount_cents INTEGER DEFAULT 0,
    discount_reason TEXT,
    tax_cents INTEGER DEFAULT 0,
    payment_method_id INTEGER REFERENCES payment_methods(id),
    amount_tendered_cents INTEGER,       -- cash handed over; drives change_cents
    change_cents INTEGER,
    shift_id INTEGER REFERENCES shifts(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- The receipt is one document per order, not per station, so its print state
    -- can't live on order_items the way kitchen tickets do.
    receipt_print_status TEXT DEFAULT 'pending',
    receipt_printed_at TEXT,
    receipt_print_error TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id),
    station_id INTEGER REFERENCES stations(id),  -- snapshot at order time
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    print_status TEXT DEFAULT 'pending',
    print_error TEXT,                            -- why the last attempt failed
    printed_at TEXT,
    print_attempts INTEGER DEFAULT 0,
    deal_id INTEGER REFERENCES deals(id),        -- groups components of one deal for receipt printing
    deal_quantity INTEGER,                       -- how many of the deal were ordered
    -- What this row contributed to the order total. A component of a deal has no price of
    -- its own — the bundle does — so unit_price_cents is 0 on those rows and the deal's
    -- money sits here, on the first component row, as price x deal_quantity. That makes
    -- SUM(line_total_cents) the order's subtotal, which is what lets a report read
    -- order_items directly instead of re-deriving the total from quantities and guessing
    -- which row of a deal was the priced one.
    line_total_cents INTEGER
);

-- ===========================================================================
-- Added after the first release.
--
-- These live here rather than in migrate.js so each table has exactly one
-- definition. runMigrations() applies this whole file before doing anything
-- else, and every statement in it is guarded — so an installed database
-- creating these for the first time and a fresh one creating them from scratch
-- end up identical.
--
-- Columns added to tables that ALREADY exist cannot go here: CREATE TABLE IF
-- NOT EXISTS does nothing once the table is there. Those are explicit ALTERs in
-- migrate.js, which is what that file is for.
-- ===========================================================================

-- Menu categories — also the printer-routing spine. An item's category decides
-- which station its kitchen ticket prints to; an item may override it.
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    station_id INTEGER REFERENCES stations(id),
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

-- Ledger of every stock change. ingredients.stock_qty remains the running
-- balance; this records how it got there, which nothing could answer before.
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER REFERENCES ingredients(id),
    delta REAL NOT NULL,            -- signed: negative for sales, waste and negative adjustments
    reason TEXT NOT NULL,           -- 'opening' | 'purchase' | 'sale' | 'adjustment' | 'waste'
    ref_type TEXT,                  -- 'purchase' | 'order'; NULL for a manual adjustment
    ref_id INTEGER,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Application configuration: business details, receipt layout, POS behaviour.
-- One row per key, so a new setting never needs a migration.
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    -- Whether this method takes physical cash, which is the only kind that produces change.
    -- A flag rather than matching on the name: the shop can rename a method, and a till that
    -- decided "is this cash?" by comparing strings to 'Cash' would quietly stop asking for the
    -- amount tendered the moment someone called it "Cash (counter)".
    is_cash INTEGER DEFAULT 0
);

-- A till session. orders.shift_id ties an order to the shift that rang it up,
-- which is what makes "who was on the till" answerable at close.
CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,
    opening_float_cents INTEGER DEFAULT 0,
    closing_note TEXT
);

CREATE TABLE IF NOT EXISTS staff_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    paid_date TEXT DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    date TEXT NOT NULL,                          -- 'YYYY-MM-DD', local to the shop
    status TEXT NOT NULL DEFAULT 'present',      -- 'present' | 'absent' | 'half-day' | 'leave'
    check_in TEXT,
    check_out TEXT,
    note TEXT
);

-- Who did what. Written for the actions that move money or change the menu.
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,           -- 'login' | 'order.void' | 'price.update' | 'stock.adjust' ...
    entity_type TEXT,               -- 'order' | 'menu_item' | 'ingredient' ...
    entity_id INTEGER,
    detail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Login sessions, as opaque random tokens. Deleting the row revokes the session,
-- which a self-contained token could not do without a blocklist.
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
);

-- Indexes for the reads the new screens make: movements for one ingredient over time,
-- orders by date, and a token lookup on every authenticated request.
--
-- Every column indexed here belongs to a table created in THIS file, so the column exists
-- the moment this file runs. An index on a column that migrate.js adds with an ALTER cannot
-- live here: on an existing database the CREATE TABLE above is a no-op, the column is still
-- missing, and this would fail with "no such column" — taking the whole migration with it.
-- idx_menu_items_category is the one that falls in that category, and it is created at the
-- end of migrate.js instead.
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);