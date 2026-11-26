// Italkatalógus: kategóriák → stílusok → márkák.
// A „Piák & árak” szűrő erre épül. Tiszta függvények, UI nélkül – lásd drinkCatalog.test.ts.
import type { Drink, DrinkCategory, DrinkStyle, DrinkSubtype, Place } from "./types";
import { STYLE_LABELS } from "./types";
import { CATALOG_GROUPS, CATALOG_MIXES, GRAPE_VARIETIES, type CatalogBrand, type CatalogGroup, type CatalogMix } from "./catalogData";

export type { DrinkCategory };

export const CATEGORY_ORDER: DrinkCategory[] = ["beer", "spirits", "wine", "cocktail", "soft"];

export const CATEGORY_LABELS: Record<DrinkCategory, string> = {
  beer: "Sör",
  spirits: "Rövidital",
  wine: "Bor / Fröccs",
  cocktail: "Koktél / Long drink",
  soft: "Üdítő / Alkoholmentes",
};

export const CATEGORY_ICONS: Record<DrinkCategory, string> = {
  beer: "🍺",
  spirits: "🥃",
  wine: "🍷",
  cocktail: "🍸",
  soft: "🥤",
};

/** Melyik italstílus melyik kategóriába tartozik – minden stílus pontosan egybe. */
export const CATEGORY_OF: Record<DrinkStyle, DrinkCategory> = {
  pilsner: "beer",
  lager: "beer",
  ipa: "beer",
  wheat: "beer",
  dark: "beer",
  craft: "beer",
  cider: "beer",
  shot: "spirits",
  wine: "wine",
  spritzer: "wine",
  longdrink: "cocktail",
  nonalcoholic: "soft",
};

/** A kategórián belüli „opciók” (stílusok), megjelenítési sorrendben. */
export const STYLES_BY_CATEGORY: Record<DrinkCategory, DrinkStyle[]> = {
  beer: ["pilsner", "lager", "ipa", "wheat", "dark", "craft", "cider"],
  spirits: ["shot"],
  wine: ["wine", "spritzer"],
  cocktail: ["longdrink"],
  soft: ["nonalcoholic"],
};

/** Magyar ABC szerinti összehasonlítás (Kozel < Kőbányai, Édes < Eger). */
export const compareHu = (a: string, b: string) => a.localeCompare(b, "hu", { sensitivity: "base" });

/** Márkakulcs: kis-nagybetű, ékezet, írásjel és fölös szóköz nélkül („kőbányai” = „Kobanyai”). */
export function brandKey(name: string): string {
  return name
    .toLocaleLowerCase("hu-HU")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------- katalógus (catalogData.ts) ----------

/**
 * Ismert márkák kategóriánként, magyar ABC-ben – a katalógusból származtatva (a csoport `alsoIn`
 * kategóriáiban is, pl. a gin márkák a koktéloknál). Csak nevek, logó nélkül (védjegy).
 */
export const KNOWN_BRANDS: Record<DrinkCategory, string[]> = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [
    c,
    [...new Set(CATALOG_GROUPS.filter((g) => g.category === c || g.alsoIn?.includes(c)).flatMap((g) => g.brands.map((b) => b.name)))].sort(compareHu),
  ]),
) as Record<DrinkCategory, string[]>;

export interface CatalogHit {
  brand: CatalogBrand;
  group: CatalogGroup;
}

/** Név és minden álnév kulcsa → márka (a csoportjával). */
const BRAND_INDEX: Map<string, CatalogHit> = new Map(
  CATALOG_GROUPS.flatMap((group) =>
    group.brands.flatMap((brand) => [brand.name, ...(brand.aliases ?? [])].map((n) => [brandKey(n), { brand, group }] as const)),
  ),
);

const KNOWN_BY_KEY: Map<string, { label: string; category: DrinkCategory }> = new Map(
  [...BRAND_INDEX.entries()].map(([k, h]) => [k, { label: h.brand.name, category: h.group.category }]),
);

