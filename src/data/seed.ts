// DEMÓ ADATOK – kitalált helyek, kitalált árak az MVP-négyszögön belül.
// Valós induláskor ezt a scripts/import-osm.mjs (helyek) és a saját ár-begyűjtés váltja ki.
import type { Drink, DrinkStyle, HappyHourSlot, LatLng, Place, Report, Vibe } from "../domain/types";
import { MVP_POLYGON } from "../domain/geo";

/**
 * Pont a négyszögön belül bilineáris interpolációval (u: Fővám→Kálvin irány, v: → Boráros irány).
 * 0<u,v<1 esetén a pont garantáltan a (konvex) MVP-négyszögön belül van.
 */
function at(u: number, v: number): LatLng {
  const [a, b, c, d] = MVP_POLYGON; // Fővám, Kálvin, Corvin, Boráros
  const lat = (1 - u) * (1 - v) * a.lat + u * (1 - v) * b.lat + u * v * c.lat + (1 - u) * v * d.lat;
  const lng = (1 - u) * (1 - v) * a.lng + u * (1 - v) * b.lng + u * v * c.lng + (1 - u) * v * d.lng;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

let n = 0;
const d = (name: string, style: DrinkStyle, volumeL: number, price: number, hhPrice?: number, brand?: string): Drink => ({
  id: `d${++n}`,
  name,
  brand,
  style,
  volumeL,
  price,
  hhPrice,
});

const WEEKDAYS = [1, 2, 3, 4, 5];
let s = 0;
const hh = (days: number[], start: string, end: string, note: string): HappyHourSlot => ({ id: `h${++s}`, days, start, end, note });

const P = (
  id: string,
  name: string,
  uv: [number, number],
  vibes: Vibe[],
  drinks: Drink[],
  happyHours: HappyHourSlot[],
): Place => ({ id, name, address: "IX. kerület (demó cím)", location: at(uv[0], uv[1]), vibes, drinks, happyHours });

export function seedPlaces(now = Date.now()): Place[] {
  n = 0;
  s = 0;
  const places: Place[] = [
    P("p1", "Csapolda Kilenc", [0.82, 0.18], ["chill"], [
      d("Arany Ászok korsó", "lager", 0.5, 890, 690, "Arany Ászok"),
      d("Dreher Classic korsó", "lager", 0.5, 990, 790, "Dreher"),
      d("Nagyfröccs", "spritzer", 0.3, 790),
      d("Heineken 0.0", "nonalcoholic", 0.33, 890, undefined, "Heineken"),
    ], [hh(WEEKDAYS, "16:00", "18:00", "Minden csapolt sör 200 Ft-tal olcsóbb")]),

    P("p2", "Rozsdás Korsó", [0.35, 0.55], ["party"], [
      d("Soproni korsó", "lager", 0.5, 850, 700, "Soproni"),
      d("Borsodi korsó", "lager", 0.5, 790, undefined, "Borsodi"),
      d("Pálinka (szilva)", "shot", 0.04, 990, 790),
    ], [hh([4, 5, 6], "22:00", "00:30", "Késő esti happy hour: Soproni 700 Ft")]),

    P("p3", "Komló Kert", [0.5, 0.75], ["garden", "chill"], [
      d("Pilsner Urquell korsó", "pilsner", 0.5, 1490, 1190, "Pilsner Urquell"),
      d("Dreher Classic pohár", "lager", 0.3, 690, undefined, "Dreher"),
      d("Aperol Spritz", "longdrink", 0.3, 2690, 2190),
    ], [hh([1, 2, 3, 4, 5, 6, 7], "15:00", "17:00", "Pilsner Urquell 1190 Ft")]),

    P("p4", "IPA Labor", [0.62, 0.42], ["chill"], [
      d("Házi IPA", "ipa", 0.4, 1690, 1390),
      d("NEIPA (vendégcsap)", "ipa", 0.33, 1890),
      d("Búzasör", "wheat", 0.5, 1590, 1290),
      d("Házi pilsner", "pilsner", 0.5, 1390, 1090),
    ], [hh([1, 2, 3, 4], "17:00", "19:00", "Minden kézműves csap -300 Ft")]),

    P("p5", "Kálvin Söröző", [0.9, 0.3], ["sport"], [
      d("Arany Ászok korsó", "lager", 0.5, 790, undefined, "Arany Ászok"),
      d("Kőbányai korsó", "lager", 0.5, 690, 590, "Kőbányai"),
      d("Dreher Classic korsó", "lager", 0.5, 950, undefined, "Dreher"),
      d("Unicum", "shot", 0.04, 890, undefined, "Zwack"),
    ], [hh(WEEKDAYS, "14:00", "17:00", "Kőbányai 590 Ft")]),

    P("p6", "Fröccsterasz", [0.25, 0.3], ["garden"], [
      d("Nagyfröccs", "spritzer", 0.3, 790, 590),
      d("Hosszúlépés", "spritzer", 0.3, 690, 490),
      d("Pohár olaszrizling", "wine", 0.15, 990),
      d("Soproni korsó", "lager", 0.5, 990, undefined, "Soproni"),
    ], [hh([5, 6], "18:00", "20:00", "Minden fröccs 200 Ft-tal olcsóbb")]),

    P("p7", "Bakáts Pince", [0.55, 0.9], ["chill"], [
      d("Borsodi korsó", "lager", 0.5, 850, 650, "Borsodi"),
      d("Staropramen korsó", "lager", 0.5, 1150, undefined, "Staropramen"),
      d("Barna sör", "dark", 0.5, 1290),
    ], [hh([3], "18:00", "21:00", "Szerdai sörnap: Borsodi 650 Ft")]),

    P("p8", "Duna Bár", [0.15, 0.6], ["party"], [
      d("Gin-tonik", "longdrink", 0.3, 2490, 1790),
      d("Heineken üveges", "lager", 0.33, 1190, undefined, "Heineken"),
      d("Tequila", "shot", 0.04, 1290, 990),
    ], [hh([4, 5, 6], "20:00", "22:00", "Gin-tonik 1790 Ft")]),

    P("p9", "Corvin Pub", [0.85, 0.82], ["sport"], [
      d("Guinness korsó", "dark", 0.5, 1890, undefined, "Guinness"),
      d("Dreher Classic korsó", "lager", 0.5, 1050, 850, "Dreher"),
      d("Kozel korsó", "lager", 0.5, 990, 790, "Kozel"),
    ], [hh(WEEKDAYS, "17:00", "19:00", "Dreher és Kozel 200 Ft-tal olcsóbb")]),

    P("p10", "Lónyay Lugas", [0.4, 0.2], ["garden"], [
      d("Arany Ászok korsó", "lager", 0.5, 850, 690, "Arany Ászok"),
      d("Limonádé", "nonalcoholic", 0.4, 890),
    ], [hh([6, 7], "13:00", "16:00", "Hétvégi kertes délután: Arany Ászok 690 Ft")]),

    P("p11", "Habzó Hordó", [0.7, 0.62], ["party", "sport"], [
      d("Kozel korsó", "lager", 0.5, 890, 690, "Kozel"),
      d("Kozel Černý korsó", "dark", 0.5, 990, 790, "Kozel"),
      d("Jägermeister", "shot", 0.04, 1190),
    ], [hh([1, 2, 3, 4, 5, 6, 7], "21:00", "23:00", "Kozel 690 Ft minden este")]),

    P("p12", "Szódás", [0.3, 0.8], ["chill"], [
      d("Kisfröccs", "spritzer", 0.2, 490, 390),
      d("Házmester", "spritzer", 0.5, 990, 790),
      d("Borsodi pohár", "lager", 0.3, 590, undefined, "Borsodi"),
    ], [hh(WEEKDAYS, "15:00", "18:00", "Fröccsök -100 Ft")]),

    P("p13", "Hop Spot", [0.75, 0.45], ["chill"], [
      d("APA", "ipa", 0.5, 1590),
      d("Session IPA", "ipa", 0.4, 1290, 990),
      d("Pilsner Urquell korsó", "pilsner", 0.5, 1390, undefined, "Pilsner Urquell"),
    ], [hh([2, 4], "18:00", "20:00", "Session IPA 990 Ft")]),

    P("p14", "Félkorsó", [0.45, 0.45], ["chill", "party"], [
      d("Soproni korsó", "lager", 0.5, 790, 650, "Soproni"),
      d("Soproni Óvatos Duhaj IPA", "ipa", 0.5, 1090, undefined, "Soproni"),
      d("Soproni 0,0%", "nonalcoholic", 0.5, 790, undefined, "Soproni"),
    ], [hh(WEEKDAYS, "18:00", "19:30", "Soproni 650 Ft")]),
  ];
  // Szponzorált demó kampány – külön blokkban, címkével jelenik meg, a rangsort nem érinti.
  const komlo = places.find((p) => p.id === "p3")!;
  komlo.sponsored = { until: now + 30 * 24 * 3600 * 1000, tagline: "Fűtött kerthelyiség, csapolt Pilsner Urquell" };
  return places;
}

export function seedReports(now = Date.now()): Report[] {
  const h = 3600 * 1000;
  return [
    {
      id: "r1", placeId: "p5", userId: "demo-anna", userName: "Anna",
      text: "Gyertek ide, ma csak 590 a Kőbányai, és megy a meccs!", drinkName: "Kőbányai korsó", price: 590,
      createdAt: now - 1.5 * h, expiresAt: now + 10.5 * h, confirms: ["demo-bence", "demo-csilla"], denies: [],
    },
    {
      id: "r2", placeId: "p11", userId: "demo-bence", userName: "Bence",
      text: "Új csap: Kozel Černý, happy hourban 790.", drinkName: "Kozel Černý korsó", price: 790,
      createdAt: now - 3 * h, expiresAt: now + 9 * h, confirms: [], denies: [],
    },
    {
      id: "r3", placeId: "p2", userId: "demo-csilla", userName: "Csilla",
      text: "Tele van, nem fértünk be.",
      createdAt: now - 20 * h, expiresAt: now - 8 * h, confirms: [], denies: [],
    },
  ];
}
