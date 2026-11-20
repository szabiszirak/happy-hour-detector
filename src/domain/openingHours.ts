// OpenStreetMap opening_hours értelmező – a gyakori formákat kezeli:
//   "Mo-Fr 16:00-24:00; Sa 00:00-02:00,16:00-24:00"
//   "Mo-Th 16:00-01:00, Fr,Sa 16:00-02:00, Su 16:00-24:00"   (vesszővel elválasztott szabályok)
//   "14:00-24:00"  (minden nap)   "24/7"   "Mo off"   "PH off" (ünnepnap – figyelmen kívül)
// Az éjfélen átnyúló sávot (16:00-02:00) a következő napra is átvezeti.
// Ismeretlen formánál "unknown" állapotot ad, nem találgat.

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
type Range = [number, number]; // percben, end > start (lehet > 1440)

export type OpenState =
  | { kind: "open"; closesAt: string; minutesLeft: number }
  | { kind: "closed"; opensAt?: string; opensToday: boolean }
  | { kind: "unknown" };

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function expandDays(sel: string): number[] {
  const out = new Set<number>();
  for (const part of sel.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part === "PH") continue;
    const [a, b] = part.split("-").map((s) => s.trim());
    const ia = DAYS.indexOf(a as (typeof DAYS)[number]);
    if (ia < 0) continue;
    if (!b) {
      out.add(ia);
      continue;
    }
    const ib = DAYS.indexOf(b as (typeof DAYS)[number]);
    if (ib < 0) continue;
    for (let i = ia; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === ib) break;
    }
  }
  return [...out];
}

/** Hetente napi idősávok (0 = hétfő). null, ha a szöveg nem értelmezhető. */
export function parseOpeningHours(src: string | undefined): Range[][] | null {
  if (!src || !src.trim()) return null;
  const s = src.trim();
  if (s === "24/7") return Array.from({ length: 7 }, () => [[0, 1440] as Range]);
  const week: (Range[] | undefined)[] = Array(7).fill(undefined);
  const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)";
  const re = new RegExp(
    `(${DAY}(?:\\s*[-,]\\s*${DAY})*)?\\s*((?:\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}(?:\\s*,\\s*(?=\\d))?)+|off|closed)`,
    "g",
  );
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    matched = true;
    const days = m[1] ? expandDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (m[1] && days.length === 0) continue; // csak "PH"
    const ranges: Range[] =
      m[2] === "off" || m[2] === "closed"
        ? []
        : m[2]
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => {
              const [a, b] = t.split("-").map((x) => toMin(x.trim()));
              return [a, b <= a ? b + 1440 : b] as Range;
            });
    for (const d of days) week[d] = ranges; // a későbbi szabály felülírja a korábbit (OSM-szabály)
  }
  if (!matched) return null;
  return week.map((r) => r ?? []);
}

/** Nyitva van-e a hely az adott időpontban. */
export function openState(src: string | undefined, now: Date): OpenState {
  const week = parseOpeningHours(src);
  if (!week) return { kind: "unknown" };
  const day = (now.getDay() + 6) % 7;
  const prev = (day + 6) % 7;
  const t = now.getHours() * 60 + now.getMinutes();

  // ma kezdődő sávok, és a tegnapról átnyúlók
  const candidates: Range[] = [...week[day], ...week[prev].filter(([, e]) => e > 1440).map(([a, e]) => [a - 1440, e - 1440] as Range)];
  // egymásba érő sávok összefűzése (pl. Sa 00:00-02:00 + Fr 16:00-24:00)
  candidates.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of candidates) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  for (const [a, e] of merged) {
    if (t >= a && t < e) {
      // ha holnap 00:00-kor folytatódik, azt is hozzávesszük
      let end = e;
      if (end === 1440) {
        const next = week[(day + 1) % 7].find(([na]) => na === 0);
        if (next) end = 1440 + next[1];
      }
      return { kind: "open", closesAt: fmt(end), minutesLeft: end - t };
    }
  }
  const later = merged.filter(([a]) => a > t);
  if (later.length) return { kind: "closed", opensAt: fmt(later[0][0]), opensToday: true };
  return { kind: "closed", opensToday: false };
}

const HU_DAYS: Record<string, string> = { Mo: "H", Tu: "K", We: "Sze", Th: "Cs", Fr: "P", Sa: "Szo", Su: "V", PH: "ünnep" };

/** Olvasható magyar forma: "H–P 16:00–24:00 · Szo 00:00–02:00, 16:00–24:00". */
export function formatOpeningHours(src: string | undefined): string {
  if (!src) return "";
  if (src.trim() === "24/7") return "Éjjel-nappal";
  return src
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => HU_DAYS[d])
    .replace(/(\d)-(\d)/g, "$1–$2")
    .replace(/([A-Za-zé]+)-([A-Za-zé]+)/g, "$1–$2")
    .replace(/\boff\b/g, "zárva")
    .replace(/;\s*/g, " · ");
}
