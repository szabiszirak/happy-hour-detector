import { useApp } from "../context";
import { formatRadius, MAX_RADIUS_M, MIN_RADIUS_M, radiusIndex, RADIUS_STEPS, stepRadius } from "../domain/searchArea";

/**
 * Közös szűrősáv a fülek fölött: keresési kör (−/+ és csúszka) és „Csak nyitva”.
 * A „csak nyitva” a fejlécben beállított időpontra vonatkozik (most, vagy adott nap/óra).
 */
export function FilterBar({ farAway, timeLabel }: { farAway: boolean; timeLabel: string | null }) {
  const { radiusM, setRadiusM, openOnly, setOpenOnly } = useApp();
  const idx = radiusIndex(radiusM);

  return (
    <div className="filterbar">
      <div className="radius">
        <span className="radius-label">
          Kör {farAway ? "a Kálvin tér körül" : "körülötted"}
        </span>
        <div className="radius-ctrl">
          <button
            className="step-btn"
            aria-label="Kisebb kör"
            disabled={radiusM <= MIN_RADIUS_M}
            onClick={() => setRadiusM(stepRadius(radiusM, -1))}
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={idx}
            aria-label="Keresési kör sugara"
            aria-valuetext={formatRadius(radiusM)}
            onChange={(e) => setRadiusM(RADIUS_STEPS[Number(e.target.value)])}
          />
          <button
            className="step-btn"
            aria-label="Nagyobb kör"
            disabled={radiusM >= MAX_RADIUS_M}
            onClick={() => setRadiusM(stepRadius(radiusM, 1))}
          >
            +
          </button>
          <strong className="radius-value">{formatRadius(radiusM)}</strong>
        </div>
      </div>
      <label className={`open-toggle ${openOnly ? "on" : ""}`}>
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
        <span>
          Csak nyitva
          <span className="muted small"> · {timeLabel ?? "most"}</span>
        </span>
      </label>
    </div>
  );
}
