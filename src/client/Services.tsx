import { useState } from "react";
import { useT } from "../i18n";
import { SERVICE_CATEGORIES, uid, update, useStore, type PriceModel, type Service } from "../store";
import { BriefcaseBusiness, Share2, Copy, ImageIcon, Pencil, Plus, Star, Trash2 } from "../icons";
import { Modal } from "./ui";
import { CatalogShare } from "./SupplierProfile";
import { readImage } from "./MenuTab";
import { ask } from "./Ask";

const MODELS: PriceModel[] = ["fixed", "hourly", "perGuest", "quote"];
const money = (n: number, locale: string) => "$" + n.toLocaleString(locale, { maximumFractionDigits: 2 });

function ServiceModal({ svc, onClose }: { svc?: Service; onClose: () => void }) {
  const s = useStore();
  const { t, tn } = useT();
  const [f, setF] = useState({ name: svc?.name ?? "", category: svc?.category ?? "planning", description: svc?.description ?? "", priceModel: (svc?.priceModel ?? "fixed") as PriceModel, price: svc?.price ?? 0, duration: svc?.duration ?? "", includes: (svc?.includes ?? []).join("\n"), eventTypes: svc?.eventTypes ?? [], active: svc?.active ?? true, featured: svc?.featured ?? false, image: svc?.image ?? "" });
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const v = { ...f, name: f.name.trim(), description: f.description.trim(), duration: f.duration.trim(), price: f.priceModel === "quote" ? 0 : Math.max(0, Number(f.price) || 0), includes: f.includes.split("\n").map((x) => x.trim()).filter(Boolean) };
    update((st) => { if (svc) Object.assign(st.services.find((x) => x.id === svc.id)!, v); else st.services.push({ id: uid(), createdAt: Date.now(), ...v }); });
    onClose();
  };
  const pick = async (file?: File) => { if (!file) return; try { const image = await readImage(file); setF((x) => ({ ...x, image })); setErr(""); } catch { setErr(t("menu.imgerr")); } };
  return (
    <Modal title={svc ? t("svc.edit") : t("svc.new")} onClose={onClose} wide>
      <form onSubmit={submit} className="form">
        <div className="full"><label htmlFor="sn1">{t("svc.name")} *</label><input id="sn1" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="sc1">{t("svc.category")}</label><select id="sc1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{t("svcc." + c)}</option>)}</select></div>
        <div><label htmlFor="sd1">{t("svc.duration")}</label><input id="sd1" value={f.duration} placeholder={t("svc.duration.ph")} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
        <div className="full"><label htmlFor="sx1">{t("description")}</label><textarea id="sx1" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><label htmlFor="sm1">{t("svc.pricing")}</label><select id="sm1" value={f.priceModel} onChange={(e) => setF({ ...f, priceModel: e.target.value as PriceModel })}>{MODELS.map((m) => <option key={m} value={m}>{t("svcp." + m)}</option>)}</select></div>
        <div><label htmlFor="sp1">{t("svc.price")}</label><input id="sp1" type="number" min={0} step="0.01" disabled={f.priceModel === "quote"} value={f.priceModel === "quote" ? "" : f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></div>
        <div className="full"><label htmlFor="si1">{t("svc.includes")}</label><textarea id="si1" rows={4} value={f.includes} placeholder={t("svc.includes.ph")} onChange={(e) => setF({ ...f, includes: e.target.value })} /></div>
        <div className="full"><label>{t("svc.eventtypes")}</label>
          <div className="row">{s.eventTypes.map((e) => <label key={e.id} className="row small" style={{ margin: 0, color: "var(--ink)", gap: 4 }}><input type="checkbox" checked={f.eventTypes.includes(e.id)} onChange={() => setF({ ...f, eventTypes: f.eventTypes.includes(e.id) ? f.eventTypes.filter((x) => x !== e.id) : [...f.eventTypes, e.id] })} />{tn(e.id)}</label>)}</div>
          <div className="muted small">{t("svc.eventtypes.hint")}</div>
        </div>
        <div className="full"><label>{t("menu.image")}</label>
          <div className="row" style={{ gap: 12 }}>
            <div className="menuimg">{f.image ? <img src={f.image} alt="" /> : <ImageIcon size={26} className="muted" />}</div>
            <label className="ghost" style={{ display: "inline-block", padding: "8px 14px", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", margin: 0, color: "var(--ink)" }}>{t("menu.upload")}<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
            {f.image && <button type="button" className="ghost sm" onClick={() => setF({ ...f, image: "" })}>{t("menu.removeimg")}</button>}
          </div>
          {err && <div className="small" style={{ color: "var(--danger)" }}>{err}</div>}
        </div>
        <div className="row full">
          <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />{t("svc.active")}</label>
          <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} />{t("svc.featured")}</label>
        </div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{svc ? t("save") : t("add")}</button></div>
      </form>
    </Modal>
  );
}

/** Service Catalog: the planner personalises the services offered to clients. */
export default function Services() {
  const s = useStore();
  const { t, tn, locale } = useT();
  const [modal, setModal] = useState<{ svc?: Service } | null>(null);
  const [share, setShare] = useState(false);
  const [cat, setCat] = useState("");
  const [state, setState] = useState<"" | "active" | "hidden">("");
  const [q, setQ] = useState("");
  const list = s.services.filter((x) => (!cat || x.category === cat) && (!state || (state === "active") === x.active) && (!q.trim() || (x.name + " " + x.description).toLowerCase().includes(q.trim().toLowerCase())));
  const price = (x: Service) => (x.priceModel === "quote" ? t("svcp.quote") : `${money(x.price, locale)}${x.priceModel === "hourly" ? ` / ${t("svc.hr")}` : x.priceModel === "perGuest" ? ` / ${t("svc.guest")}` : ""}`);
  const patch = (id: string, fn: (x: Service) => void) => update((st) => { fn(st.services.find((y) => y.id === id)!); });
  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}><BriefcaseBusiness size={22} style={{ verticalAlign: -3 }} /> {t("nav.services")}</h1>
        <span className="row" style={{ gap: 6 }}><button className="ghost" onClick={() => setShare(true)}><Share2 size={15} /> {t("cat.share")}</button><button onClick={() => setModal({})}><Plus size={16} /> {t("svc.new")}</button></span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{t("svc.desc")}</p>
      {share && <CatalogShare onClose={() => setShare(false)} />}
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card"><div className="muted small">{t("svc.total")}</div><h2 style={{ margin: 0 }}>{s.services.length}</h2></div>
        <div className="card"><div className="muted small">{t("svc.active")}</div><h2 style={{ margin: 0, color: "var(--teal)" }}>{s.services.filter((x) => x.active).length}</h2></div>
        <div className="card"><div className="muted small">{t("svc.hidden")}</div><h2 style={{ margin: 0 }}>{s.services.filter((x) => !x.active).length}</h2></div>
        <div className="card"><div className="muted small">{t("svc.featured")}</div><h2 style={{ margin: 0, color: "var(--gold)" }}>{s.services.filter((x) => x.featured).length}</h2></div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <input style={{ maxWidth: 260 }} value={q} placeholder={t("search")} aria-label={t("search")} onChange={(e) => setQ(e.target.value)} />
        <div className="seg" role="group" aria-label={t("svc.category")}>
          <button aria-pressed={cat === ""} onClick={() => setCat("")}>{t("all")}</button>
          {SERVICE_CATEGORIES.filter((c) => s.services.some((x) => x.category === c)).map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{t("svcc." + c)}</button>)}
        </div>
        <div className="seg" role="group" aria-label={t("status")}>
          {([["", "all"], ["active", "svc.active"], ["hidden", "svc.hidden"]] as const).map(([k, l]) => <button key={k} aria-pressed={state === k} onClick={() => setState(k)}>{t(l)}</button>)}
        </div>
      </div>
      {list.length === 0 && <p className="muted">{t("none")}</p>}
      <div className="grid g3">
        {list.map((x) => (
          <div className="card svccard" key={x.id} style={{ opacity: x.active ? 1 : .6 }} onDoubleClick={() => setModal({ svc: x })}>
            {x.image && <div className="menuimg big" style={{ marginBottom: 8 }}><img src={x.image} alt="" /></div>}
            <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <div><b>{x.name}</b>{x.featured && <Star size={14} fill="currentColor" style={{ color: "var(--gold)", marginLeft: 6, verticalAlign: -2 }} />}<div><span className="badge">{t("svcc." + x.category)}</span></div></div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><b>{price(x)}</b>{x.duration && <div className="muted small">{x.duration}</div>}</div>
            </div>
            <p className="muted small" style={{ margin: "8px 0" }}>{x.description}</p>
            {x.includes.length > 0 && <ul className="svcinc">{x.includes.slice(0, 5).map((i) => <li key={i}>{i}</li>)}{x.includes.length > 5 && <li className="muted">+{x.includes.length - 5}</li>}</ul>}
            {x.eventTypes.length > 0 && <div className="row" style={{ gap: 4, marginTop: 6 }}>{x.eventTypes.map((e) => <span key={e} className="badge">{tn(e)}</span>)}</div>}
            <div className="row between" style={{ marginTop: "auto", paddingTop: 10 }}>
              <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={x.active} onChange={(e) => patch(x.id, (y) => { y.active = e.target.checked; })} />{t("svc.active")}</label>
              <span className="row" style={{ gap: 0 }}>
                <button className="ghost icon" aria-label={t("svc.edit")} title={t("svc.edit")} onClick={() => setModal({ svc: x })}><Pencil size={15} /></button>
                <button className="ghost icon" aria-label={t("seat.duplicate")} title={t("seat.duplicate")} onClick={() => update((st) => { st.services.push({ ...structuredClone(x), id: uid(), name: `${x.name} (${t("board.copy")})`, createdAt: Date.now() }); })}><Copy size={15} /></button>
                <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => ask(t("confirm.delete"), () => update((st) => { st.services = st.services.filter((y) => y.id !== x.id); }), { danger: true })}><Trash2 size={15} /></button>
              </span>
            </div>
          </div>
        ))}
      </div>
      {modal && <ServiceModal svc={modal.svc} onClose={() => setModal(null)} />}
    </>
  );
}
