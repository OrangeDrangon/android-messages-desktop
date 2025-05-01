import {
  app,
  Event as ElectronEvent,
  ipcMain,
  ipcRenderer,
  shell,
} from "electron";
import { BrowserWindow } from "electron/main";
import path from "path";
import process from "process";
import { checkForUpdate } from "./helpers/autoUpdate";
import { IS_DEV, IS_LINUX, IS_MAC, RESOURCES_PATH } from "./helpers/constants";
import { MenuManager } from "./helpers/menuManager";
import { setSettingsFlushEnabled, settings } from "./helpers/settings";
import { Conversation, TrayManager } from "./helpers/trayManager";
import { popupContextMenu } from "./menu/contextMenu";
import fs from "fs";

const {
  autoHideMenuEnabled,
  trayEnabled,
  savedWindowSize,
  savedWindowPosition,
  checkForUpdateOnLaunchEnabled,
  taskbarFlashEnabled,
} = settings;

let mainWindow: BrowserWindow;
let trayManager: TrayManager;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
    }
  });
}

if (IS_MAC) {
  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      app.dock?.setBadge("");
    }
  });
}

app.on("before-quit", () => {
  setSettingsFlushEnabled(false);
});

if (gotTheLock) {
  app.on("ready", () => app.setAppUserModelId("pw.kmr.amd"));
  app.on("ready", () => {
    trayManager = new TrayManager();

    new MenuManager();

    if (checkForUpdateOnLaunchEnabled.value && !IS_DEV) {
      checkForUpdate(true, false);
    }

    const { width, height } = savedWindowSize.value;
    const { x, y } = savedWindowPosition.value ?? {};

    console.log("app.getAppPath()", app.getAppPath());
    mainWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      autoHideMenuBar: autoHideMenuEnabled.value,
      title: "Android Messages",
      show: false, //don't show window just yet (issue #229)
      icon: IS_LINUX
        ? path.resolve(RESOURCES_PATH, "icons", "128x128.png")
        : undefined,
      titleBarStyle: IS_MAC ? "hiddenInset" : "default",
      webPreferences: {
        preload: IS_DEV
          ? path.resolve(app.getAppPath(), "bridge.js")
          : path.resolve(app.getAppPath(), "app", "bridge.js"),
      },
    });

    process.env.MAIN_WINDOW_ID = mainWindow.id.toString();

    if (!(settings.trayEnabled.value && settings.startInTrayEnabled.value)) {
      mainWindow.show();
    }

    // Fix the user agent -- Google sends auth requests to YouTube as well, for some reason
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      {
        urls: ["https://*.google.com/*", "https://*.youtube.com/*"],
      },
      ({ requestHeaders }, callback) =>
        callback({
          requestHeaders: {
            ...requestHeaders,
            // Specifically, we are ONLY removing the Electron portion of the agent
            // Found via https://old.reddit.com/r/electronjs/comments/eiy2sf/google_blocking_log_in_from_electron_apps/fcvuwd9/
            // Referenced at this link https://github.com/firebase/firebase-js-sdk/issues/2478#issuecomment-571773318
            // "User-Agent": mainWindow.webContents.userAgent.replace(
            //   "Electron/" + process.versions.electron,
            //   ""
            // ),
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/2000.36 (KHTML, like Gecko) Chrome/2000.0.0.0 Safari/2000.36",
          },
        })
    );
    mainWindow.loadURL("https://messages.google.com/web/");

    trayManager.startIfEnabled();
    settings.showIconsInRecentConversationTrayEnabled.subscribe(() =>
      trayManager.refreshTrayMenu()
    );

    let quitViaContext = false;
    app.on("before-quit", () => {
      quitViaContext = true;
    });

    const shouldExitOnMainWindowClosed = () => {
      if (IS_MAC) {
        return quitViaContext;
      } else {
        if (trayEnabled.value) {
          return quitViaContext;
        }
        return true;
      }
    };

    mainWindow.on("close", (event: ElectronEvent) => {
      const { x, y, width, height } = mainWindow.getBounds();
      savedWindowPosition.next({ x, y });
      savedWindowSize.next({ width, height });
      if (!shouldExitOnMainWindowClosed()) {
        event.preventDefault();
        mainWindow.hide();
        trayManager?.showMinimizeToTrayWarning();
        if (IS_MAC) {
          app.dock?.hide();
        }
      } else {
        app.quit(); // If we don't explicitly call this, the webview and mainWindow get destroyed but background process still runs.
      }
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    mainWindow.webContents.on("context-menu", popupContextMenu);

    // block Google collecting data
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      {
        urls: [
          "https://messages.google.com/web/jserror?*",
          "https://play.google.com/log?*",
          "https://www.google-analytics.com/analytics.js",
        ],
      },
      (details, callback) => {
        callback({ cancel: true });
      }
    );
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      {
        urls: [
          "file://www.google.com/js/bg*",
        ],
      },
      (details, callback) => {
        const path = details.url.replace("file://www.google.com/js/bg", "");
        callback({ redirectURL: "https://www.google.com/js/bg" + path });
      }
    );
    mainWindow.webContents.session.webRequest.onBeforeRequest(
      {
        urls: [
          "file:///web/",
        ],
      },
      (details, callback) => {
        let path = details.url.replace("file:///web/", "");
        callback({ redirectURL: "https://www.google.com/js/bg" + path });
      }
    );
  }); //onready

  ipcMain.on("should-hide-notification-content", (event) => {
    event.returnValue = settings.hideNotificationContentEnabled.value;
  });

  ipcMain.on("show-main-window", () => {
    mainWindow.show();
    if (IS_MAC) {
      app.dock?.setBadge("");
    }
  });

  ipcMain.on("flash-main-window-if-not-focused", () => {
    if (!mainWindow.isFocused() && taskbarFlashEnabled.value) {
      mainWindow.flashFrame(true);
      if (IS_MAC) {
        app.dock?.setBadge("•");
      }
    }
  });

  ipcMain.on("set-unread-status", (_event, unreadStatus: boolean) => {
    trayManager.setUnread(unreadStatus);
  });

  ipcMain.on("set-recent-conversations", (_event, data: Conversation[]) => {
    trayManager.setRecentConversations(data);
  });

  ipcMain.handle("get-icon", () => {
    const bitmap = fs.readFileSync(
      path.resolve(RESOURCES_PATH, "icons", "64x64.png")
    );
    return Buffer.from(bitmap).toString("base64");
  });
}
