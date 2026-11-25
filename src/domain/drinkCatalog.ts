// Italkatalógus: kategóriák → stílusok → márkák.
// A „Piák & árak” szűrő erre épül. Tiszta függvények, UI nélkül – lásd drinkCatalog.test.ts.
import type { Drink, DrinkStyle, Place } from "./types";
import { STYLE_LABELS } from "./types";

export type DrinkCategory = "beer" | "spirits" | "wine" | "cocktail" | "soft";

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
  shot: "spirits",
  wine: "wine",
  spritzer: "wine",
  longdrink: "cocktail",
  nonalcoholic: "soft",
};

/** A kategórián belüli „opciók” (stílusok), megjelenítési sorrendben. */
export const STYLES_BY_CATEGORY: Record<DrinkCategory, DrinkStyle[]> = {
  beer: ["pilsner", "lager", "ipa", "wheat", "dark", "craft"],
  spirits: ["shot"],
  wine: ["wine", "spritzer"],
  cocktail: ["longdrink"],
  soft: ["nonalcoholic"],
};

/**
 * Ismert márkák kategóriánként (márkaszótár, ötlettár J5). Csak nevek – logót nem tárolunk
 * (védjegy); a felületen saját monogram-jelvény jelenik meg helyettük.
 */
export const KNOWN_BRANDS: Record<DrinkCategory, string[]> = {
  beer: [
    "Arany Ászok", "Borsodi", "Dreher", "Edelweiss", "Guinness", "Heineken", "Hoegaarden", "Kozel", "Kőbányai",
    "Paulaner", "Pilsner Urquell", "Soproni", "Staropramen", "Stella Artois",
  ],
  spirits: ["Absolut", "Bacardi", "Captain Morgan", "Finlandia", "Jack Daniel's", "Jägermeister", "Jameson", "Olmeca", "Unicum"],
  wine: ["Törley"],
  cocktail: ["Aperol", "Beefeater", "Bombay Sapphire", "Campari", "Gordon's", "Martini"],
  soft: ["Coca-Cola", "Kinley", "Pepsi", "Red Bull", "Schweppes", "Szentkirályi", "Theodora"],
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

const KNOWN_BY_KEY: Map<string, { label: string; category: DrinkCategory }> = new Map(
  CATEGORY_ORDER.flatMap((c) => KNOWN_BRANDS[c].map((label) => [brandKey(label), { label, category: c }] as const)),
);

/** A márka egységes, szótár szerinti írásmódja (ha ismert), különben a megadott név rendbe téve. */
export function canonicalBrand(name: string): string {
  const k = brandKey(name);
  return KNOWN_BY_KEY.get(k)?.label ?? name.trim().replace(/\s+/g, " ");
}

/** Javaslatok a szerkesztő márka mezőjéhez: a kategória ismert márkái, ABC-sorrendben. */
export function brandSuggestions(category: DrinkCategory): string[] {
  return [...KNOWN_BRANDS[category]].sort(compareHu);
}

// ---------- márkajelvény (saját monogram, nem logó) ----------

/** A palettából választott jelvényszínek; a márka neve alapján mindig ugyanaz jön. */
export const BADGE_COLORS = ["#7C3AED", "#FB7185", "#2DD4BF", "#60A5FA", "#F59E0B", "#E879F9", "#A3E635", "#818CF8"];

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
  // a sötét lila és indigó háttéren fehér, a világos színeken sötét betű olvasható
  const textColor = color === "#7C3AED" || color === "#818CF8" ? "#FFFFFF" : "#0B0D17";
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