/** A márka egységes, szótár szerinti írásmódja (ha ismert), különben a megadott név rendbe téve. */
export function canonicalBrand(name: string): string {
  const k = brandKey(name);
  const known = KNOWN_BY_KEY.get(k)?.label;
  if (known) return known;
  const clean = name.trim().replace(/\s+/g, " ");
  // csupa kisbetűvel beírt saját márka → nagy kezdőbetűk; az egyedi írásmódot (pl. „MONYO”) nem bántjuk
  return clean === clean.toLocaleLowerCase("hu-HU")
    ? clean.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("hu-HU"))
    : clean;
}

/** Javaslatok a szerkesztő márka mezőjéhez: a kategória ismert márkái, ABC-sorrendben. */
export function brandSuggestions(category: DrinkCategory): string[] {
  return [...KNOWN_BRANDS[category]];
}

/** A kategória csoportjai (pl. Sör → Hazai nagyüzemi, Hazai kézműves, Cseh, …), katalógus-sorrendben. */
export function catalogGroups(category: DrinkCategory): CatalogGroup[] {
  return CATALOG_GROUPS.filter((g) => g.category === category);
}

/** Egy kategória (vagy csoport) márkái magyar ABC-ben. */
export function brandsIn(category: DrinkCategory, groupId?: string): CatalogBrand[] {
  return CATALOG_GROUPS.filter((g) => g.category === category && (!groupId || g.id === groupId))
    .flatMap((g) => g.brands)
    .sort((a, b) => compareHu(a.name, b.name));
}

/** Gyakori márkák a gyorsválasztóhoz (pl. ízlésprofil sörmárkái), ABC-ben. */
export function popularBrands(category: DrinkCategory): string[] {
  return brandsIn(category)
    .filter((b) => b.popular)
    .map((b) => b.name);
}

/** Márka keresése névvel vagy álnévvel („urquell”, „kobanyai”, „Jager”). */
export function findCatalogBrand(name: string): CatalogHit | undefined {
  return BRAND_INDEX.get(brandKey(name));
}

export interface CatalogSearchResult {
  name: string;
  kind: "brand" | "mix";
  category: DrinkCategory;
  group?: string;
  /** Az álnév, amelyre illett (ha nem a fő névre). */
  matchedAlias?: string;
}

/**
 * Keresés a katalógusban (márkák + kevert italok), ékezet- és kisbetű-függetlenül.
 * Sorrend: a fő név elejére illők, az álnév elejére illők, majd a belsejükben illők; azon belül magyar ABC.
 */
export function searchCatalog(query: string, opts: { category?: DrinkCategory; limit?: number } = {}): CatalogSearchResult[] {
  const q = brandKey(query);
  if (!q) return [];
  type Scored = CatalogSearchResult & { rank: number };
  const out = new Map<string, Scored>();
  const consider = (r: CatalogSearchResult, names: string[]) => {
    let best: { rank: number; alias?: string } | null = null;
    for (const [i, n] of names.entries()) {
      const k = brandKey(n);
      // fő név eleje (0) < álnév eleje (1) < fő név belseje (2) < álnév belseje (3)
      const hit = k.startsWith(q) || k.split(" ").some((w) => w.startsWith(q)) ? 0 : k.includes(q) ? 2 : -1;
      if (hit < 0) continue;
      const rank = hit + (i === 0 ? 0 : 1);
      if (!best || rank < best.rank) best = { rank, alias: i === 0 ? undefined : n };
    }
    if (!best) return;
    const key = `${r.kind}:${r.name}`;
    const prev = out.get(key);
    if (!prev || best.rank < prev.rank) out.set(key, { ...r, matchedAlias: best.alias, rank: best.rank });
  };
  for (const g of CATALOG_GROUPS) {
    if (opts.category && g.category !== opts.category && !g.alsoIn?.includes(opts.category)) continue;
    for (const b of g.brands) consider({ name: b.name, kind: "brand", category: g.category, group: g.label }, [b.name, ...(b.aliases ?? [])]);
  }
  for (const m of CATALOG_MIXES) {
    if (opts.category && m.category !== opts.category) continue;
    consider({ name: m.name, kind: "mix", category: m.category }, [m.name, ...(m.aliases ?? [])]);
  }
  const list = [...out.values()].sort((a, b) => a.rank - b.rank || compareHu(a.name, b.name));
  return list.slice(0, opts.limit ?? 20).map(({ rank: _r, matchedAlias, ...r }) => (matchedAlias ? { ...r, matchedAlias } : r));
}

