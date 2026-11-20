// Vázlatos alaptérkép a fő utcákkal – akkor látszik, ha nincs térképcsempe-szerver
// beállítva (pl. a demó linken, ahol külső képek nem tölthetők be).
// A koordináták közelítőek; éles módban a VITE_TILE_URL csempés térképe váltja ki.
export type Line = { name: string; kind: "major" | "minor" | "bridge"; path: [number, number][] };

export const STREETS: Line[] = [
  { name: "Vámház krt.", kind: "major", path: [[47.4872, 19.0582], [47.4895, 19.0617]] },
  { name: "Múzeum krt.", kind: "major", path: [[47.4895, 19.0617], [47.4935, 19.0628]] },
  { name: "Üllői út", kind: "major", path: [[47.4895, 19.0617], [47.4857, 19.0707], [47.4828, 19.0772]] },
  { name: "József krt.", kind: "major", path: [[47.4857, 19.0707], [47.4895, 19.0728]] },
  { name: "Ferenc krt.", kind: "major", path: [[47.4857, 19.0707], [47.4812, 19.0652]] },
  { name: "Közraktár u.", kind: "minor", path: [[47.4866, 19.0587], [47.4838, 19.0613], [47.4812, 19.0645]] },
  { name: "Ráday u.", kind: "minor", path: [[47.489, 19.0622], [47.4864, 19.0641], [47.4838, 19.0662]] },
  { name: "Lónyay u.", kind: "minor", path: [[47.4881, 19.0601], [47.4855, 19.062], [47.4827, 19.0641]] },
  { name: "Kinizsi u.", kind: "minor", path: [[47.4889, 19.0634], [47.4868, 19.0663], [47.4848, 19.0688]] },
  { name: "Szabadság híd", kind: "bridge", path: [[47.4872, 19.0582], [47.4858, 19.0535]] },
  { name: "Petőfi híd", kind: "bridge", path: [[47.4812, 19.0652], [47.4793, 19.0597]] },
];

/** A Duna sávja (közelítő). */
export const DANUBE: [number, number][] = [
  [47.4975, 19.0465], [47.4905, 19.0525], [47.4865, 19.0565], [47.4825, 19.0605], [47.4785, 19.0655],
  [47.4745, 19.0705], [47.4715, 19.0655], [47.4755, 19.0595], [47.4795, 19.0545], [47.4845, 19.0495],
  [47.4945, 19.0415],
];
