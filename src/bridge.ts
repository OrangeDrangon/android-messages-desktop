import { contextBridge, ipcRenderer, webFrame } from "electron";

import {
  INITIAL_ICON_IMAGE,
  IS_MAC,
} from "./preload/constants_preload";
import {
  createRecentThreadObserver,
  createUnreadObserver,
  focusFunctions,
  recentThreadObserver,
} from "./preload/observers";

declare global {
  interface Window {
    interop: any;
  }
}

const preload_init = () => {

    if (IS_MAC) {
      const titlebarStyle = `#amd-titlebar {
        -webkit-app-region: drag;
        position: fixed;
        width: 100%;
        height: 64px;
        top: 0;
        left: 0;
        background: none;
        pointer-events: none;
      }`;

      document.body.appendChild(
        Object.assign(document.createElement("style"), {
          textContent: titlebarStyle,
        })
      );

      const titlebar = document.createElement("div");
      titlebar.id = "amd-titlebar";
      document.querySelector("mw-app")?.parentNode?.prepend(titlebar);
    }

    const conversationListObserver = new MutationObserver(() => {
      if (document.querySelector("mws-conversations-list") != null) {
        createUnreadObserver();
        createRecentThreadObserver();

        // keep trying to get an image that isnt blank until they load
        const interval = setInterval(() => {
          const conversation = document.body.querySelector(
            "mws-conversation-list-item"
          );
          if (conversation) {
            const canvas = conversation.querySelector(
              "a div.avatar-container canvas"
            ) as HTMLCanvasElement | null;

            if (canvas != null && canvas.toDataURL() != INITIAL_ICON_IMAGE) {
              recentThreadObserver();
              // refresh for profile image loads after letter loads.
              setTimeout(recentThreadObserver, 3000);
              clearInterval(interval);
            }
          }
        }, 250);
        conversationListObserver.disconnect();
      }

      const title = document.head.querySelector("title");
      if (title != null) {
        title.innerText = "Android Messages";
      }
    });

    conversationListObserver.observe(document.body, {
      attributes: false,
      subtree: true,
      childList: true,
    });
}

ipcRenderer.on("focus-conversation", (event, i) => {
  focusFunctions[i]();
});

contextBridge.exposeInMainWorld("interop", {
  show_main_window: () => {
    ipcRenderer.send("show-main-window");
  },
  flash_main: () => {
    ipcRenderer.send("flash-main-window-if-not-focused");
  },
  should_hide: () => {
    return ipcRenderer.sendSync("should-hide-notification-content");
  },
  get_icon: async () => {
    const data =  await ipcRenderer.invoke("get-icon");
    return `data:image/png;base64,${data}`;
  },
  preload_init,
});
webFrame.executeJavaScript(`
  window.addEventListener("load", async () => {
    window.interop.preload_init();
    window.icon_data_uri = await window.interop.get_icon();
  });
`);
webFrame.executeJavaScript(`window.OldNotification = window.Notification;
window.Notification = function (title, options) {
  try {
    const hideContent = window.interop.should_hide();

    const notificationOpts = hideContent
      ? {
          body: "Click to open",
          icon: window.icon_data_uri
        }
      : {
          body: options?.body || "",
          icon: options?.icon
        };

    const newTitle = hideContent ? "New Message" : title;
    const notification = new window.OldNotification(newTitle, notificationOpts);
    notification.addEventListener("click", () => {
      window.interop.show_main_window();
      document.dispatchEvent(new Event("focus"));
    });
    window.interop.flash_main();
    return notification;
  } catch (e) {
  console.error(e);
  console.trace();
  }
};

window.Notification.permission = "granted";
window.Notification.requestPermission = async () => "granted";
`);
contextBridge.exposeInMainWorld("module", {exports: null});
