import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp } from "../context";
import { MVP_CORNERS, MVP_POLYGON } from "../domain/geo";
import { happyHourStatus } from "../domain/happyHour";
import { cheapestBeer, formatFt } from "../domain/pricing";
import { openState } from "../domain/openingHours";
import { DANUBE, STREETS } from "./baseMap";

const TILE_URL = (import.meta.env.VITE_TILE_URL as string | undefined) || "";
const TILE_ATTR = (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) || "";

export const MARKER_COLORS = { active: "#f5a623", open: "#5fd38d", closed: "#8a7f76" };

interface Props {
  highlightIds?: Set<string>;
  pickMode: boolean;
  onPick: (lat: number, lng: number) => void;
}

export function MapView({ highlightIds, pickMode, onPick }: Props) {
  const { places, now, pos, openPlace } = useApp();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
  const pickRef = useRef({ pickMode, onPick });
  pickRef.current = { pickMode, onPick };

  // térkép létrehozása egyszer
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: Boolean(TILE_URL) });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    m.fitBounds(L.latLngBounds(MVP_POLYGON.map((p) => [p.lat, p.lng] as [number, number])), { padding: [10, 10] });

    if (TILE_URL) {
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, subdomains: "abcd" }).addTo(m);
    } else {
      // vázlatos alaptérkép
      L.polygon(DANUBE, { stroke: false, fillColor: "#1f3a4d", fillOpacity: 0.9, interactive: false }).addTo(m);
      for (const s of STREETS) {
        const line = L.polyline(s.path, {
          color: s.kind === "major" ? "#5a4a3e" : s.kind === "bridge" ? "#6d7c87" : "#40352d",
          weight: s.kind === "major" ? 7 : 4,
          lineCap: "round",
          interactive: false,
        }).addTo(m);
        line.bindTooltip(s.name, { permanent: true, direction: "center", className: "street-label" });
      }
    }

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
        : `<div class="dot dot-${state}${sponsored}${dim ? " pin-dim" : ""}"></div>`;
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
  }, [pos]);

  useEffect(() => {
    el.current?.classList.toggle("picking", pickMode);
  }, [pickMode]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      {!TILE_URL && <div className="map-note">Vázlatos alaptérkép (demó)</div>}
    </div>
  );
}
