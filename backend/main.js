const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer } = require('./server')

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.loadURL('http://localhost:5173');
}

app.whenReady().then(async () => {
    await startServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});