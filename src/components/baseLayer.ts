// Az alaptérkép kiválasztása. Sorrend:
//  1) egész Budapest vektoros térképe (map/budapest.pmtiles – a GitHub Pages deploy tölti le),
//  2) a négyszög kis kivágása (map/mvp.pmtiles – a repóban van, fejlesztéshez),
//  3) VITE_TILE_URL csempeszerver, ha meg van adva,
//  4) a beépített vázlatos alaptérkép (pl. a claude.ai-os demólinken, ahol külső fájl nem tölthető).
// A PMTiles fájlokat a böngésző részletekben (HTTP range request) olvassa, szerver nélkül.
import L from "leaflet";
import { MAP_FLAVOR } from "../theme";
import { labelRules, leafletLayer, LineLabelSymbolizer, paintRules } from "protomaps-leaflet";
import { namedFlavor } from "@protomaps/basemaps";
import { DANUBE, STREETS } from "./baseMap";

export type BaseKind = "budapest" | "mvp" | "tiles" | "sketch";

const OSM_ATTR =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap közreműködők</a> · ' +
  '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a>';

/** Budapest közigazgatási határát lefedő téglalap – ennél messzebbre nem lehet elgörgetni. */
export const BUDAPEST_BOUNDS = L.latLngBounds([47.349, 18.925], [47.613, 19.335]);
const MVP_BOUNDS = L.latLngBounds([47.476, 19.05], [47.494, 19.078]);

/**
 * A „dark” stílus utcanevei alapból nagyon halványak (#525252 / #666 a sötét alapon) és kicsik.
 * Világosabb, nagyobb, vastagabb körvonalú feliratokat adunk, és a mellékutcák neve
 * már 15-ös nagyítástól látszik (az alap 16).
 */
function readableRules() {
  // A „dark” stílus szürkéit a „Carbon Mint” karbon tónusaihoz hangoljuk (src/theme.ts).
  const flavor = {
    ...namedFlavor("dark"),
    background: MAP_FLAVOR.background,
    earth: MAP_FLAVOR.earth,
    water: MAP_FLAVOR.water,
    park_a: MAP_FLAVOR.park_a,
    park_b: MAP_FLAVOR.park_b,
    wood_a: MAP_FLAVOR.wood_a,
    wood_b: MAP_FLAVOR.wood_b,
    pedestrian: MAP_FLAVOR.pedestrian,
    buildings: MAP_FLAVOR.buildings,
    minor_service: MAP_FLAVOR.minor_service,
    minor_a: MAP_FLAVOR.minor_a,
    minor_b: MAP_FLAVOR.minor_b,
    other: MAP_FLAVOR.other,
    link: MAP_FLAVOR.link,
    major: MAP_FLAVOR.major,
    highway: MAP_FLAVOR.highway,
    minor_service_casing: MAP_FLAVOR.casing,
    minor_casing: MAP_FLAVOR.casing,
    link_casing: MAP_FLAVOR.casing,
    major_casing_early: MAP_FLAVOR.casing,
    major_casing_late: MAP_FLAVOR.casing,
    highway_casing_early: MAP_FLAVOR.casing,
    highway_casing_late: MAP_FLAVOR.casing,
    bridges_minor: MAP_FLAVOR.bridges_minor,
    bridges_major: MAP_FLAVOR.bridges_major,
    bridges_highway: MAP_FLAVOR.bridges_highway,
    boundaries: MAP_FLAVOR.boundaries,
    roads_label_major: MAP_FLAVOR.label_major,
    roads_label_major_halo: MAP_FLAVOR.halo,
    roads_label_minor: MAP_FLAVOR.label_minor,
    roads_label_minor_halo: MAP_FLAVOR.halo,
    city_label: MAP_FLAVOR.label_city,
    city_label_halo: MAP_FLAVOR.halo,
    subplace_label: MAP_FLAVOR.label_sub,
    subplace_label_halo: MAP_FLAVOR.halo,
  };
  const labels = labelRules(flavor, "hu").map((rule) => {
    if (rule.dataLayer !== "roads" || !(rule.symbolizer instanceof LineLabelSymbolizer)) return rule;
    const major = rule.minzoom !== undefined && rule.minzoom < 16;
    return {
      ...rule,
      minzoom: major ? rule.minzoom : 15,
      symbolizer: new LineLabelSymbolizer({
        labelProps: ["name:hu", "name"],
        fill: major ? flavor.roads_label_major : flavor.roads_label_minor,
        stroke: flavor.roads_label_major_halo,
        width: 3,
        font: major ? "600 14px sans-serif" : "500 13px sans-serif",
      }),
    };
  });
  return { paintRules: paintRules(flavor), labelRules: labels, backgroundColor: flavor.background };
}

/** Valódi PMTiles fájl-e az URL mögött? (A fejlesztői szerver hiányzó fájlra index.html-t ad 200-zal.) */
async function isPmtiles(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-6" } });
    if (!res.ok) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    return new TextDecoder().decode(buf.slice(0, 7)) === "PMTiles";
  } catch {
    return false;
  }
}

function addSketch(m: L.Map) {
  L.polygon(DANUBE, { stroke: false, fillColor: MAP_FLAVOR.water, fillOpacity: 0.95, interactive: false }).addTo(m);
  for (const s of STREETS) {
    L.polyline(s.path, {
      color: s.kind === "major" ? MAP_FLAVOR.highway : s.kind === "bridge" ? MAP_FLAVOR.boundaries : MAP_FLAVOR.minor_a,
      weight: s.kind === "major" ? 7 : 4,
      lineCap: "round",
      interactive: false,
    })
      .bindTooltip(s.name, { permanent: true, direction: "center", className: "street-label" })
      .addTo(m);
  }
}

/** Az elérhető legjobb alaptérkép hozzáadása; visszaadja, melyik lett. */
export async function addBaseLayer(m: L.Map): Promise<BaseKind> {
  const custom = (import.meta.env.VITE_PMTILES_URL as string | undefined) || "";
  const candidates: [string, BaseKind][] = [
    ...(custom ? [[custom, "budapest"] as [string, BaseKind]] : []),
    ["./map/budapest.pmtiles", "budapest"],
    ["./map/mvp.pmtiles", "mvp"],
  ];
  for (const [url, kind] of candidates) {
    if (!(await isPmtiles(url))) continue;
    const layer = leafletLayer({
      url,
      ...readableRules(),
      lang: "hu",
      maxDataZoom: 15,
      attribution: OSM_ATTR,
    } as Parameters<typeof leafletLayer>[0]);
    (layer as unknown as L.Layer).addTo(m);
    m.attributionControl.setPrefix(false);
    if (kind === "budapest") {
      m.setMaxBounds(BUDAPEST_BOUNDS.pad(0.05));
      m.setMinZoom(11);
    } else {
      m.setMaxBounds(MVP_BOUNDS.pad(0.6));
      m.setMinZoom(14);
    }
    return kind;
  }

  const tileUrl = (import.meta.env.VITE_TILE_URL as string | undefined) || "";
  if (tileUrl) {
    L.tileLayer(tileUrl, {
      attribution: (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) || "",
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(m);
    return "tiles";
  }
  addSketch(m);
  return "sketch";
}
