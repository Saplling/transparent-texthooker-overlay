const { app, BrowserWindow, session, screen } = require('electron');
const { ipcMain } = require("electron");
const fs = require("fs");
const path = require('path');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let userSettings = {
  "fontSize": 42,
  "weburl1": "ws://localhost:6677/api/ws/text/origin",
  "weburl2": "ws://localhost:6677"
};

if (fs.existsSync(settingsPath)) {
  try {
    const data = fs.readFileSync(settingsPath, "utf-8");
    oldUserSettings = JSON.parse(data)
    userSettings = { ...userSettings, ...oldUserSettings}

  } catch (error) {
    console.error("Failed to load settings.json:", e)

  }
}

app.whenReady().then(async () => {
  const isDev = !app.isPackaged;
  const extPath = isDev ? path.join(__dirname, 'yomitan'): path.join(process.resourcesPath, "yomitan")
  let ext;
  try {
    ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
    console.log('Yomitan extension loaded.');

  } catch (e) {
    console.error('Failed to load extension:', e);
  }
  const display = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    x:0,
    y:0,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    titleBarStyle: 'hidden',
    title: "",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    show: false,
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver")
  let resizeMode = false
  let yomitanShown = false
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    if (!resizeMode && !yomitanShown) {
      win.setIgnoreMouseEvents(ignore, options)
    }
  })
  ipcMain.on("resize-mode", (event, state) => {
    resizeMode = state;
  })

  ipcMain.on("yomitan-event", (event, state) => {
    yomitanShown = state;
  })

  ipcMain.on('release-mouse', () => {
  win.blur(); 
  setTimeout(() => win.focus(), 50); 
});


// Fix for ghost title bar
// https://github.com/electron/electron/issues/39959#issuecomment-1758736966
  win.on('blur', () => {
  win.setBackgroundColor('#00000000')
})

win.on('focus', () => {
  win.setBackgroundColor('#00000000')
})

  win.loadFile('index.html');
  if (isDev) {
    win.webContents.on('context-menu', () => {
      win.webContents.openDevTools({ mode: 'detach' });

    });
  }
  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send("load-settings", userSettings);
  });

  ipcMain.on("app-close", () => {
    app.quit();
  });

  ipcMain.on("open-yomitan-settings", () => {
    const yomitanOptionsWin = new BrowserWindow({
      width: 1100,
      height: 600,
      webPreferences: {
        nodeIntegration: false
      }
    });

    yomitanOptionsWin.removeMenu()
    yomitanOptionsWin.loadURL(`chrome-extension://${ext.id}/settings.html`);
  });

  let websocketStates = {
    "ws1": false,
    "ws2": false
  }
  ipcMain.on("websocket-closed", (event, type) => {
    websocketStates[type] = false
  });
  ipcMain.on("websocket-opened", (event, type) => {
    websocketStates[type] = true
  });

  ipcMain.on("open-settings", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("force-visible", true); // ✅ Show overlay
    }
    win.webContents.send("request-current-settings");
    ipcMain.once("reply-current-settings", (event, settings) => {
      const settingsWin = new BrowserWindow({
        width: 500,
        height: 400,
        resizable: true,
        alwaysOnTop: true,
        title: "Overlay Settings",
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        },
      });
      settingsWin.removeMenu()
      
      settingsWin.loadFile("settings.html");
      settingsWin.on("closed", () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("force-visible", false);
        }
      })
      const closedListenerFunction = (event, type) => {
        settingsWin.send("websocket-closed", type)
      }
      const openedListenerFunction = (event, type) => {
        settingsWin.send("websocket-opened", type);
      };
      ipcMain.on("websocket-closed", closedListenerFunction)
      ipcMain.on("websocket-opened", openedListenerFunction)
      console.log(websocketStates)
      settingsWin.webContents.send("preload-settings", {settings, websocketStates})
      
      settingsWin.on("closed", () => {
        ipcMain.removeListener("websocket-closed", closedListenerFunction)
        ipcMain.removeListener("websocket-opened", openedListenerFunction)
      })
    })


  });
  ipcMain.on("fontsize-changed", (event, newsize) => {
    win.webContents.send("new-fontsize", newsize);
    userSettings.fontSize = newsize;
  })
  ipcMain.on("weburl1-changed", (event, newurl) => {
    userSettings.weburl1 = newurl;
    win.webContents.send("new-weburl1", newurl)
  })
  ipcMain.on("weburl2-changed", (event, newurl) => {
    userSettings.weburl2 = newurl;
    win.webContents.send("new-weburl2", newurl)
  })
  

  app.on("before-quit", () => {
    fs.writeFileSync(settingsPath, JSON.stringify(userSettings, null, 2))
  })
});
