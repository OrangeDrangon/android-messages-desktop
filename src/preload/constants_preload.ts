// Can't use constants.ts in bridge.ts because of context isolation

export const IS_MAC = window.navigator.userAgent.indexOf("Macintosh") > -1;

export const RECENT_CONVERSATION_TRAY_COUNT = 3;

export {INITIAL_ICON_IMAGE} from "../helpers/constants_shared";
