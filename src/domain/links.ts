// Külső linkek, amelyeket a saját adatainkból rakunk össze (Google-adatot nem tárolunk, csak a place_id-t, ha van).
import type { Place } from "./types";

const MAPS = "https://www.google.com/maps/search/?api=1";

/** A hely a Google Térképen (útvonal / nyitvatartás / értékelések ott). place_id-vel pontos, nélküle név + cím alapján. */
export function googleMapsUrl(place: Pick<Place, "name" | "address" | "location" | "googlePlaceId">): string {
  if (place.googlePlaceId)
    return `${MAPS}&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.googlePlaceId)}`;
  const q = place.address ? `${place.name}, ${place.address}` : `${place.location.lat},${place.location.lng}`;
  return `${MAPS}&query=${encodeURIComponent(q)}`;
}
