// A hely ikoncsempéje: kocsmáros által feltöltött ikon → honlap-ikon (saját mappából) → négyágú csillag.
// A döntés a domainben van (siteIcon.resolvePlaceBadge); itt csak a megjelenítés és a betöltési hiba kezelése.
import { useId, useState } from "react";
import type { Place } from "../domain/types";
import { resolvePlaceBadge } from "../domain/siteIcon";
import { FAVICONS, iconOf } from "../data/placeIcons";

/**
 * Négyágú, színátmenetes csillag-szikra (saját rajz, a „Carbon Mint” színeivel – nem márkalogó).
 * A függőleges ágak kicsit hosszabbak, mellette egy kisebb második szikra.
 */
export function SparkIcon({ size = 24, hh = false }: { size?: number; hh?: boolean }) {
  const id = useId().replace(/:/g, "");
  const stops = hh ? ["#FF5C8A", "#B69CFF", "#2EF2B3"] : ["#2EF2B3", "#5AB0FF", "#FF5C8A"];
  return (
    <svg className="spark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sg${id}`} gradientUnits="userSpaceOnUse" x1="4" y1="2" x2="18" y2="22">
          <stop offset="0.08" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="0.92" stopColor={stops[2]} />
        </linearGradient>
        <radialGradient id={`sc${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* fő szikra: homorú oldalú négyágú csillag */}
      <path
        d="M11.4 1.2 C12.1 7.2 15.5 10.6 21.4 11.4 C15.5 12.2 12.1 15.6 11.4 22.6 C10.7 15.6 7.3 12.2 1.6 11.4 C7.3 10.6 10.7 7.2 11.4 1.2 Z"
        fill={`url(#sg${id})`}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.35"
        strokeLinejoin="round"
      />
      <circle cx="11.4" cy="11.4" r="1.8" fill={`url(#sc${id})`} />
      {/* kis kísérő szikra */}
      <path
        d="M19.4 1.6 C19.6 3.2 20.4 4 22 4.2 C20.4 4.4 19.6 5.2 19.4 6.8 C19.2 5.2 18.4 4.4 16.8 4.2 C18.4 4 19.2 3.2 19.4 1.6 Z"
        fill={`url(#sg${id})`}
      />
    </svg>
  );
}

/** Ikoncsempe a listában / kártyán / adatlapon. Betöltési hiba esetén a csillagra vált (nincs törött kép). */
export function PlaceIconTile({ place, size = 40, hh = false }: { place: Pick<Place, "id" | "name" | "info">; size?: number; hh?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const badge = resolvePlaceBadge(place, FAVICONS, failed);
  const type = iconOf(place);
  const title =
    (badge.kind === "image" ? (badge.source === "owner" ? "A hely saját ikonja" : "Ikon a hely honlapjáról") : type.label) +
    (type.uncertain ? " – típus ellenőrizendő" : "");
  return (
    <span
      className={`place-icon ${badge.kind === "image" ? "has-img" : "has-spark"} ${type.uncertain ? "uncertain" : ""} ${hh ? "hh" : ""}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      title={title}
      role="img"
      aria-label={title}
      data-badge={badge.kind === "image" ? badge.source : "sparkle"}
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
        <SparkIcon size={Math.round(size * 0.66)} hh={hh} />
      )}
      {type.uncertain && (
        <span className="place-icon-q" aria-hidden="true">
          ?
        </span>
      )}
    </span>
  );
}
