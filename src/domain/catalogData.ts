// Budapesti italkatalógus – az egyetlen forrás (a data/drink-catalog.json ebből generálódik: npm run catalog:export).
// Csak nevek, fajták és besorolás. Árat, happy hourt vagy szponzorációt NEM tartalmaz, és logót sem:
// a felület saját monogram-jelvényt mutat (lásd drinkCatalog.ts brandBadge). Valódi logó csak írásos
// engedéllyel kerülhet a `logo` mezőbe (LicensedLogo) – jelenleg egyik márkánál sincs.
// A csoportokon belül a márkák magyar ABC szerint (compareHu) rendezettek – ezt teszt ellenőrzi.
import type { CocktailType, DrinkCategory, DrinkStyle, DrinkSubtype, SpiritType } from "./types";

export type Origin = "hu" | "import";

/** Partner által, írásos engedéllyel átadott logó. Engedély nélkül nem tölthető ki. */
export interface LicensedLogo {
  /** Saját tárhelyen (Firebase Storage) lévő fájl címe – külső képre nem linkelünk. */
  url: string;
  storagePath?: string;
  /** A jogosult (márkatulajdonos / forgalmazó) neve. */
  licensor: string;
  /** Az engedély kelte és (ha van) lejárata, epoch ms. */
  grantedAt: number;
  expiresAt?: number;
  /** Mire szól az engedély (pl. „app – márkalista és itallap”). */
  scope: string;
}

export interface CatalogBrand {
  name: string;
  aliases?: string[];
  origin: Origin;
  /** ISO országkód (import márkáknál). */
  country?: string;
  tier?: "mass" | "craft";
  /** Tipikus stílus (pl. Hoegaarden → búza). */
  styles?: DrinkStyle[];
  /** Tipikus alfajta (pl. Beefeater → gin). */
  subtype?: DrinkSubtype;
  /** Gyakori a budapesti kocsmákban → kiemelt gyorsválasztó. */
  popular?: boolean;
  /** Hivatalos oldal – csak ellenőrzés után tölthető ki. */
  officialUrl?: string;
  logo?: LicensedLogo;
}

export interface CatalogGroup {
  id: string;
  label: string;
  category: DrinkCategory;
  style?: DrinkStyle;
  subtype?: DrinkSubtype;
  /** Ezekben a kategóriákban is javasoljuk (pl. gin → koktél). */
  alsoIn?: DrinkCategory[];
  brands: CatalogBrand[];
}

/** Kevert italok: koktélok, long drinkek, shotok és fröccsök. */
export interface CatalogMix {
  name: string;
  aliases?: string[];
  category: DrinkCategory;
  style: DrinkStyle;
  subtype?: DrinkSubtype;
  base?: SpiritType[];
  popular?: boolean;
  /** Fröccsnél: bor és szóda deciliterben. */
  wineDl?: number;
  sodaDl?: number;
}

const hu = (name: string, extra: Partial<CatalogBrand> = {}): CatalogBrand => ({ name, origin: "hu", ...extra });
const im = (name: string, country: string, extra: Partial<CatalogBrand> = {}): CatalogBrand => ({ name, origin: "import", country, ...extra });
const P = { popular: true } as const;

