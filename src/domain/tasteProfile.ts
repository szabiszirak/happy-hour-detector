// Ízlésprofil (v2): kategóriák + kategórián belüli preferenciák (márka / alfajta).
// Tiszta függvények – lásd tasteProfile.test.ts.
import type {
  CocktailType,
  Drink,
  DrinkCategory,
  DrinkSubtype,
  LegacyTasteProfile,
  Place,
  SoftType,
  SpiritType,
  TastePrefs,
  TasteProfile,
  WineStyle,
} from "./types";
import { brandKey, canonicalBrand, CATEGORY_LABELS, CATEGORY_OF, CATEGORY_ORDER, compareHu, KNOWN_BRANDS } from "./drinkCatalog";

/** A nem-sör kategóriák alfajtái, megjelenítési sorrendben. */
export const SUBTYPE_OPTIONS = {
  wine: [
    { value: "dry_white", label: "Száraz fehér" },
    { value: "semi_sweet", label: "Félédes" },
    { value: "sweet", label: "Édes" },
    { value: "rose", label: "Rosé" },
    { value: "red", label: "Vörös" },
  ] as { value: WineStyle; label: string }[],
  spirits: [
    { value: "palinka", label: "Pálinka" },
    { value: "whiskey", label: "Whiskey / bourbon" },
    { value: "gin", label: "Gin" },
    { value: "rum", label: "Rum" },
    { value: "tequila", label: "Tequila" },
    { value: "vodka", label: "Vodka" },
    { value: "liqueur", label: "Likőr / keserű" },
  ] as { value: SpiritType; label: string }[],
  cocktail: [
    { value: "gin_tonic", label: "Gin-tonik" },
    { value: "spritz", label: "Spritz / aperitif" },
    { value: "mojito", label: "Mojito / rumos" },
    { value: "classic", label: "Klasszikus koktél" },
    { value: "longdrink", label: "Long drink" },
  ] as { value: CocktailType; label: string }[],
  soft: [
    { value: "na_beer", label: "Alkoholmentes sör / ital" },
    { value: "tonic_soda", label: "Tonik / üdítő" },
    { value: "lemonade", label: "Limonádé / szóda" },
  ] as { value: SoftType; label: string }[],
};

export type SubtypeCategory = keyof typeof SUBTYPE_OPTIONS;

export const SUBTYPE_LABELS: Record<DrinkSubtype, string> = Object.fromEntries(
  Object.values(SUBTYPE_OPTIONS).flatMap((opts) => opts.map((o) => [o.value, o.label])),
) as Record<DrinkSubtype, string>;

/** Melyik alfajta melyik kategóriához tartozik. */
export const SUBTYPE_CATEGORY: Record<DrinkSubtype, SubtypeCategory> = Object.fromEntries(
  (Object.keys(SUBTYPE_OPTIONS) as SubtypeCategory[]).flatMap((c) => SUBTYPE_OPTIONS[c].map((o) => [o.value, c])),
) as Record<DrinkSubtype, SubtypeCategory>;

/** A kedvenc sörmárka-választó listája: a szótár sörmárkái magyar ABC-sorrendben. */
export const beerBrandOptions = (): string[] => [...KNOWN_BRANDS.beer].sort(compareHu);

// ---------- alfajta felismerése az ital nevéből / márkájából ----------

const RULES: Record<SubtypeCategory, [RegExp, DrinkSubtype][]> = {
  wine: [
    [/ros[eé]/, "rose"],
    [/f[eé]l[eé]des/, "semi_sweet"],
    [/(^|\s)[eé]des|tokaji|asz[uú]/, "sweet"],
    [/v[oö]r[oö]s|k[eé]kfrankos|cabernet|merlot|pinot noir|bikav[eé]r|kadarka|syrah|zweigelt/, "red"],
    [/sz[aá]raz|olaszrizling|rizling|riesling|chardonnay|sauvignon|furmint|irsai|feh[eé]r/, "dry_white"],
  ],
  spirits: [
    [/p[aá]link|szilva|barack|k[oö]rte|t[oö]rk[oö]ly|birs/, "palinka"],
    [/whisk|bourbon|scotch|jameson|jack daniel/, "whiskey"],
    [/(^|\s)gin(\s|$)|beefeater|gordon|bombay|hendrick/, "gin"],
    [/(^|\s)rum(\s|$)|bacardi|captain morgan|havana/, "rum"],
    [/tequila|mezcal|olmeca/, "tequila"],
    [/vodka|vodka|absolut|finlandia|smirnoff/, "vodka"],
    [/unicum|j[aä]ger|lik[oő]r|keser[uű]|amaro|fernet|baileys|zwack/, "liqueur"],
  ],
  cocktail: [
    [/gin[\s-]*ton(ik|ic)|g\s*&\s*t/, "gin_tonic"],
    [/spritz|aperol|campari|hugo|aperit/, "spritz"],
    [/mojito|cuba libre|daiquiri|pi[nñ]a colada|(^|\s)rum/, "mojito"],
    [/margarita|negroni|old fashioned|martini|cosmopolitan|manhattan|koktél|cocktail/, "classic"],
    [/long\s*drink|cola|k[oó]la|sz[oó]d|narancs|whisk/, "longdrink"],
  ],
  soft: [
    [/0[,.]0|alkoholmentes|0\s*%|alcohol free|zero/, "na_beer"],
    [/ton(ik|ic)|cola|k[oó]la|pepsi|sprite|fanta|schweppes|kinley|[uü]d[ií]t[oő]|red bull|energia/, "tonic_soda"],
    [/limon[aá]d|sz[oó]da|(^|\s)v[ií]z|szentkir[aá]lyi|theodora/, "lemonade"],
  ],
};

