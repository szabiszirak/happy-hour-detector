// Kezdő adatok: a valódi helyek az MVP-négyszögből (OpenStreetMap + webes kiegészítés).
// Forrás: data/places.osm.json – frissítése: .github/workflows/import-osm.yml
// Happy hour idősávok: data/happy-hours.json (valós adatok + normál eloszlással becsült, megjelölt idősávok).
// Itallapok: data/drinks.json (Google Maps menüfotókból kinyert italok és HUF árak).
import type { Drink, HappyHourSlot, Place, Report } from "../domain/types";
import raw from "../../data/places.osm.json";
import happyHoursByPlace from "../../data/happy-hours.json";
import drinksByPlace from "../../data/drinks.json";

interface RawPlace {
  id: string;
  osmId?: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  vibes: Place["vibes"];
  osm: {
    amenity?: string;
    openingHours?: string;
    website?: string;
    phone?: string;
    source?: string;
    inMvp: boolean;
    checkNeeded?: boolean;
  };
}

/** Csak a négyszögön belüli helyek kerülnek az MVP-be. */
export function seedPlaces(): Place[] {
  return (raw as RawPlace[])
    .filter((p) => p.osm.inMvp)
    .map((p) => ({
      id: p.id,
      osmId: p.osmId,
      name: p.name,
      address: p.address.startsWith("1") || !p.address ? p.address : `Budapest, ${p.address}`,
      location: p.location,
      vibes: p.vibes ?? [],
      info: {
        kind: p.osm.amenity,
        openingHours: p.osm.openingHours || undefined,
        website: p.osm.website || undefined,
        phone: p.osm.phone || undefined,
        source: p.osm.source,
        checkNeeded: p.osm.checkNeeded,
      },
      drinks: (drinksByPlace as Record<string, Drink[]>)[p.id] ?? [],
      happyHours: (happyHoursByPlace as Record<string, HappyHourSlot[]>)[p.id] ?? [],
    }));
}

/** Valódi helyekhez nem találunk ki bejelentéseket. */
export function seedReports(): Report[] {
  return [];
}
