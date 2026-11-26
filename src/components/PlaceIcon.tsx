// Saját, beépített SVG ikonkészlet a helyekhez – nincs külső kép, letöltés vagy ikon-URL.
// Melyik hely melyik ikont kapja: domain/placeIcon.ts (resolvePlaceIcon).
import type { ReactNode } from "react";
import type { PlaceIconId } from "../domain/types";
import type { ResolvedPlaceIcon } from "../domain/placeIcon";

/** 24×24-es vonalas rajzok, `currentColor` színnel. */
const PATHS: Record<PlaceIconId, ReactNode> = {
  // söröskorsó habbal és füllel
  pub: (
    <>
      <path d="M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z" />
      <path d="M15 11h2.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H15" />
      <path d="M5 9a2.5 2.5 0 0 1 2.2-3.5 3 3 0 0 1 5.6 0A2.5 2.5 0 0 1 15 9" />
      <path d="M8.5 12.5v5M11.5 12.5v5" />
    </>
  ),
  // csapolófej + pohár
  craft: (
    <>
      <rect x="9.5" y="2.5" width="5" height="5" rx="1" />
      <path d="M12 7.5v3" />
      <path d="M7 10.5h10v2.5h-3.5v2" />
      <path d="M10 17h5l-.6 4.5h-3.8z" />
    </>
  ),
  // tumbler jégkockával
  bar: (
    <>
      <path d="M5 6h14l-1.6 13.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z" />
      <path d="M5.8 11h12.4" />
      <rect x="9" y="12.5" width="4" height="4" rx="0.8" transform="rotate(-10 11 14.5)" />
    </>
  ),
  // martinis pohár olívával
  cocktail: (
    <>
      <path d="M4 4h16l-8 8.5z" />
      <path d="M12 12.5V20" />
      <path d="M8 20.5h8" />
      <path d="M14.5 3l-2.5 5" />
      <circle cx="11.4" cy="9.2" r="1.3" />
    </>
  ),
  // borospohár
  wine: (
    <>
      <path d="M7.5 3h9l.4 4.5a5 5 0 0 1-9.8 0z" />
      <path d="M7.4 7.5h9.2" />
      <path d="M12 12.5V20" />
      <path d="M8.5 20.5h7" />
    </>
  ),
  // diszkógömb
  club: (
    <>
      <path d="M12 2v3" />
      <circle cx="12" cy="13" r="7.5" />
      <path d="M4.5 13h15M12 5.5v15" />
      <path d="M6 9h12M6 17h12" />
      <path d="M8.6 6.3c-1.4 4.2-1.4 9.2 0 13.4M15.4 6.3c1.4 4.2 1.4 9.2 0 13.4" />
    </>
  ),
  // dupla hangjegy
  music: (
    <>
      <path d="M9 18V5.5l11-2.5v12.5" />
      <path d="M9 9l11-2.5" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="15.5" r="2.5" />
    </>
  ),
  // darts céltábla nyíllal
  games: (
    <>
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="4.5" />
      <circle cx="11" cy="13" r="1.2" />
      <path d="M11 13l9-9" />
      <path d="M17 4h3v3" />
    </>
  ),
  // belépőjegy
  culture: (
    <>
      <path d="M3 7.5V5h18v2.5a2 2 0 0 0 0 4V14a2 2 0 0 0 0 4v1H3v-1a2 2 0 0 0 0-4v-2.5a2 2 0 0 0 0-4z" />
      <path d="M15 5.5v13" strokeDasharray="1.6 1.8" />
      <path d="M7 10h5M7 13.5h4" />
    </>
  ),
  // kávéscsésze gőzzel
  cafe: (
    <>
      <path d="M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
      <path d="M16 11.5h1.5a2 2 0 0 1 0 4H16" />
      <path d="M4 21h14" />
      <path d="M8.5 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3" />
    </>
  ),
  // villa és kés
  restaurant: (
    <>
      <path d="M7 3v7a2 2 0 0 0 2 2v9" />
      <path d="M11 3v7a2 2 0 0 1-2 2" />
      <path d="M9 3v5" />
      <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </>
  ),
  // fa és pad
  garden: (
    <>
      <circle cx="9" cy="8" r="5" />
      <path d="M9 13v8" />
      <path d="M13.5 17h7M14.5 17v3.5M19.5 17v3.5M14 14.5h6" />
    </>
  ),
  // helyjelölő pohárral
  generic: (
    <>
      <path d="M12 21.5s7-6.2 7-11.5a7 7 0 0 0-14 0c0 5.3 7 11.5 7 11.5z" />
      <path d="M9.5 7h5l-.8 5.5h-3.4z" />
    </>
  ),
};

export function PlaceIconSvg({ id, size = 22 }: { id: PlaceIconId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id]}
    </svg>
  );
}

/** Ikoncsempe a listában / adatlapon. Bizonytalan típusnál szaggatott sárga keret és magyarázó felirat. */
export function PlaceIconTile({ icon, size = 40, hh = false }: { icon: ResolvedPlaceIcon; size?: number; hh?: boolean }) {
  const title = icon.uncertain ? `${icon.label} – típus ellenőrizendő` : icon.label;
  return (
    <span
      className={`place-icon ${icon.uncertain ? "uncertain" : ""} ${hh ? "hh" : ""}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      title={title}
      role="img"
      aria-label={title}
      data-icon={icon.id}
    >
      <PlaceIconSvg id={icon.id} size={Math.round(size * 0.58)} />
      {icon.uncertain && (
        <span className="place-icon-q" aria-hidden="true">
          ?
        </span>
      )}
    </span>
  );
}
