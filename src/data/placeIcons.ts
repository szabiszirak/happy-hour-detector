// Kézi típus-felülírások (data/place-icons.json) és a letöltött honlap-ikonok (data/place-favicons.json) betöltése.
import raw from "../../data/place-icons.json";
import favRaw from "../../data/place-favicons.json";
import { parseIconOverrides, resolvePlaceIcon } from "../domain/placeIcon";
import { parseFaviconIndex } from "../domain/siteIcon";
import type { Place } from "../domain/types";

export const PLACE_ICON_OVERRIDES = parseIconOverrides(raw);
export const FAVICONS = parseFaviconIndex(favRaw);

/** A hely típusa (címke + „ellenőrizendő” jelzés) a kézi felülírásokkal együtt. */
export const iconOf = (place: Pick<Place, "id" | "name" | "info">) => resolvePlaceIcon(place, PLACE_ICON_OVERRIDES);
