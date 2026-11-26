// Profilkép: saját feltöltés → Google-fiók képe → kezdőbetű (mindig van megjeleníthető avatar).
// Külső, tetszőleges kép-URL-t nem fogadunk el (adatvédelem: a kép betöltése az idegen oldalnak IP-t árul el).

export type AvatarPref = "auto" | "initials";

/** Saját, kicsinyített profilkép (demóban data URL, élesben Firebase Storage). */
export interface StoredAvatar {
  url: string;
  storagePath?: string;
  updatedAt: number;
}

export interface AvatarSettings {
  custom?: StoredAvatar;
  /** „initials” = mindig a kezdőbetű (akkor is, ha van kép). */
  pref: AvatarPref;
}

export const DEFAULT_AVATAR_SETTINGS: AvatarSettings = { pref: "auto" };

export const AVATAR_LIMITS = {
  mimes: ["image/jpeg", "image/png", "image/webp"],
  /** A kiválasztott eredeti fájl legfeljebb ekkora lehet (a böngésző kicsinyíti). */
  maxInputBytes: 5 * 1024 * 1024,
  /** A tárolt, kicsinyített kép oldalhossza és felső mérete. */
  sizePx: 256,
  maxStoredBytes: 1024 * 1024,
  /** Demóban a data URL legfeljebb ennyi karakter (localStorage-kímélés). */
  maxDataUrlChars: 200_000,
} as const;

export function validateAvatarFile(file: { mime: string; size: number }): string | null {
  if (!(AVATAR_LIMITS.mimes as readonly string[]).includes(file.mime)) return "Csak JPG, PNG vagy WebP kép választható.";
  if (file.size <= 0) return "Üres fájl.";
  if (file.size > AVATAR_LIMITS.maxInputBytes) return "A kép legfeljebb 5 MB lehet.";
  return null;
}

/** Megjeleníthető kép-cím-e: csak saját data URL (kép) vagy https (Storage / Google-fiók). */
export function isSafeAvatarUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  if (url.startsWith("data:")) return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= AVATAR_LIMITS.maxDataUrlChars;
  return /^https:\/\/[^\s"'<>]+$/.test(url) && url.length <= 2048;
}

/** Tárolt beállítás beolvasása (hibás / régi adatnál alapérték). */
export function parseAvatarSettings(raw: unknown): AvatarSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AVATAR_SETTINGS;
  const r = raw as Partial<AvatarSettings>;
  const pref: AvatarPref = r.pref === "initials" ? "initials" : "auto";
  const c = r.custom;
  const custom = c && isSafeAvatarUrl(c.url) ? { url: c.url, updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : 0, ...(c.storagePath ? { storagePath: c.storagePath } : {}) } : undefined;
  return custom ? { pref, custom } : { pref };
}

// ---------- kezdőbetű ----------

const firstLetter = (w: string) => w.match(/\p{L}/u)?.[0]?.toLocaleUpperCase("hu-HU") ?? "";

/**
 * Legfeljebb 2 betű: az első és az utolsó név-szó kezdőbetűje („Szabolcs Szirák” → „SS”, „kati” → „K”).
 * Ponttal végződő rövidítéseket („Dr.”, „ifj.”) és betű nélküli részeket kihagy; név nélkül az e-mailből; végül „?”.
 */
export function initials(displayName?: string, email?: string): string {
  const fromWords = (words: string[]) => {
    const ws = words.filter((w) => !/\.$/.test(w) && firstLetter(w));
    if (!ws.length) return "";
    return ws.length === 1 ? firstLetter(ws[0]) : firstLetter(ws[0]) + firstLetter(ws[ws.length - 1]);
  };
  const byName = fromWords((displayName ?? "").trim().split(/\s+/));
  if (byName) return byName;
  const local = (email ?? "").split("@")[0];
  const byMail = fromWords(local.split(/[._\-+\d]+/));
  return byMail || "?";
}

/** Világos LED-színek a karbon alapon; rajtuk sötét betű olvasható. */
export const AVATAR_COLORS = ["#2EF2B3", "#FF5C8A", "#FFC53D", "#5AB0FF", "#B69CFF", "#A3E635", "#FF8A4C"];
export const AVATAR_TEXT_COLOR = "#0A0C0D";

/** Mindig ugyanaz a szín ugyanannak a felhasználónak. */
export function avatarColor(uid: string): string {
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ---------- feloldás ----------

export type AvatarView =
  | { kind: "image"; url: string; source: "custom" | "provider"; initials: string; color: string }
  | { kind: "initials"; initials: string; color: string };

export interface AvatarUser {
  uid: string;
  displayName?: string;
  email?: string;
  /** A bejelentkezési fiók (Google) képe, ha van. */
  photoURL?: string;
}

/**
 * Melyik avatar jelenjen meg. Sorrend: saját kép → Google-fiók képe → kezdőbetű.
 * „Csak kezdőbetű” beállításnál mindig kezdőbetű. A `failed` listában lévő (be nem töltött) képeket átugorja.
 */
export function resolveAvatar(user: AvatarUser, settings: AvatarSettings = DEFAULT_AVATAR_SETTINGS, failed: readonly string[] = []): AvatarView {
  const base = { initials: initials(user.displayName, user.email), color: avatarColor(user.uid) };
  if (settings.pref === "initials") return { kind: "initials", ...base };
  const candidates: { url: string | undefined; source: "custom" | "provider" }[] = [
    { url: settings.custom?.url, source: "custom" },
    { url: user.photoURL, source: "provider" },
  ];
  for (const c of candidates) if (isSafeAvatarUrl(c.url) && !failed.includes(c.url)) return { kind: "image", url: c.url, source: c.source, ...base };
  return { kind: "initials", ...base };
}
