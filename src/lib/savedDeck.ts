/**
 * Remembering a visitor's deck between visits. The server only ever sees the deck path
 * (zip + district codes) in a cookie; the address text they typed stays in their
 * browser's localStorage, so the header can show it without it leaving the device.
 */

export const DECK_COOKIE = "deck";

/** Only deck paths we build ourselves, so the cookie can't become an open redirect. */
export function isDeckPath(path: string | undefined): path is string {
  return !!path && /^\/z\/\d{5}(\?(cd|u|l)=[\w.%+-]+(&(cd|u|l)=[\w.%+-]+)*)?$/.test(path);
}

const ADDRESS_KEY = "ygd:address";
const CHANGE_EVENT = "ygd:address";

export function readSavedAddress(): string | null {
  try {
    return localStorage.getItem(ADDRESS_KEY);
  } catch {
    // Storage blocked (private mode, site data off): the header shows the search box.
    return null;
  }
}

export function saveAddress(address: string) {
  try {
    localStorage.setItem(ADDRESS_KEY, address);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: this tab's saves, plus other tabs' via the storage event. */
export function subscribeSavedAddress(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
