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
  | "wine"
  | "spritzer"
  | "longdrink"
  | "shot"
  | "nonalcoholic";

/** Ízlésprofil-kategóriák a regisztrációs kérdéshez. */
export type TasteCategory = "lightbeer" | "craftbeer" | "wine" | "longdrink" | "shot";

export type PriceBand = "budget" | "mid" | "premium";

export interface Drink {
  id: string;
  /** Pl. „Arany Ászok”, „Dreher Classic”, „Házi fröccs”. */
  name: string;
  brand?: string;
  style: DrinkStyle;
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
}

export interface Sponsorship {
  /** Unix ms – eddig fut a kampány. */
  until: number;
  tagline: string;
}

export type Vibe = "chill" | "party" | "garden" | "sport";

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
  drinks: Drink[];
  happyHours: HappyHourSlot[];
  sponsored?: Sponsorship;
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

export interface TasteProfile {
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
}

export const STYLE_LABELS: Record<DrinkStyle, string> = {
  pilsner: "Pilsner",
  lager: "Világos láger",
  ipa: "IPA / APA",
  wheat: "Búza",
  dark: "Barna / stout",
  craft: "Egyéb kézműves",
  wine: "Bor",
  spritzer: "Fröccs",
  longdrink: "Long drink / koktél",
  shot: "Rövidital",
  nonalcoholic: "Alkoholmentes",
};

export const TASTE_LABELS: Record<TasteCategory, string> = {
  lightbeer: "Világos sör / pilsner",
  craftbeer: "Kézműves sör (IPA, APA…)",
  wine: "Bor / fröccs",
  longdrink: "Long drink / koktél",
  shot: "Rövidital",
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

/** Melyik italstílus melyik ízlésprofil-kategóriába tartozik. */
export const STYLE_TO_TASTE: Record<DrinkStyle, TasteCategory | null> = {
  pilsner: "lightbeer",
  lager: "lightbeer",
  wheat: "craftbeer",
  ipa: "craftbeer",
  dark: "craftbeer",
  craft: "craftbeer",
  wine: "wine",
  spritzer: "wine",
  longdrink: "longdrink",
  shot: "shot",
  nonalcoholic: null,
};
