const { ipcMain } = require('electron');
const { createIngredient, getAllIngredients, adjustStockByDelta, setStockAbsolute, getLowStock } = require('../models/ingredient');
const { createMenuItem, getAllMenuItems, addRecipeItem, getRecipeForMenuItem } = require('../models/menuItem');
const { createOrder, completeOrder, getOrderById, expandDealToOrderItems } = require('../models/order');
const { createDeal, addDealItem, getAllDeals, getDealWithItems } = require('../models/deal');

function registerIpcHandlers() {
    ipcMain.handle('ingredients:create', (event, data) => createIngredient(data));
    ipcMain.handle('ingredients:getAll', () => getAllIngredients());
    ipcMain.handle('ingredients:getLowStock', () => getLowStock());

    ipcMain.handle('menuItems:create', (event, data) => createMenuItem(data));
    ipcMain.handle('menuItems:getAll', () => getAllMenuItems());
    ipcMain.handle('menuItems:getRecipe', (event, menuItemId) => getRecipeForMenuItem(menuItemId));

    ipcMain.handle('orders:create', (event, data) => createOrder(data));
    ipcMain.handle('orders:complete', (event, orderId) => completeOrder(orderId));
    ipcMain.handle('orders:getById', (event, orderId) => getOrderById(orderId));

    ipcMain.handle('deals:create', (event, data) => createDeal(data));
    ipcMain.handle('deals:getAll', () => getAllDeals());
    ipcMain.handle('deals:addItem', (event, { dealId, menuItemId, quantity }) => addDealItem(dealId, menuItemId, quantity));
}

module.exports = { registerIpcHandlers };