export const CATALOG_GROUPS: CatalogGroup[] = [
  // ---------------- SÖR ----------------
  {
    id: "beer-hu-mass",
    label: "Hazai nagyüzemi",
    category: "beer",
    style: "lager",
    brands: [
      hu("Arany Ászok", { tier: "mass", ...P }),
      hu("Borsodi", { tier: "mass", ...P }),
      hu("Dreher", { tier: "mass", ...P }),
      hu("Kőbányai", { tier: "mass", ...P }),
      hu("Pécsi Szalon", { tier: "mass", aliases: ["Pécsi", "Szalon"], ...P }),
      hu("Soproni", { tier: "mass", ...P }),
    ],
  },
  {
    id: "beer-hu-craft",
    label: "Hazai kézműves",
    category: "beer",
    style: "craft",
    brands: [
      hu("Bors Sörmanufaktúra", { tier: "craft", aliases: ["Bors"] }),
      hu("Brew Your Mind", { tier: "craft", aliases: ["BYM"] }),
      hu("Dorozsmai", { tier: "craft" }),
      hu("Etyeki Sörmanufaktúra", { tier: "craft", aliases: ["Etyeki"] }),
      hu("Fehér Nyúl", { tier: "craft", ...P }),
      hu("Fóti Kézműves Sörfőzde", { tier: "craft", aliases: ["Fóti"] }),
      hu("Hedon", { tier: "craft" }),
      hu("Hopfanatic", { tier: "craft" }),
      hu("Horizont", { tier: "craft", ...P }),
      hu("Hübris", { tier: "craft" }),
      hu("Kalapos", { tier: "craft" }),
      hu("Kanyar", { tier: "craft" }),
      hu("Legenda", { tier: "craft" }),
      hu("Mad Scientist", { tier: "craft", ...P }),
      hu("MONYO", { tier: "craft", ...P }),
      hu("Reketye", { tier: "craft" }),
      hu("Rothbeer", { tier: "craft" }),
      hu("Szent András", { tier: "craft", ...P }),
      hu("Ugar", { tier: "craft" }),
      hu("Zip's", { tier: "craft", aliases: ["Zips"] }),
    ],
  },
  {
    id: "beer-cz",
    label: "Cseh",
    category: "beer",
    style: "pilsner",
    brands: [
      im("Bernard", "CZ"),
      im("Budweiser Budvar", "CZ", { aliases: ["Budvar", "Budějovický Budvar"] }),
      im("Gambrinus", "CZ"),
      im("Kozel", "CZ", { aliases: ["Velkopopovický Kozel"], ...P }),
      im("Krušovice", "CZ"),
      im("Pilsner Urquell", "CZ", { aliases: ["Urquell", "Plzeň"], ...P }),
      im("Radegast", "CZ"),
      im("Staropramen", "CZ", P),
    ],
  },
  {
    id: "beer-de-at",
    label: "Német / osztrák",
    category: "beer",
    style: "lager",
    brands: [
      im("Augustiner", "DE"),
      im("Beck's", "DE", { aliases: ["Becks"] }),
      im("Edelweiss", "AT", { styles: ["wheat"] }),
      im("Erdinger", "DE", { styles: ["wheat"] }),
      im("Franziskaner", "DE", { styles: ["wheat"] }),
      im("Gösser", "AT"),
      im("Hacker-Pschorr", "DE"),
      im("Krombacher", "DE", { styles: ["pilsner"] }),
      im("Löwenbräu", "DE"),
      im("Paulaner", "DE", { styles: ["wheat"], ...P }),
      im("Schöfferhofer", "DE", { styles: ["wheat"] }),
      im("Spaten", "DE"),
      im("Warsteiner", "DE", { styles: ["pilsner"] }),
      im("Weihenstephaner", "DE", { styles: ["wheat"] }),
      im("Zipfer", "AT"),
    ],
  },
  {
    id: "beer-be",
    label: "Belga",
    category: "beer",
    style: "craft",
    brands: [
      im("Chimay", "BE"),
      im("Delirium", "BE", { aliases: ["Delirium Tremens"] }),
      im("Duvel", "BE"),
      im("Grimbergen", "BE"),
      im("Hoegaarden", "BE", { styles: ["wheat"], ...P }),
      im("Kwak", "BE", { aliases: ["Pauwel Kwak"] }),
      im("Leffe", "BE", P),
      im("Lindemans", "BE"),
      im("Stella Artois", "BE", { styles: ["lager"] }),
    ],
  },
  {
    id: "beer-ie-uk",
    label: "Ír / brit",
    category: "beer",
    style: "dark",
    brands: [
      im("BrewDog", "GB", { styles: ["ipa"] }),
      im("Guinness", "IE", P),
      im("Kilkenny", "IE"),
      im("Murphy's", "IE"),
      im("Newcastle Brown Ale", "GB", { aliases: ["Newcastle"] }),
    ],
  },
  {
    id: "beer-eu",
    label: "Egyéb európai",
    category: "beer",
    style: "lager",
    brands: [
      im("Amstel", "NL"),
      im("Birra Moretti", "IT", { aliases: ["Moretti"] }),
      im("Carlsberg", "DK"),
      im("Efes", "TR"),
      im("Grolsch", "NL"),
      im("Heineken", "NL", P),
      im("Kronenbourg", "FR", { aliases: ["1664", "Kronenbourg 1664"] }),
      im("Lech", "PL"),
      im("Peroni", "IT"),
      im("Tuborg", "DK"),
      im("Tyskie", "PL"),
      im("Żywiec", "PL", { aliases: ["Zywiec"] }),
    ],
  },
  {
    id: "beer-asia",
    label: "Ázsiai",
    category: "beer",
    style: "lager",
    brands: [
      im("Asahi", "JP"),
      im("Chang", "TH"),
      im("Kirin", "JP"),
      im("Sapporo", "JP"),
      im("Singha", "TH"),
      im("Tiger", "SG"),
      im("Tsingtao", "CN"),
    ],
  },
  {
    id: "beer-americas",
    label: "Amerikai / mexikói",
    category: "beer",
    style: "lager",
    brands: [
      im("Brooklyn", "US", { styles: ["craft"] }),
      im("Corona", "MX", { aliases: ["Corona Extra"], ...P }),
      im("Desperados", "NL"),
      im("Samuel Adams", "US", { styles: ["craft"] }),
      im("Sierra Nevada", "US", { styles: ["ipa"] }),
      im("Sol", "MX"),
    ],
  },
  {
    id: "beer-cider",
    label: "Cider",
    category: "beer",
    style: "cider",
    brands: [
      im("Kopparberg", "SE"),
      im("Magners", "IE"),
      im("Rekorderlig", "SE"),
      im("Somersby", "DK", P),
      im("Strongbow", "GB"),
    ],
  },

  // ---------------- BOR / FRÖCCS ----------------
  {
    id: "wine-producers",
    label: "Pincészetek és pezsgőházak",
    category: "wine",
    style: "wine",
    brands: [
      hu("BB", { aliases: ["Balatonboglári", "Balatonboglári Borgazdaság"] }),
      hu("Bock"),
      hu("Etyeki Kúria"),
      hu("Frittmann"),
      hu("Gál Tibor"),
      hu("Garamvári", { subtype: "sparkling" }),
      hu("Gere Attila", { aliases: ["Gere"] }),
      hu("Hilltop", { aliases: ["Hilltop Neszmély"] }),
      hu("Hungaria", { subtype: "sparkling", aliases: ["Hungária"] }),
      hu("Konyári"),
      hu("Kreinbacher", { subtype: "sparkling" }),
      hu("Laposa"),
      hu("St. Andrea", { aliases: ["St Andrea"] }),
      hu("Takler"),
      hu("Thummerer"),
      hu("Törley", { subtype: "sparkling", ...P }),
      hu("Varga", P),
    ],
  },

  // ---------------- RÖVIDITAL ----------------
  {
    id: "spirits-palinka",
    label: "Pálinka",
    category: "spirits",
    style: "shot",
    subtype: "palinka",
    brands: [
      hu("Agárdi", P),
      hu("Bolyhos"),
      hu("Brill"),
      hu("Gönci"),
      hu("Panyolai"),
      hu("Prekop"),
      hu("Rézangyal"),
      hu("Szicsek"),
      hu("Zwack", { aliases: ["Zwack Kecskeméti", "Kecskeméti"], ...P }),
    ],
  },
  {
    id: "spirits-whisky-scotch",
    label: "Whisky – skót",
    category: "spirits",
    style: "shot",
    subtype: "whiskey",
    alsoIn: ["cocktail"],
    brands: [
      im("Ballantine's", "GB", { aliases: ["Ballantines"], ...P }),
      im("Chivas Regal", "GB", { aliases: ["Chivas"] }),
      im("Dewar's", "GB"),
      im("Famous Grouse", "GB"),
      im("Glenfiddich", "GB"),
      im("Grant's", "GB"),
      im("Johnnie Walker", "GB", P),
      im("Laphroaig", "GB"),
      im("Monkey Shoulder", "GB"),
      im("Talisker", "GB"),
    ],
  },
  {
    id: "spirits-whiskey-irish",
    label: "Whiskey – ír",
    category: "spirits",
    style: "shot",
    subtype: "whiskey",
    alsoIn: ["cocktail"],
    brands: [im("Bushmills", "IE"), im("Jameson", "IE", P), im("Tullamore D.E.W.", "IE", { aliases: ["Tullamore Dew", "Tullamore"] })],
  },
  {
    id: "spirits-bourbon",
    label: "Bourbon / amerikai whiskey",
    category: "spirits",
    style: "shot",
    subtype: "whiskey",
    alsoIn: ["cocktail"],
    brands: [
      im("Bulleit", "US"),
      im("Four Roses", "US"),
      im("Jack Daniel's", "US", { aliases: ["Jack Daniels", "JD"], ...P }),
      im("Jim Beam", "US", P),
      im("Maker's Mark", "US"),
      im("Wild Turkey", "US"),
      im("Woodford Reserve", "US"),
    ],
  },
  {
    id: "spirits-gin",
    label: "Gin",
    category: "spirits",
    style: "shot",
    subtype: "gin",
    alsoIn: ["cocktail"],
    brands: [
      im("Beefeater", "GB", P),
      im("Bombay Sapphire", "GB", { aliases: ["Bombay"], ...P }),
      im("Bulldog", "GB"),
      im("Gordon's", "GB", { aliases: ["Gordons"], ...P }),
      im("Hendrick's", "GB", { aliases: ["Hendricks"] }),
      im("Malfy", "IT"),
      im("Monkey 47", "DE"),
      im("Roku", "JP"),
      im("Tanqueray", "GB"),
    ],
  },
  {
    id: "spirits-rum",
    label: "Rum",
    category: "spirits",
    style: "shot",
    subtype: "rum",
    alsoIn: ["cocktail"],
    brands: [
      im("Bacardi", "PR", P),
      im("Captain Morgan", "JM", P),
      im("Diplomático", "VE", { aliases: ["Diplomatico"] }),
      im("Don Papa", "PH"),
      im("Havana Club", "CU", P),
      im("Kraken", "TT"),
      im("Plantation", "BB"),
      im("Zacapa", "GT", { aliases: ["Ron Zacapa"] }),
    ],
  },
  {
    id: "spirits-tequila",
    label: "Tequila / mezcal",
    category: "spirits",
    style: "shot",
    subtype: "tequila",
    alsoIn: ["cocktail"],
    brands: [
      im("Del Maguey", "MX"),
      im("Don Julio", "MX"),
      im("El Jimador", "MX"),
      im("Espolòn", "MX", { aliases: ["Espolon"] }),
      im("Jose Cuervo", "MX", { aliases: ["Cuervo"] }),
      im("Olmeca", "MX", P),
      im("Patrón", "MX", { aliases: ["Patron"] }),
      im("Sierra", "MX", P),
    ],
  },
  {
    id: "spirits-vodka",
    label: "Vodka",
    category: "spirits",
    style: "shot",
    subtype: "vodka",
    alsoIn: ["cocktail"],
    brands: [
      im("Absolut", "SE", P),
      im("Belvedere", "PL"),
      im("Finlandia", "FI", P),
      im("Grey Goose", "FR"),
      im("Russian Standard", "RU"),
      im("Smirnoff", "GB", P),
      im("Stolichnaya", "LV", { aliases: ["Stoli"] }),
      im("Wyborowa", "PL"),
      im("Żubrówka", "PL", { aliases: ["Zubrowka"] }),
    ],
  },
  {
    id: "spirits-liqueur",
    label: "Likőr / keserű / vermut",
    category: "spirits",
    style: "shot",
    subtype: "liqueur",
    alsoIn: ["cocktail"],
    brands: [
      im("Amaretto Disaronno", "IT", { aliases: ["Disaronno", "Amaretto"] }),
      im("Aperol", "IT", { subtype: "liqueur", ...P }),
      im("Baileys", "IE"),
      im("Becherovka", "CZ"),
      im("Campari", "IT"),
      im("Cinzano", "IT"),
      im("Cointreau", "FR"),
      im("Fernet-Branca", "IT", { aliases: ["Fernet", "Fernet Branca"] }),
      hu("Fütyülős"),
      hu("Hubertus"),
      im("Jägermeister", "DE", { aliases: ["Jäger", "Jager", "Jagermeister"], ...P }),
      im("Kahlúa", "MX", { aliases: ["Kahlua"] }),
      im("Malibu", "BB"),
      im("Martini", "IT"),
      im("Ramazzotti", "IT"),
      im("Sambuca", "IT"),
      im("St-Germain", "FR", { aliases: ["St Germain"] }),
      hu("Unicum", { aliases: ["Zwack Unicum"], ...P }),
    ],
  },

  // ---------------- ÜDÍTŐ / ALKOHOLMENTES ----------------
  {
    id: "soft-brands",
    label: "Üdítők, energiaitalok, víz",
    category: "soft",
    style: "nonalcoholic",
    brands: [
      im("Cappy", "US"),
      im("Club-Mate", "DE", { aliases: ["Club Mate"] }),
      im("Coca-Cola", "US", { aliases: ["Coca Cola", "Coke", "Kóla"], ...P }),
      im("Fanta", "US"),
      im("Fever-Tree", "GB", { aliases: ["Fever Tree"] }),
      hu("Hell", { aliases: ["Hell Energy"] }),
      im("Kinley", "US"),
      hu("Márka", { aliases: ["Márka üdítő"] }),
      hu("NaturAqua"),
      im("Pepsi", "US"),
      im("Rauch", "AT"),
      im("Red Bull", "AT", P),
      im("Schweppes", "CH", P),
      im("Sprite", "US"),
      hu("Szentkirályi"),
      hu("Theodora"),
      hu("Traubi", { aliases: ["Traubisoda", "Traubi Szóda"] }),
      hu("XIXO"),
    ],
  },
  {
    id: "soft-na-beer",
    label: "Alkoholmentes sör",
    category: "soft",
    style: "nonalcoholic",
    subtype: "na_beer",
    brands: [
      im("Clausthaler", "DE"),
      hu("Dreher 24", { aliases: ["Dreher 0,0", "Dreher alkoholmentes"] }),
      im("Erdinger Alkoholfrei", "DE", { aliases: ["Erdinger 0,0"] }),
      im("Heineken 0.0", "NL", { aliases: ["Heineken 0,0", "Heineken alkoholmentes"] }),
      im("Paulaner 0,0", "DE", { aliases: ["Paulaner alkoholmentes"] }),
      hu("Soproni 0,0%", { aliases: ["Soproni alkoholmentes"] }),
    ],
  },
];

