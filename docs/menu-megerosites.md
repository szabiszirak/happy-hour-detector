# Étlap-megerősítés – belső lista (nem jelenik meg az appban)

> Felvéve: 2026-11-26. Döntés: a közös repó `scrape_556/` és `menus/` mappájában lévő, a Google Térképről gyűjtött
> adatokat (vélemények, értékelések, étlapfotók és az ezekből AI-val kiolvasott árak) **nem vesszük át az appba**.
> Ok: a projekt szabálya (Google-ből csak `place_id`), a Google Térkép felhasználási feltételei, a véleményírók neve
> személyes adat, és a régi / hibásan kiolvasott ár valódinak tűnne.
>
> Helyettük: **saját értékelések** az appban (1–5 csillag + szöveg) és egy „Google-értékelések megnyitása” link;
> az árakat pedig a helyektől kérjük el megerősítésre.

## Kit keresünk meg

Az alábbi 5 helyről van kinyert étlap a közös repóban (`menus/extracted_menu_items.json`). Az árakat **nem** másoljuk
ide – csak azt jegyezzük, mennyi tételt kellene megerősíttetni.

| Hely | App-azonosító | Cím | Kinyert tételek | MVP-terület |
|---|---|---|---|---|
| MONYO Tap House | `osm-node-6403982785` | Kálvin tér 7 | 73 ital | igen |
| Jedermann Café | `web-jedermanncafe` | Ráday utca 58 | 66 ital, 53 étel | igen |
| BarCraft Esport Bár | `osm-node-4290484184` | Ferenc körút 34 | 24 ital | igen |
| Púder Bárszínház | `web-puderbarszinhaz` | Ráday utca 8 | 38 étel | igen |
| For Sale Pub | `osm-node-2705477650` | Vámház körút 2 | 65 étel | nem (szomszédos) |

## A folyamat

1. **Megkeresés** – e-mail vagy személyesen (minta lent). Ha van, a `partners/partner_list.md` mintája szerint.
2. **Kocsmáros fiók** – a hely képviselője belép „kocsmáros fiókkal”, a helyen „Ez az én helyem” → igazolás.
3. **Itallap feltöltése** – ellenőrzött kocsmárosként a Szerkesztés gombbal (italok, árak, happy hour sávok).
   Segítség: a közös repóbeli kinyert listát elküldhetjük nekik **ellenőrzésre** („ezt látjuk – stimmel?”),
   de az appba csak az kerül, amit ők rögzítenek / jóváhagynak.
4. **Megjelenés** – az árak „✓ Kocsmáros által ellenőrzött” helyen jelennek meg; a közösség a „Stimmel” gombbal
   és bejelentésekkel jelzi a változást.

## Megkereső levél (minta)

> **Tárgy:** Happy Hour Detector – megjelenítenénk az itallapotokat
>
> Sziasztok!
>
> A Happy Hour Detector egy budapesti diákoknak és baráti társaságoknak szóló térképes app (Kálvin tér – Corvin –
> Boráros tér környéke), ami megmutatja, hol van épp happy hour és mennyibe kerül egy korsó. Szeretnénk a ti helyetek
> itallapját is pontosan megjeleníteni.
>
> Ha van egy perc: a kocsmáros felületen (ingyenes) ti magatok tudjátok feltölteni és frissen tartani az árakat és a
> happy hour időpontokat, és a helyetek „Kocsmáros által ellenőrzött” jelölést kap. Ha egyszerűbb, egy aktuális
> itallap-fotó vagy PDF is elég, és mi rögzítjük – megjelenés előtt átküldjük jóváhagyásra.
>
> Köszönjük!
> [név] – Happy Hour Detector csapat

## Javaslat a közös repóhoz (egyeztetendő Kristóffal)

- A `scrape_556/budapest_reviews_sample.csv` véleményírói nevei és a Google-os kép- / térképlinkek személyes,
  illetve harmadik féltől származó adatok – érdemes törölni, vagy legalább nem tovább terjeszteni.
- A `menus/` lista csak belső, ellenőrzésre küldhető munkaanyagként használható.
