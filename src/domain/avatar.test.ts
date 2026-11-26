import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  avatarColor,
  initials,
  isSafeAvatarUrl,
  parseAvatarSettings,
  resolveAvatar,
  validateAvatarFile,
} from "./avatar";

const DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const GOOGLE = "https://lh3.googleusercontent.com/a/abc=s96-c";
const user = { uid: "u1", displayName: "Szabolcs Szirák", email: "sziraksz@gmail.com" };

describe("kezdőbetű", () => {
  it("első és utolsó név-szó, magyar nagybetűvel", () => {
    expect(initials("Szabolcs Szirák")).toBe("SS");
    expect(initials("kati")).toBe("K");
    expect(initials("Tóth Kristóf")).toBe("TK");
    expect(initials("őrsi ádám")).toBe("ŐÁ");
    expect(initials("Nagy Béla János")).toBe("NJ");
  });
  it("rövidítések, írásjelek, emoji kihagyva", () => {
    expect(initials("Dr. Kovács Anna")).toBe("KA");
    expect(initials("🍺 Bence")).toBe("B");
    expect(initials("  ")).toBe("?");
  });
  it("név nélkül az e-mailből, végül „?”", () => {
    expect(initials("", "kati.nagy@pelda.hu")).toBe("KN");
    expect(initials(undefined, "bence99@pelda.hu")).toBe("B");
    expect(initials(undefined, undefined)).toBe("?");
  });
  it("szín: mindig ugyanaz ugyanarra, a palettából", () => {
    expect(avatarColor("u1")).toBe(avatarColor("u1"));
    expect(AVATAR_COLORS).toContain(avatarColor("valaki-mas"));
  });
});

describe("fájl- és cím-ellenőrzés", () => {
  it("csak JPG/PNG/WebP, legfeljebb 5 MB", () => {
    expect(validateAvatarFile({ mime: "image/png", size: 2e6 })).toBeNull();
    expect(validateAvatarFile({ mime: "image/gif", size: 1000 })).toMatch(/JPG/);
    expect(validateAvatarFile({ mime: "image/jpeg", size: 6e6 })).toMatch(/5 MB/);
    expect(validateAvatarFile({ mime: "image/jpeg", size: 0 })).toMatch(/Üres/);
  });
  it("csak saját kép-data URL vagy https cím fogadható el", () => {
    expect(isSafeAvatarUrl(DATA)).toBe(true);
    expect(isSafeAvatarUrl(GOOGLE)).toBe(true);
    expect(isSafeAvatarUrl("http://pelda.hu/kep.jpg")).toBe(false);
    expect(isSafeAvatarUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAvatarUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeAvatarUrl("data:image/jpeg;base64," + "A".repeat(300_000))).toBe(false);
    expect(isSafeAvatarUrl(undefined)).toBe(false);
  });
  it("tárolt beállítás beolvasása: hibás adatnál alapérték, veszélyes cím kiszűrve", () => {
    expect(parseAvatarSettings(null)).toEqual({ pref: "auto" });
    expect(parseAvatarSettings({ pref: "initials" })).toEqual({ pref: "initials" });
    expect(parseAvatarSettings({ pref: "x", custom: { url: "javascript:1", updatedAt: 1 } })).toEqual({ pref: "auto" });
    expect(parseAvatarSettings({ custom: { url: DATA, updatedAt: 5 } })).toEqual({ pref: "auto", custom: { url: DATA, updatedAt: 5 } });
  });
});

describe("melyik avatar látszik", () => {
  it("saját kép → Google-fiók képe → kezdőbetű", () => {
    expect(resolveAvatar({ ...user, photoURL: GOOGLE }, { pref: "auto", custom: { url: DATA, updatedAt: 1 } })).toMatchObject({ kind: "image", source: "custom", url: DATA });
    expect(resolveAvatar({ ...user, photoURL: GOOGLE })).toMatchObject({ kind: "image", source: "provider", url: GOOGLE });
    expect(resolveAvatar(user)).toEqual({ kind: "initials", initials: "SS", color: avatarColor("u1") });
  });
  it("„Csak kezdőbetű” beállításnál akkor is kezdőbetű, ha van kép", () => {
    expect(resolveAvatar({ ...user, photoURL: GOOGLE }, { pref: "initials", custom: { url: DATA, updatedAt: 1 } }).kind).toBe("initials");
  });
  it("be nem töltött kép esetén a következő lehetőség jön", () => {
    const s = { pref: "auto" as const, custom: { url: DATA, updatedAt: 1 } };
    expect(resolveAvatar({ ...user, photoURL: GOOGLE }, s, [DATA])).toMatchObject({ source: "provider" });
    expect(resolveAvatar({ ...user, photoURL: GOOGLE }, s, [DATA, GOOGLE]).kind).toBe("initials");
  });
  it("nem biztonságos fiókkép helyett kezdőbetű", () => {
    expect(resolveAvatar({ ...user, photoURL: "http://nem-https.hu/a.jpg" }).kind).toBe("initials");
  });
});
