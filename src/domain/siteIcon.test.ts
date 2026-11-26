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
    expect(resolvePlaceBadge({ id: "a", info: { iconUrl: own } }, fav, [own])).toMatchObject({ source: "website", credit: "a.hu" });
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

describe("letöltő v2: címváltozatok, átirányítás, manifest, méret, hibák", async () => {
  const f = await import("./favicon");
  const s = await import("./siteIcon");
  it("címváltozatok: eredeti elöl, másik séma, www-vel / nélküle, ismétlés nélkül", () => {
    expect(f.websiteVariants("https://berliner.hu/")).toEqual([
      "https://berliner.hu/",
      "http://berliner.hu/",
      "https://www.berliner.hu/",
      "http://www.berliner.hu/",
    ]);
    expect(f.websiteVariants("http://www.orfeusz98pub.hu/a?b=1")[0]).toBe("http://www.orfeusz98pub.hu/a?b=1");
    expect(f.websiteVariants("http://www.orfeusz98pub.hu/a?b=1")).toContain("https://orfeusz98pub.hu/a?b=1");
    expect(f.websiteVariants("nem url")).toEqual([]);
  });
  it("meta refresh és manifest-hivatkozás", () => {
    expect(f.extractMetaRefresh(`<meta http-equiv="Refresh" content="0; URL='/hu/'">`, "https://x.hu/")).toBe("https://x.hu/hu/");
    expect(f.extractMetaRefresh(`<meta http-equiv="refresh" content="5">`, "https://x.hu/")).toBeUndefined();
    expect(f.extractManifestLink(`<link rel="manifest" href="/site.webmanifest">`, "https://x.hu/a/")).toBe("https://x.hu/site.webmanifest");
  });
  it("manifest ikonok: méret, típus, egyszínű kihagyva; rangsorban az apple-touch-icon után", () => {
    const icons = f.manifestIcons(
      { icons: [{ src: "/android-192.png", sizes: "192x192", type: "image/png" }, { src: "mono.svg", purpose: "monochrome" }, { sizes: "1x1" }] },
      "https://x.hu/m/site.webmanifest",
    );
    expect(icons).toEqual([{ url: "https://x.hu/android-192.png", rel: "manifest", size: 192, type: "image/png" }]);
    expect(f.manifestIcons("nem json", "https://x.hu/")).toEqual([]);
    const ranked = f.rankIconCandidates([...icons, { url: "https://x.hu/a.png", rel: "apple-touch-icon", size: 180 }, { url: "https://x.hu/i.png", rel: "icon", size: 32 }]);
    expect(ranked.map((c) => c.rel)).toEqual(["apple-touch-icon", "manifest", "icon"]);
  });
  it("pixelméret PNG / GIF / ICO fejlécből", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.set([0, 0, 0, 180, 0, 0, 0, 180], 16);
    expect(f.imageDimensions(png, "png")).toEqual({ width: 180, height: 180 });
    const ico = new Uint8Array(6 + 32);
    ico.set([0, 0, 1, 0, 2, 0]);
    ico.set([16, 16], 6);
    ico.set([0, 0], 22); // 0 = 256
    expect(f.imageDimensions(ico, "ico")).toEqual({ width: 256, height: 256 });
    expect(f.imageDimensions(new Uint8Array([71, 73, 70, 56, 57, 97, 32, 0, 32, 0]), "gif")).toEqual({ width: 32, height: 32 });
    expect(f.imageDimensions(new Uint8Array(4), "svg")).toBeUndefined();
  });
  it("hibakategóriák", () => {
    expect(f.classifyFetchError("oldal: fetch failed")).toBe("unreachable");
    expect(f.classifyFetchError("This operation was aborted")).toBe("timeout");
    expect(f.classifyFetchError("https://x.hu/favicon.ico: HTTP 404")).toBe("http");
    expect(f.classifyFetchError("https://x.hu/i.png: nem kép")).toBe("not-image");
    expect(f.classifyFetchError("nincs ikon-jelölt")).toBe("no-icon");
  });
  it("kézi honlap-lista: érvényes címek normalizálva", () => {
    expect(f.parseWebsiteOverrides({ _comment: "x", a: "gravitybp.com", b: { url: "https://x.hu", source: "web" }, c: "ftp://x", d: 5 })).toEqual({
      a: "https://gravitybp.com/",
      b: "https://x.hu/",
    });
  });
  it("felirat és kis ikon jelzése", () => {
    expect(s.creditHost("https://www.berliner.hu/favicon.ico")).toBe("berliner.hu");
    expect(s.creditHost("nem url")).toBeUndefined();
    const fav = s.parseFaviconIndex({ a: { status: "ok", file: "icons/places/a.ico", source: "https://www.a.hu/favicon.ico", width: 16 }, b: { status: "ok", file: "icons/places/b.png", width: 180 } });
    expect(s.resolvePlaceBadge({ id: "a" }, fav)).toEqual({ kind: "image", url: "icons/places/a.ico", source: "website", credit: "a.hu", pixelated: true });
    expect(s.resolvePlaceBadge({ id: "b" }, fav)).toEqual({ kind: "image", url: "icons/places/b.png", source: "website" });
  });
});
