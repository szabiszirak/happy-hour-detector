// Helyek ikonja: kézi felülírás → névbeli kulcsszó → OSM-típus → alapikon.
// Csak azonosítót ad vissza; a rajzok saját SVG-k a components/PlaceIcon.tsx-ben (nincs külső kép / letöltés).
import type { Place, PlaceIconId } from "./types";
import { brandKey } from "./drinkCatalog";

export const PLACE_ICON_IDS: PlaceIconId[] = [
  "pub", "craft", "bar", "cocktail", "wine", "club", "music", "games", "culture", "cafe", "restaurant", "garden", "generic",
];

export const PLACE_ICON_LABELS: Record<PlaceIconId, string> = {
  pub: "Söröző / kocsma",
  craft: "Kézműves sörös hely",
  bar: "Bár",
  cocktail: "Koktélbár",
  wine: "Borozó",
  club: "Klub",
  music: "Élőzenés hely",
  games: "Darts, biliárd, játék",
  culture: "Kulturális hely",
  cafe: "Kávézó-bár",
  restaurant: "Étterem-bár",
  garden: "Kert / sörkert",
  generic: "Vendéglátóhely",
};

export type IconSource = "override" | "name" | "tag" | "fallback";

export interface ResolvedPlaceIcon {
  id: PlaceIconId;
  label: string;
  source: IconSource;
  /** Ellenőrizendő hely, kézi beállítás nélkül – a felület jelzi („típus ellenőrizendő”). */
  uncertain: boolean;
}

/** Kézi felülírások helyazonosító szerint (data/place-icons.json). */
export type IconOverrides = Record<string, PlaceIconId>;

/**
 * Névbeli kulcsszavak a specifikustól az általános felé, ékezet- és kisbetű-függetlenül (brandKey után).
 * A magyar összetett szavak miatt („Bárszínház”, „Kultúrkávézó”) a hosszabb szavakat részletként is keressük,
 * a rövid angol szavakat (pub, club, tiki…) csak egész szóként.
 */
export const NAME_RULES: [PlaceIconId, RegExp][] = [
  ["music", /\blive music\b|\bmusic club\b|\bjazz\b|\bblues\b|elozene|zenes|koncert/],
  ["games", /\bdarts?\b|biliard|billiard|\bboard games?\b|tarsasjatek|\btarsas\b|\besport\b|bowling|csocso/],
  ["culture", /szinhaz|kultur|galeria|\bmozi\b/],
  ["cocktail", /\bcocktails?\b|koktel|\btiki\b/],
  ["craft", /\btap ?house\b|\btaproom\b|\bcraft\b|kezmuves|sorfozde|\bbrewery\b|\bbrewpub\b/],
  ["wine", /borozo|\bborbar\b|\bwine\b|\bvinoteka\b/],
  ["garden", /kert\b|\bgarden\b|\bbiergarten\b/],
  ["club", /\bclub\b|\bklub\b|\bdisco\b|\bdiszko\b/],
  ["pub", /sorozo|\bpub\b|kocsma|csapszek|presszo|\bsorbar\b/],
];

/** OSM `amenity` (vagy webes `kind`) → ikon. */
export const KIND_ICONS: Record<string, PlaceIconId> = {
  pub: "pub",
  bar: "bar",
  nightclub: "club",
  biergarten: "garden",
  brewery: "craft",
  restaurant: "restaurant",
  cafe: "cafe",
};

export const isPlaceIconId = (v: unknown): v is PlaceIconId => typeof v === "string" && (PLACE_ICON_IDS as string[]).includes(v);

/** Ikon a névből (ha van egyértelmű kulcsszó). */
export function iconFromName(name: string): PlaceIconId | undefined {
  const k = brandKey(name);
  for (const [id, re] of NAME_RULES) if (re.test(k)) return id;
  return undefined;
}

/** Minden helyre érvényes ikont ad. */
export function resolvePlaceIcon(place: Pick<Place, "id" | "name" | "info">, overrides: IconOverrides = {}): ResolvedPlaceIcon {
  const done = (id: PlaceIconId, source: IconSource): ResolvedPlaceIcon => ({
    id,
    label: PLACE_ICON_LABELS[id],
    source,
    uncertain: source !== "override" && (!!place.info?.checkNeeded || source === "fallback"),
  });
  const manual = place.info?.icon;
  if (isPlaceIconId(manual)) return done(manual, "override");
  const curated = overrides[place.id];
  if (isPlaceIconId(curated)) return done(curated, "override");
  const byName = iconFromName(place.name);
  if (byName) return done(byName, "name");
  const kind = place.info?.kind?.toLowerCase();
  if (kind && KIND_ICONS[kind]) return done(KIND_ICONS[kind], "tag");
  return done("generic", "fallback");
}

/** A data/place-icons.json beolvasása: ismeretlen ikonazonosítókat és megjegyzés-kulcsokat eldob. */
export function parseIconOverrides(raw: unknown): IconOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: IconOverrides = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) if (!id.startsWith("_") && isPlaceIconId(v)) out[id] = v;
  return out;
}
