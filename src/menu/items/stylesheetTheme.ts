import { dialog, Menu, type MenuItemConstructorOptions } from "electron";
import { readFile } from "node:fs/promises";
import { getMainWindow } from "../../helpers/getMainWindow";
import { settings } from "../../helpers/settings";

const { customStylesheetPath } = settings;

export const stylesheetThemeMenu: MenuItemConstructorOptions = {
  label: "Stylesheet Theme",
  submenu: [
    {
      label: "Choose Stylesheet…",
      click: async () => {
        const window = getMainWindow();
        if (!window) return;
        try {
          const result = await dialog.showOpenDialog(window, {
            title: "Choose a CSS theme",
            filters: [{ name: "CSS stylesheets", extensions: ["css"] }],
            properties: ["openFile"],
          });
          if (result.canceled || !result.filePaths[0]) return;
          const filePath = result.filePaths[0];
          await readFile(filePath, "utf8");
          customStylesheetPath.next(filePath);
        } catch (error) {
          dialog.showErrorBox("Unable to load stylesheet", String(error));
        }
      },
    },
    {
      id: "reloadStylesheetMenuItem",
      label: "Reload Stylesheet",
      enabled: !!customStylesheetPath.value,
      click: () => customStylesheetPath.next(customStylesheetPath.value),
    },
    {
      id: "removeStylesheetMenuItem",
      label: "Remove Stylesheet",
      enabled: !!customStylesheetPath.value,
      click: () => customStylesheetPath.next(null),
    },
  ],
};

customStylesheetPath.subscribe((filePath) => {
  for (const id of ["reloadStylesheetMenuItem", "removeStylesheetMenuItem"]) {
    const item = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (item) item.enabled = !!filePath;
  }
});
