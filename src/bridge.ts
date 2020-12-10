import {
  ipcRenderer,
  remote,
  NativeImage,
  NotificationConstructorOptions,
} from "electron";
import path from "path";
import { CacheManager } from "./helpers/cacheManager";
import { EVENT_BRIDGE_INIT, RESOURCES_PATH } from "./helpers/constants";
import { popupContextMenu } from "./menu/contextMenu";

const { Notification: ElectronNotification, app, nativeImage } = remote;

const { darkMode, hideNotificationContent, notificationSound } = app.settings;

// Electron (or the build of Chromium it uses?) does not seem to have any default right-click menu, this adds our own.
remote.getCurrentWebContents().addListener("context-menu", popupContextMenu);

const cacheManager = new CacheManager();

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
  const node = document.querySelector("mws-conversations-list");
  if (node) {
    observer.observe(node, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
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

darkMode.subscribe((val) => {
  if (val) {
    // Props to Google for making the web app use dark mode entirely based on this class
    // and for making the class name semantic!
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
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
  let icon: NativeImage | undefined;
  const potentialImg = cacheManager.getProfileImg(title);
  if (potentialImg != null) {
    icon = nativeImage.createFromDataURL(potentialImg);
  }

  const hideContent = hideNotificationContent.value;

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

  notificationOpts.silent = notificationSound.value;

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
