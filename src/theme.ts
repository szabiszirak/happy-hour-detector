// „Carbon Mint” – a CSS-en kívül (Leaflet-rétegek, alaptérkép) használt színek egy helyen.
// A felület többi színe a src/styles.css :root változóiban van; a kettőt együtt kell módosítani.

export const THEME = {
  bg: "#0A0C0D",
  card: "#14181A",
  mint: "#2EF2B3",
  mintText: "#6FF7CB",
  hh: "#FF5C8A",
  closed: "#6E7A77",
  me: "#5AB0FF",
  /** Keresési kör: semleges, hogy ne keveredjen a menta „nyitva” jelöléssel és a kék saját helyeddel. */
  radius: "#C9D4D1",
  corner: "#93A39F",
} as const;

/** Térképi jelölők színei (HH most / nyitva / zárva). */
export const MARKER_COLORS = { active: THEME.hh, open: THEME.mint, closed: THEME.closed } as const;

/** Protomaps „dark” flavor felülírásai: semleges karbon tónusok, olvasható utcanevek. */
export const MAP_FLAVOR = {
  background: "#0A0C0D",
  earth: "#0F1213",
  water: "#11202A",
  park_a: "#0E1F19",
  park_b: "#0F221C",
  wood_a: "#0E1C17",
  wood_b: "#0E1C17",
  pedestrian: "#141819",
  buildings: "#171B1D",
  minor_service: "#1E2427",
  minor_a: "#252C2F",
  minor_b: "#1E2427",
  other: "#1E2427",
  link: "#2C3437",
  major: "#2C3437",
  highway: "#364044",
  casing: "#0F1213",
  bridges_minor: "#252C2F",
  bridges_major: "#2C3437",
  bridges_highway: "#364044",
  boundaries: "#46524E",
  label_major: "#E9F2EF",
  label_minor: "#BCC8C4",
  label_city: "#93A39F",
  label_sub: "#84938F",
  halo: "#0A0C0D",
} as const;
