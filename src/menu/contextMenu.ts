import {
  ContextMenuParams,
  MenuItemConstructorOptions,
  remote,
  clipboard,
} from "electron";

const { Menu, app } = remote;

// WARNING THIS IS THE ONLY PLACE LEFT WITH FORCE TYPECASTS TO ANY
// IT HAS NO SIDE EFFECTS
// I WOULD NOT DO IT BUT I AM NOT POSITIVE HOW TO PROPERLY TYPE IT

const SAVEAS = 0,
      COPY = 1,
      COPYL = 2,
      SEP1 = 3,
      SELALL = 4;

const standardMenuTemplate: MenuItemConstructorOptions[] = []
standardMenuTemplate[SAVEAS] = {
  label: "Save # As...",
};
standardMenuTemplate[COPY] = {
  label: "Copy Message",
};
standardMenuTemplate[COPYL] = {
  label: "Copy Link",
};
standardMenuTemplate[SEP1] = {
  type: "separator",
};
standardMenuTemplate[SELALL] = {
  label: "Select All",
};

const textMenuTemplate: MenuItemConstructorOptions[] =
[
  {
    label: "Undo",
    role: "undo",
  },
  {
    label: "Redo",
    role: "redo",
  },
  {
    type: "separator",
  },
  {
    label: "Cut",
    role: "cut",
  },
  {
    label: "Copy",
    role: "copy",
  },
  {
    label: "Paste",
    role: "paste",
  },
  {
    type: "separator",
  },
  {
    label: "Select All",
    role: "selectAll",
  },
];


