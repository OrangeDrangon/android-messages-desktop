import { app, Event as ElectronEvent, ipcMain, shell } from "electron";
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
      mainWindow.focus();
    }
  });
}

if (IS_MAC) {
  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
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
      void checkForUpdate(true, false);
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
      show: false,
      icon: IS_LINUX
        ? path.resolve(RESOURCES_PATH, "icons", "128x128.png")
        : undefined,
      titleBarStyle: IS_MAC ? "hiddenInset" : "default",
      webPreferences: {
        preload: IS_DEV
          ? path.resolve(app.getAppPath(), "bridge.js")
          : path.resolve(app.getAppPath(), "app", "bridge.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        partition: "persist:main",
      },
    });

    process.env.MAIN_WINDOW_ID = mainWindow.id.toString();

    if (!(settings.trayEnabled.value && settings.startInTrayEnabled.value)) {
      mainWindow.show();
    }

    mainWindow.loadURL("https://messages.google.com/web/");

    trayManager.startIfEnabled();
    settings.showIconsInRecentConversationTrayEnabled.subscribe(() => {
      trayManager.refreshTrayMenu();
    });

    let quitViaContext = false;
    app.on("before-quit", () => {
      quitViaContext = true;
    });

    const shouldExitOnMainWindowClosed = () => {
      if (IS_MAC) {
        return quitViaContext;
      }

      if (trayEnabled.value) {
        return quitViaContext;
      }

      return true;
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
        app.quit();
      }
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
      const url = details.url;

      const isGoogleAuthWindow =
        url.startsWith("https://accounts.google.com/") ||
        url.startsWith("https://google.com/") ||
        url.startsWith("https://www.google.com/") ||
        url.startsWith("https://messages.google.com/");

      if (isGoogleAuthWindow) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 500,
            height: 700,
            parent: mainWindow,
            modal: true,
            autoHideMenuBar: true,
            titleBarStyle: "default",
            webPreferences: {
              preload: IS_DEV
                ? path.resolve(app.getAppPath(), "bridge.js")
                : path.resolve(app.getAppPath(), "app", "bridge.js"),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false,
              partition: "persist:main",
            },
          },
        };
      }

      shell.openExternal(url);
      return { action: "deny" };
    });

    mainWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.log("did-fail-load", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      }
    );

    mainWindow.webContents.on(
      "did-redirect-navigation",
      (_event, url, isInPlace, isMainFrame) => {
        console.log("did-redirect-navigation", {
          url,
          isInPlace,
          isMainFrame,
        });
      }
    );

    mainWindow.webContents.on("console-message", (_event, level, message) => {
      console.log("renderer console:", level, message);
    });

    mainWindow.webContents.on("context-menu", popupContextMenu);
  });

  ipcMain.on("should-hide-notification-content", (event) => {
    event.returnValue = settings.hideNotificationContentEnabled.value;
  });

  ipcMain.on("show-main-window", () => {
    mainWindow.show();
    mainWindow.focus();

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
