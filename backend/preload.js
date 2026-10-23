// Communication with the backend now goes through fetch() calls to the local
// Express server (see server.js), not Electron IPC. This file is kept minimal
// but intentionally not removed: contextIsolation still requires a preload
// script to exist, and this is the natural place to add any genuinely
// Electron-specific capability later (e.g., triggering a native print dialog,
// or file-system dialogs the renderer can't reach directly).
