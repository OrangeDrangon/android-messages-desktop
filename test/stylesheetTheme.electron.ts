import { app, BrowserWindow, session } from "electron";
import { BehaviorSubject } from "rxjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { attachStylesheetTheme } from "../src/helpers/stylesheetTheme";

app.on("window-all-closed", () => {});
app
  .whenReady()
  .then(async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "amd-electron-theme-"));
    const browserSession = session.fromPartition("theme-smoke");
    browserSession.protocol.handle(
      "https",
      () =>
        new Response("<html><body><p>Theme test</p></body></html>", {
          headers: { "content-type": "text/html" },
        })
    );
    const window = new BrowserWindow({
      show: false,
      webPreferences: { session: browserSession },
    });
    const file = path.join(directory, "theme.css");
    const setting = new BehaviorSubject<string | null>(file);
    const errors: unknown[] = [];
    attachStylesheetTheme(window.webContents, setting, (error) =>
      errors.push(error)
    );
    async function expectColor(color: string) {
      for (let i = 0; i < 100; i++) {
        const actual = await window.webContents.executeJavaScript(
          "getComputedStyle(document.body).color"
        );
        if (actual === color) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.fail(
        "Expected body color " +
          color +
          ", actual: " +
          (await window.webContents.executeJavaScript(
            "getComputedStyle(document.body).color"
          )) +
          ", errors: " +
          errors.map(String)
      );
    }
    try {
      await writeFile(file, "body { color: rgb(255, 0, 0) !important; }");
      await window.loadURL("https://messages.google.com/web/");
      await expectColor("rgb(255, 0, 0)");
      await writeFile(file, "body { color: rgb(0, 0, 255) !important; }");
      setting.next(file);
      await expectColor("rgb(0, 0, 255)");
      await window.loadURL("https://messages.google.com/web/conversations");
      await expectColor("rgb(0, 0, 255)");
      setting.next(null);
      await expectColor("rgb(0, 0, 0)");
      setting.next(file);
      await expectColor("rgb(0, 0, 255)");
      await window.loadURL("https://accounts.google.com/");
      await expectColor("rgb(0, 0, 0)");
      assert.deepEqual(errors, []);
      console.log(
        "PASS: real Electron CSS apply, replace, navigation, removal, and origin isolation"
      );
    } finally {
      window.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  })
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
