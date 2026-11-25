// Az aktív fiók (vendég / kocsmáros) eszközönként tárolva. Csak felület-állapot: jogot nem ad,
// a jogosultságot a domain (account.ts, ownership.ts) és a szerveren a firestore.rules dönti el.
import { parseAccountMode, type AccountMode } from "../domain/account";

const KEY = "hhd.mode";

export function loadAccountMode(): AccountMode {
  try {
    return parseAccountMode(localStorage.getItem(KEY));
  } catch {
    return "guest";
  }
}

export function saveAccountMode(mode: AccountMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* nincs tároló */
  }
}

export function clearAccountMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nincs tároló */
  }
}
