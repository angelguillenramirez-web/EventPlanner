import { useState } from "react";
import { useT } from "../i18n";
import { RESERVED, slugify, update, useStore, type SupplierProfile } from "../store";
import { SUPPLIER_CATEGORIES, profileToSupplier } from "../suppliers";
import { Check, Copy, ExternalLink, ImageIcon, Upload } from "../icons";
import { Modal } from "./ui";
import { SupplierCard } from "./Suppliers";
import { readImage } from "./MenuTab";

/** Public address of the open service catalog: platform link / business name. */
export const catalogUrl = (slug: string) => `${location.origin}${location.pathname}#/${slug}`;

/** Address + on/off switch for the open (view-only) service catalog. Used in the profile and when sharing from Services. */
export function CatalogLink({ compact }: { compact?: boolean }) {
  const { t } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const [v, setV] = useState(p.slug || slugify(p.name || s.accounts.find((a) => a.id === s.sessionId)?.company || s.userName));
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const clean = slugify(v);
  const save = (open: boolean) => {
    if (!clean) return setErr(t("cat.err.empty"));
    if (RESERVED.includes(clean)) return setErr(t("cat.err.reserved"));
    setErr(""); update((st) => { st.supplierProfile.slug = clean; st.supplierProfile.catalogOpen = open; });
  };
  const url = catalogUrl(p.slug || clean);
  const copy = async () => { try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className={compact ? "" : "card"} style={compact ? {} : { boxShadow: "none" }}>
      <label htmlFor="cslug">{t("cat.address")}</label>
      <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
        <code className="small nowrap" style={{ background: "var(--soft)", padding: "8px 8px", borderRadius: 8 }}>{location.host}/#/</code>
        <input id="cslug" value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} onBlur={() => setV(slugify(v))} />
      </div>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>{t("cat.hint")}</p>
      {err && <p role="alert" className="small" style={{ color: "var(--danger)", margin: "0 0 8px" }}>{err}</p>}
      {p.catalogOpen && p.slug === clean ? (
        <>
          <div className="row" style={{ flexWrap: "nowrap", gap: 4, marginBottom: 8 }}>
            <code className="small ell" style={{ background: "var(--soft)", padding: "8px 10px", borderRadius: 8, flex: 1 }}>{url}</code>
            <button className="ghost icon" aria-label={t("gst.copylink")} title={copied ? t("gst.copied") : t("gst.copylink")} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            <a className="ghost btnlike" style={{ padding: "7px 10px" }} href={url} target="_blank" rel="noreferrer" aria-label={t("cat.open")} title={t("cat.open")}><ExternalLink size={15} /></a>
          </div>
          <p className="small" style={{ color: "var(--teal)", margin: "0 0 8px" }}><Check size={13} style={{ verticalAlign: -2 }} /> {t("cat.on")}</p>
          <button className="ghost sm" onClick={() => update((st) => { st.supplierProfile.catalogOpen = false; })}>{t("cat.stop")}</button>
        </>
      ) : <button onClick={() => save(true)}>{p.slug && p.slug !== clean && p.catalogOpen ? t("cat.update") : t("cat.start")}</button>}
      <p className="muted small" style={{ marginBottom: 0 }}>{t("cat.proto")}</p>
    </div>
  );
}

