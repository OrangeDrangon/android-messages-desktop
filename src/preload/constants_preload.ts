// Can't use constants.ts in bridge.ts because of context isolation

export const IS_MAC = window.navigator.userAgent.indexOf("Macintosh") > -1;

// This preload runs on every page the window loads, which includes Google's
// sign-in pages. They must be left untouched: they are not ours to modify, and
// modifying them breaks them.
export const IS_MESSAGES_ORIGIN =
  window.location.hostname === "messages.google.com";

export const RECENT_CONVERSATION_TRAY_COUNT = 3;

// Max characters of a conversation snippet shown in the tray before it is
// truncated with an ellipsis.
export const RECENT_CONVERSATION_SNIPPET_LENGTH = 30;

export { INITIAL_ICON_IMAGE } from "../helpers/constants_shared";