/** Kevert ital (koktél / fröccs / shot) keresése névvel vagy álnévvel. */
export function findMix(name: string): CatalogMix | undefined {
  const k = brandKey(name);
  if (!k) return undefined;
  return CATALOG_MIXES.find((m) => [m.name, ...(m.aliases ?? [])].some((n) => brandKey(n) === k));
}

/** Fröccs mennyisége literben a bor/szóda arányból (pl. Nagyfröccs → 0,3 l). */
export function spritzerVolumeL(name: string): number | undefined {
  const m = findMix(name);
  if (!m || m.wineDl === undefined || m.sodaDl === undefined) return undefined;
  return Math.round((m.wineDl + m.sodaDl) * 10) / 100;
}

export interface CatalogHint {
  category: DrinkCategory;
  style?: DrinkStyle;
  subtype?: DrinkSubtype;
  /** A katalógus szerinti márkanév (ha a megadott név márka). */
  brand?: string;
  /** Javasolt kiszerelés literben (fröccsnél az arányból). */
  volumeL?: number;
}

/**
 * Tipp a szerkesztőnek egy ital nevéből (és opcionálisan márkájából):
 * kevert ital (Mojito, Nagyfröccs) → márka (Hoegaarden, Tanqueray) → szőlőfajta (Kékfrankos).
 * Csak besorolást ad, árat soha.
 */
export function catalogHint(name: string, brand?: string): CatalogHint | undefined {
  const mixHit = findMix(name);
  if (mixHit) {
    const vol = spritzerVolumeL(mixHit.name);
    return { category: mixHit.category, style: mixHit.style, subtype: mixHit.subtype, ...(vol ? { volumeL: vol } : {}) };
  }
  const tryBrand = (n: string): CatalogHint | undefined => {
    const hit = findCatalogBrand(n);
    if (!hit) return undefined;
    const style = hit.brand.styles?.[0] ?? hit.group.style;
    const subtype = hit.brand.subtype ?? hit.group.subtype;
    return { category: hit.group.category, brand: hit.brand.name, ...(style ? { style } : {}), ...(subtype ? { subtype } : {}) };
  };
  const byBrand = (brand && tryBrand(brand)) || tryBrand(name);
  if (byBrand) return byBrand;
  // márka a név elején („Kozel Premium 0,5”, „Jameson 4 cl”)
  const words = name.trim().split(/\s+/);
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    const h = tryBrand(words.slice(0, n).join(" "));
    if (h) return h;
  }
  const grape = GRAPE_VARIETIES.find((g) => [g.name, ...(g.aliases ?? [])].some((n) => brandKey(name).includes(brandKey(n))));
  if (grape) return { category: "wine", style: "wine", subtype: grape.subtype };
  return undefined;
}

/** Megjeleníthető-e a márka valódi logója: csak érvényes, írásos engedéllyel (különben monogram). */
export function logoAllowed(brand: CatalogBrand, now: number): boolean {
  const l = brand.logo;
  return !!l && !!l.licensor.trim() && !!l.scope.trim() && l.grantedAt <= now && (l.expiresAt === undefined || now < l.expiresAt);
}

/** A katalógus belső ellenőrzése: ABC-sorrend, egyedi nevek/álnevek. Üres lista = rendben. */
export function validateCatalog(): string[] {
  const problems: string[] = [];
  const owner = new Map<string, string>();
  for (const g of CATALOG_GROUPS) {
    const names = g.brands.map((b) => b.name);
    const sorted = [...names].sort(compareHu);
    if (names.join("|") !== sorted.join("|")) problems.push(`${g.id}: nem ABC-sorrendű`);
    for (const b of g.brands)
      for (const n of [b.name, ...(b.aliases ?? [])]) {
        const k = brandKey(n);
        const prev = owner.get(k);
        if (prev && prev !== b.name) problems.push(`ütközés: „${n}” (${prev} / ${b.name})`);
        owner.set(k, b.name);
      }
  }
  const mixNames = CATALOG_MIXES.map((m) => m.name);
  if (mixNames.join("|") !== [...mixNames].sort(compareHu).join("|")) problems.push("keverékek: nem ABC-sorrendű");
  for (const m of CATALOG_MIXES)
    for (const n of [m.name, ...(m.aliases ?? [])]) {
      const k = brandKey(n);
      const prev = owner.get(k);
      if (prev && prev !== m.name) problems.push(`ütközés: „${n}” (${prev} / ${m.name})`);
      owner.set(k, m.name);
    }
  return problems;
}

