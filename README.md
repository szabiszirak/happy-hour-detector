# Happy Hour Detector – MVP

Térképes webapp, amely megmutatja, hol van most happy hour, és hol a legolcsóbb egy adott ital.
Első terület: **Budapest, Fővám tér – Kálvin tér – Corvin negyed – Boráros tér négyszöge**.

Ötlettár és döntések: Google Docs – *Happy Hour Detector – Ötlettár*; a repóban: [docs/otlettar.md](docs/otlettar.md) (marketing és merch).

## Mit tud az MVP

| Funkció | Hol a kódban |
|---|---|
| Google-fiókos belépés + 2 kérdéses ízlésprofil | `src/auth/auth.ts`, `src/components/Onboarding.tsx` |
| Térkép a kocsmákkal: happy hour most / nyitva / zárva szerint színezve | `src/components/MapView.tsx` |
| Egész Budapest saját hosztolású vektoros térképe (Protomaps PMTiles, OSM), kocsmanevek nagy nagyításon | `src/components/baseLayer.ts`, `scripts/download-map.sh` |
| **Kocsmák** fül: a 33 valódi hely távolság szerint, kereséssel, „most nyitva” szűrővel | `src/components/Lists.tsx` |
| Nyitvatartás az OSM `opening_hours` mezőből (éjfélen átnyúló sávokkal) | `src/domain/openingHours.ts` |
| **Happy Hour** fül: most zajlik / hamarosan indul / heti menetrend, visszaszámlálóval | `src/components/Lists.tsx` |
| **Piák & árak** fül: szűrő italstílusra, márkára, max. árra, távolságra, „csak HH”-ra; rendezés Ft/liter, ár, távolság, ízlés szerint | `src/domain/search.ts` |
| Ízlés MatchScore (%) minden helynél | `src/domain/match.ts` |
| Waze-féle bejelentések: 12 óra után lejárnak, megerősíthetők/cáfolhatók | `src/domain/reports.ts`, `PlaceSheet.tsx` |
| „Stimmel” gomb az árakhoz (1 kattintásos ár-megerősítés) | `PlaceSheet.tsx` |
| Bárki szerkesztheti a hely adatait (HH sávok, itallap, árak), új helyet is be lehet küldeni | `PlaceEditor.tsx` |
| Szponzorált helyek külön blokkban, címkével – a rangsort nem befolyásolják | `activeSponsored()` + teszt |
| Idő-szimuláció a demóhoz („mi van pénteken 17:30-kor?”) | `App.tsx` |

## Két üzemmód

- **Demó mód** (alapértelmezett, nincs szükség semmilyen fiókra): kitalált helyek és árak, az adatok a böngészőben tárolódnak, a belépés szimulált.
- **Éles mód**: ha a `.env.local`-ban megvannak a Firebase-kulcsok, valódi Google-belépés és közös Firestore-adatbázis – mindenki ugyanazt látja.

## Élő demó

**https://szabiszirak.github.io/happy-hour-detector/** – minden `main`-re feltöltött változás után automatikusan frissül
(`.github/workflows/deploy-pages.yml`: tesztek → build → közzététel).

A térképen és a **Kocsmák** listában a négyszög **33 valódi helye** látszik (OpenStreetMap + webes kiegészítés,
`data/places.osm.json`), nyitvatartással. Árak és happy hour időpontok még nincsenek – ezeket az appban lehet felvinni.
Demó módban fut: amit felviszel, az csak a saját böngésződben tárolódik (közös adatbázishoz Firebase kell).

## Futtatás

```bash
npm install
npm run dev          # fejlesztői szerver: http://localhost:5173
npm test             # üzleti logika tesztjei (happy hour idősávok, árak, kereső, bejelentések)
npm run build        # éles build a dist/ mappába
npm run build:single # egyetlen HTML fájl (dist-single/index.html) – bemutatóhoz
```

## Éles mód beállítása (Firebase)

1. <https://console.firebase.google.com> → új projekt.
2. **Authentication → Sign-in method → Google** bekapcsolása.
3. **Firestore Database** létrehozása (régió: `europe-central2`, Varsó).
4. **Project settings → Your apps → Web app** → a konfigurációs értékeket másold a `.env.local`-ba (minta: `.env.example`).
5. A `firestore.rules` tartalmát töltsd fel a Firestore → Rules fülre, a `storage.rules`-t a Storage → Rules fülre
   (a Storage-hoz Blaze csomag kell – a kocsmáros-igazolások és helyfotók miatt).
