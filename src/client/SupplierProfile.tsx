import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { RESERVED, slugify, update, useStore, type SupplierProfile } from "../store";
import { SUPPLIER_CATEGORIES, profileToSupplier } from "../suppliers";
import { Check, Copy, ExternalLink, ImageIcon, Upload } from "../icons";
import { Modal } from "./ui";
import { SupplierCard } from "./Suppliers";
import { readImage } from "./MenuTab";
import { CatalogView } from "./PublicCatalog";

/** Public address of the open service catalog: platform link / business name. */
export const catalogUrl = (slug: string) => `${location.origin}${location.pathname}#/${slug}`;

/** Address + on/off switch for the open (view-only) service catalog. Used in the profile and when sharing from Services. */
export function CatalogLink({ compact, dirty, onSave }: { compact?: boolean; /** the profile has changes that are not saved yet */ dirty?: boolean; onSave?: () => void }) {
  const { t } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const [v, setV] = useState(p.slug || slugify(p.name || s.accounts.find((a) => a.id === s.sessionId)?.company || s.userName));
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const clean = slugify(v);
  const [warn, setWarn] = useState(false);
  useEffect(() => { if (!dirty) setWarn(false); }, [dirty]);
  /** The public page shows what is saved: ask to save first instead of acting. */
  const guard = (e?: { preventDefault: () => void }) => { if (!dirty) return false; e?.preventDefault(); setWarn(true); return true; };
  const save = (open: boolean) => {
    if (guard()) return;
    if (!clean) return setErr(t("cat.err.empty"));
    if (RESERVED.includes(clean)) return setErr(t("cat.err.reserved"));
    setErr(""); update((st) => { st.supplierProfile.slug = clean; st.supplierProfile.catalogOpen = open; });
  };
  const url = catalogUrl(p.slug || clean);
  const copy = async () => { try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className={compact ? "" : "card"} style={compact ? {} : { boxShadow: "none" }}>
      <label htmlFor="cslug">{t("cat.address")}</label>
      <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
        <code className="small nowrap" style={{ background: "var(--soft)", padding: "8px 8px", borderRadius: 8 }}>{location.host}/#/</code>
        <input id="cslug" style={{ flex: 1, minWidth: 140 }} value={v} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} onChange={(e) => { setV(e.target.value); setErr(""); }} onBlur={() => setV(slugify(v))} />
      </div>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>{t("cat.hint")}</p>
      {warn && <div role="alert" className="small" style={{ margin: "0 0 10px", padding: "8px 10px", borderRadius: 8, background: "var(--soft)", border: "1px solid var(--gold)" }}>{t("sprof.unsaved")}{onSave && <> <button type="button" className="sm" style={{ marginLeft: 6 }} onClick={() => { onSave(); setWarn(false); }}>{t("sprof.savenow")}</button></>}</div>}
      {err && <p role="alert" className="small" style={{ color: "var(--danger)", margin: "0 0 8px" }}>{err}</p>}
      {p.catalogOpen && p.slug === clean ? (
        <>
          <div className="row" style={{ flexWrap: "nowrap", gap: 4, marginBottom: 8 }}>
            <code className="small ell" style={{ background: "var(--soft)", padding: "8px 10px", borderRadius: 8, flex: 1 }}>{url}</code>
            <button type="button" className="ghost icon" aria-label={t("gst.copylink")} title={copied ? t("gst.copied") : t("gst.copylink")} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            <a className="ghost btnlike" style={{ padding: "7px 10px" }} href={url} target="_blank" rel="noreferrer" aria-label={t("cat.open")} title={t("cat.open")} onClick={guard}><ExternalLink size={15} /></a>
          </div>
          <p className="small" style={{ color: "var(--teal)", margin: "0 0 8px" }}><Check size={13} style={{ verticalAlign: -2 }} /> {t("cat.on")}</p>
          <button type="button" className="ghost sm" onClick={() => update((st) => { st.supplierProfile.catalogOpen = false; })}>{t("cat.stop")}</button>
        </>
      ) : <button type="button" onClick={() => save(true)}>{p.slug && p.slug !== clean && p.catalogOpen ? t("cat.update") : t("cat.start")}</button>}
      <p className="muted small" style={{ marginBottom: 0 }}>{t("cat.proto")}</p>
    </div>
  );
}

