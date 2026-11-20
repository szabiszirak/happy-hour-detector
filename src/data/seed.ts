// Kezdő adatok: a valódi helyek az MVP-négyszögből (OpenStreetMap + webes kiegészítés).
// Forrás: data/places.osm.json – frissítése: .github/workflows/import-osm.yml
// Árak, happy hour időpontok még nincsenek: ezeket a felhasználók / kocsmárosok töltik fel az appban.
import type { Place, Report } from "../domain/types";
import raw from "../../data/places.osm.json";

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
      drinks: [],
      happyHours: [],
    }));
}

/** Valódi helyekhez nem találunk ki bejelentéseket. */
export function seedReports(): Report[] {
  return [];
}
