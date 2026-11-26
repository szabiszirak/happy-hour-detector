import { describe, expect, it } from "vitest";
import { isSafeIconUrl, parseFaviconIndex, resolvePlaceBadge } from "./siteIcon";
import {
  candidateScore,
  extractIconLinks,
  faviconFileName,
  normalizeWebsite,
  rankIconCandidates,
  sniffImageType,
} from "./favicon";
import faviconsJson from "../../data/place-favicons.json";

const PAGE = "https://pelda.hu/hu/kezdolap/";
const HTML = `<!doctype html><html><head>
  <link rel="stylesheet" href="/style.css">
  <link rel="icon" type="image/png" sizes="16x16" href="/img/fav-16.png">
  <link rel='icon' type='image/png' sizes='32x32 64x64' href='img/fav-64.png'>
  <LINK REL="shortcut icon" HREF="//cdn.pelda.hu/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2&amp;x=1">
  <link rel="mask-icon" href="/safari.svg" color="#000">
  <link rel="icon" href="javascript:alert(1)">
</head><body></body></html>`;

describe("honlap-cím", () => {
  it("séma pótlása, csak http/https, értelmes host", () => {
    expect(normalizeWebsite("berliner.hu")).toBe("https://berliner.hu/");
    expect(normalizeWebsite("http://www.orfeusz98pub.hu")).toBe("http://www.orfeusz98pub.hu/");
    expect(normalizeWebsite(" https://9kert.hu/muzeumpub/ ")).toBe("https://9kert.hu/muzeumpub/");
    expect(normalizeWebsite("ftp://x.hu")).toBeUndefined();
    expect(normalizeWebsite("localhost")).toBeUndefined();
    expect(normalizeWebsite("")).toBeUndefined();
  });
});

describe("ikon-hivatkozások kinyerése és rangsora", () => {
  const c = extractIconLinks(HTML, PAGE);
  it("abszolút URL-ek, méretek, a hibás séma kihagyva, /favicon.ico tartalék", () => {
    expect(c.map((x) => x.url)).toEqual([
      "https://pelda.hu/img/fav-16.png",
      "https://pelda.hu/hu/kezdolap/img/fav-64.png",
      "https://cdn.pelda.hu/favicon.ico",
      "https://pelda.hu/apple-touch-icon.png?v=2&x=1",
      "https://pelda.hu/safari.svg",
      "https://pelda.hu/favicon.ico",
    ]);
    expect(c[1]).toMatchObject({ rel: "icon", size: 64, type: "image/png" });
    expect(c[3]).toMatchObject({ rel: "apple-touch-icon", size: 180 });
  });
  it("a <base href> szerint old fel", () => {
    const r = extractIconLinks(`<base href="https://masik.hu/a/"><link rel="icon" href="i.png">`, PAGE);
    expect(r[0].url).toBe("https://masik.hu/a/i.png");
  });
  it("rangsor: apple-touch-icon, nagy PNG, … a pici és a maszk-ikon hátul; nincs ismétlés", () => {
    const r = rankIconCandidates([...c, c[0]]);
    expect(r[0].rel).toBe("apple-touch-icon");
    expect(r[1].url).toBe("https://pelda.hu/hu/kezdolap/img/fav-64.png");
    expect(r[r.length - 1].rel).toBe("mask-icon");
    expect(new Set(r.map((x) => x.url)).size).toBe(r.length);
    expect(candidateScore({ url: "a.svg", rel: "icon", size: 0, type: "image/svg+xml" })).toBeGreaterThan(candidateScore({ url: "a.png", rel: "icon", size: 32 }));
  });
  it("üres / ikon nélküli oldalon is ad /favicon.ico tartalékot", () => {
    expect(extractIconLinks("<html></html>", "https://x.hu/aloldal")).toEqual([{ url: "https://x.hu/favicon.ico", rel: "fallback", size: 0 }]);
  });
});

describe("képtípus felismerése és fájlnév", () => {
  it("bájtokból, nem a Content-Type-ból", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffImageType(new Uint8Array([0, 0, 1, 0, 1, 0]))).toBe("ico");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImageType(new TextEncoder().encode('  <?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(sniffImageType(new TextEncoder().encode("<!doctype html><html>"))).toBeUndefined();
  });
  it("biztonságos fájlnév", () => {
    expect(faviconFileName("osm-node-2766675225", "png")).toBe("icons/places/osm-node-2766675225.png");
    expect(faviconFileName("../Web/Púder Bár", "ico")).toBe("icons/places/web-p-der-b-r.ico");
  });
});

describe("csempe: kocsmáros ikon → honlap-ikon → csillag", () => {
  const fav = parseFaviconIndex({
    _comment: "x",
    a: { status: "ok", file: "icons/places/a.png", source: "https://a.hu/favicon.png" },
    b: { status: "ok", file: "https://kulso.hu/favicon.ico" },
    c: { status: "not-found" },
  });
  it("csak helyi fájlra mutató, sikeres bejegyzés számít", () => {
    expect(fav.a).toMatchObject({ status: "ok", file: "icons/places/a.png" });
    expect(fav.b).toBeUndefined();
    expect(fav.c).toEqual({ status: "not-found" });
  });
  it("sorrend és törött kép esetén visszaesés a csillagra", () => {
    const own = "data:image/png;base64,iVBORw0KGgo=";
    expect(resolvePlaceBadge({ id: "a", info: { iconUrl: own } }, fav)).toEqual({ kind: "image", url: own, source: "owner" });
    expect(resolvePlaceBadge({ id: "a", info: { iconUrl: own } }, fav, [own])).toMatchObject({ source: "website", credit: "https://a.hu/favicon.png" });
    expect(resolvePlaceBadge({ id: "a" }, fav, ["icons/places/a.png"])).toEqual({ kind: "sparkle" });
    expect(resolvePlaceBadge({ id: "c" }, fav)).toEqual({ kind: "sparkle" });
    expect(resolvePlaceBadge({ id: "zz" })).toEqual({ kind: "sparkle" });
  });
  it("külső, http vagy veszélyes cím nem jelenik meg", () => {
    expect(isSafeIconUrl("https://kulso.hu/favicon.ico")).toBe(false);
    expect(isSafeIconUrl("http://firebasestorage.googleapis.com/x")).toBe(false);
    expect(isSafeIconUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeIconUrl("icons/places/../../secret.png")).toBe(false);
    expect(isSafeIconUrl("https://firebasestorage.googleapis.com/v0/b/x/o/places%2Fa%2Ficon?alt=media")).toBe(true);
    expect(resolvePlaceBadge({ id: "q", info: { iconUrl: "https://kulso.hu/logo.png" } })).toEqual({ kind: "sparkle" });
  });
  it("a repóban lévő favicon-adatfájl érvényes", () => {
    const parsed = parseFaviconIndex(faviconsJson);
    for (const r of Object.values(parsed)) if (r.status === "ok") expect(isSafeIconUrl(r.file)).toBe(true);
  });
});