/** A katalógus JSON-formában (data/drink-catalog.json – npm run catalog:export). */
export function exportCatalog() {
  return {
    note: "Generált fájl – a forrás: src/domain/catalogData.ts. Csak nevek és besorolás; logó, ár, happy hour nincs benne.",
    categories: CATEGORY_ORDER.map((c) => ({
      id: c,
      label: CATEGORY_LABELS[c],
      styles: STYLES_BY_CATEGORY[c].map((s) => ({ id: s, label: STYLE_LABELS[s] })),
      groups: catalogGroups(c).map((g) => ({
        id: g.id,
        label: g.label,
        ...(g.style ? { style: g.style } : {}),
        ...(g.subtype ? { subtype: g.subtype } : {}),
        ...(g.alsoIn ? { alsoIn: g.alsoIn } : {}),
        brands: g.brands.map(({ logo: _l, ...b }) => b),
      })),
      mixes: CATALOG_MIXES.filter((m) => m.category === c),
    })),
    grapes: GRAPE_VARIETIES,
  };
}

// ---------- márkajelvény (saját monogram, nem logó) ----------

/** A palettából választott jelvényszínek; a márka neve alapján mindig ugyanaz jön. */
export const BADGE_COLORS = ["#2EF2B3", "#FF5C8A", "#5AB0FF", "#FFC53D", "#B69CFF", "#A3E635", "#FF8A4C", "#7EE8FA"];

export interface BrandBadge {
  initials: string;
  color: string;
  /** A jelvényen lévő betűk színe (a háttérhez választva, olvashatóan). */
  textColor: string;
}

