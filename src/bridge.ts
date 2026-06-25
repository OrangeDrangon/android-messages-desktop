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
      const titlebarStyle = `:root {
        --amd-titlebar-height: 28px;
      }

      body {
        overflow: hidden;
      }

      mw-app {
        display: block;
        height: calc(100vh - var(--amd-titlebar-height));
        overflow: hidden;
        transform: translateY(var(--amd-titlebar-height));
      }

      #amd-titlebar {
        -webkit-app-region: drag;
        position: fixed;
        height: var(--amd-titlebar-height);
        top: 0;
        left: 0;
        right: 0;
        background: none;
        pointer-events: none;
        z-index: 2147483647;
      }

      button,
      a,
      input,
      textarea,
      select,
      [role="button"],
      [role="link"],
      [tabindex] {
        -webkit-app-region: no-drag;
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
  should_auto_copy_otp: () => {
    return ipcRenderer.sendSync("should-auto-copy-otp");
  },
  copy_otp_to_clipboard: (otp: string) => {
    ipcRenderer.send("copy-otp-to-clipboard", otp);
  },
  show_otp_notification: (data: {
    title: string;
    body: string;
    otp: string;
    hideContent: boolean;
  }) => {
    ipcRenderer.send("show-otp-notification", data);
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
function normalizeOtpCandidate(candidate) {
  const otp = String(candidate || "").replace(/[\\s-]/g, "");
  if (!/\\d/.test(otp)) return null;
  if (!/^[A-Za-z0-9]{4,8}$/.test(otp)) return null;
  if (/^(?:19|20)\\d{2}$/.test(otp)) return null;
  if (/^(.)\\1+$/.test(otp)) return null;
  return otp;
}

function extractOtpFromText(text) {
  const value = String(text || "");
  const keyword = "(?:otp|one[-\\\\s]?time|verification|verify|security|login|sign[-\\\\s]?in|authentication|auth|passcode|pin|code)";
  const candidate = "([A-Za-z0-9](?:[A-Za-z0-9-]{2,10}[A-Za-z0-9])?)";
  const explicitPatterns = [
    new RegExp("(?:^|\\\\n)@[^\\\\s]+\\\\s+#" + candidate + "\\\\s*$", "i"),
    new RegExp("\\\\b(?:" + keyword + ")\\\\b(?:\\\\s+(?:is|for|=|:|-|to use|is:))*\\\\s+" + candidate + "\\\\b", "i"),
    new RegExp("\\\\b" + candidate + "\\\\b\\\\s+(?:is|=)\\\\s+(?:your\\\\s+)?(?:" + keyword + ")\\\\b", "i"),
    new RegExp("\\\\b(?:use|enter|type)\\\\s+" + candidate + "\\\\b.{0,40}\\\\b(?:" + keyword + ")\\\\b", "i"),
  ];
  const keywordPattern = new RegExp("\\\\b" + keyword + "\\\\b", "gi");
  const tokenPattern = /\\b[A-Za-z0-9](?:[A-Za-z0-9-]{2,10}[A-Za-z0-9])?\\b/g;
  let keywordMatch;

  for (const pattern of explicitPatterns) {
    const otp = normalizeOtpCandidate(value.match(pattern)?.[1]);
    if (otp) return otp;
  }

  while ((keywordMatch = keywordPattern.exec(value)) != null) {
    const windowStart = Math.max(0, keywordMatch.index - 50);
    const windowEnd = Math.min(value.length, keywordMatch.index + keywordMatch[0].length + 100);
    const nearbyText = value.slice(windowStart, windowEnd);
    const tokens = nearbyText.match(tokenPattern) || [];

    for (const token of tokens) {
      const otp = normalizeOtpCandidate(token);
      if (otp) return otp;
    }
  }

  return null;
}

window.Notification = function (title, options) {
  try {
    const hideContent = window.interop.should_hide();
    const autoCopyOtp = window.interop.should_auto_copy_otp();
    const otp = extractOtpFromText(options?.body);
    if (otp) {
      if (autoCopyOtp) {
        window.interop.copy_otp_to_clipboard(otp);
      }
      window.interop.show_otp_notification({
        title,
        body: options?.body || "",
        otp,
        hideContent,
      });
      window.interop.flash_main();
      return;
    }

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
