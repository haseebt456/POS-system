const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    ingredients: {
        create: (data) => ipcRenderer.invoke('ingredients:create', data),
        getAll: () => ipcRenderer.invoke('ingredients:getAll'),
        getLowStock: () => ipcRenderer.invoke('ingredients:getLowStock'),
    },
    menuItems: {
        create: (data) => ipcRenderer.invoke('menuItems:create', data),
        getAll: () => ipcRenderer.invoke('menuItems:getAll'),
        getRecipe: (id) => ipcRenderer.invoke('menuItems:getRecipe', id),
    },
    orders: {
        create: (data) => ipcRenderer.invoke('orders:create', data),
        complete: (id) => ipcRenderer.invoke('orders:complete', id),
        getById: (id) => ipcRenderer.invoke('orders:getById', id),
    },
    deals: {
        create: (data) => ipcRenderer.invoke('deals:create', data),
        getAll: () => ipcRenderer.invoke('deals:getAll'),
        addItem: (payload) => ipcRenderer.invoke('deals:addItem', payload),
    },
});