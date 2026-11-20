// Vázlatos alaptérkép a fő utcákkal – akkor látszik, ha nincs térképcsempe-szerver
// beállítva (pl. a claude.ai-os demó linken, ahol külső képek nem tölthetők be).
// A vonalakat az OSM-sarkokhoz és a valódi helyek címkoordinátáihoz igazítottuk; közelítőek.
// Éles módban (GitHub Pages) a VITE_TILE_URL csempés térképe váltja ki.
export type Line = { name: string; kind: "major" | "minor" | "bridge"; path: [number, number][] };

const FOVAM: [number, number] = [47.486455, 19.057664];
const KALVIN: [number, number] = [47.489432, 19.061488];
const CORVIN: [number, number] = [47.485546, 19.070905];
const BORAROS: [number, number] = [47.480488, 19.067308];

export const STREETS: Line[] = [
  { name: "Vámház krt.", kind: "major", path: [FOVAM, [47.4882, 19.0601], KALVIN] },
  { name: "Múzeum krt.", kind: "major", path: [KALVIN, [47.4935, 19.0625]] },
  { name: "Üllői út", kind: "major", path: [KALVIN, CORVIN, [47.483, 19.0775]] },
  { name: "József krt.", kind: "major", path: [CORVIN, [47.4895, 19.0728]] },
  { name: "Ferenc krt.", kind: "major", path: [CORVIN, [47.4843, 19.0692], [47.4828, 19.0686], BORAROS] },
  { name: "Közraktár u.", kind: "minor", path: [FOVAM, [47.4838, 19.0606], [47.4818, 19.0637], BORAROS] },
  { name: "Ráday u.", kind: "minor", path: [[47.4891, 19.0621], [47.488, 19.0625], [47.4867, 19.0636], [47.4843, 19.0653], [47.4819, 19.0672]] },
  { name: "Lónyay u.", kind: "minor", path: [[47.4887, 19.061], [47.4858, 19.0622], [47.4848, 19.0626], [47.4829, 19.0645], [47.4812, 19.0668]] },
  { name: "Szabadság híd", kind: "bridge", path: [FOVAM, [47.4848, 19.0533]] },
  { name: "Petőfi híd", kind: "bridge", path: [BORAROS, [47.4782, 19.0615]] },
];

/** A Duna sávja (közelítő): a pesti part a Fővám tér és a Boráros tér nyugati oldalán fut. */
export const DANUBE: [number, number][] = [
  [47.4975, 19.0478], [47.4905, 19.0533], [47.4862, 19.0567], [47.4828, 19.0607], [47.4798, 19.0645],
  [47.4745, 19.0708], [47.4712, 19.0665], [47.4765, 19.0598], [47.4795, 19.0560], [47.4835, 19.0518],
  [47.4875, 19.0488], [47.4945, 19.0432],
];
