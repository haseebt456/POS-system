const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const authRouter = require('./routes/auth');
const ingredientsRouter = require('./routes/ingredients');

const menuItemsRouter = require('./routes/menuItems');
const ordersRouter = require('./routes/orders');
const paymentMethodsRouter = require('./routes/paymentMethods');
const posConfigRouter = require('./routes/posConfig');
const stockMovementsRouter = require('./routes/stockMovements');
const dealsRouter = require('./routes/deals');
const stationsRouter = require('./routes/stations');
const purchasesRouter = require('./routes/purchase');
const supplierRouter = require('./routes/supplier');
const categoriesRouter = require('./routes/categories');
const { runMigrations } = require('./migrate');
const { requireAuth, requireRole } = require('./middleware/auth');

// schema.sql only ever builds a *fresh* database — every CREATE TABLE in it is
// IF NOT EXISTS, so on an installed database it silently does nothing. Column additions
// therefore live in migrate.js, and this is the only place they get applied on a machine
// that is already running the app.
//
// This call used to exist only in setup.js. Nobody re-runs setup on a working install, so
// migrations never ran where it mattered: order_items.deal_quantity is written by
// models/order.js on every deal order and was never created. Refuse to start rather than
// serve a schema the code has moved past.
try {
    const applied = runMigrations();
    if (applied.length) console.log(`Migrations applied: ${applied.join(', ')}`);
} catch (err) {
    console.error('Migration failed — refusing to start against a stale schema.');
    console.error(err);
    process.exit(1);
}

const app = express();
// Overridable so the test runner can bind a spare port rather than fight the instance the
// shop is actually using.
const PORT = Number(process.env.PORT) || 3001;

app.use(cors()); // local-only app, but keeps fetch() calls from the renderer simple
app.use(express.json({ limit: '3mb' }));

// Menu item photos. Served outside /api so an <img> can load them without a bearer token.
// Local-only, same tradeoff as GET /api/auth/operators.
const uploadsDir = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// --- Authorization ---------------------------------------------------------
//
// The order of these mounts is the whole design. requireAuth is attached to the `/api`
// prefix rather than to each router, so a route group added later is authenticated by
// default: forgetting to guard it is not possible, only consciously opting out by mounting
// it above this line — which is exactly what /api/auth does, and it is the only one.
//
// This matters because the alternative (a requireAuth on each router) fails open. The
// mistake it produces is a silent, unauthenticated endpoint, and nothing in the app would
// look wrong until someone found it.

// Public: the login screen itself. Mounted first precisely so it is not caught below.
app.use('/api/auth', authRouter);

// Everything past this point needs a session.
app.use('/api', requireAuth);

// Reading the menu, the deals and stock levels is part of taking an order, so an operator
// needs all three. Changing any of them is an administrative act.
//
// Stock adjustment is the one place this will need revisiting: the brief lets an operator
// correct a count with a reason attached. That route does not exist yet — it arrives with
// stock_movements in M3, and it gets its own narrow, audited endpoint rather than being
// re-opened by loosening this one.
const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function adminForWrites(req, res, next) {
    if (!WRITE_METHODS.has(req.method.toLowerCase())) return next();
    return requireRole('admin')(req, res, next);
}

app.use('/api/menu-items', adminForWrites, menuItemsRouter);
app.use('/api/categories', adminForWrites, categoriesRouter);
app.use('/api/deals', adminForWrites, dealsRouter);
app.use('/api/ingredients', adminForWrites, ingredientsRouter);

// Operators ring up orders; this is the till.
app.use('/api/orders', ordersRouter);

// Read-only and useful to both roles: an operator picks a payment method when taking money,
// and the order history filters by one. Nothing here is administrative, so no role guard —
// writes would be, and they arrive with Settings → POS Configuration in M7.
app.use('/api/payment-methods', paymentMethodsRouter);

// The POS settings the till itself acts on — the default order type and what this user is
// allowed to discount. Both roles read it; an operator cannot do their job without knowing
// their ceiling, and knowing it tells them nothing about the shop's finances.
app.use('/api/pos-config', posConfigRouter);

// The stock ledger, admin-only. Every write path appends to it directly through
// models/ingredient.js and models/order.js — there is no route to post a movement, so this
// being read-only is a property of the model, not a guard that could be forgotten.
//
// The comment above adminForWrites predicted a narrow operator-facing adjustment endpoint
// here. It did not arrive: the existing stock count route already covers "correct the shelf
// with a reason attached", and it is admin-only, so nothing needs loosening. What an operator
// may adjust is still open — see frontend/DESIGN.md §6.
app.use('/api/stock-movements', requireRole('admin'), stockMovementsRouter);

// Admin-only in full. Purchases and supplier balances are the financial data the brief
// keeps away from operators, and stations are printer configuration — Settings, not the
// shop floor.
app.use('/api/purchases', requireRole('admin'), purchasesRouter);
app.use('/api/suppliers', requireRole('admin'), supplierRouter);
app.use('/api/stations', requireRole('admin'), stationsRouter);

function startServer() {
    return new Promise((resolve) => {
        const server = app.listen(PORT, 'localhost', () => {
            console.log(`Backend API listening on http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

// Only when this file is the entry point (`node server.js`).
//
// It used to run on every require. Electron's main.js requires this module and *then*
// calls startServer() itself inside app.whenReady(), so port 3001 was bound twice: the
// first bind served, and the second — with no 'error' handler on the promise — never
// resolved, meaning the createWindow() awaiting it depended on winning a race. Binding in
// exactly one place, chosen by how the file was loaded, removes the second attempt.
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
