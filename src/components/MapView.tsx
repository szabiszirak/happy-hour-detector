import { useEffect, useRef, useState } from "react";
import { THEME } from "../theme";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp } from "../context";
import { centroid, groupNearby, MVP_CORNERS, MVP_POLYGON } from "../domain/geo";
import { cheapestBeer, formatFt } from "../domain/pricing";
import { groupLook, markerVisual, type MarkerLook } from "../domain/mapVisual";
import { addBaseLayer, type BaseKind } from "./baseLayer";

/** Ettől a nagyítástól a kocsmák neve is kiíródik a jelölők mellé. */
const NAME_ZOOM = 17;

/** Jelölőszínek – a CSS-változókkal egyezően (--hh, --ok, --closed). */
export { MARKER_COLORS } from "../theme";

interface Props {
  highlightIds?: Set<string>;
  pickMode: boolean;
  onPick: (lat: number, lng: number) => void;
  /** GPS pontosság méterben – halvány kör a helyed körül. */
  accuracy?: number;
  /** Ha nő, a térkép a helyedre ugrik. */
  recenterKey?: number;
  /** Keresési kör sugara (a `pos` körül) – a körön kívüli helyek halványak. */
  radiusM: number;
  /** „Csak nyitva”: a nyitva lévők türkiz gyűrűt kapnak, a többi szürke. */
  openOnly: boolean;
}

