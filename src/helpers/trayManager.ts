import { app, Menu, Tray, nativeImage, NativeImage} from "electron";
import settings from "electron-settings";
import path from "path";
import { trayMenuTemplate } from "../menu/trayMenu";
import {
  IS_LINUX,
  IS_MAC,
  IS_WINDOWS,
  RESOURCES_PATH,
  SETTING_TRAY_ENABLED,
  DEFAULT_BADGE_TASKBAR
} from "./constants";

type Unread = any;
let timer:any = null;

export class TrayManager {
  public enabled = settings.get(SETTING_TRAY_ENABLED, !IS_LINUX) as boolean;
  public iconPath = this.getIconPath();
  public overlayIconPath = this.getOverlayIconPath();
  public iconImage:NativeImage = nativeImage.createFromPath(this.iconPath);

  public tray: Tray | null = null;
  private iconCache: Map<string, NativeImage> = new Map();
  private unreadIconCacheName:string = "unreadIcon";
  private unreadPrev:Unread = {list: []};

  constructor() {
    this.handleTrayEnabledToggle = this.handleTrayEnabledToggle.bind(this);
  }

  private getIconPath(): string {
    if (IS_WINDOWS) {
      // Re-use regular app .ico for the tray icon on Windows.
      return path.resolve(RESOURCES_PATH, "icon.ico");
    } else {
      // Mac tray icon filename MUST end in 'Template' and contain only black and transparent pixels.
      // Otherwise, automatic inversion and dark mode appearance won't work.
      // See: https://stackoverflow.com/questions/41664208/electron-tray-icon-change
      const trayIconFileName = IS_MAC ? "icon_macTemplate.png" : "icon.png";
      return path.resolve(RESOURCES_PATH, "tray", trayIconFileName);
    }
  }

  private getOverlayIconPath(): string | null {
    if (IS_WINDOWS) {
      return path.resolve(RESOURCES_PATH, "tray", "unread_icon.ico");
    } else if (IS_LINUX) {
      return path.resolve(RESOURCES_PATH, "tray", "unread_icon.png");
    }
    return null;
  }

  public startIfEnabled(): void {
    if (this.enabled) {
      this.tray = new Tray(this.iconPath);
      const trayContextMenu = Menu.buildFromTemplate(trayMenuTemplate);
      this.tray.setContextMenu(trayContextMenu);
      this.setupEventListeners();
      this.setUnreadIcon(this.unreadPrev);
    }
  }

  private setupEventListeners() {
    if (this.tray != null) {
      this.tray.on("click", this.handleTrayClick);
    }
  }

  private destroyEventListeners() {
    if (this.tray != null) {
      this.tray.removeListener("click", this.handleTrayClick);
      this.tray.removeListener("double-click", this.handleTrayClick);
    }
  }

  private handleTrayClick(_event: Electron.KeyboardEvent) {
    app.mainWindow?.show();
  }

  private destroy(): void {
    if (this.tray) {
      this.destroyEventListeners();
      this.tray.destroy();
      this.tray = null;
    }
  }

  public showMinimizeToTrayWarning(): void {
    if (IS_WINDOWS && this.enabled) {
      const seenMinimizeToTrayWarning = settings.get(
        "seenMinimizeToTrayWarningPref",
        false
      ) as boolean;
      if (!seenMinimizeToTrayWarning && this.tray != null) {
        this.tray.displayBalloon({
          title: "Android Messages",
          content:
            "Android Messages is still running in the background. To close it, use the File menu or right-click on the tray icon.",
        });
        settings.set("seenMinimizeToTrayWarningPref", true);
      }
    }
  }

  public handleTrayEnabledToggle(newValue: boolean): void {
    this.enabled = newValue;
    const liveStartInTrayMenuItemRef = Menu.getApplicationMenu()?.getMenuItemById(
      "startInTrayMenuItem"
    );

    if (newValue) {
      if (!IS_MAC && liveStartInTrayMenuItemRef != null) {
        // Must get a live reference to the menu item when updating their properties from outside of them.
        liveStartInTrayMenuItemRef.enabled = true;
      }
      if (!this.tray) {
        this.startIfEnabled();
      }
    }
    if (!newValue) {
      if (this.tray) {
        this.destroy();
        if (!IS_MAC) {
          if (!app.mainWindow?.isVisible()) {
            app.mainWindow?.show();
          }
        }
      }
      if (!IS_MAC && liveStartInTrayMenuItemRef != null) {
        // If the app has no tray icon, it can be difficult or impossible to re-gain access to the window, so disallow
        // starting hidden, except on Mac, where the app window can still be un-hidden via the dock.
        settings.set("startInTrayPref", false);
        liveStartInTrayMenuItemRef.enabled = false;
        liveStartInTrayMenuItemRef.checked = false;
      }
      if (IS_LINUX) {
        // On Linux, the call to tray.destroy doesn't seem to work, causing multiple instances of the tray icon.
        // Work around this by quickly restarting the app.
        app.relaunch();
        app.exit(0);
      }
    }
  }

  public setUnreadIcon(unread:Unread): void {
    if (IS_WINDOWS)
    {
      let that = this;
      let changeIcon = function()
      {
        app.mainWindow?.setIcon(
          (settings.get("iconBadgeTaskbar", DEFAULT_BADGE_TASKBAR)
            ? unread.icon64
              || unread.icon128
              || unread.icon256
              || unread.icon32
              || unread.icon24
              || unread.icon16
              || unread.icon
            : ""
          ) || that.iconPath);
      }
      changeIcon();
      if (!unread.focus && !unread.changeIcon)
      {
//	    	app.mainWindow?.flashFrame(true);
        clearTimeout(timer);
        timer = setTimeout(function()
        {
          changeIcon();
        }, 1000);
      }
    }
    else
      app.setBadgeCount(unread.list.length); //does this work on macOS/Linux?

    if (!this.tray)
      return;

    this.unreadPrev = unread;
    const tooltip: string = "Android Messages v" + app.getVersion(),
          textMaxLength = 22; // trancate text

    this.tray.setToolTip(tooltip);
    if (unread.list.length) {
      this.tray.setImage(unread.icon
                          || unread.icon16
                          || unread.icon24
                          || unread.icon32
                          || unread.icon64
                          || unread.icon128
                          || unread.icon256
                          || this.iconPath);
      let data:string = "";
      for(let i = 0, info:any, text:string; i < unread.list.length; i++)
      {
        info = unread.list[i];
        text = info.text.replace(/(\r\n|\n+)+/g, " ");
        if (text.length > textMaxLength)
          text = text.slice(0, textMaxLength) + "...";
        if (text)
          text = ":\n " + text;

        data += (data ? "\n" : "") + info.name + text;
      }
      if (data)
        this.tray.setToolTip(tooltip + "\n\n" + data);
    } else {
      this.tray.setImage(this.iconPath);
    }
  }

  public getIcon(size:number): string
  {
    if (IS_MAC)
      return path.resolve(RESOURCES_PATH, "tray", "icon_macTemplate.png")

    return path.resolve(RESOURCES_PATH, "icons", size + "x" + size + ".png");
  }

  public unreadIconImage(text:string, icon?:NativeImage): NativeImage | undefined
  {
    const iconCacheName = this.unreadIconCacheName + text;
    if (icon !== undefined)
      return this.iconCache.set(iconCacheName, icon), undefined;

    if (this.iconCache.has(iconCacheName))
      return this.iconCache.get(iconCacheName);

    return undefined;
  }

}
