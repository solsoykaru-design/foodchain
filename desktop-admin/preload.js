const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__API_BASE__', 'https://foodchain-qpxh.onrender.com');