export function MapView({ highlightIds, pickMode, onPick, accuracy, recenterKey = 0, radiusM, openOnly }: Props) {
  const { places, now, pos, openPlace } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
  const acc = useRef<L.Circle | null>(null);
  const area = useRef<L.Circle | null>(null);
  const lastRadius = useRef(radiusM);
  const [base, setBase] = useState<BaseKind | null>(null);
  const pickRef = useRef({ pickMode, onPick });
  pickRef.current = { pickMode, onPick };

  // térkép létrehozása egyszer
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true });
    m.attributionControl.setPrefix(false);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.fitBounds(L.latLngBounds(MVP_POLYGON.map((p) => [p.lat, p.lng] as [number, number])), { padding: [10, 10] });

    // alaptérkép: letöltött Budapest-térkép → MVP-kivágás → csempeszerver → vázlat
    let alive = true;
    addBaseLayer(m).then((k) => alive && setBase(k));

    // kocsmanevek nagy nagyításon
    const syncZoomClass = () => el.current?.classList.toggle("zoom-names", m.getZoom() >= NAME_ZOOM);
    m.on("zoomend", syncZoomClass);
    syncZoomClass();

    L.polygon(
      MVP_POLYGON.map((p) => [p.lat, p.lng] as [number, number]),
      { color: THEME.corner, weight: 1.5, dashArray: "6 6", fillColor: THEME.mint, fillOpacity: 0.03, interactive: false },
    ).addTo(m);
    for (const c of MVP_CORNERS) {
      L.circleMarker([c.at.lat, c.at.lng], { radius: 3, color: THEME.corner, fillOpacity: 1, interactive: false })
        .bindTooltip(c.name, { permanent: true, direction: "top", className: "corner-label", offset: [0, -4] })
        .addTo(m);
    }

    markers.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (pickRef.current.pickMode) pickRef.current.onPick(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    return () => {
      alive = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // kocsma-jelölők
  useEffect(() => {
    const g = markers.current;
    if (!g) return;
    g.clearLayers();
    const opts = { center: pos, radiusM, openOnly, now, highlightIds };
    const RANK: Record<MarkerLook, number> = { "open-ring": 3, normal: 2, muted: 1, dimmed: 0 };
    const STATE_RANK = { active: 2, open: 1, closed: 0 } as const;
    const z = (look: MarkerLook, state: keyof typeof STATE_RANK) => RANK[look] * 1000 + STATE_RANK[state] * 250;

    // Az egymáshoz nagyon közeli helyek (pl. azonos cím) egy jelölőt kapnak, a nevek egymás alatt.
    for (const group of groupNearby(places, 25)) {
      if (group.length === 1) {
        const p = group[0];
        const v = markerVisual(p, opts);
        const beer = cheapestBeer(p, now);
        // A térképen nincs fizetős kiemelés (a kocsmák megjelenése nem megvehető).
        const cls = `look-${v.look}`;
        // Ár csak akkor kerül a jelölőre, ha van adat; különben kis pötty a hely állapotának színével.
        const html = beer
          ? `<div class="pin pin-${v.state} ${cls}">${v.state === "active" ? "<span class='pin-dot'></span>" : ""}${formatFt(beer.price).replace(" Ft", "")}</div>`
          : `<div class="dot dot-${v.state} ${cls}"><span class="dot-name">${escapeHtml(p.name)}</span></div>`;
        const icon = L.divIcon({ className: "", html, iconSize: [0, 0] });
        L.marker([p.location.lat, p.location.lng], { icon, title: p.name, zIndexOffset: z(v.look, v.state) })
          .bindTooltip(p.name, { direction: "top", offset: [0, beer ? -26 : -8], className: "pin-label" })
          .on("click", () => openPlace(p.id))
          .addTo(g);
        continue;
      }

      const visuals = group.map((p) => markerVisual(p, opts));
      const look = groupLook(visuals);
      const lead = visuals.filter((v) => v.look === look).reduce((a, b) => (STATE_RANK[b.state] > STATE_RANK[a.state] ? b : a));
      const items = group
        .map((p, i) => {
          const beer = cheapestBeer(p, now);
          const price = beer ? ` · ${formatFt(beer.price)}` : "";
          return `<span class="dot-name-item look-${visuals[i].look}" data-id="${escapeHtml(p.id)}"><i class="mini-dot mini-${visuals[i].state}"></i>${escapeHtml(p.name)}${price}</span>`;
        })
        .join("");
      const html = `<div class="dot dot-${lead.state} dot-group look-${look}"><span class="dot-count">${group.length}</span><span class="dot-names">${items}</span></div>`;
      const at = centroid(group.map((p) => p.location));
      const icon = L.divIcon({ className: "", html, iconSize: [0, 0] });

      // Kis nagyításon a csoportra koppintva választó jön fel; nagyban a nevekre lehet koppintani.
      const chooser = document.createElement("div");
      chooser.className = "group-chooser";
      group.forEach((p, i) => {
        const b = document.createElement("button");
        b.innerHTML = `<i class="mini-dot mini-${visuals[i].state}"></i>${escapeHtml(p.name)}`;
        if (!visuals[i].matches) b.className = "no-match";
        b.onclick = () => {
          m.closePopup();
          openPlace(p.id);
        };
        chooser.appendChild(b);
      });
      const m = map.current!;
      L.marker([at.lat, at.lng], { icon, title: group.map((p) => p.name).join(" · "), zIndexOffset: z(look, lead.state) + 100 })
        .bindTooltip(group.map((p) => p.name).join(" · "), { direction: "top", offset: [0, -10], className: "pin-label" })
        .bindPopup(chooser, { closeButton: false, className: "group-popup", offset: [0, -6] })
        .on("click", (e: L.LeafletMouseEvent) => {
          const hit = (e.originalEvent.target as HTMLElement | null)?.closest?.("[data-id]") as HTMLElement | null;
          if (hit?.dataset.id) {
            e.target.closePopup();
            openPlace(hit.dataset.id);
          }
        })
        .addTo(g);
    }
  }, [places, now, highlightIds, openPlace, pos, radiusM, openOnly]);

  // keresési kör a referenciapont körül; sugárváltáskor a térkép rááll a körre
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!area.current)
      area.current = L.circle([pos.lat, pos.lng], {
        radius: radiusM,
        color: THEME.radius,
        weight: 1.5,
        dashArray: "4 6",
        fillColor: THEME.radius,
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(m);
    else area.current.setLatLng([pos.lat, pos.lng]).setRadius(radiusM);
    if (lastRadius.current !== radiusM) {
      lastRadius.current = radiusM;
      m.fitBounds(area.current.getBounds(), { padding: [16, 16], maxZoom: 17 });
    }
  }, [pos, radiusM]);

  // saját pozíció
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!me.current) {
      me.current = L.circleMarker([pos.lat, pos.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: THEME.me,
        fillOpacity: 1,
      })
        .bindTooltip("Itt vagy", { direction: "top", offset: [0, -8] })
        .addTo(m);
    } else me.current.setLatLng([pos.lat, pos.lng]);

    // pontossági kör
    if (accuracy && accuracy > 0) {
      if (!acc.current)
        acc.current = L.circle([pos.lat, pos.lng], {
          radius: accuracy,
          color: THEME.me,
          weight: 1,
          fillColor: THEME.me,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(m);
      else acc.current.setLatLng([pos.lat, pos.lng]).setRadius(accuracy);
    } else if (acc.current) {
      acc.current.remove();
      acc.current = null;
    }
  }, [pos, accuracy]);

  // a térkép a helyedre ugrik (első GPS-találat, vagy a 📍 gomb)
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const m = map.current;
    if (!m || recenterKey === 0) return;
    m.setView([posRef.current.lat, posRef.current.lng], Math.max(m.getZoom(), 16), { animate: true });
  }, [recenterKey]);

  useEffect(() => {
    el.current?.classList.toggle("picking", pickMode);
  }, [pickMode]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {base === "sketch" && <div className="map-note">Vázlatos alaptérkép (demó)</div>}
      {base === "mvp" && <div className="map-note">Térkép: csak a négyszög környéke</div>}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