/** Az ital alfajtája: a megadott `subtype`, különben a névből/márkából kikövetkeztetve (vagy ismeretlen). */
export function inferSubtype(drink: Drink): DrinkSubtype | undefined {
  const cat = CATEGORY_OF[drink.style];
  if (cat === "beer") return undefined;
  if (drink.subtype && SUBTYPE_CATEGORY[drink.subtype] === cat) return drink.subtype;
  const text = `${drink.name} ${drink.brand ?? ""}`.toLocaleLowerCase("hu-HU");
  for (const [re, sub] of RULES[cat]) if (re.test(text)) return sub;
  return undefined;
}

// ---------- profil: létrehozás, migráció, leírás ----------

export const emptyPrefs = (): TastePrefs => ({});

/** v1 → v2 kategória-megfeleltetés. */
const LEGACY_MAP: Record<LegacyTasteProfile["categories"][number], DrinkCategory> = {
  lightbeer: "beer",
  craftbeer: "beer",
  wine: "wine",
  longdrink: "cocktail",
  shot: "spirits",
};

/**
 * Bármilyen tárolt profil → v2. A régi (v1) profilok nem vesznek el; ismeretlen
 * vagy hibás adatnál undefined (ilyenkor az app újra kérdez).
 */
export function migrateProfile(raw: unknown): TasteProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<TasteProfile> & Partial<LegacyTasteProfile> & { version?: number };
  const band = r.priceBand === "budget" || r.priceBand === "mid" || r.priceBand === "premium" ? r.priceBand : "mid";
  if (r.version === 2 && Array.isArray(r.categories)) {
    return {
      version: 2,
      categories: (r.categories as DrinkCategory[]).filter((c) => CATEGORY_ORDER.includes(c)),
      prefs: (r.prefs as TastePrefs) ?? {},
      priceBand: band,
      completedAt: r.completedAt ?? Date.now(),
    };
  }
  if (Array.isArray(r.categories)) {
    const cats = [
      ...new Set((r.categories as string[]).map((c) => LEGACY_MAP[c as keyof typeof LEGACY_MAP]).filter(Boolean)),
    ] as DrinkCategory[];
    return { version: 2, categories: CATEGORY_ORDER.filter((c) => cats.includes(c)), prefs: {}, priceBand: band, completedAt: r.completedAt ?? Date.now() };
  }
  return undefined;
}

/** Egy kategória kiválasztott preferenciái (szövegként), pl. ["Kozel", "Soproni"] vagy ["Rosé"]. */
export function prefLabels(prefs: TastePrefs, c: DrinkCategory): string[] {
  if (c === "beer") return prefs.beerBrands ?? [];
  return ((prefs[c] ?? []) as DrinkSubtype[]).map((v) => SUBTYPE_LABELS[v]);
}

/** Rövid leírás a menühöz: „Sör (Kozel, Soproni) · Bor (Rosé)”. */
export function describeProfile(p: TasteProfile): string {
  return p.categories
    .map((c) => {
      const l = prefLabels(p.prefs, c);
      return l.length ? `${CATEGORY_LABELS[c]} (${l.join(", ")})` : CATEGORY_LABELS[c];
    })
    .join(" · ");
}

/** Mentés előtti rendrakás: csak a kiválasztott kategóriák preferenciái maradnak, a márkák egységes írásmóddal. */
export function normalizePrefs(categories: DrinkCategory[], prefs: TastePrefs): TastePrefs {
  const out: TastePrefs = {};
  if (categories.includes("beer") && prefs.beerBrands?.length) {
    const seen = new Set<string>();
    out.beerBrands = prefs.beerBrands
      .map((b) => canonicalBrand(b))
      .filter((b) => brandKey(b) && !seen.has(brandKey(b)) && seen.add(brandKey(b)))
      .sort(compareHu);
  }
  for (const c of ["wine", "spirits", "cocktail", "soft"] as const)
    if (categories.includes(c) && prefs[c]?.length) (out as Record<string, unknown>)[c] = [...new Set(prefs[c] as string[])];
  return out;
}

// ---------- pontos preferencia illeszkedése egy helyhez ----------

/** A hely kínál-e a kategóriában a felhasználó kedvenc márkájából / alfajtájából. */
function categoryPrefHit(place: Place, c: DrinkCategory, prefs: TastePrefs): boolean | null {
  const drinks = place.drinks.filter((d) => CATEGORY_OF[d.style] === c);
  if (c === "beer") {
    const wanted = new Set((prefs.beerBrands ?? []).map(brandKey));
    if (!wanted.size) return null;
    return drinks.some((d) => d.brand && wanted.has(brandKey(d.brand)));
  }
  const wanted = (prefs[c] ?? []) as DrinkSubtype[];
  if (!wanted.length) return null;
  return drinks.some((d) => {
    const s = inferSubtype(d);
    return s !== undefined && wanted.includes(s);
  });
}

/**
 * Pontos preferencia-pontszám (0–1): a részletezett kategóriák hányadában van találat.
 * null, ha a felhasználó egyik kategóriához sem adott meg részletet.
 */
export function prefScore(place: Place, profile: TasteProfile): number | null {
  const hits = profile.categories.map((c) => categoryPrefHit(place, c, profile.prefs)).filter((h): h is boolean => h !== null);
  if (!hits.length) return null;
  return hits.filter(Boolean).length / hits.length;
}
