import { describe, expect, it } from "vitest";
import { validateCompanyReg, validatePhone, validateTaxNumber } from "./businessId";

describe("adószám", () => {
  it("valódi formátumú adószámok elfogadva, egységes alakban", () => {
    expect(validateTaxNumber("10625790-4-44")).toEqual({ ok: true, normalized: "10625790-4-44" });
    expect(validateTaxNumber("10537914 4 44")).toEqual({ ok: true, normalized: "10537914-4-44" });
    expect(validateTaxNumber("10537914444")).toEqual({ ok: true, normalized: "10537914-4-44" });
  });
  it("hibás ellenőrző számjegy, ÁFA-kód, területi kód, hossz", () => {
    expect(validateTaxNumber("10625791-4-44").ok).toBe(false);
    const vat = validateTaxNumber("10625790-7-44");
    expect(vat.ok === false && vat.error).toMatch(/ÁFA/);
    const county = validateTaxNumber("10625790-4-21");
    expect(county.ok === false && county.error).toMatch(/területi/);
    expect(validateTaxNumber("1062579-4-44").ok).toBe(false);
    expect(validateTaxNumber("abc").ok).toBe(false);
  });
});

describe("cégjegyzékszám és telefon", () => {
  it("cégjegyzékszám", () => {
    expect(validateCompanyReg("01 09 123456")).toEqual({ ok: true, normalized: "01-09-123456" });
    expect(validateCompanyReg("25-09-123456").ok).toBe(false);
    expect(validateCompanyReg("01-99-123456").ok).toBe(false);
    expect(validateCompanyReg("01-09-1234").ok).toBe(false);
  });
  it("telefon", () => {
    expect(validatePhone("06 30 123 4567")).toEqual({ ok: true, normalized: "+36 301234567" });
    expect(validatePhone("+36 1 234 5678")).toEqual({ ok: true, normalized: "+36 12345678" });
    expect(validatePhone("30 123 4567").ok).toBe(false);
    expect(validatePhone("06 30 12").ok).toBe(false);
  });
});
