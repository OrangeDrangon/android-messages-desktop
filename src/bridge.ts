import { ipcRenderer, remote, NotificationConstructorOptions } from "electron";
import path from "path";
import {
  EVENT_BRIDGE_INIT,
  EVENT_UPDATE_USER_SETTING,
  SETTING_HIDE_NOTIFICATION,
  RESOURCES_PATH,
  SETTING_NOTIFICATION_SOUND,
  SETTING_SYSTEM_DARK_MODE,
  BASE_APP_PATH,
} from "./helpers/constants";
import { handleEnterPrefToggle } from "./helpers/inputManager";
import { popupContextMenu } from "./menu/contextMenu";
import settings from "electron-settings";
import { getProfileImg } from "./helpers/profileImage";

const { Notification: ElectronNotification, app, nativeTheme } = remote;

// Electron (or the build of Chromium it uses?) does not seem to have any default right-click menu, this adds our own.
remote.getCurrentWebContents().addListener("context-menu", popupContextMenu);

function createUnreadListener() {
  const unreadObserver = (
    _mutationList: MutationRecord[],
    _observer: MutationObserver
  ) => {
    if (document.querySelector(".unread") != null) {
      app.trayManager?.setUnreadIcon(true);
    } else {
      app.trayManager?.setUnreadIcon(false);
    }
  };
  const observer = new MutationObserver(unreadObserver);
  const node = document.querySelector("main");
  if (node) {
    observer.observe(node, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-e2e-is-unread"],
    });
  }
}

window.addEventListener("load", () => {
  const onInit = (
    _mutationsList: MutationRecord[],
    observer: MutationObserver
  ) => {
    if (document.querySelector("mw-main-nav")) {
      // we're definitely logged-in if this is in the DOM
      ipcRenderer.send(EVENT_BRIDGE_INIT);
      createUnreadListener();
      observer.disconnect();
    }
    // In the future we could detect the "you've been signed in elsewhere" modal and notify the user here
  };

  const observer = new MutationObserver(onInit);
  observer.observe(document.body, {
    childList: true,
    attributes: true,
  });
});

// dark mode work around issue #258 (https://github.com/OrangeDrangon/android-messages-desktop/issues/258)
window.addEventListener("DOMContentLoaded", function(e)
{
  const fs = require("fs");
  fs.readFile(path.resolve(BASE_APP_PATH, "src", "stylesheets", "dark.css"), "utf-8", function(error:any, data:any)
  {
    if(error)
      return;

    const style = document.createElement("style");
    style.innerHTML = data;
    style.id = "dark-theme";
    let s = document.head.querySelector("style");
    s?.parentNode?.insertBefore(style, s); //insert as first style, allowing native style overwrite it.
  });

  //theme selection is saved in google account and restored on initial load
  //I don't know if there are any events available that we could use to identify when it finished loading
  //for now we are relaying on div#cdk-describedby-message-1 that being inserted into DOM after theme is applied by google
  //at which time we are forcing light/dark theme to match system.
  const obs = new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
  {
    for(let i = 0; i < m.length; i++)
    {
      for(let n = 0; n < m[i].addedNodes.length; n++)
      {
        if ((m[i].addedNodes[n] as HTMLElement).id == "cdk-describedby-message-1") //this is one of the last items inserted 
        {
          if (settings.get(SETTING_SYSTEM_DARK_MODE))
            darkMode(nativeTheme.shouldUseDarkColors);

          o.disconnect();
        }
      }
    }
  });
  obs.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true
  });
});

function darkMode(mode:boolean)
{
  localStorage.setItem("dark_mode_enabled", "" + mode);
  if (mode)
    document.body?.classList.add("dark-theme");
  else
    document.body?.classList.remove("dark-theme");
}

ipcRenderer.on(EVENT_UPDATE_USER_SETTING, (_event, settingsList) => {
  if ("useDarkMode" in settingsList && settingsList.useDarkMode !== null) {
    darkMode(settingsList.useDarkMode);
  }

  if ("enterToSend" in settingsList) {
    handleEnterPrefToggle(settingsList.enterToSend);
  }
});

/**
 * Override the webview's window's instance of the Notification class and forward their data to the
 * main process. This is Necessary to generate and send a custom notification via Electron instead
 * of just forwarding the webview (Google) ones.
 *
 * Derived from:
 * https://github.com/electron/electron/blob/master/docs/api/ipc-main.md#sending-messages
 * https://stackoverflow.com/questions/2891096/addeventlistener-using-apply
 * https://stackoverflow.com/questions/31231622/event-listener-for-web-notification
 * https://stackoverflow.com/questions/1421257/intercept-javascript-event
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.Notification = function (title: string, options: NotificationOptions) {
  const icon = getProfileImg(title);

  const hideContent = settings.get(SETTING_HIDE_NOTIFICATION, false) as boolean;

  const notificationOpts: NotificationConstructorOptions = hideContent
    ? {
        title: "New Message",
        body: "Click to open",
        icon: path.resolve(RESOURCES_PATH, "icons", "64x64.png"),
      }
    : {
        title,
        icon,
        body: options.body || "",
      };

  notificationOpts.silent = settings.get(
    SETTING_NOTIFICATION_SOUND,
    true
  ) as boolean;

  const notification = new ElectronNotification(notificationOpts);
  notification.addListener("click", () => {
    app.mainWindow?.show();
    document.dispatchEvent(new Event("focus"));
  });
  // Mock the api for adding event listeners for a normal Browser notification
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  notification.addEventListener = notification.addListener;
  notification.show();
  if (!app.mainWindow?.isFocused()) {
    app.mainWindow?.flashFrame(true);
  }
  return notification;
};
// THIS IS NEEDED FOR GOOGLE TO ISSUE NOTIFICATIONS
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Notification.permission = "granted";
Notification.requestPermission = async () => "granted";
