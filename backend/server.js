const express = require('express');
const cors = require('cors');

const ingredientsRouter = require('./routes/ingredients');

const menuItemsRouter = require('./routes/menuItems');
const ordersRouter = require('./routes/orders');
const dealsRouter = require('./routes/deals');
const stationsRouter = require('./routes/stations');
const purchasesRouter = require('./routes/purchase');
const supplierRouter = require('./routes/supplier');
const app = express();
const PORT = 3001;

app.use(cors()); // local-only app, but keeps fetch() calls from the renderer simple
app.use(express.json());

app.use('/api/ingredients', ingredientsRouter);
app.use('/api/menu-items', menuItemsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/suppliers', supplierRouter);

function startServer() {
    return new Promise((resolve) => {
        const server = app.listen(PORT, 'localhost', () => {
            console.log(`Backend API listening on http://localhost:${PORT}`);
            resolve(server);
        });
    });
}
startServer();
module.exports = { app, startServer };