export function brandBadge(label: string): BrandBadge {
  const words = label
    .replace(/['’]/g, "")
    .split(/[\s\-/&.]+/)
    .filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toLocaleUpperCase("hu-HU")
      : (words[0] ?? "?").slice(0, 2).replace(/^./, (c) => c.toLocaleUpperCase("hu-HU"));
  let h = 0;
  for (const ch of brandKey(label)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = BADGE_COLORS[h % BADGE_COLORS.length];
  // a „Carbon Mint” jelvényszínek mind világos LED-tónusok: rajtuk sötét betű olvasható
  const textColor = "#0A0C0D";
  return { initials, color, textColor };
}

// ---------- katalógus a szűrőhöz ----------

/** A „márka nélküli” italok csoportjának kulcsa a szűrőben. */
export const OTHER_BRAND = "__other";

export interface BrandEntry {
  key: string;
  label: string;
  /** Hány ital-ajánlat tartozik hozzá (0 = még nincs ár). */
  count: number;
  /** A márkaszótárban szerepel-e. */
  known: boolean;
  badge: BrandBadge;
}

export interface CategoryNode {
  category: DrinkCategory;
  label: string;
  icon: string;
  count: number;
  styles: { style: DrinkStyle; label: string; count: number }[];
  /** ABC-sorrendben; a szótárbeli márkák akkor is, ha még nincs hozzájuk ár. */
  brands: BrandEntry[];
  /** Márka nélküli italok száma („Egyéb”). */
  otherCount: number;
}

const drinksOf = (places: Place[]): Drink[] => places.flatMap((p) => p.drinks);

/** A teljes kategória-fa a helyek itallapjaiból + a márkaszótárból. Üres adatnál is hibátlan. */
export function buildCatalog(places: Place[]): CategoryNode[] {
  const drinks = drinksOf(places);
  return CATEGORY_ORDER.map((category) => {
    const inCat = drinks.filter((d) => CATEGORY_OF[d.style] === category);
    const brands = new Map<string, BrandEntry>();
    for (const label of KNOWN_BRANDS[category])
      brands.set(brandKey(label), { key: brandKey(label), label, count: 0, known: true, badge: brandBadge(label) });
    let otherCount = 0;
    for (const d of inCat) {
      if (!d.brand || !brandKey(d.brand)) {
        otherCount++;
        continue;
      }
      const key = brandKey(d.brand);
      const entry = brands.get(key);
      if (entry) entry.count++;
      else {
        const label = canonicalBrand(d.brand);
        brands.set(key, { key, label, count: 1, known: KNOWN_BY_KEY.has(key), badge: brandBadge(label) });
      }
    }
    return {
      category,
      label: CATEGORY_LABELS[category],
      icon: CATEGORY_ICONS[category],
      count: inCat.length,
      styles: STYLES_BY_CATEGORY[category].map((style) => ({
        style,
        label: STYLE_LABELS[style],
        count: inCat.filter((d) => d.style === style).length,
      })),
      brands: [...brands.values()].sort((a, b) => compareHu(a.label, b.label)),
      otherCount,
    };
  });
}

/** Egy ital megfelel-e a kategória / stílus / márka választásnak. */
export function matchesSelection(
  drink: Drink,
  sel: { category: DrinkCategory | null; styles: DrinkStyle[]; brand: string | null },
): boolean {
  if (sel.category && CATEGORY_OF[drink.style] !== sel.category) return false;
  if (sel.styles.length && !sel.styles.includes(drink.style)) return false;
  if (sel.brand) {
    const k = drink.brand ? brandKey(drink.brand) : "";
    if (sel.brand === OTHER_BRAND ? k !== "" : k !== sel.brand) return false;
  }
  return true;
}

/**
 * A szűrő márkalistájának bontása: felül a ténylegesen árazott márkák (és a kiválasztott),
 * alul – összecsukva – a még ár nélküli ismert márkák, a keresőszóra szűrve (ékezet-függetlenül).
 */
export function splitBrandList(
  brands: BrandEntry[],
  selectedKey: string | null,
  query = "",
): { shown: BrandEntry[]; more: BrandEntry[]; moreTotal: number } {
  const q = brandKey(query);
  const shown = brands.filter((b) => b.count > 0 || b.key === selectedKey);
  const rest = brands.filter((b) => !(b.count > 0 || b.key === selectedKey));
  const more = q ? rest.filter((b) => b.key.includes(q) || b.key.split(" ").some((w) => w.startsWith(q))) : rest;
  return { shown, more, moreTotal: rest.length };
}

/**
 * Mit változtatna a katalógus-tipp az italon (csak besorolás: stílus, alfajta, márka, fröccsnél mennyiség).
 * `null`, ha nincs mit módosítani. Árat soha nem érint.
 */
export function hintPatch(drink: Drink, hint: CatalogHint | undefined): Partial<Pick<Drink, "style" | "subtype" | "brand" | "volumeL">> | null {
  if (!hint) return null;
  const patch: Partial<Pick<Drink, "style" | "subtype" | "brand" | "volumeL">> = {};
  const style = hint.style ?? (CATEGORY_OF[drink.style] === hint.category ? drink.style : STYLES_BY_CATEGORY[hint.category][0]);
  if (style !== drink.style) patch.style = style;
  if (hint.subtype && hint.category !== "beer" && hint.subtype !== drink.subtype) patch.subtype = hint.subtype;
  if (!hint.subtype && patch.style && CATEGORY_OF[patch.style] !== CATEGORY_OF[drink.style] && drink.subtype) patch.subtype = undefined;
  if (hint.brand && brandKey(drink.brand ?? "") !== brandKey(hint.brand)) patch.brand = hint.brand;
  if (hint.volumeL !== undefined && Math.abs(hint.volumeL - drink.volumeL) > 0.001) patch.volumeL = hint.volumeL;
  return Object.keys(patch).length ? patch : null;
}