6. Kezdő helyek feltöltése: `node scripts/import-osm.mjs > places.osm.json`, majd importálás a `places` gyűjteménybe.
7. Térkép: egész Budapest vektoros térképe (Protomaps, OpenStreetMap-adatok) – `bash scripts/download-map.sh public/map budapest` letölti a `public/map/budapest.pmtiles` fájlba (a GitHub Pages deploy ezt automatikusan, hetente frissítve teszi meg).
8. Hosting: `npm run build`, majd Firebase Hosting / Netlify / Vercel.

## Adatforrások – fontos

- **Helyek**: OpenStreetMap-import (`scripts/import-osm.mjs`), ezek szabadon tárolhatók (ODbL, hivatkozással).
- **Google**: a Google Places adataiból tartósan csak a `place_id` tárolható (`googlePlaceId` mező) – az útvonal gomb ezzel nyitja meg a helyet a Google Térképen.
- **Árak és happy hour időpontok**: saját begyűjtés (a módszer az ötlettárban nyitott kérdés). Az appban szerkeszthetők.

## Felépítés

```
src/
  domain/      üzleti logika, UI nélkül, tesztelve (types, geo, happyHour, pricing, search, match, reports)
  data/        adatréteg: Repo interfész, LocalRepo (demó), FirebaseRepo (éles), demó adatok
  auth/        belépés: demó vagy Firebase Google
  components/  felület: térkép, fülek, adatlap, szerkesztő, onboarding
firestore.rules  jogosultságok: kocsmáros-hitelesítést (owners) és ital-kiemelést (promotions → active) csak admin állíthat
storage.rules    igazolások (privát: feltöltő + admin), helyfotók (csak az ellenőrzött kocsmáros tölthet fel)
scripts/         OSM-import
```

## Következő lépések (javaslat)

1. Firebase projekt létrehozása → éles mód, első zárt teszt Kristófékkal.
2. Valós helyek importja az MVP-négyszögből + árak begyűjtése (döntés kell a módszerről).
3. Kocsmáros „Ez az én helyem” igénylés és admin felület a szponzorációhoz.
4. Jelvények (Árvadász, Kocsmamester) a már gyűjtött megerősítésekből.
5. Jogi kör: ÁSZF, adatvédelem (ízlésprofil = személyes adat), 18+ korhatár, alkoholreklám-szabályok.

## Kocsmáros profil és ital-kiemelés (éles mód)

- **Fiókok:** egy Google-fiók vendég és kocsmáros fiókként is használható (fiókváltás a menüben, eszközönként megjegyezve).
  A kocsmáros fiók (`users/{uid}.ownerAccount`: kapcsolattartó e-mail + feltételek elfogadása) önkiszolgáló, és önmagában
  semmilyen jogot nem ad: „Ez az én helyem” csak kocsmáros fiókban látszik, igényelni csak kocsmáros fiókkal lehet
  (firestore.rules), szerkeszteni / kiemelést kérni csak kocsmáros fiókban és csak az admin által ellenőrzött helyen.

- **Admin jog:** Firebase Auth custom claim (`admin: true`), csak szerverről állítható, pl. Admin SDK-val:
  `admin.auth().setCustomUserClaims(uid, { admin: true })`. Az app a menüben ekkor mutatja az „Admin – ellenőrzés” felületet.
- **Igénylés:** `claims/{id}` mindig `pending` állapotban jön létre; jóváhagyáskor az admin írja az `owners/{placeId}` dokumentumot.
  Kliensről senki nem tudja magát hitelesíteni (firestore.rules).
- **Kiemelés:** a kocsmáros `requested` kérést küld; `active`-ra csak admin állíthatja a díj rendezése után.
  Később: fizetési webhook (Barion / Stripe) → Cloud Function aktiválja.
- **Adatvédelem – TODO:** ütemezett Cloud Function, ami a döntés után 30 nappal törli a `claims/{uid}/{claimId}/` igazolásokat
  (`documentsExpired` a domain/ownership.ts-ben). Demó módban ezt a LocalRepo betöltéskor elvégzi.
