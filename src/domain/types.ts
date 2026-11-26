// Az app adatmodellje. Minden, ami nem Google-ből jön, a saját adatunk –
// ezért szabadon szerkeszthető az appon belül.

export type LatLng = { lat: number; lng: number };

/** Italstílusok – erre épül a szűrő („pilsnert szeretnék”). */
export type DrinkStyle =
  | "pilsner"
  | "lager"
  | "ipa"
  | "wheat"
  | "dark"
  | "craft"
  | "cider"
  | "wine"
  | "spritzer"
  | "longdrink"
  | "shot"
  | "nonalcoholic";

/** Italkategóriák (Piák & árak szűrő és ízlésprofil). */
export type DrinkCategory = "beer" | "spirits" | "wine" | "cocktail" | "soft";

/** Kategórián belüli alfajták (ízlésprofil és itallap „Fajta” mezője). */
export type WineStyle = "dry_white" | "semi_sweet" | "sweet" | "rose" | "red" | "sparkling";
export type SpiritType = "palinka" | "whiskey" | "gin" | "rum" | "tequila" | "vodka" | "liqueur";
export type CocktailType = "gin_tonic" | "spritz" | "mojito" | "classic" | "longdrink";
export type SoftType = "na_beer" | "tonic_soda" | "lemonade";
export type DrinkSubtype = WineStyle | SpiritType | CocktailType | SoftType;

/** Régi (v1) ízlésprofil-kategóriák – csak a migrációhoz. */
export type TasteCategory = "lightbeer" | "craftbeer" | "wine" | "longdrink" | "shot";

export type PriceBand = "budget" | "mid" | "premium";

