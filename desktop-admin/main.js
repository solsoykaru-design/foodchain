const { app, BrowserWindow } = require('electron');
const path = require('path');
const createServer = require('./server');

let mainWindow;
let server;

const PORT = 3099;

app.whenReady().then(() => {
  server = createServer(PORT).listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      title: 'FoodChain Admin',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: true,
      },
    });

    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }, 2000);
    });

    mainWindow.webContents.on('crashed', () => {
      console.error('Renderer crashed, reloading...');
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }, 2000);
    });

    mainWindow.on('close', (e) => {
      if (!mainWindow) return;
      console.log('Window closing');
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
