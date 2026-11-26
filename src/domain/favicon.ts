// Honlap-ikonok (favicon) felderítése – tiszta függvények. A hálózatot a scripts/fetch-favicons.ts kezeli;
// itt csak a HTML-ből kinyerés, a jelöltek rangsora, a fájltípus felismerése és a fájlnév van.

export interface IconCandidate {
  url: string;
  rel: "apple-touch-icon" | "manifest" | "icon" | "mask-icon" | "fallback";
  /** A legnagyobb megadott méret pixelben (sizes="180x180"), `any` → 512, ismeretlen → 0. */
  size: number;
  type?: string;
}

/** Weboldal-cím rendbetétele: hiányzó séma → https; csak http/https; hibásnál undefined. */
export function normalizeWebsite(raw: string | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : undefined;
};

const decodeEntities = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&quot;/g, '"');

function parseSizes(sizes: string | undefined): number {
  if (!sizes) return 0;
  if (/\bany\b/i.test(sizes)) return 512;
  return Math.max(0, ...sizes.split(/\s+/).map((s) => Number(s.toLowerCase().split("x")[0]) || 0));
}

/**
 * A <link rel="icon" …> jellegű hivatkozások kinyerése (a <base href> figyelembevételével), abszolút URL-ekkel.
 * Mindig hozzáteszi a /favicon.ico tartalékot is.
 */
