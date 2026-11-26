// A hely ikoncsempéje: kocsmáros által feltöltött ikon → honlap-ikon (saját mappából) → a hely nevének kezdőbetűje.
// A döntés a domainben van (siteIcon.resolvePlaceBadge); itt csak a megjelenítés és a betöltési hiba kezelése.
import { useState } from "react";
import type { Place } from "../domain/types";
import { resolvePlaceBadge } from "../domain/siteIcon";
import { FAVICONS, iconOf } from "../data/placeIcons";

/** Ikoncsempe a listában / kártyán / adatlapon. Betöltési hiba esetén a kezdőbetűre vált (nincs törött kép). */
export function PlaceIconTile({ place, size = 40, hh = false }: { place: Pick<Place, "id" | "name" | "info">; size?: number; hh?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const badge = resolvePlaceBadge(place, FAVICONS, failed);
  const type = iconOf(place);
  const title =
    (badge.kind === "image"
      ? badge.source === "owner"
        ? "A hely saját ikonja"
        : `Ikon: ${badge.credit ?? "a hely honlapja"}`
      : type.label) +
    (type.uncertain ? " – típus ellenőrizendő" : "");
  return (
    <span
      className={`place-icon ${badge.kind === "image" ? "has-img" : "has-initial"} ${badge.kind === "image" && badge.pixelated ? "pixelated" : ""} ${type.uncertain ? "uncertain" : ""} ${hh ? "hh" : ""}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      title={title}
      role="img"
      aria-label={title}
      data-badge={badge.kind === "image" ? badge.source : "initial"}
    >
      {badge.kind === "image" ? (
        <img
          src={badge.url}
          alt=""
          width={Math.round(size * 0.66)}
          height={Math.round(size * 0.66)}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed((f) => [...f, badge.url])}
        />
      ) : (
        <span className="place-initial" style={{ fontSize: Math.round(size * 0.46) }} aria-hidden="true">
          {badge.letter}
        </span>
      )}
      {type.uncertain && (
        <span className="place-icon-q" aria-hidden="true">
          ?
        </span>
      )}
    </span>
  );
}
