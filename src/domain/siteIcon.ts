// Hely-ikon a csempére: kocsmáros által feltöltött ikon → honlap-ikon (saját mappánkból) → négyágú csillag.
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
    if (r.status === "ok" && isSafeIconUrl(r.file)) out[id] = r;
    else if (r.status === "disabled" || r.status === "not-found" || r.status === "error") out[id] = { status: r.status };
  }
  return out;
}

export type PlaceBadge =
  | { kind: "image"; url: string; source: "owner" | "website"; credit?: string }
  | { kind: "sparkle" };

/**
 * Mit mutasson a csempe. A `failed` listában lévő (be nem töltött) képeket átugorja,
 * így hibás ikon helyett mindig a négyágú csillag marad.
 */
export function resolvePlaceBadge(place: Pick<Place, "id" | "info">, favicons: FaviconIndex = {}, failed: readonly string[] = []): PlaceBadge {
  const own = place.info?.iconUrl;
  if (isSafeIconUrl(own) && !failed.includes(own)) return { kind: "image", url: own, source: "owner" };
  const rec = favicons[place.id];
  if (rec?.status === "ok" && isSafeIconUrl(rec.file) && !failed.includes(rec.file))
    return { kind: "image", url: rec.file, source: "website", ...(rec.source ? { credit: rec.source } : {}) };
  return { kind: "sparkle" };
}
