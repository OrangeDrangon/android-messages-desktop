import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { BehaviorSubject } from "rxjs";
import { attachStylesheetTheme } from "../src/helpers/stylesheetTheme.ts";

async function fixture(t, initial = true) {
  const directory = await mkdtemp(path.join(tmpdir(), "amd-theme-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "theme.css");
  await writeFile(file, "body { color: red !important; }");
  const contents = new EventEmitter();
  const styles = new Map();
  const errors = [];
  let nextKey = 0;
  let destroyed = false;
  contents.url = "https://messages.google.com/web/";
  contents.getURL = () => contents.url;
  contents.isDestroyed = () => destroyed;
  contents.insertCSS = async (css, options) => {
    assert.equal(options.cssOrigin, "author");
    const key = String(++nextKey);
    styles.set(key, css);
    return key;
  };
  contents.removeInsertedCSS = async (key) => styles.delete(key);
  const setting = new BehaviorSubject(initial ? file : null);
  attachStylesheetTheme(contents, setting, (error) => errors.push(error));
  const navigate = (url = contents.url) => {
    contents.emit("did-start-navigation", {
      isMainFrame: true,
      isSameDocument: false,
    });
    contents.url = url;
    contents.emit("did-finish-load");
  };
  const destroy = () => {
    destroyed = true;
    contents.emit("destroyed");
  };
  t.after(destroy);
  return { contents, setting, styles, errors, file, navigate, destroy };
}

async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(check(), "theme operation did not complete");
}

test("applies a saved theme, replaces edited CSS, and removes it", async (t) => {
  const f = await fixture(t);
  assert.equal(f.styles.size, 0);
  f.navigate();
  await until(() => f.styles.size === 1);
  await writeFile(f.file, "body { color: blue !important; }");
  f.setting.next(f.file);
  await until(() => [...f.styles.values()][0]?.includes("blue"));
  assert.equal(f.styles.size, 1);
  f.setting.next(null);
  await until(() => f.styles.size === 0);
  assert.deepEqual(f.errors, []);
});

test("reapplies after navigation but skips non-Messages origins", async (t) => {
  const f = await fixture(t);
  f.navigate();
  await until(() => f.styles.size === 1);
  const previousKey = [...f.styles.keys()][0];
  f.navigate();
  await until(
    () => f.styles.size === 1 && [...f.styles.keys()][0] !== previousKey
  );
  for (const url of [
    "https://accounts.google.com/",
    "https://messages.google.com.example.com/",
    "http://messages.google.com/",
  ]) {
    f.navigate(url);
    await until(() => f.styles.size === 0);
  }
  f.navigate("https://messages.google.com/web/");
  await until(() => f.styles.size === 1);
});

test("keeps the applied theme on read failure and still allows removal", async (t) => {
  const f = await fixture(t);
  f.navigate();
  await until(() => f.styles.size === 1);
  await rm(f.file);
  f.setting.next(f.file);
  await until(() => f.errors.length === 1);
  assert.equal(f.styles.size, 1);
  f.setting.next(null);
  await until(() => f.styles.size === 0);
});

test("a removed theme cannot reappear after an in-flight insertion", async (t) => {
  const f = await fixture(t);
  const insert = f.contents.insertCSS;
  let release;
  f.contents.insertCSS = async (...args) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return insert(...args);
  };
  f.navigate();
  await until(() => release);
  f.setting.next(null);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.styles.size, 0);
  assert.deepEqual(f.errors, []);
});

test("defaults to no theme and releases its subscription on destruction", async (t) => {
  const f = await fixture(t, false);
  f.navigate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.styles.size, 0);
  f.destroy();
  assert.equal(f.setting.observed, false);
  f.setting.next(f.file);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.styles.size, 0);
});