export const popupContextMenu = async (event: Electron.Event, params: ContextMenuParams): Promise<void> => {

  const node = document.elementFromPoint(params.x, params.y) as HTMLElement;
  const msgNode = findMsg(node) as HTMLElement;

  if (!msgNode && !params.isEditable)
    return;

  let menu:any,
      menuIsClosing = false,
      callback:Function|null = null;

  const isLightbox = msgNode && msgNode.tagName == "MWS-LIGHTBOX";
  const win = remote.getCurrentWindow();

  const menuTemplate:MenuItemConstructorOptions[] = [...(params.isEditable ? textMenuTemplate : standardMenuTemplate)];
  const showMenu = (callback?:Function|null) =>
  {
    menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup({
      x: params.x,
      y: params.y,
      window: win,
      callback: () => {
        (menu as unknown) = null; // Unsure if memory would leak without this (Clean up, clean up, everybody do your share)
        if (typeof callback == "function")
          callback();
      }
    });
  } // showMenu()

  if (params.isEditable) {

    if (params.misspelledWord) {
      menuTemplate.unshift({ type: "separator" });
      menuTemplate.unshift({
        label: "Add to Dictionary",
        click: () =>
          app.mainWindow?.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord
          ),
      });
      menuTemplate.unshift({ type: "separator" });
      for (const suggestion of params.dictionarySuggestions.reverse()) {
        menuTemplate.unshift({
          label: suggestion,
          click: () =>
            remote.getCurrentWebContents().replaceMisspelling(suggestion),
        });
      }
    }
    showMenu();
    return;
  }
  // Omit options pertaining to input fields if this isn't one

  const sel = document.getSelection() as Selection;
  let text:string = "";
  if (sel.containsNode(msgNode, true))
    text = sel.toString();

  if (text == "")
  {
    text = msgNode?.textContent as string;
    const range = document.createRange();
    range.selectNode(msgNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    text = window.getSelection()?.toString() as string;
    window.getSelection()?.removeAllRanges();
  }

  menuTemplate[COPY].click = () =>
  {
    if (text != "")
      clipboard.writeText(text);
  }

  menuTemplate[COPYL].click = () =>
  {
    clipboard.writeText(params.linkURL);
  };

  menuTemplate[SELALL].click = () =>
  {
    const range = document.createRange();
    range.selectNode(msgNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }
  menuTemplate[COPY].enabled = msgNode.textContent?.trim() != "" && !isLightbox;
  menuTemplate[SELALL].enabled = msgNode.textContent?.trim() != "" && !isLightbox;
  menuTemplate[COPYL].visible = (params.linkURL && node.tagName == "A") as boolean;

  switch (params.mediaType) {
    case "video":
    case "image":
      if (!params.srcURL || !params.srcURL.length)
        break;

      const mediaType = params.mediaType[0].toUpperCase() + params.mediaType.slice(1);

      let url = params.srcURL;

      menuTemplate.splice(COPYL, 1); // remove copy link
      menuTemplate[SAVEAS].visible = true;
      menuTemplate[SAVEAS].label = menuTemplate[SAVEAS].label?.replace("#", mediaType);
      menuTemplate[SAVEAS].click = () =>
      {
        const link = document.createElement('a'),
              d = new Date(),
              download = (url:string) =>
              {
                link.href = url;
                link.download = "IMG_" + d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              },
              pad = (t:number) => ("0" + t).substr(-2);

        if (url.match(/^blob:/i))
        {
          download(url);
        }
        else
        {
          //using AJAX to prevent non-blob images from being opened instead of downloaded (i.e preview of web links)
          const xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "blob";
          xhr.onload = function()
          {
          	const url = window.URL.createObjectURL(this.response);
            download(url);
            window.URL.revokeObjectURL(url);
          }
          xhr.send();
        }
      } // saveAs()

      callback = () =>
      {
        if (!menuIsClosing)
        {
          (overlay.firstChild as HTMLElement)?.click();
          observer.disconnect();
          setTimeout(()=>document.body.classList.toggle("hiddenOverlay", false), 300);
          clearTimeout(timer);
        }
        menuIsClosing = false;
      }

      const urlLoaded = (src:string, sublabel:string="") =>
      {
        clearTimeout(timer);
        if (src)
          url = src;

        // cache new url for both old and new urls, it's probably redundent, since new url will be "attached" to the preview image
        cacheURL.set(params.srcURL, src);
        cacheURL.set(url, src);
        menuTemplate[SAVEAS].sublabel = sublabel;
        menuIsClosing = true;
        // electron currently doesn't support dynamic menus, we have to re-open it
        menu.closePopup(win);
        showMenu(callback);
      } // urlLoaded()

      const observer:MutationObserver = new MutationObserver((m: MutationRecord[], o: MutationObserver) =>
      {
        const node = m[0].target as HTMLElement;
        let src:string;
        if (m[0].type == "attributes" && node.tagName == "IMG")
        {
          // image finished loading
          src = node.getAttribute("src") as string;
          o.disconnect();
        }
        else
        {
          const overlayImg = overlay.querySelector("img") as HTMLElement;
          if (!overlayImg)
            return;

          // image found in the overlay
          o.disconnect();
          src = overlayImg.getAttribute("src") as string;
          if (!src || src == url)
          {
            clearTimeout(timer);
            // wait 5sec for the image to load
            timer = setTimeout(function()
            {
              // change menu label
              urlLoaded("", "still loading...");
              // wait another 5sec and assume this is the original image
              timer = setTimeout(function()
              {
                urlLoaded(url, "");
              }, 5000);
            }, 5000);
            // wait for original image to load
            return observer.observe(overlayImg,
            {
              attributes: true,
              attributeFilter: ["src"]
            })
          }
        }
        // image finished loading
        urlLoaded(src);
        return;
      }) //observer

      const win = remote.getCurrentWindow();
      let overlay = {} as HTMLElement;

      for (let i = 0; i < 100; i++)
      {
        if (overlay = document.querySelector("body > div.cdk-overlay-container") as HTMLElement)
          break;

        const button = document.querySelector("mw-main-nav-menu > button") as HTMLElement;
        button.click();
        button.click();
      }

      const cachedUrl = cacheURL.get(url);
      let timer:NodeJS.Timer,
          enabled = true;

      if (cachedUrl)
        url = cachedUrl;

      if (node.classList.contains("image-msg") && !cachedUrl && ((node as HTMLImageElement).naturalWidth == 600 || (node as HTMLImageElement).naturalHeight == 600) )
      {
        // menu requested on image preview, let's load the original image
        enabled = false;
        document.body.classList.toggle("hiddenOverlay", true);
        observer.observe(overlay,
        {
          subtree: true,
          childList: true,
        });
        // open original image
        node?.click();
      }
      if (!enabled)
        menuTemplate[SAVEAS].sublabel = "loading orig...";

      break;
    default:
      menuTemplate[SAVEAS].visible = false;
  }
  showMenu(callback);
};

const cacheURL:Map<string, string> = new Map();
const findMsg = function (node:Element|Element|null):HTMLElement|null
{
  if (!node)
    return null;

  if (node.tagName == "MWS-MESSAGE-PART-CONTENT" || node.tagName == "MWS-LIGHTBOX")
    return node as HTMLElement;

  return findMsg(node.parentNode as Element );
}
