import { BrowserWindow, ipcMain, IpcMainEvent, powerMonitor } from "electron";

const HOME_URL = "https://messages.google.com/web/";

// How long a single reachability probe may take before it counts as a failure.
const PROBE_TIMEOUT_MS = 5_000;
// Probe retry delay starts here and doubles up to the cap.
const PROBE_RETRY_START_MS = 500;
const PROBE_RETRY_MAX_MS = 10_000;
// Extra wait before reloading when reloads keep failing right after a good probe.
const RELOAD_BACKOFF_START_MS = 1_000;
const RELOAD_BACKOFF_MAX_MS = 30_000;
// Fallback for machines where powerMonitor "resume" is never delivered: if the
// main-process timer fires much later than scheduled, the machine was asleep.
const WATCHDOG_INTERVAL_MS = 5_000;
const WATCHDOG_JUMP_MS = 20_000;

// Safety net for missed OS/Chromium events: poll reachability and the page.
const MONITOR_INTERVAL_MS = 15_000;
const POST_RELOAD_CHECK_MS = 8_000;
const INSPECT_TIMEOUT_MS = 2_000;
// Don't keep reloading a page that legitimately says "not connected".
const STUCK_COOLDOWN_MS = 120_000;
const HARD_RESET_COOLDOWN_MS = 600_000;
// An error/offline shell is a short page; the real app UI is far larger.
const SHORT_PAGE_CHARS = 400;
const OFFLINE_TEXT = /not connected|no internet|offline|disconnected/i;

// Chromium net errors that a retry can plausibly fix (see net_error_list.h).
const TRANSIENT_NET_ERRORS = new Set([
  -7, // TIMED_OUT
  -21, // NETWORK_CHANGED
  -100, // CONNECTION_CLOSED
  -101, // CONNECTION_RESET
  -102, // CONNECTION_REFUSED
  -103, // CONNECTION_ABORTED
  -104, // CONNECTION_FAILED
  -105, // NAME_NOT_RESOLVED
  -106, // INTERNET_DISCONNECTED
  -109, // ADDRESS_UNREACHABLE
  -118, // CONNECTION_TIMED_OUT
  -130, // PROXY_CONNECTION_FAILED
  -324, // EMPTY_RESPONSE
]);