/** Share window opened from the service catalog. */
export function CatalogShare({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return <Modal title={t("cat.share")} onClose={onClose}><p className="muted" style={{ marginTop: 0 }}>{t("cat.share.sub")}</p><CatalogLink compact /><div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button onClick={onClose}>{t("done")}</button></div></Modal>;
}

/** Shows its children laid out at a fixed width (a computer or phone screen) shrunk to fit the column. */
export function Scaled({ width, children, fixed }: { width: number; children: React.ReactNode; /** keep the frame still and scroll the content inside it (a phone) */ fixed?: boolean }) {
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ k: 1, h: 600 });
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current; if (!o || !i) return;
    const f = () => { const k = Math.min(1, o.clientWidth / width); setM({ k, h: i.offsetHeight * k }); };
    f(); const ro = new ResizeObserver(f); ro.observe(o); ro.observe(i); return () => ro.disconnect();
  }, [width]);
  return <div ref={outer} className={`pvview${fixed ? " fixed" : ""}`}><div style={{ height: m.h }}><div ref={inner} className="pvin" style={{ width, transform: `scale(${m.k})` }}>{children}</div></div></div>;
}

/** "Preview" window: how planners and clients will see the saved business profile (or advice to create it first). */
export function ProfilePreviewModal({ onClose, onEdit }: { onClose: () => void; onEdit: () => void }) {
  const { t } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const has = !!p.name.trim();
  const [dev, setDev] = useState<"desktop" | "phone">("desktop");
  return (
    <Modal title={t("svc.pb.preview.title")} onClose={onClose} xl>
      {!has ? (
        <div className="card" style={{ boxShadow: "none", textAlign: "center", padding: 28, margin: "10px auto", maxWidth: 520, borderStyle: "dashed", borderColor: "var(--teal)" }}>
          <h3 style={{ margin: "0 0 6px" }}>{t("svc.pb.none")}</h3>
          <p className="muted">{t("svc.pb.preview.none")}</p>
          <button onClick={() => { onClose(); onEdit(); }}>{t("svc.pb.create")}</button>
        </div>
      ) : (
        <>
          <div className="pvbar" style={{ position: "static" }}>
            <span className="muted small">{t("svc.pb.preview.sub")}</span>
            <div className="seg" role="group" aria-label={t("sprof.pv.device")}>
              <button type="button" aria-pressed={dev === "desktop"} onClick={() => setDev("desktop")}>{t("sprof.pv.desktop")}</button>
              <button type="button" aria-pressed={dev === "phone"} onClick={() => setDev("phone")}>{t("sprof.pv.phone")}</button>
            </div>
          </div>
          <div className={`pvframe${dev === "phone" ? " phone" : " screen"}`} style={{ position: "static", height: "min(66vh, 640px)" }}>
            {dev === "desktop" && <div className="pvchrome" aria-hidden><i /><i /><i /><span>{location.host}/#/{p.slug || "tu-negocio"}</span></div>}
            <Scaled fixed width={dev === "phone" ? 390 : 1200}><CatalogView p={p} name={p.name} logo={s.businessLogo} services={s.services} inert /></Scaled>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Account > Supplier profile: create the profile and preview it as it appears in the suppliers market. */
export default function SupplierProfileTab() {
  const { t, tn } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const acct = s.accounts.find((a) => a.id === s.sessionId);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [warnView, setWarnView] = useState(false);
  const [tab, setTab] = useState(1);
  const [view, setView] = useState<"page" | "card">("page");
  const [dev, setDev] = useState<"desktop" | "phone">("desktop");
  const [f, setF] = useState<SupplierProfile>(() => ({ ...p, name: p.name || acct?.company || "", email: p.email || s.userEmail, phone: p.phone || s.userPhone }));
  const set = (k: Partial<SupplierProfile>) => { setSaved(false); setF({ ...f, ...k }); };
  const pic = async (file: File | undefined) => { if (!file) return; if (!file.type.startsWith("image/")) return setErr(t("menu.imgerr")); try { set({ cover: await readImage(file) }); setErr(""); } catch { setErr(t("menu.imgerr")); } };
  const dirty = (Object.keys(f) as (keyof SupplierProfile)[]).some((k) => k !== "slug" && k !== "catalogOpen" && JSON.stringify(f[k]) !== JSON.stringify(p[k]));
  const doSave = () => { if (!f.name.trim()) return; update((st) => { st.supplierProfile = { ...st.supplierProfile, ...f, name: f.name.trim(), slug: st.supplierProfile.slug, catalogOpen: st.supplierProfile.catalogOpen }; }); setSaved(true); };
  const save = (e: React.FormEvent) => { e.preventDefault(); if (!f.name.trim()) { setTab(1); setErr(t("sprof.name.req")); return; } setErr(""); doSave(); };
  const done = [!!f.name.trim() && !!f.tagline.trim(), f.about.trim().length >= 40 && f.supports.length > 0 && !!f.cover, !!(f.city || f.country) && !!(f.phone || f.email), f.from > 0, p.published || p.catalogOpen];
  const tabs: [number, string][] = [[1, "sprof.s.basics"], [2, "sprof.s.about"], [3, "sprof.s.contact"], [4, "sprof.s.pricing"], [5, "sprof.s.publish"]];
  const cats = f.categories?.length ? f.categories : [f.category];
  const toggleCat = (id: string) => { const n = cats.includes(id) ? cats.filter((x) => x !== id) : [...cats, id]; if (n.length) set({ categories: n, category: n[0] }); };
  const toggle = (id: string) => set({ supports: f.supports.includes(id) ? f.supports.filter((x) => x !== id) : [...f.supports, id] });
  // how complete the public profile is, and what is still missing
  const todo = ([
    [!!f.name.trim(), "sprof.todo.name"], [!!f.tagline.trim(), "sprof.todo.tagline"], [f.about.trim().length >= 40, "sprof.todo.about"], [!!(f.city || f.country), "sprof.todo.place"],
    [!!(f.phone || f.email), "sprof.todo.contact"], [!!f.cover, "sprof.todo.cover"], [f.supports.length > 0, "sprof.todo.supports"],
  ] as [boolean, string][]);
  const pct = Math.round((todo.filter(([ok]) => ok).length / todo.length) * 100);
  const sec = (n: number, title: string, sub: string, body: React.ReactNode) => n !== tab ? null : (
    <fieldset className="spsec"><legend><span className="spnum">{n}</span><span><b>{title}</b><span className="muted small" style={{ display: "block", fontWeight: 400 }}>{sub}</span></span></legend><div style={{ display: "grid", gap: 12 }}>{body}</div></fieldset>
  );
  return (
    <div className="spgrid live">
      <form className="card" onSubmit={save}>
        <div><h3 style={{ margin: 0 }}>{t("account.tab.supplier")}</h3><p className="muted small" style={{ margin: "4px 0 0" }}>{t("sprof.sub")}</p></div>
        <div className="spprog" role="group" aria-label={t("sprof.complete", { n: pct })}>
          <div className="row between small"><b>{t("sprof.complete", { n: pct })}</b></div>
          <div className="spbar"><i style={{ width: pct + "%" }} /></div>
          {pct < 100 && <p className="muted small" style={{ margin: "6px 0 0" }}>{t("sprof.missing")}: {todo.filter(([ok]) => !ok).map(([, k]) => t(k)).join(" · ")}</p>}
        </div>
        <div className="sptabs">
          <nav className="sptabnav" aria-label={t("account.tab.supplier")}>
            {tabs.map(([n, k]) => <button type="button" key={n} className={`sptab${tab === n ? " on" : ""}`} aria-current={tab === n ? "step" : undefined} onClick={() => setTab(n)}><span className="spnum">{done[n - 1] ? <Check size={14} /> : n}</span><span>{t(k)}</span></button>)}
          </nav>
          <div className="spbody">
        {sec(1, t("sprof.s.basics"), t("sprof.s.basics.sub"), <>
          <div><label htmlFor="sn">{t("sprof.name")} *</label><input id="sn" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label htmlFor="stg">{t("sprof.tagline")}</label><input id="stg" maxLength={80} placeholder={t("sprof.ph.tagline")} value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} /><span className="muted small">{f.tagline.length}/80</span></div>
          <div><label>{t("sup.service")} <span className="muted small" style={{ fontWeight: 400 }}>· {t("sprof.cats.hint")}</span></label>
            <div className="row" style={{ gap: 4 }}>{SUPPLIER_CATEGORIES.map((c) => <button type="button" key={c} className={`chip${cats.includes(c) ? " on" : ""}`} aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>{t("supc." + c)}</button>)}</div>
          </div>
        </>)}
        {sec(2, t("sprof.s.about"), t("sprof.s.about.sub"), <>
          <div><label htmlFor="sab">{t("sprof.about")}</label><textarea id="sab" rows={4} maxLength={400} placeholder={t("sprof.ph.about")} value={f.about} onChange={(e) => set({ about: e.target.value })} /><span className="muted small">{f.about.length}/400</span></div>
          <div><label>{t("sup.supports")}</label><div className="row" style={{ gap: 4 }}>{s.eventTypes.map((e) => <button type="button" key={e.id} className={`chip${f.supports.includes(e.id) ? " on" : ""}`} aria-pressed={f.supports.includes(e.id)} onClick={() => toggle(e.id)}>{tn(e.id)}</button>)}</div></div>
          <div><label>{t("sprof.cover")}</label>
            <div className="row" style={{ gap: 8 }}>
              <span className="thumb" style={{ width: 120, height: 70, margin: 0 }}>{f.cover ? <img src={f.cover} alt="" /> : <ImageIcon size={22} className="muted" />}</span>
              <label className="filebtn sm"><Upload size={14} /> {t("menu.upload")}<input type="file" accept="image/*" hidden onChange={(e) => { pic(e.target.files?.[0]); e.target.value = ""; }} /></label>
              <button type="button" className="ghost sm" disabled={!s.businessLogo} title={s.businessLogo ? "" : t("ag.logo.noaccount")} onClick={() => set({ cover: s.businessLogo })}>{t("sprof.cover.logo")}</button>
              {f.cover && <button type="button" className="ghost sm" onClick={() => set({ cover: "" })}>{t("menu.removeimg")}</button>}
            </div>
          </div>
        </>)}
        {sec(3, t("sprof.s.contact"), t("sprof.s.contact.sub"), <>
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sci">{t("account.city")}</label><input id="sci" placeholder={t("sprof.ph.city")} value={f.city} onChange={(e) => set({ city: e.target.value })} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sco">{t("account.country")}</label><input id="sco" placeholder={t("sprof.ph.country")} value={f.country} onChange={(e) => set({ country: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sph">{t("account.phone")}</label><input id="sph" type="tel" placeholder={t("sprof.ph.phone")} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sem">{t("email")}</label><input id="sem" type="email" placeholder={t("sprof.ph.email")} value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="swe">{t("sprof.web")}</label><input id="swe" placeholder={t("sprof.ph.web")} value={f.web} onChange={(e) => set({ web: e.target.value })} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sig">Instagram</label><input id="sig" placeholder={t("sprof.ph.ig")} value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} /></div>
          </div>
        </>)}
        {sec(4, t("sprof.s.pricing"), t("sprof.s.pricing.sub"), <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sti">{t("sup.prices")}</label><select id="sti" value={f.tier} onChange={(e) => set({ tier: Number(e.target.value) as 1 | 2 | 3 })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{"$".repeat(n)}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="sfr">{t("sup.from")} (USD)</label><input id="sfr" type="number" min={0} placeholder={t("sprof.ph.from")} value={f.from || ""} onChange={(e) => set({ from: Math.max(0, Number(e.target.value) || 0) })} /></div>
        </div>)}
        {sec(5, t("sprof.s.publish"), t("sprof.s.publish.sub"), <><label className="row" style={{ gap: 8, margin: 0, color: "var(--ink)" }}><input type="checkbox" style={{ width: "auto" }} checked={f.published} onChange={(e) => set({ published: e.target.checked })} />{t("sprof.publish")}</label><CatalogLink dirty={dirty} onSave={doSave} /></>)}
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
          </div>
        </div>
        <div className="row spsave"><button>{t("save")}</button>{saved && <span role="status" className="row" style={{ color: "var(--teal)", gap: 4 }}><Check size={15} />{t("saved")}</span>}</div>
      </form>
      <div className="spside">
        <div>
          <div className="pvbar">
            <div className="seg" role="group" aria-label={t("sprof.preview")}>
              <button type="button" aria-pressed={view === "page"} onClick={() => setView("page")}>{t("sprof.pv.page")}</button>
              <button type="button" aria-pressed={view === "card"} onClick={() => setView("card")}>{t("sprof.pv.card")}</button>
            </div>
            {view === "page" && <div className="seg" role="group" aria-label={t("sprof.pv.device")}>
              <button type="button" aria-pressed={dev === "desktop"} onClick={() => setDev("desktop")}>{t("sprof.pv.desktop")}</button>
              <button type="button" aria-pressed={dev === "phone"} onClick={() => setDev("phone")}>{t("sprof.pv.phone")}</button>
            </div>}
          </div>
          {view === "page" ? (
            <div className={`pvframe${dev === "phone" ? " phone" : " screen"}`}>
              {dev === "desktop" && <div className="pvchrome" aria-hidden><i /><i /><i /><span>{location.host}/#/{f.name ? f.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "tu-negocio"}</span></div>}
              <Scaled fixed width={dev === "phone" ? 390 : 1200}><CatalogView p={f} name={f.name || acct?.company || s.userName} logo={s.businessLogo} services={s.services} inert /></Scaled>
            </div>
          ) : (
            <div style={{ maxWidth: 400, margin: "0 auto", zoom: 1.35 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>{t("sprof.preview")}</div>
              <SupplierCard x={profileToSupplier({ ...f, name: f.name || t("sprof.name") }, s.businessLogo)} mine />
              <p className="muted small">{f.published ? t("sprof.live") : <>{t("sprof.draft")} <button type="button" className="ghost sm" onClick={() => setTab(5)}>{t("sprof.gotovis")}</button></>}</p>
            </div>
          )}
        </div>
        {p.catalogOpen && p.slug && <>
          {warnView && dirty && <div role="alert" className="small" style={{ padding: "8px 10px", borderRadius: 8, background: "var(--soft)", border: "1px solid var(--gold)" }}>{t("sprof.unsaved")} <button type="button" className="sm" style={{ marginLeft: 6 }} onClick={() => { doSave(); setWarnView(false); }}>{t("sprof.savenow")}</button></div>}
          <a className="btnlike" style={{ justifyContent: "center" }} href={catalogUrl(p.slug)} target="_blank" rel="noreferrer" onClick={(e) => { if (dirty) { e.preventDefault(); setWarnView(true); } }}><ExternalLink size={15} /> {t("sprof.viewpublic")}</a>
        </>}
      </div>
    </div>
  );
}
