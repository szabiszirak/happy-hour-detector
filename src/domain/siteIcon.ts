// Hely-ikon a csempére: kocsmáros által feltöltött ikon → honlap-ikon (saját mappánkból) → a hely nevének kezdőbetűje.
// Külső oldalról közvetlenül nem töltünk be képet (adatvédelem, törött linkek, http-tiltás https-en).
import type { Place } from "./types";
import type { FaviconIndex, FaviconRecord } from "./favicon";

const LOCAL_ICON = /^icons\/places\/[a-z0-9-]+\.(png|ico|svg|jpg|webp|gif)$/;
const STORAGE_URL = /^https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+$/;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Megjeleníthető ikon-cím-e: saját mappa, saját Storage vagy (demóban) kicsinyített data URL. */
export function isSafeIconUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url || url.length > 100_000) return false;
  return LOCAL_ICON.test(url) || (STORAGE_URL.test(url) && url.length <= 2048) || DATA_URL.test(url);
}

/** A data/place-favicons.json beolvasása: csak érvényes, sikeres és helyi fájlra mutató bejegyzések számítanak. */
export function parseFaviconIndex(raw: unknown): FaviconIndex {
  if (!raw || typeof raw !== "object") return {};
  const out: FaviconIndex = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (id.startsWith("_") || !v || typeof v !== "object") continue;
    const r = v as FaviconRecord;
    if (r.status === "ok" && isSafeIconUrl(r.file))
      out[id] = { status: "ok", file: r.file, ...(r.source ? { source: r.source } : {}), ...(typeof r.width === "number" ? { width: r.width } : {}), ...(typeof r.height === "number" ? { height: r.height } : {}) };
    else if (r.status === "disabled" || r.status === "not-found" || r.status === "error") out[id] = { status: r.status };
  }
  return out;
}

export type PlaceBadge =
  | { kind: "image"; url: string; source: "owner" | "website"; credit?: string; pixelated?: boolean }
  | { kind: "initial"; letter: string };

const SKIP_WORDS = new Set(["a", "az", "the"]);

/**
 * A hely nevének kezdőbetűje nagybetűvel („Púder Bárszínház” → „P”, „2k bár” → „2”).
 * A névelőt (a, az, the) átugorja, ha utána van még szó; írásjeleket, emojit kihagy. Üres névnél „?”.
 */
export function placeInitial(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const start = words.length > 1 && SKIP_WORDS.has(words[0].toLocaleLowerCase("hu")) ? 1 : 0;
  for (const w of words.slice(start)) {
    const m = w.match(/[\p{L}\p{N}]/u);
    if (m) return m[0].toLocaleUpperCase("hu");
  }
  return "?";
}

/** A forrás rövid neve a feliratban: „berliner.hu” (www nélkül). */
export function creditHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Kis (≤ 32 px) raszteres ikon: nagyításkor pixelesen, élesen rajzoljuk elmosás helyett. */
export const isSmallIcon = (r: Pick<FaviconRecord, "width" | "file">) =>
  r.width !== undefined && r.width <= 32 && !(r.file ?? "").endsWith(".svg");

/**
 * Mit mutasson a csempe. A `failed` listában lévő (be nem töltött) képeket átugorja,
 * így hibás ikon helyett mindig a hely kezdőbetűje marad.
 */
export function resolvePlaceBadge(place: Pick<Place, "id" | "info"> & { name?: string }, favicons: FaviconIndex = {}, failed: readonly string[] = []): PlaceBadge {
  const own = place.info?.iconUrl;
  if (isSafeIconUrl(own) && !failed.includes(own)) return { kind: "image", url: own, source: "owner" };
  const rec = favicons[place.id];
  if (rec?.status === "ok" && isSafeIconUrl(rec.file) && !failed.includes(rec.file))
    return {
      kind: "image",
      url: rec.file,
      source: "website",
      ...(creditHost(rec.source) ? { credit: creditHost(rec.source) } : {}),
      ...(isSmallIcon(rec) ? { pixelated: true } : {}),
    };
  return { kind: "initial", letter: placeInitial(place.name) };
}
