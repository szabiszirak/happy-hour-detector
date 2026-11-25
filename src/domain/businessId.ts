// Hivatalos vállalkozási azonosítók formai ellenőrzése (kocsmáros hitelesítéshez).
// A formai helyesség nem bizonyít jogosultságot – azt az admin ellenőrzi a feltöltött igazolások alapján.

export type IdCheck = { ok: true; normalized: string } | { ok: false; error: string };

/** Adószám ellenőrző számjegyének súlyai (törzsszám 1–7. jegye). */
const TAX_WEIGHTS = [9, 7, 3, 1, 9, 7, 3];

/** Érvényes területi kódok: 02–20 (vármegyék), 22–44 (Budapest, kiemelt), 51 (Kiemelt Adózók). */
function validCountyCode(n: number): boolean {
  return (n >= 2 && n <= 20) || (n >= 22 && n <= 44) || n === 51;
}

/**
 * Magyar adószám: 8 jegyű törzsszám – ÁFA-kód (1–5) – 2 jegyű területi kód, pl. 10625790-4-44.
 * Kötőjel, szóköz és pont nélkül is beírható; a kimenet egységes formátumú.
 */
export function validateTaxNumber(input: string): IdCheck {
  const digits = input.replace(/[\s.\-–]/g, "");
  if (!/^\d+$/.test(digits) || digits.length !== 11)
    return { ok: false, error: "Az adószám 11 számjegy, pl. 12345678-1-42." };
  const d = digits.split("").map(Number);
  const sum = TAX_WEIGHTS.reduce((acc, w, i) => acc + w * d[i], 0);
  const check = (10 - (sum % 10)) % 10;
  if (check !== d[7]) return { ok: false, error: "A törzsszám ellenőrző számjegye nem stimmel – nincs elírás?" };
  if (d[8] < 1 || d[8] > 5) return { ok: false, error: "Az ÁFA-kód (a 9. számjegy) csak 1–5 lehet." };
  if (!validCountyCode(d[9] * 10 + d[10])) return { ok: false, error: "Ismeretlen területi kód (az utolsó két számjegy)." };
  return { ok: true, normalized: `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}` };
}

/**
 * Cégjegyzékszám: cégbíróság (01–20) – cégforma (01–23) – 6 jegyű sorszám, pl. 01-09-123456.
 * Egyéni vállalkozónál nincs – ezért opcionális mező.
 */
export function validateCompanyReg(input: string): IdCheck {
  const digits = input.replace(/[\s.\-–]/g, "");
  if (!/^\d{10}$/.test(digits)) return { ok: false, error: "A cégjegyzékszám formátuma: 01-09-123456." };
  const court = Number(digits.slice(0, 2));
  const form = Number(digits.slice(2, 4));
  if (court < 1 || court > 20) return { ok: false, error: "A cégbírósági kód (első két számjegy) 01–20 lehet." };
  if (form < 1 || form > 23) return { ok: false, error: "Ismeretlen cégforma-kód (3–4. számjegy)." };
  return { ok: true, normalized: `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}` };
}

/** Magyar telefonszám (+36 / 06 előtaggal), egységes „+36 …” alakra hozva. */
export function validatePhone(input: string): IdCheck {
  let digits = input.replace(/[\s()\-/]/g, "");
  if (digits.startsWith("+36")) digits = digits.slice(3);
  else if (digits.startsWith("0036")) digits = digits.slice(4);
  else if (digits.startsWith("06")) digits = digits.slice(2);
  else return { ok: false, error: "Add meg +36 vagy 06 előtaggal." };
  if (!/^\d{8,9}$/.test(digits)) return { ok: false, error: "Hiányos telefonszám." };
  return { ok: true, normalized: `+36 ${digits}` };
}

/** E-mail-cím alapellenőrzése (kisbetűsítve, szóköz nélkül). */
export function validateEmail(input: string): IdCheck {
  const v = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v)) return { ok: false, error: "Adj meg egy érvényes e-mail-címet." };
  return { ok: true, normalized: v };
}