export function extractIconLinks(html: string, pageUrl: string): IconCandidate[] {
  const head = html.slice(0, 300_000);
  const baseHref = head.match(/<base\s[^>]*>/i)?.[0];
  let base = pageUrl;
  const bh = baseHref && attr(baseHref, "href");
  if (bh) {
    try {
      base = new URL(decodeEntities(bh), pageUrl).toString();
    } catch {
      /* rossz <base>: marad az oldal címe */
    }
  }
  const out: IconCandidate[] = [];
  for (const tag of head.match(/<link\s[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    let kind: IconCandidate["rel"] | undefined;
    if (/apple-touch-icon/.test(rel)) kind = "apple-touch-icon";
    else if (/(^|\s)mask-icon(\s|$)/.test(rel)) kind = "mask-icon";
    else if (/(^|\s)icon(\s|$)/.test(rel)) kind = "icon";
    if (!kind) continue;
    try {
      const url = new URL(decodeEntities(href), base);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      const type = attr(tag, "type")?.toLowerCase();
      out.push({ url: url.toString(), rel: kind, size: parseSizes(attr(tag, "sizes")), ...(type ? { type } : {}) });
    } catch {
      /* hibás href: kihagyjuk */
    }
  }
  try {
    out.push({ url: new URL("/favicon.ico", pageUrl).toString(), rel: "fallback", size: 0 });
  } catch {
    /* nincs érvényes oldal-cím */
  }
  return out;
}

/** Pontszám: nagyobb a jobb. Az apple-touch-icon és a nagy PNG előre, a maszk-ikon (egyszínű) és a pici ikon hátra. */
export function candidateScore(c: IconCandidate): number {
  if (c.rel === "mask-icon") return 10; // egyszínű sziluett: csak végső esetben
  const isSvg = c.type === "image/svg+xml" || /\.svg(\?|$)/i.test(c.url);
  let s = 0;
  if (c.rel === "apple-touch-icon") s += 300;
  else if (c.rel === "manifest") s += 280;
  else if (c.rel === "icon") s += 200;
  else s += 50; // /favicon.ico tartalék
  if (isSvg) s += 120;
  s += Math.min(c.size, 256) / 2;
  if (c.size > 0 && c.size < 32) s -= 80;
  return s;
}

/** Jelöltek sorrendben (legjobb elöl), ismétlődő URL-ek nélkül. */
export function rankIconCandidates(cands: IconCandidate[]): IconCandidate[] {
  const seen = new Set<string>();
  return [...cands]
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

export type ImageKind = "png" | "ico" | "svg" | "jpg" | "webp" | "gif";

/** A fájl első bájtjaiból: tényleg kép-e (a Content-Type-nak nem hiszünk vakon). */
export function sniffImageType(bytes: Uint8Array): ImageKind | undefined {
  const b = bytes;
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (b.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (b.length >= 4 && at(0, 0x00, 0x00, 0x01, 0x00)) return "ico";
  if (b.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "jpg";
  if (b.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  if (b.length >= 6 && (at(0, 0x47, 0x49, 0x46, 0x38, 0x37, 0x61) || at(0, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61))) return "gif";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return undefined;
}

export const FAVICON_DIR = "icons/places";
export const FAVICON_MAX_BYTES = 200 * 1024;

/** Biztonságos fájlnév a hely azonosítójából: icons/places/osm-node-123.png */
export function faviconFileName(placeId: string, kind: ImageKind): string {
  const safe = placeId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "hely";
  return `${FAVICON_DIR}/${safe}.${kind}`;
}

/** A data/place-favicons.json egy bejegyzése. */
export interface FaviconRecord {
  status: "ok" | "not-found" | "error" | "disabled";
  /** Hiba fajtája (kézi utánjáráshoz). */
  errorKind?: FetchErrorKind;
  /** A letöltött kép pixelmérete (ha kiolvasható; SVG-nél nincs). */
  width?: number;
  height?: number;
  /** Saját mappánkban lévő fájl (status = ok). */
  file?: string;
  /** Honnan töltöttük le (forrásmegjelölés). */
  source?: string;
  page?: string;
  bytes?: number;
  sha256?: string;
  fetchedAt?: string;
  error?: string;
}

export type FaviconIndex = Record<string, FaviconRecord>;

// ---------- v2: címváltozatok, átirányítás, web manifest, méret, hibakategória ----------

/**
 * Próbálandó címváltozatok, ha az oldal nem töltődik be: eredeti → másik séma → www-vel / nélküle.
 * Ismétlés nélkül, az eredeti mindig elöl.
 */
export function websiteVariants(url: string): string[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  const hosts = u.hostname.startsWith("www.") ? [u.hostname, u.hostname.slice(4)] : [u.hostname, `www.${u.hostname}`];
  const schemes = u.protocol === "https:" ? ["https:", "http:"] : ["http:", "https:"];
  const out: string[] = [];
  for (const host of hosts)
    for (const scheme of schemes) {
      const v = new URL(u.toString());
      v.protocol = scheme;
      v.hostname = host;
      out.push(v.toString());
    }
  return [...new Set([u.toString(), ...out])];
}

/** <meta http-equiv="refresh" content="0; url=…"> célja (abszolút), ha van. */
export function extractMetaRefresh(html: string, pageUrl: string): string | undefined {
  for (const tag of html.slice(0, 100_000).match(/<meta\s[^>]*>/gi) ?? []) {
    if ((attr(tag, "http-equiv") ?? "").toLowerCase() !== "refresh") continue;
    const m = (attr(tag, "content") ?? "").match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
    if (!m) continue;
    try {
      const u = new URL(decodeEntities(m[1].trim()), pageUrl);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {
      /* hibás cél */
    }
  }
  return undefined;
}

/** <link rel="manifest" href="…"> abszolút címe, ha van. */
export function extractManifestLink(html: string, pageUrl: string): string | undefined {
  for (const tag of html.slice(0, 300_000).match(/<link\s[^>]*>/gi) ?? []) {
    if (!/(^|\s)manifest(\s|$)/i.test(attr(tag, "rel") ?? "")) continue;
    const href = attr(tag, "href");
    if (!href) continue;
    try {
      const u = new URL(decodeEntities(href), pageUrl);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {
      /* hibás href */
    }
  }
  return undefined;
}

/** A web app manifest `icons` listája jelöltként (az egyszínű „monochrome” ikonok nélkül). */
export function manifestIcons(manifest: unknown, manifestUrl: string): IconCandidate[] {
  const icons = (manifest as { icons?: unknown })?.icons;
  if (!Array.isArray(icons)) return [];
  const out: IconCandidate[] = [];
  for (const i of icons as { src?: unknown; sizes?: unknown; type?: unknown; purpose?: unknown }[]) {
    if (typeof i?.src !== "string" || !i.src) continue;
    if (typeof i.purpose === "string" && /monochrome/i.test(i.purpose) && !/any/i.test(i.purpose)) continue;
    try {
      const u = new URL(i.src, manifestUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const type = typeof i.type === "string" ? i.type.toLowerCase() : undefined;
      out.push({ url: u.toString(), rel: "manifest", size: parseSizes(typeof i.sizes === "string" ? i.sizes : undefined), ...(type ? { type } : {}) });
    } catch {
      /* hibás src */
    }
  }
  return out;
}

/** Pixelméret PNG / GIF / ICO fejlécből (ICO-nál a legnagyobb bejegyzés; a 0 = 256). JPEG/WebP/SVG: undefined. */
export function imageDimensions(bytes: Uint8Array, kind: ImageKind): { width: number; height: number } | undefined {
  const u16le = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const u32be = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  if (kind === "png" && bytes.length >= 24) return { width: u32be(16), height: u32be(20) };
  if (kind === "gif" && bytes.length >= 10) return { width: u16le(6), height: u16le(8) };
  if (kind === "ico" && bytes.length >= 6) {
    const n = u16le(4);
    let best: { width: number; height: number } | undefined;
    for (let k = 0; k < n && 6 + k * 16 + 2 <= bytes.length; k++) {
      const w = bytes[6 + k * 16] || 256;
      const h = bytes[6 + k * 16 + 1] || 256;
      if (!best || w > best.width) best = { width: w, height: h };
    }
    return best;
  }
  return undefined;
}

export type FetchErrorKind = "unreachable" | "timeout" | "http" | "no-icon" | "not-image";

/** Hibaüzenetből kategória (a data/place-favicons.json-ban a kézi utánjáráshoz). */
export function classifyFetchError(message: string): FetchErrorKind {
  const m = message.toLowerCase();
  if (/abort|timeout|timed out/.test(m)) return "timeout";
  if (/http \d{3}/.test(m)) return "http";
  if (/nem kép|not an image|túl kicsi/.test(m)) return "not-image";
  if (/nincs ikon/.test(m)) return "no-icon";
  return "unreachable";
}

/** Kézzel gondozott honlapok (data/place-websites.json): helyazonosító → hivatalos honlap. Érvénytelen kihagyva. */
export function parseWebsiteOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (id.startsWith("_")) continue;
    const url = typeof v === "string" ? v : typeof (v as { url?: unknown })?.url === "string" ? (v as { url: string }).url : undefined;
    const n = normalizeWebsite(url);
    if (n) out[id] = n;
  }
  return out;
}