const mix = (name: string, subtype: CocktailType, base: SpiritType[], extra: Partial<CatalogMix> = {}): CatalogMix => ({
  name,
  category: "cocktail",
  style: "longdrink",
  subtype,
  base,
  ...extra,
});
const froccs = (name: string, wineDl: number, sodaDl: number, extra: Partial<CatalogMix> = {}): CatalogMix => ({
  name,
  category: "wine",
  style: "spritzer",
  wineDl,
  sodaDl,
  ...extra,
});

/** Koktélok, long drinkek, shotok és fröccsök – magyar ABC szerint. */
export const CATALOG_MIXES: CatalogMix[] = [
  mix("Aperol Spritz", "spritz", ["liqueur"], { aliases: ["Aperol Fröccs"], popular: true }),
  { name: "B-52", aliases: ["B52"], category: "spirits", style: "shot", subtype: "liqueur", base: ["liqueur"] },
  mix("Bloody Mary", "longdrink", ["vodka"]),
  mix("Caipirinha", "classic", []),
  mix("Campari Spritz", "spritz", ["liqueur"]),
  mix("Cosmopolitan", "classic", ["vodka"], { aliases: ["Cosmo"] }),
  mix("Cuba Libre", "mojito", ["rum"], { aliases: ["Rum-kóla", "Rum Cola"], popular: true }),
  mix("Daiquiri", "mojito", ["rum"]),
  mix("Dark 'n' Stormy", "mojito", ["rum"], { aliases: ["Dark and Stormy"] }),
  mix("Espresso Martini", "classic", ["vodka"]),
  mix("Gin Tonic", "gin_tonic", ["gin"], { aliases: ["Gin-tonik", "G&T", "Gin Tonik"], popular: true }),
  froccs("Házmester", 3, 2),
  froccs("Hosszúlépés", 1, 2),
  mix("Hugo", "spritz", ["liqueur"], { popular: true }),
  { name: "Jägerbomb", aliases: ["Jäger-bomba", "Jagerbomb"], category: "spirits", style: "shot", subtype: "liqueur", base: ["liqueur"] },
  froccs("Kisfröccs", 1, 1, { popular: true }),
  froccs("Krúdy-fröccs", 9, 1, { aliases: ["Krúdy fröccs"] }),
  mix("Long Island Iced Tea", "longdrink", ["vodka", "gin", "rum", "tequila"], { aliases: ["Long Island"], popular: true }),
  mix("Mai Tai", "mojito", ["rum"]),
  mix("Margarita", "classic", ["tequila"]),
  mix("Mojito", "mojito", ["rum"], { popular: true }),
  mix("Moscow Mule", "longdrink", ["vodka"]),
  froccs("Nagyfröccs", 2, 1, { popular: true }),
  mix("Negroni", "classic", ["gin", "liqueur"], { popular: true }),
  mix("Old Fashioned", "classic", ["whiskey"]),
  mix("Paloma", "longdrink", ["tequila"]),
  mix("Piña Colada", "mojito", ["rum"], { aliases: ["Pina Colada"] }),
  mix("Screwdriver", "longdrink", ["vodka"], { aliases: ["Vodka-narancs", "Vodka narancs"] }),
  mix("Sex on the Beach", "longdrink", ["vodka"], { popular: true }),
  froccs("Sóherfröccs", 1, 9, { aliases: ["Sóher fröccs"] }),
  mix("Tequila Sunrise", "longdrink", ["tequila"]),
  froccs("Viceházmester", 2, 3),
  mix("Vodka-Red Bull", "longdrink", ["vodka"], { aliases: ["Vodka Red Bull", "VRB"] }),
  mix("Whiskey Sour", "classic", ["whiskey"], { aliases: ["Whisky Sour"] }),
  mix("Whiskey-Cola", "longdrink", ["whiskey"], { aliases: ["Whisky-kóla", "Whiskey Cola", "Whisky Cola", "Jack-kóla"], popular: true }),
];

