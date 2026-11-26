// A kézi ikon-felülírások (data/place-icons.json) betöltése és ellenőrzése.
import raw from "../../data/place-icons.json";
import { parseIconOverrides } from "../domain/placeIcon";

export const PLACE_ICON_OVERRIDES = parseIconOverrides(raw);
import { resolvePlaceIcon } from "../domain/placeIcon";
import type { Place } from "../domain/types";

/** A hely ikonja a kézi felülírásokkal együtt. */
export const iconOf = (place: Pick<Place, "id" | "name" | "info">) => resolvePlaceIcon(place, PLACE_ICON_OVERRIDES);
