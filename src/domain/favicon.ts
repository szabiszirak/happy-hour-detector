// Honlap-ikonok (favicon) felderítése – tiszta függvények. A hálózatot a scripts/fetch-favicons.ts kezeli;
// itt csak a HTML-ből kinyerés, a jelöltek rangsora, a fájltípus felismerése és a fájlnév van.

export interface IconCandidate {
  url: string;
  rel: "apple-touch-icon" | "icon" | "mask-icon" | "fallback";
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