/** Share window opened from the service catalog. */
export function CatalogShare({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return <Modal title={t("cat.share")} onClose={onClose}><p className="muted" style={{ marginTop: 0 }}>{t("cat.share.sub")}</p><CatalogLink compact /><div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button onClick={onClose}>{t("done")}</button></div></Modal>;
}

/** Account > Supplier profile: create the profile and preview it as it appears in the suppliers market. */
export default function SupplierProfileTab() {
  const { t, tn } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const acct = s.accounts.find((a) => a.id === s.sessionId);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState<SupplierProfile>(() => ({ ...p, name: p.name || acct?.company || "", email: p.email || s.userEmail, phone: p.phone || s.userPhone }));
  const set = (k: Partial<SupplierProfile>) => { setSaved(false); setF({ ...f, ...k }); };
  const pic = async (file: File | undefined) => { if (!file) return; if (!file.type.startsWith("image/")) return setErr(t("menu.imgerr")); try { set({ cover: await readImage(file) }); setErr(""); } catch { setErr(t("menu.imgerr")); } };
  const save = (e: React.FormEvent) => { e.preventDefault(); if (!f.name.trim()) return; update((st) => { st.supplierProfile = { ...st.supplierProfile, ...f, name: f.name.trim(), slug: st.supplierProfile.slug, catalogOpen: st.supplierProfile.catalogOpen }; }); setSaved(true); };
  const toggle = (id: string) => set({ supports: f.supports.includes(id) ? f.supports.filter((x) => x !== id) : [...f.supports, id] });
  return (
    <div className="spgrid">
      <form className="card" onSubmit={save} style={{ display: "grid", gap: 12 }}>
        <div><h3 style={{ margin: 0 }}>{t("account.tab.supplier")}</h3><p className="muted small" style={{ margin: "4px 0 0" }}>{t("sprof.sub")}</p></div>
        <label className="row" style={{ gap: 8, margin: 0, color: "var(--ink)" }}><input type="checkbox" style={{ width: "auto" }} checked={f.published} onChange={(e) => set({ published: e.target.checked })} />{t("sprof.publish")}</label>
        <div><label htmlFor="sn">{t("sprof.name")} *</label><input id="sn" required value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><label htmlFor="scat">{t("sup.service")}</label><select id="scat" value={f.category} onChange={(e) => set({ category: e.target.value })}>{SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c}>{t("supc." + c)}</option>)}</select></div>
        <div><label htmlFor="stg">{t("sprof.tagline")}</label><input id="stg" maxLength={80} value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} /></div>
        <div><label htmlFor="sab">{t("sprof.about")}</label><textarea id="sab" rows={4} maxLength={400} value={f.about} onChange={(e) => set({ about: e.target.value })} /></div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sci">{t("account.city")}</label><input id="sci" value={f.city} onChange={(e) => set({ city: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sco">{t("account.country")}</label><input id="sco" value={f.country} onChange={(e) => set({ country: e.target.value })} /></div>
        </div>
        <div><label>{t("sup.supports")}</label><div className="row" style={{ gap: 4 }}>{s.eventTypes.map((e) => <button type="button" key={e.id} className={`chip${f.supports.includes(e.id) ? " on" : ""}`} aria-pressed={f.supports.includes(e.id)} onClick={() => toggle(e.id)}>{tn(e.id)}</button>)}</div></div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sti">{t("sup.prices")}</label><select id="sti" value={f.tier} onChange={(e) => set({ tier: Number(e.target.value) as 1 | 2 | 3 })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{"$".repeat(n)}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sfr">{t("sup.from")} (USD)</label><input id="sfr" type="number" min={0} value={f.from} onChange={(e) => set({ from: Math.max(0, Number(e.target.value) || 0) })} /></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sph">{t("account.phone")}</label><input id="sph" type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sem">{t("email")}</label><input id="sem" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="swe">{t("sprof.web")}</label><input id="swe" value={f.web} onChange={(e) => set({ web: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="sig">Instagram</label><input id="sig" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} /></div>
        </div>
        <div><label>{t("sprof.cover")}</label>
          <div className="row" style={{ gap: 8 }}>
            <span className="thumb" style={{ width: 120, height: 70, margin: 0 }}>{f.cover ? <img src={f.cover} alt="" /> : <ImageIcon size={22} className="muted" />}</span>
            <label className="filebtn sm"><Upload size={14} /> {t("menu.upload")}<input type="file" accept="image/*" hidden onChange={(e) => { pic(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button type="button" className="ghost sm" disabled={!s.businessLogo} title={s.businessLogo ? "" : t("ag.logo.noaccount")} onClick={() => set({ cover: s.businessLogo })}>{t("sprof.cover.logo")}</button>
            {f.cover && <button type="button" className="ghost sm" onClick={() => set({ cover: "" })}>{t("menu.removeimg")}</button>}
          </div>
        </div>
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
        <div className="row"><button>{t("save")}</button>{saved && <span role="status" className="row" style={{ color: "var(--teal)", gap: 4 }}><Check size={15} />{t("saved")}</span>}</div>
      </form>
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div>
          <div className="muted small" style={{ marginBottom: 6 }}>{t("sprof.preview")}</div>
          <SupplierCard x={profileToSupplier({ ...f, name: f.name || t("sprof.name") })} mine />
          <p className="muted small">{f.published ? t("sprof.live") : t("sprof.draft")}</p>
        </div>
        <CatalogLink />
      </div>
    </div>
  );
}
