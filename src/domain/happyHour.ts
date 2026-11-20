import type { HappyHourSlot, Place } from "./types";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** ISO hétnap: 1 = hétfő … 7 = vasárnap. */
export const isoDay = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export type HHStatus =
  | { kind: "active"; slot: HappyHourSlot; minutesLeft: number }
  | { kind: "upcoming"; slot: HappyHourSlot; minutesUntil: number }
  | { kind: "none" };

/**
 * Egy idősáv aktív-e az adott pillanatban. Kezeli az éjfélen átnyúló sávot is
 * (pl. 22:00–01:00 péntek: szombat 00:30-kor még aktív).
 */
export function slotMinutesLeft(slot: HappyHourSlot, now: Date): number | null {
  const s = toMin(slot.start);
  const e = toMin(slot.end);
  const t = now.getHours() * 60 + now.getMinutes();
  const today = isoDay(now);
  const yesterday = today === 1 ? 7 : today - 1;

  if (e > s) {
    if (slot.days.includes(today) && t >= s && t < e) return e - t;
    return null;
  }
  // éjfélen átnyúló sáv
  if (slot.days.includes(today) && t >= s) return 24 * 60 - t + e;
  if (slot.days.includes(yesterday) && t < e) return e - t;
  return null;
}

/** A hely mostani / mai Happy Hour állapota (a „hamarosan” = 3 órán belül indul ma). */
export function happyHourStatus(place: Place, now: Date): HHStatus {
  let best: HHStatus = { kind: "none" };
  const t = now.getHours() * 60 + now.getMinutes();
  for (const slot of place.happyHours) {
    const left = slotMinutesLeft(slot, now);
    if (left !== null) {
      if (best.kind !== "active" || left > best.minutesLeft)
        best = { kind: "active", slot, minutesLeft: left };
      continue;
    }
    if (best.kind === "active") continue;
    if (slot.days.includes(isoDay(now))) {
      const until = toMin(slot.start) - t;
      if (until > 0 && until <= 180 && (best.kind !== "upcoming" || until < best.minutesUntil))
        best = { kind: "upcoming", slot, minutesUntil: until };
    }
  }
  return best;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} perc`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} óra` : `${h} ó ${m} p`;
}

const DAY_SHORT = ["", "H", "K", "Sze", "Cs", "P", "Szo", "V"];

/** „H–P 16:00–18:00” jellegű rövid leírás. */
export function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Minden nap";
  const isRun = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isRun && sorted.length >= 3) return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}
