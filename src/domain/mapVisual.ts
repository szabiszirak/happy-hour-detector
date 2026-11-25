// Hogyan nézzen ki egy hely a térképen és szerepeljen-e a listában –
// a sugár-szűrő, a „csak nyitva” szűrő (a beállított időpontra) és a fülek kiemelése együtt.
import type { LatLng, Place } from "./types";
import { happyHourStatus } from "./happyHour";
import { openState, type OpenState } from "./openingHours";
import { inRadius } from "./searchArea";

/**
 * - normal:    a szokásos színek (HH korall, nyitva türkiz, zárva szürke)
 * - open-ring: „csak nyitva” bekapcsolva és nyitva → türkiz gyűrű
 * - muted:     a körön belül, de nem felel meg a szűrőnek (zárva / nem kiemelt) → szürke, halvány
 * - dimmed:    a körön kívül → nagyon halvány, felirat nélkül
 */
export type MarkerLook = "normal" | "open-ring" | "muted" | "dimmed";

/** A jelölő alapszíne (állapot). */
export type MarkerState = "active" | "open" | "closed";

export interface VisualOptions {
  center: LatLng;
  radiusM: number;
  /** „Csak nyitva” szűrő – a `now` időpontra (most, vagy a beállított nap/óra). */
  openOnly: boolean;
  now: Date;
  /** A fül saját kiemelése (pl. Happy Hour fül: csak a HH-s helyek). undefined = nincs. */
  highlightIds?: Set<string>;
}

export interface MarkerVisual {
  look: MarkerLook;
  state: MarkerState;
  inRadius: boolean;
  open: OpenState;
  /** Megfelel-e minden szűrőnek (ez kerül a listába). */
  matches: boolean;
}

export function markerVisual(place: Place, o: VisualOptions): MarkerVisual {
  const open = openState(place.info?.openingHours, o.now);
  const hh = happyHourStatus(place, o.now).kind === "active";
  const state: MarkerState = hh ? "active" : open.kind === "open" ? "open" : "closed";
  const inside = inRadius(place, o.center, o.radiusM);
  const openOk = !o.openOnly || open.kind === "open";
  const highlightOk = !o.highlightIds || o.highlightIds.has(place.id);
  const matches = inside && openOk && highlightOk;

  let look: MarkerLook;
  if (!inside) look = "dimmed";
  else if (!openOk || !highlightOk) look = "muted";
  else if (o.openOnly) look = "open-ring";
  else look = "normal";
  return { look, state, inRadius: inside, open, matches };
}

/** Csoport (közeli helyek) megjelenése: a „legjobb” tag számít. */
export function groupLook(visuals: MarkerVisual[]): MarkerLook {
  const order: MarkerLook[] = ["open-ring", "normal", "muted", "dimmed"];
  return order.find((l) => visuals.some((v) => v.look === l)) ?? "dimmed";
}

/** A listába kerülő helyek (minden szűrőnek megfelelnek) és a körön kívül maradók száma. */
export function filterForList<T extends Place>(places: T[], o: VisualOptions): { shown: T[]; outsideCount: number } {
  const shown: T[] = [];
  let outsideCount = 0;
  for (const p of places) {
    const v = markerVisual(p, o);
    if (v.matches) shown.push(p);
    else if (!v.inRadius && (!o.openOnly || v.open.kind === "open")) outsideCount++;
  }
  return { shown, outsideCount };
}
