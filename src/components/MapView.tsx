import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp } from "../context";
import { MVP_CORNERS, MVP_POLYGON } from "../domain/geo";
import { happyHourStatus } from "../domain/happyHour";
import { cheapestBeer, formatFt } from "../domain/pricing";
import { openState } from "../domain/openingHours";
import { addBaseLayer, type BaseKind } from "./baseLayer";

/** Ettől a nagyítástól a kocsmák neve is kiíródik a jelölők mellé. */
const NAME_ZOOM = 17;

export const MARKER_COLORS = { active: "#f5a623", open: "#5fd38d", closed: "#8a7f76" };

interface Props {
  highlightIds?: Set<string>;
  pickMode: boolean;
  onPick: (lat: number, lng: number) => void;
  /** GPS pontosság méterben – halvány kör a helyed körül. */
  accuracy?: number;
  /** Ha nő, a térkép a helyedre ugrik. */
  recenterKey?: number;
}

export function MapView({ highlightIds, pickMode, onPick, accuracy, recenterKey = 0 }: Props) {
  const { places, now, pos, openPlace } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
  const acc = useRef<L.Circle | null>(null);
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
      { color: "#f5a623", weight: 2, dashArray: "6 6", fillColor: "#f5a623", fillOpacity: 0.04, interactive: false },
    ).addTo(m);
    for (const c of MVP_CORNERS) {
      L.circleMarker([c.at.lat, c.at.lng], { radius: 3, color: "#f5a623", fillOpacity: 1, interactive: false })
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
    for (const p of places) {
      const hh = happyHourStatus(p, now).kind;
      const open = openState(p.info?.openingHours, now).kind;
      const beer = cheapestBeer(p, now);
      const dim = highlightIds && !highlightIds.has(p.id);
      const state = hh === "active" ? "active" : open === "open" ? "open" : "closed";
      const sponsored = p.sponsored && p.sponsored.until > now.getTime() ? " pin-sponsored" : "";
      // Ár csak akkor kerül a jelölőre, ha van adat; különben kis pötty a hely állapotának színével.
      const html = beer
        ? `<div class="pin pin-${state}${sponsored}${dim ? " pin-dim" : ""}">${state === "active" ? "<span class='pin-dot'></span>" : ""}${formatFt(beer.price).replace(" Ft", "")}</div>`
        : `<div class="dot dot-${state}${sponsored}${dim ? " pin-dim" : ""}"><span class="dot-name">${escapeHtml(p.name)}</span></div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [0, 0] });
      L.marker([p.location.lat, p.location.lng], { icon, title: p.name, zIndexOffset: state === "active" ? 500 : state === "open" ? 200 : 0 })
        .bindTooltip(p.name, { direction: "top", offset: [0, beer ? -26 : -8], className: "pin-label" })
        .on("click", () => openPlace(p.id))
        .addTo(g);
    }
  }, [places, now, highlightIds, openPlace]);

  // saját pozíció
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!me.current) {
      me.current = L.circleMarker([pos.lat, pos.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#3d8bff",
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
          color: "#3d8bff",
          weight: 1,
          fillColor: "#3d8bff",
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
