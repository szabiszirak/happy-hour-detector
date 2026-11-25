import { useMemo, useRef, useState } from "react";
import { useApp } from "../context";
import type { Place } from "../domain/types";
import { validateCompanyReg, validatePhone, validateTaxNumber } from "../domain/businessId";
import {
  buildClaim,
  canSubmitClaim,
  CLAIM_ROLE_LABELS,
  DOC_KIND_LABELS,
  DOC_RETENTION_DAYS,
  documentsError,
  EMPTY_DRAFT,
  UPLOAD_LIMITS,
  validateClaimDraft,
  validateUpload,
  type ClaimDocKind,
  type ClaimDraft,
  type ClaimRole,
  type OwnerClaim,
} from "../domain/ownership";

const STEP_TITLES = ["Vállalkozás adatai", "Igazolások", "Ellenőrzés és beküldés"];
const UPLOAD_KINDS: ClaimDocKind[] = ["storefront", "receipt", "registry"];

/** „Ez az én helyem” – kocsmáros hely-igénylés 3 lépésben. */
export function ClaimFlow({ place, myClaims, onClose }: { place: Place; myClaims: OwnerClaim[]; onClose: () => void }) {
  const { repo, user, owners, toast } = useApp();
  const claimId = useMemo(() => repo.newId("claims"), [repo]);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<ClaimDraft>({ ...EMPTY_DRAFT, contactName: user.displayName });
  const [touched, setTouched] = useState<Partial<Record<keyof ClaimDraft, boolean>>>({});
  const [uploading, setUploading] = useState<ClaimDocKind | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<ClaimDocKind>("storefront");

  const can = canSubmitClaim(user.uid, place.id, myClaims, owners);
  const errors = validateClaimDraft(d);
  const set = (patch: Partial<ClaimDraft>) => setD({ ...d, ...patch });
  const blur = (k: keyof ClaimDraft) => setTouched({ ...touched, [k]: true });
  const err = (k: keyof ClaimDraft) => (touched[k] ? errors[k] : undefined);

  const step1Ok = !errors.role && !errors.businessName && !errors.taxNumber && !errors.companyReg && !errors.contactName && !errors.phone;
  const step2Ok = !documentsError(d.documents);

  const pickFile = (kind: ClaimDocKind) => {
    kindRef.current = kind;
    setUploadErr(null);
    fileRef.current?.click();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const kind = kindRef.current;
    let docs = d.documents;
    setUploading(kind);
    try {
      for (const f of Array.from(files)) {
        const e = validateUpload({ name: f.name, mime: f.type, size: f.size }, docs.length);
        if (e) {
          setUploadErr(`${f.name}: ${e}`);
          continue;
        }
        docs = [...docs, await repo.uploadClaimDocument(user.uid, claimId, f, kind)];
      }
      setD((cur) => ({ ...cur, documents: docs }));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "A feltöltés nem sikerült.");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setTouched({ role: true, businessName: true, taxNumber: true, companyReg: true, contactName: true, phone: true, documents: true, consent: true });
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await repo.submitClaim(buildClaim(d, user, place, claimId, Date.now()));
      toast("Igénylés beküldve – az ellenőrzés állapotát a Kocsmáros felületen látod.");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "A beküldés nem sikerült.");
      setBusy(false);
    }
  };

  const tax = d.taxNumber ? validateTaxNumber(d.taxNumber) : null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet claim" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ez az én helyem">
        <div className="sheet-head">
          <div>
            <span className="muted small">Kocsmáros profil · {place.name}</span>
            <h2>Ez az én helyem</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        {!can.ok ? (
          <p className="check-note">{can.reason}</p>
        ) : (
          <>
            <ol className="claim-steps">
              {STEP_TITLES.map((t, i) => (
                <li key={t} className={i === step ? "on" : i < step ? "done" : ""}>
                  <span>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="claim-body">
                <div className="field">
                  <span>Milyen minőségben igényled?</span>
                  <div className="chips" role="radiogroup">
                    {(Object.keys(CLAIM_ROLE_LABELS) as ClaimRole[]).map((r) => (
                      <button key={r} role="radio" aria-checked={d.role === r} className={`chip ${d.role === r ? "on" : ""}`} onClick={() => set({ role: r })}>
                        {CLAIM_ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                  {err("role") && <em className="field-err">{errors.role}</em>}
                </div>
                <Field label="Vállalkozás neve (ahogy a cégkivonatban / számlán szerepel)" error={err("businessName")}>
                  <input value={d.businessName} onChange={(e) => set({ businessName: e.target.value })} onBlur={() => blur("businessName")} placeholder="pl. Kocsma Kft." />
                </Field>
                <Field
                  label="Adószám"
                  error={err("taxNumber")}
                  ok={tax?.ok ? `Formailag rendben: ${tax.normalized}` : undefined}
                >
                  <input
                    value={d.taxNumber}
                    inputMode="numeric"
                    onChange={(e) => set({ taxNumber: e.target.value })}
                    onBlur={() => blur("taxNumber")}
                    placeholder="12345678-1-42"
                  />
                </Field>
                <Field
                  label="Cégjegyzékszám (egyéni vállalkozónál hagyd üresen)"
                  error={err("companyReg")}
                  ok={d.companyReg && validateCompanyReg(d.companyReg).ok ? "Formailag rendben" : undefined}
                >
                  <input value={d.companyReg} onChange={(e) => set({ companyReg: e.target.value })} onBlur={() => blur("companyReg")} placeholder="01-09-123456" />
                </Field>
                <Field label="Kapcsolattartó neve" error={err("contactName")}>
                  <input value={d.contactName} onChange={(e) => set({ contactName: e.target.value })} onBlur={() => blur("contactName")} />
                </Field>
                <Field label="Telefonszám (csak az ellenőrzéshez)" error={err("phone")} ok={d.phone && validatePhone(d.phone).ok ? "Rendben" : undefined}>
                  <input value={d.phone} type="tel" onChange={(e) => set({ phone: e.target.value })} onBlur={() => blur("phone")} placeholder="+36 30 123 4567" />
                </Field>
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={onClose}>
                    Mégse
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setTouched({ ...touched, role: true, businessName: true, taxNumber: true, companyReg: true, contactName: true, phone: true });
                      if (step1Ok) setStep(1);
                    }}
                  >
                    Tovább
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="claim-body">
                <p className="muted small">
                  Ebből látjuk, hogy a hely valóban a te kezedben van. Kell legalább egy helyszíni fotó, és egy blokk/számla a hely nevével vagy
                  egy cégkivonat. JPG, PNG, WebP vagy PDF, fájlonként max. 5 MB, összesen {UPLOAD_LIMITS.maxFiles} fájl.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  multiple
                  accept={UPLOAD_LIMITS.mimes.join(",")}
                  onChange={(e) => onFiles(e.target.files)}
                  aria-label="Igazolás feltöltése"
                />
                {UPLOAD_KINDS.map((k) => {
                  const docs = d.documents.filter((x) => x.kind === k);
                  return (
                    <div key={k} className="upload-row">
                      <div className="upload-head">
                        <strong>{DOC_KIND_LABELS[k]}</strong>
                        <button className="mini" disabled={uploading !== null || d.documents.length >= UPLOAD_LIMITS.maxFiles} onClick={() => pickFile(k)}>
                          {uploading === k ? "Feltöltés…" : "+ Feltöltés"}
                        </button>
                      </div>
                      {docs.length > 0 && (
                        <ul className="doc-list">
                          {docs.map((x) => (
                            <li key={x.id}>
                              {x.previewUrl ? <img src={x.previewUrl} alt="" /> : <span className="doc-icon">PDF</span>}
                              <span className="doc-name">{x.name}</span>
                              <span className="claim-status uploaded">Feltöltve</span>
                              <button className="icon-btn" aria-label={`${x.name} törlése`} onClick={() => set({ documents: d.documents.filter((y) => y.id !== x.id) })}>
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {uploadErr && <p className="field-err">{uploadErr}</p>}
                {!step2Ok && touched.documents && <p className="field-err">{documentsError(d.documents)}</p>}
                <p className="fine">
                  🔒 Az igazolásokat csak a Happy Hour Detector ellenőrzője látja, a döntés után {DOC_RETENTION_DAYS} nappal töröljük őket.
                </p>
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={() => setStep(0)}>
                    Vissza
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      blur("documents");
                      if (step2Ok) setStep(2);
                    }}
                  >
                    Tovább
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="claim-body">
                <dl className="facts">
                  <dt>Hely</dt>
                  <dd>
                    {place.name} · {place.address}
                  </dd>
                  <dt>Szerep</dt>
                  <dd>{d.role ? CLAIM_ROLE_LABELS[d.role] : "–"}</dd>
                  <dt>Vállalkozás</dt>
                  <dd>{d.businessName}</dd>
                  <dt>Adószám</dt>
                  <dd>{tax?.ok ? tax.normalized : d.taxNumber}</dd>
                  {d.companyReg && (
                    <>
                      <dt>Cégjegyzékszám</dt>
                      <dd>{d.companyReg}</dd>
                    </>
                  )}
                  <dt>Kapcsolattartó</dt>
                  <dd>
                    {d.contactName} · {d.phone}
                  </dd>
                  <dt>Igazolások</dt>
                  <dd>{d.documents.length} fájl</dd>
                </dl>
                <label className="consent">
                  <input type="checkbox" checked={d.consent} onChange={(e) => set({ consent: e.target.checked })} />
                  <span>
                    Kijelentem, hogy jogosult vagyok a hely képviseletére, és a megadott adatok valósak. Tudomásul veszem, hogy a profilt csak
                    ellenőrzés után kapom meg.
                  </span>
                </label>
                {touched.consent && errors.consent && <p className="field-err">{errors.consent}</p>}
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={() => setStep(1)}>
                    Vissza
                  </button>
                  <button className="btn primary" disabled={busy} onClick={submit}>
                    {busy ? "Beküldés…" : "Igénylés beküldése"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, ok, children }: { label: string; error?: string; ok?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${error ? "invalid" : ""}`}>
      <span>{label}</span>
      {children}
      {error ? <em className="field-err">{error}</em> : ok ? <em className="field-ok">✓ {ok}</em> : null}
    </label>
  );
}
