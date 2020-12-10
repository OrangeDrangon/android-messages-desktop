import settingsLegacy from "electron-settings";
import jetpack from "fs-jetpack";

import {
  SETTING_AUTOHIDE_MENU,
  SETTING_HIDE_NOTIFICATION,
  SETTING_NOTIFICATION_SOUND,
  SETTING_START_IN_TRAY,
  SETTING_SYSTEM_DARK_MODE,
  SETTING_TRAY_ENABLED,
} from "./constants";

import { BehaviorSubject } from "rxjs";

const startInTrayLegacy = settingsLegacy.get(
  SETTING_START_IN_TRAY,
  false
) as boolean;
const autoHideMenuLegacy = settingsLegacy.get(
  SETTING_AUTOHIDE_MENU,
  false
) as boolean;
const notificationSoundLegacy = settingsLegacy.get(
  SETTING_NOTIFICATION_SOUND,
  true
) as boolean;
const hideNotificationContentLegacy = settingsLegacy.get(
  SETTING_HIDE_NOTIFICATION,
  false
) as boolean;
const systemDarkModeLegacy = settingsLegacy.get(
  SETTING_SYSTEM_DARK_MODE,
  true
) as boolean;
const trayEnabledLegacy = settingsLegacy.get(
  SETTING_TRAY_ENABLED,
  false
) as boolean;

export const startInTray = new BehaviorSubject(startInTrayLegacy);
export const autoHideMenu = new BehaviorSubject(autoHideMenuLegacy);
export const notificationSound = new BehaviorSubject(notificationSoundLegacy);
export const hideNotificationContent = new BehaviorSubject(
  hideNotificationContentLegacy
);
export const useSystemDarkMode = new BehaviorSubject(systemDarkModeLegacy);
export const darkMode = new BehaviorSubject(false);
export const trayEnabled = new BehaviorSubject(trayEnabledLegacy);

export const settings = {
  startInTray,
  autoHideMenu,
  notificationSound,
  hideNotificationContent,
  useSystemDarkMode,
  darkMode,
  trayEnabled,
};

const settings_file = "settings.json";

if (!jetpack.exists(settings_file)) {
  jetpack.write(settings_file, {});
}

Object.entries(settings).forEach(([name, setting]) => {
  setting.subscribe((val) => {
    const data = jetpack.read(settings_file, "json") || {};
    data[name] = val;
    jetpack.write(settings_file, data);
  });
});
