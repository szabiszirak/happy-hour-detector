// Honlap-ikonok (favicon) letöltése a helyek weboldaláról → public/icons/places/ + data/place-favicons.json
//
// Futtatás (internetkapcsolattal):   npm run icons:fetch [-- --only <hely-id>] [-- --force] [-- --dry-run]
// GitHub Actions-ben:                 .github/workflows/fetch-favicons.yml („Honlap-ikonok frissítése”)
//
// A felderítés logikája (HTML-ből kinyerés, rangsor, fájltípus) a src/domain/favicon.ts-ben van, unit tesztekkel.
// A képeket saját mappába mentjük – a felhasználók böngészője így nem kér semmit közvetlenül a kocsmák oldaláról.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractIconLinks,
  FAVICON_MAX_BYTES,
  faviconFileName,
  normalizeWebsite,
  rankIconCandidates,
  sniffImageType,
  type FaviconIndex,
  type FaviconRecord,
} from "../src/domain/favicon";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = join(ROOT, "data/place-favicons.json");
const PUBLIC = join(ROOT, "public");
const UA = "HappyHourDetector-favicon/1.0 (+https://github.com/szabiszirak/happy-hour-detector)";
const PAGE_MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 2;
const PAUSE_MS = 1000;

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

interface Site {
  id: string;
  name: string;
  website: string;
}

function loadSites(): Site[] {
  const read = (f: string) => {
    try {
      return JSON.parse(readFileSync(join(ROOT, f), "utf8"));
    } catch {
      return [];
    }
  };
  const osm = read("data/places.osm.json") as { id: string; name: string; osm?: { website?: string } }[];
  const web = read("data/places.web.json") as { id?: string; name: string; website?: string }[];
  const all = [
    ...osm.map((p) => ({ id: p.id, name: p.name, website: p.osm?.website })),
    // a webes kiegészítések az import után OSM-azonosítót kapnak; itt csak akkor számítanak, ha van saját id-jük
    ...web.filter((p) => p.id).map((p) => ({ id: p.id!, name: p.name, website: p.website })),
  ];
  return all.flatMap((p) => {
    const website = normalizeWebsite(p.website);
    return website ? [{ id: p.id, name: p.name, website }] : [];
  });
}

/** Letöltés időkorláttal és mérethatárral. */
async function get(url: string, maxBytes: number, accept: string): Promise<{ bytes: Uint8Array; finalUrl: string; type: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new Error(`túl nagy (${len} B)`);
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) {
          ctrl.abort();
          throw new Error("túl nagy");
        }
        chunks.push(value);
      }
    const bytes = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) (bytes.set(c, o), (o += c.length));
    return { bytes, finalUrl: res.url || url, type: res.headers.get("content-type") ?? "" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchIcon(site: Site): Promise<FaviconRecord> {
  const fetchedAt = new Date().toISOString();
  let page: { bytes: Uint8Array; finalUrl: string };
  try {
    page = await get(site.website, PAGE_MAX_BYTES, "text/html,application/xhtml+xml");
  } catch (e) {
    return { status: "error", page: site.website, error: `oldal: ${(e as Error).message}`, fetchedAt };
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(page.bytes);
  const candidates = rankIconCandidates(extractIconLinks(html, page.finalUrl));
  const errors: string[] = [];
  for (const c of candidates.slice(0, 6)) {
    try {
      const img = await get(c.url, FAVICON_MAX_BYTES, "image/*");
      const kind = sniffImageType(img.bytes);
      if (!kind) {
        errors.push(`${c.url}: nem kép`);
        continue;
      }
      if (img.bytes.length < 64) {
        errors.push(`${c.url}: túl kicsi`);
        continue;
      }
      const file = faviconFileName(site.id, kind);
      if (!dryRun) {
        mkdirSync(join(PUBLIC, dirname(file)), { recursive: true });
        writeFileSync(join(PUBLIC, file), img.bytes);
      }
      return {
        status: "ok",
        file,
        source: img.finalUrl,
        page: page.finalUrl,
        bytes: img.bytes.length,
        sha256: createHash("sha256").update(img.bytes).digest("hex"),
        fetchedAt,
      };
    } catch (e) {
      errors.push(`${c.url}: ${(e as Error).message}`);
    }
  }
  return { status: "not-found", page: page.finalUrl, error: errors.slice(0, 3).join(" | ") || "nincs ikon-jelölt", fetchedAt };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const existing: FaviconIndex & { _comment?: string } = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, "utf8")) : {};
  const sites = loadSites().filter((s) => !only || s.id === only);
  const queue = sites.filter((s) => {
    const prev = existing[s.id] as FaviconRecord | undefined;
    if (prev?.status === "disabled") return false; // a hely kérte / kézzel kikapcsolva
    return force || prev?.status !== "ok";
  });
  console.log(`${sites.length} hely honlappal, ebből ${queue.length} feldolgozandó${dryRun ? " (próbafutás)" : ""}.`);

  const results: Record<string, FaviconRecord> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        const site = queue[next++];
        const r = await fetchIcon(site);
        results[site.id] = r;
        console.log(`${r.status === "ok" ? "✓" : "–"} ${site.name}: ${r.status === "ok" ? r.file : r.error}`);
        await sleep(PAUSE_MS);
      }
    }),
  );

  // régi fájl törlése, ha más kiterjesztéssel jött az új
  for (const [id, r] of Object.entries(results)) {
    const old = existing[id] as FaviconRecord | undefined;
    if (!dryRun && old?.file && old.file !== r.file && existsSync(join(PUBLIC, old.file))) unlinkSync(join(PUBLIC, old.file));
  }

  const merged: Record<string, unknown> = { _comment: existing._comment };
  for (const id of Object.keys({ ...existing, ...results }).filter((k) => !k.startsWith("_")).sort())
    merged[id] = results[id] ?? existing[id];
  if (!dryRun) writeFileSync(OUT_JSON, JSON.stringify(merged, null, 2) + "\n");
  const ok = Object.values(results).filter((r) => r.status === "ok").length;
  console.log(`Kész: ${ok} ikon letöltve, ${Object.keys(results).length - ok} helyen marad a csillag.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