interface PageInfo {
  url: string;
  title: string;
  chars: number;
  text?: string;
  error?: string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const isErrorPage = (url: string) =>
  !url || url === "about:blank" || url.startsWith("chrome-error://");

/**
 * Keeps the Google Messages web app alive across suspend/resume and network
 * changes (see #505, #605).
 *
 * After a suspend the OS network can still be down, and Chromium keeps
 * keep-alive sockets and DNS entries that died while the machine slept. A
 * reload on a fixed timer therefore either fails outright or silently reuses
 * dead connections, so the page comes back without its link to the phone.
 * Instead, every trigger funnels into one routine that:
 *   1. waits until messages.google.com is actually reachable,
 *   2. drops stale sockets and cached DNS for the app's session,
 *   3. reloads (or re-navigates if the window is stuck on an error page).
 */
export function setupConnectionRecovery(win: BrowserWindow): void {
  const wc = win.webContents;
  const ses = wc.session;

  // Bumped to cancel an in-flight recovery when a newer one supersedes it.
  let generation = 0;
  let recovering = false;
  let consecutiveFailures = 0;
  let rendererReportsOffline = false;
  let lastGoodUrl = HOME_URL;
  let lastTick = Date.now();
  let lastReachable = true;
  let lastStuckRecovery = 0;
  let lastHardReset = 0;
  let checking = false;

  const isStale = (token: number) => token !== generation || win.isDestroyed();

  // Any HTTP response at all proves DNS, routing and TLS work. Going through
  // the app's own session means proxy settings match the real page load.
  const isReachable = async (): Promise<boolean> => {
    let ok = false;
    try {
      await ses.fetch(HOME_URL, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      ok = true;
    } catch {
      ok = false;
    }
    lastReachable = ok;
    return ok;
  };

  // Describes what the window is showing. Page text is only included for short
  // pages (error/offline shells) so conversation content never reaches logs.
  const inspectPage = async (): Promise<PageInfo | null> => {
    if (win.isDestroyed()) {
      return null;
    }
    try {
      const body = await Promise.race([
        wc.executeJavaScript(
          'document.body ? document.body.innerText : ""'
        ) as Promise<string>,
        sleep(INSPECT_TIMEOUT_MS).then(() => {
          throw new Error("inspect timed out");
        }),
      ]);
      return {
        url: wc.getURL(),
        title: wc.getTitle(),
        chars: body.length,
        text:
          body.length < SHORT_PAGE_CHARS
            ? body.replace(/\s+/g, " ").trim()
            : undefined,
      };
    } catch (error) {
      return { url: wc.getURL(), title: "", chars: -1, error: String(error) };
    }
  };

  const looksDisconnected = (page: PageInfo | null) =>
    !!page &&
    (page.url.startsWith("chrome-error://") ||
      (page.text !== undefined && OFFLINE_TEXT.test(page.text)));

  const reload = () => {
    if (win.isDestroyed()) {
      return;
    }
    if (isErrorPage(wc.getURL())) {
      // loadURL rejects on failure; did-fail-load already handles that case.
      win.loadURL(lastGoodUrl).catch(() => undefined);
    } else {
      wc.reload();
    }
  };

  // Last resort when a reload still lands on an offline screen: a service
  // worker or HTTP cache may be serving a stale offline shell. Cookies,
  // localStorage and IndexedDB are untouched, so the account stays paired.
  const hardReset = async (reason: string): Promise<void> => {
    if (Date.now() - lastHardReset < HARD_RESET_COOLDOWN_MS) {
      return;
    }
    lastHardReset = Date.now();
    console.log("connection-recovery: hard reset", { reason });
    await ses.clearCache();
    await ses.clearStorageData({
      storages: ["serviceworkers", "cachestorage"],
    });
    if (win.isDestroyed()) {
      return;
    }
    if (isErrorPage(wc.getURL())) {
      reload();
    } else {
      wc.reloadIgnoringCache();
    }
  };

  const verifyAfterReload = (reason: string) => {
    setTimeout(async () => {
      try {
        const page = await inspectPage();
        console.log("connection-recovery: page after reload", {
          reason,
          ...page,
        });
        if (looksDisconnected(page)) {
          await hardReset("still-disconnected-after-reload");
        }
      } catch (error) {
        console.log("connection-recovery: post-reload check failed", error);
      }
    }, POST_RELOAD_CHECK_MS);
  };

  const recover = async (reason: string): Promise<void> => {
    if (win.isDestroyed()) {
      return;
    }
    const token = ++generation;
    recovering = true;
    console.log("connection-recovery: start", {
      reason,
      page: await inspectPage(),
    });

    try {
      let retryDelay = PROBE_RETRY_START_MS;
      while (!(await isReachable())) {
        if (isStale(token)) {
          return;
        }
        await sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, PROBE_RETRY_MAX_MS);
      }
      if (isStale(token)) {
        return;
      }

      // Network is fine but loads keep failing (captive portal, proxy auth,
      // Google outage): slow down instead of reload-looping.
      if (consecutiveFailures > 0) {
        await sleep(
          Math.min(
            RELOAD_BACKOFF_MAX_MS,
            RELOAD_BACKOFF_START_MS * 2 ** (consecutiveFailures - 1)
          )
        );
        if (isStale(token)) {
          return;
        }
      }

      await ses.closeAllConnections();
      await ses.clearHostResolverCache();
      if (isStale(token)) {
        return;
      }

      console.log("connection-recovery: reloading", { reason });
      reload();
      verifyAfterReload(reason);
    } catch (error) {
      console.log("connection-recovery: failed", { reason, error });
    } finally {
      if (token === generation) {
        recovering = false;
      }
    }
  };

  wc.on("did-finish-load", () => {
    const url = wc.getURL();
    // The error page also emits did-finish-load; don't treat it as success.
    if (!isErrorPage(url)) {
      consecutiveFailures = 0;
      lastGoodUrl = url;
    }
  });

  wc.on("did-fail-load", (_event, errorCode, _desc, _url, isMainFrame) => {
    // Subframe failures (embedded content) must not reload the whole app.
    if (!isMainFrame || !TRANSIENT_NET_ERRORS.has(errorCode)) {
      return;
    }
    consecutiveFailures++;
    if (!recovering) {
      void recover("did-fail-load");
    }
  });

  // The OS can also kill the renderer while suspended (memory reclaim).
  wc.on("render-process-gone", (_event, details) => {
    console.log("render-process-gone", details);
    if (details.reason !== "clean-exit") {
      void recover("render-process-gone");
    }
  });

  // "resume" always restarts recovery: whatever state existed before the
  // suspend is stale, even if a recovery was already running.
  const onResume = () => {
    lastTick = Date.now();
    void recover("resume");
  };
  powerMonitor.on("resume", onResume);

  const watchdog = setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if (gap > WATCHDOG_JUMP_MS && !recovering) {
      void recover("clock-jump");
    }
  }, WATCHDOG_INTERVAL_MS);
  watchdog.unref();

  // Safety net for events that never arrive (no "resume", no Chromium
  // offline/online): notice reachability coming back, or a page that is stuck
  // on an offline screen while the network is fine.
  const checkHealth = async () => {
    if (checking || recovering || win.isDestroyed()) {
      return;
    }
    checking = true;
    try {
      const wasReachable = lastReachable;
      const ok = await isReachable();
      if (recovering) {
        return;
      }
      if (!ok) {
        if (wasReachable) {
          console.log("connection-recovery: connectivity lost");
        }
        return;
      }
      if (!wasReachable) {
        void recover("connectivity-restored");
        return;
      }
      if (Date.now() - lastStuckRecovery < STUCK_COOLDOWN_MS) {
        return;
      }
      const page = await inspectPage();
      if (looksDisconnected(page)) {
        lastStuckRecovery = Date.now();
        void recover("stuck-page");
      }
    } catch (error) {
      console.log("connection-recovery: health check failed", error);
    } finally {
      checking = false;
    }
  };
  const monitor = setInterval(() => void checkHealth(), MONITOR_INTERVAL_MS);
  monitor.unref();

  // Renderer-side online/offline events (see bridge.ts). Chromium can miss the
  // offline->online transition across a suspend, which is why resume and the
  // watchdog exist; this covers ordinary Wi-Fi drops while the app is running.
  const onNetworkOnline = (event: IpcMainEvent) => {
    if (event.sender !== wc) {
      return;
    }
    const wasOffline = rendererReportsOffline;
    rendererReportsOffline = false;
    if (wasOffline) {
      void recover("network-online");
    }
  };
  const onNetworkOffline = (event: IpcMainEvent) => {
    if (event.sender === wc) {
      rendererReportsOffline = true;
    }
  };
  ipcMain.on("network-online", onNetworkOnline);
  ipcMain.on("network-offline", onNetworkOffline);

  win.once("closed", () => {
    generation++;
    clearInterval(watchdog);
    clearInterval(monitor);
    powerMonitor.removeListener("resume", onResume);
    ipcMain.removeListener("network-online", onNetworkOnline);
    ipcMain.removeListener("network-offline", onNetworkOffline);
  });
}
