import type { WebContents } from "electron";
import { readFile } from "node:fs/promises";
import type { BehaviorSubject } from "rxjs";

/** Owns the custom stylesheet for the main Messages document. */
export function attachStylesheetTheme(
  contents: WebContents,
  stylesheetPath: BehaviorSubject<string | null>,
  onError: (error: unknown) => void
): void {
  let key: string | undefined;
  let revision = 0;
  let ready = false;
  let pending = Promise.resolve();

  const refresh = () => {
    const request = ++revision;
    const filePath = stylesheetPath.value;
    const isCurrent = () =>
      request === revision && ready && !contents.isDestroyed();

    // Serialize replacements so rapid selections cannot leave multiple themes.
    pending = pending
      .then(async () => {
        if (!isCurrent()) return;
        const url = new URL(contents.getURL());

        // Read before replacing: a missing file leaves the current theme intact.
        const css =
          filePath && url.origin === "https://messages.google.com"
            ? await readFile(filePath, "utf8")
            : "";
        if (!isCurrent()) return;
        if (key) {
          const previousKey = key;
          key = undefined;
          await contents.removeInsertedCSS(previousKey);
          if (!isCurrent()) return;
        }
        if (css) {
          const insertedKey = await contents.insertCSS(css, {
            cssOrigin: "author",
          });
          if (isCurrent()) {
            key = insertedKey;
          } else if (!contents.isDestroyed()) {
            await contents.removeInsertedCSS(insertedKey);
          }
        }
      })
      .catch((error: unknown) => {
        if (isCurrent()) onError(error);
      });
  };

  contents.on("did-start-navigation", (event) => {
    if (event.isMainFrame && !event.isSameDocument) {
      ready = false;
      revision++;
    }
  });
  contents.on("did-finish-load", () => {
    ready = true;
    refresh();
  });
  const subscription = stylesheetPath.subscribe(refresh);
  contents.once("destroyed", () => {
    revision++;
    subscription.unsubscribe();
  });
}
