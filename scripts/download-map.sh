#!/usr/bin/env bash
# Budapest vektoros térképének letöltése a Protomaps napi buildjéből (OpenStreetMap-adatok, PMTiles formátum).
#
# Használat:  scripts/download-map.sh <kimeneti mappa> [budapest|mvp|all]
#   budapest – egész Budapest (deploykor, a GitHub Pages-re; nem kerül a gitbe)
#   mvp      – csak a négyszög környéke, kis fájl (fejlesztéshez, tesztekhez; a repóban: public/map/mvp.pmtiles)
#
# Kell hozzá: curl, és vagy a `pmtiles` parancs, vagy a `gh` CLI (GitHub Actionsben megvan) a letöltéséhez.
set -euo pipefail

OUT="${1:?Kimeneti mappa kell}"
WHAT="${2:-all}"
mkdir -p "$OUT"

# Budapest közigazgatási határát lefedő téglalap (minLon,minLat,maxLon,maxLat)
BUDAPEST_BBOX="18.925,47.349,19.335,47.613"
# A Fővám tér – Kálvin tér – Corvin negyed – Boráros tér négyszög, kis ráhagyással
MVP_BBOX="19.050,47.476,19.078,47.494"

# 1) pmtiles CLI
if ! command -v pmtiles >/dev/null 2>&1; then
  TMP="$(mktemp -d)"
  echo "pmtiles CLI letöltése…"
  gh release download --repo protomaps/go-pmtiles --pattern '*_Linux_x86_64.tar.gz' --dir "$TMP"
  tar -xzf "$TMP"/*.tar.gz -C "$TMP"
  PMTILES="$TMP/pmtiles"
else
  PMTILES="$(command -v pmtiles)"
fi

# 2) a legfrissebb elérhető napi build (a nevük dátum: ÉÉÉÉHHNN.pmtiles)
BUILD=""
for i in $(seq 0 20); do
  D="$(date -u -d "-$i day" +%Y%m%d)"
  URL="https://build.protomaps.com/$D.pmtiles"
  if curl -sfI --max-time 20 "$URL" >/dev/null; then BUILD="$URL"; break; fi
done
if [ -z "$BUILD" ]; then echo "Nem találtam elérhető Protomaps buildet az elmúlt 3 hétből." >&2; exit 1; fi
echo "Forrás: $BUILD"

extract () { # név, bbox
  local name="$1" bbox="$2"
  for attempt in 1 2 3; do
    if "$PMTILES" extract "$BUILD" "$OUT/$name.pmtiles" --bbox="$bbox" --download-threads=4; then
      ls -la "$OUT/$name.pmtiles"
      return 0
    fi
    rm -f "$OUT/$name.pmtiles"
    echo "Kivágás sikertelen ($attempt. próba), újra…" >&2
    sleep $((attempt * 15))
  done
  return 1
}

case "$WHAT" in
  budapest) extract budapest "$BUDAPEST_BBOX" ;;
  mvp) extract mvp "$MVP_BBOX" ;;
  all) extract budapest "$BUDAPEST_BBOX"; extract mvp "$MVP_BBOX" ;;
  *) echo "Ismeretlen: $WHAT" >&2; exit 2 ;;
esac

# forrás-információ a térkép hivatkozásához
echo "{\"source\":\"$BUILD\",\"downloadedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$OUT/map-source.json"