export interface Drink {
  id: string;
  /** Pl. „Arany Ászok”, „Dreher Classic”, „Házi fröccs”. */
  name: string;
  brand?: string;
  style: DrinkStyle;
  /** Alfajta (pl. rosé, pálinka, gin-tonik) – ha nincs megadva, a névből következtetünk rá. */
  subtype?: DrinkSubtype;
  /** Kiszerelés literben (0.5 korsó, 0.3 pohár, 0.04 rövid). */
  volumeL: number;
  /** Normál ár forintban. */
  price: number;
  /** Happy Hour ár, ha van rá kedvezmény. */
  hhPrice?: number;
  /** Utolsó megerősítés („Még mindig ennyi?” → Igen). */
  lastConfirmedAt?: number;
  confirmCount?: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface HappyHourSlot {
  id: string;
  /** ISO hét napjai: 1 = hétfő … 7 = vasárnap. */
  days: number[];
  /** "HH:MM" helyi idő. Az end lehet kisebb a startnál (éjfélen átnyúló sáv). */
  start: string;
  end: string;
  /** Rövid leírás: „Minden csapolt sör -30%”. */
  note: string;
  /** Normál eloszlással generált becsült idősáv (nem valós adat). */
  isSynthetic?: boolean;
}

export interface Sponsorship {
  /** Unix ms – eddig fut a kampány. */
  until: number;
  tagline: string;
}

export type Vibe = "chill" | "party" | "garden" | "sport";

/** Forrásból (OpenStreetMap / web) jövő kiegészítő adatok. */
/** A hely ikonja (saját SVG-készlet, lásd domain/placeIcon.ts és components/PlaceIcon.tsx). */
export type PlaceIconId =
  | "pub"
  | "craft"
  | "bar"
  | "cocktail"
  | "wine"
  | "club"
  | "music"
  | "games"
  | "culture"
  | "cafe"
  | "restaurant"
  | "garden"
  | "generic";

export interface PlaceInfo {
  /** Hely típusa: pub, bar, restaurant, cafe, nightclub… */
  kind?: string;
  /** Kézzel választott ikon (szerkesztő) – felülírja az automatikus feloldást. */
  icon?: PlaceIconId;
  /** OSM opening_hours formátum, pl. "Mo-Fr 16:00-24:00". */
  openingHours?: string;
  website?: string;
  phone?: string;
  /** "osm" vagy "web: <forrás>" */
  source?: string;
  /** Ellenőrizni kell, hogy létezik-e / tényleg bár-e. */
  checkNeeded?: boolean;
}

/** Kocsmáros által feltöltött fotó (nem Google-adat). */
export interface PlacePhoto {
  id: string;
  /** Megjeleníthető cím: Storage letöltési URL, demóban kicsinyített data URL. */
  url: string;
  storagePath?: string;
  addedAt: number;
}

/** Közösségi „Még mindig ennyi?” megerősítések italonként – külön mező, hogy a kocsmáros adatait ne írja felül. */
export type DrinkConfirmations = Record<string, { count: number; lastAt: number }>;

export interface Place {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  /** Google Places azonosító – ez az egyetlen Google-adat, amit tartósan tárolhatunk. */
  googlePlaceId?: string;
  /** OpenStreetMap azonosító (ha onnan importáltuk). */
  osmId?: string;
  vibes: Vibe[];
  info?: PlaceInfo;
  drinks: Drink[];
  happyHours: HappyHourSlot[];
  /** Régi, hely-szintű kiemelés – már nem jelenik meg (a fizetős kiemelés italoknál van, lásd pricing.ts). */
  sponsored?: Sponsorship;
  /** Kocsmáros bemutatkozó szövege. */
  description?: string;
  photos?: PlacePhoto[];
  confirmations?: DrinkConfirmations;
  updatedAt?: number;
  updatedBy?: string;
}

/** Waze-féle közösségi bejelentés. */
export interface Report {
  id: string;
  placeId: string;
  userId: string;
  userName: string;
  text: string;
  /** Opcionális konkrét ár-állítás: „ma csak 700 az Arany Ászok”. */
  drinkName?: string;
  price?: number;
  createdAt: number;
  expiresAt: number;
  confirms: string[];
  denies: string[];
}

/** Kategórián belüli preferenciák – mind opcionális. */
export interface TastePrefs {
  /** Kedvenc sörmárkák (szótár szerinti írásmóddal, vagy saját név). */
  beerBrands?: string[];
  wine?: WineStyle[];
  spirits?: SpiritType[];
  cocktail?: CocktailType[];
  soft?: SoftType[];
}

/**
 * Kategóriánkénti árkeret Ft-ban (a priceBudget.ts egységeiben: sör 0,5 l, rövid 4 cl, a többi darab).
 * `null` = „mindegy”; hiányzó kategória = nem kérdeztük (szintén nem korlátoz).
 */
export type CategoryBudgets = Partial<Record<DrinkCategory, number | null>>;

/** Ízlésprofil (v3): kategóriák + kategórián belüli preferenciák + kategóriánkénti árkeret. */
export interface TasteProfile {
  version: 3;
  categories: DrinkCategory[];
  prefs: TastePrefs;
  budgets: CategoryBudgets;
  completedAt: number;
}

/** Régi (v1) profil, ahogy a böngészőben / Firestore-ban maradhatott. */
export interface LegacyTasteProfile {
  categories: TasteCategory[];
  priceBand: PriceBand;
  completedAt: number;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  profile?: TasteProfile;
  /** Csak éles módban, a Firebase Auth `admin` custom claimből – kliensről nem állítható. */
  isAdmin?: boolean;
}

export const STYLE_LABELS: Record<DrinkStyle, string> = {
  pilsner: "Pilsner",
  lager: "Világos láger",
  ipa: "IPA / APA",
  wheat: "Búza",
  dark: "Barna / stout",
  craft: "Egyéb kézműves",
  cider: "Cider",
  wine: "Bor",
  spritzer: "Fröccs",
  longdrink: "Long drink / koktél",
  shot: "Rövidital",
  nonalcoholic: "Alkoholmentes",
};


export const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  budget: "800 Ft alatt",
  mid: "800–1200 Ft",
  premium: "1200 Ft felett",
};

export const VIBE_LABELS: Record<Vibe, string> = {
  chill: "Beszélgetős",
  party: "Bulis",
  garden: "Kerthelyiség",
  sport: "Meccsnézős",
};