/** Magyar szőlőfajták (fajta → bor-alfajta), keresőhöz és a névből való felismeréshez. */
export const GRAPE_VARIETIES: { name: string; subtype: "dry_white" | "red" | "rose"; aliases?: string[] }[] = [
  { name: "Cabernet franc", subtype: "red" },
  { name: "Chardonnay", subtype: "dry_white" },
  { name: "Cserszegi fűszeres", subtype: "dry_white", aliases: ["Cserszegi"] },
  { name: "Egri Bikavér", subtype: "red" },
  { name: "Furmint", subtype: "dry_white" },
  { name: "Hárslevelű", subtype: "dry_white" },
  { name: "Irsai Olivér", subtype: "dry_white", aliases: ["Irsai"] },
  { name: "Juhfark", subtype: "dry_white" },
  { name: "Kadarka", subtype: "red" },
  { name: "Kékfrankos", subtype: "red" },
  { name: "Királyleányka", subtype: "dry_white" },
  { name: "Merlot", subtype: "red" },
  { name: "Olaszrizling", subtype: "dry_white" },
  { name: "Pinot noir", subtype: "red" },
  { name: "Portugieser", subtype: "red", aliases: ["Kékoportó"] },
  { name: "Rozé", subtype: "rose", aliases: ["Rosé"] },
  { name: "Sárgamuskotály", subtype: "dry_white", aliases: ["Muskotály"] },
  { name: "Sauvignon blanc", subtype: "dry_white", aliases: ["Sauvignon"] },
  { name: "Szekszárdi Bikavér", subtype: "red" },
  { name: "Zenit", subtype: "dry_white" },
  { name: "Zweigelt", subtype: "red" },
];

/** Magyar borvidékek (tájékoztató lista a keresőhöz / szerkesztőhöz). */
export const WINE_REGIONS: string[] = [
  "Badacsony",
  "Balatonfüred-Csopak",
  "Eger",
  "Etyek-Buda",
  "Kunság",
  "Mátra",
  "Somló",
  "Sopron",
  "Szekszárd",
  "Tokaj",
  "Villány",
];

/** Pálinka-gyümölcsök (a „Pálinka” alfajtán belüli fajták). */
export const PALINKA_FRUITS: string[] = ["Ágyas", "Alma", "Barack", "Birs", "Cseresznye", "Körte", "Meggy", "Szilva", "Törköly", "Vilmoskörte"];
