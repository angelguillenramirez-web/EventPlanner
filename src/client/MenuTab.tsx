import { useState } from "react";
import { useT } from "../i18n";
import { MENU_CATEGORIES, uid, update, useStore, type EventT, type MenuItem } from "../store";
import { BookmarkPlus, BookOpen, ImageIcon, Pencil, Plus, Trash2, Utensils } from "../icons";
import { Modal } from "./ui";
import ApprovalButton from "./Approval";

const money = (n: number, locale: string) => "$" + n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Floating window with a large view of a picture; closes with X, Esc or a click outside. */
export function ImageLightbox({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} wide>
      <div style={{ textAlign: "center", marginTop: 12 }}><img src={src} alt={title} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 5 }} /></div>
    </Modal>
  );
}

/** Shrinks a picked image so it fits comfortably in the browser storage used by the prototype. */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read"));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        const k = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.75));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

function ItemModal({ event, item, category, library, onClose }: { event: EventT; item?: MenuItem; category?: string; library?: boolean; onClose: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ category: item?.category ?? category ?? "main", name: item?.name ?? "", description: item?.description ?? "", price: item?.price ?? 0, image: item?.image ?? "" });
  const [err, setErr] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [zoom, setZoom] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr(t("menu.imgerr")); return; }
    try { const image = await readImage(file); setF((x) => ({ ...x, image })); setErr(""); setZoom(true); } catch { setErr(t("menu.imgerr")); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const v = { ...f, name: f.name.trim(), description: f.description.trim(), price: Math.max(0, Number(f.price) || 0) };
    update((st) => {
      const list = library ? st.menuLibrary : st.menu;
      if (item) Object.assign(list.find((x) => x.id === item.id)!, v);
      else list.push({ id: uid(), eventId: library ? "" : event.id, ...v, selected: false, createdAt: Date.now() });
      if (!library && !item && saveDefault && !st.menuLibrary.some((x) => x.name === v.name && x.category === v.category)) st.menuLibrary.push({ id: uid(), eventId: "", ...v, selected: false, createdAt: Date.now() });
    });
    onClose();
  };
  return (
    <Modal title={library ? (item ? t("menu.edit") : t("menu.lib.new")) : item ? t("menu.edit") : t("menu.add")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div><label htmlFor="mc">{t("menu.category")}</label><select id="mc" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MENU_CATEGORIES.map((c) => <option key={c} value={c}>{t("menuc." + c)}</option>)}</select></div>
        <div><label htmlFor="mp">{t("menu.price")}</label><input id="mp" type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></div>
        <div className="full"><label htmlFor="mn">{t("name")} *</label><input id="mn" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="full"><label htmlFor="md2">{t("description")}</label><textarea id="md2" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="full"><label>{t("menu.image")}</label>
          <div className="row" style={{ gap: 12 }}>
            <div className="menuimg" style={{ cursor: f.image ? "zoom-in" : undefined }} onClick={() => f.image && setZoom(true)}>{f.image ? <img src={f.image} alt="" /> : <ImageIcon size={26} className="muted" />}</div>
            <label className="ghost" style={{ display: "inline-block", padding: "8px 14px", border: "1px solid var(--line)", borderRadius: 5, cursor: "pointer", margin: 0, color: "var(--ink)" }}>
              {t("menu.upload")}<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {f.image && <button type="button" className="ghost sm" onClick={() => setF({ ...f, image: "" })}>{t("menu.removeimg")}</button>}
          </div>
          {err && <div className="small" role="alert" style={{ color: "var(--rose)" }}>{err}</div>}
        </div>
        {!library && !item && <label className="row small full" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />{t("menu.lib.save")}</label>}
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{item ? t("save") : t("add")}</button></div>
      </form>
      {zoom && f.image && <ImageLightbox src={f.image} title={f.name || t("menu.image")} onClose={() => setZoom(false)} />}
    </Modal>
  );
}

/** The planner's default options: pick several to add them to this event's menu, or manage the list. */
function LibraryModal({ event, onClose, onEdit, onNew }: { event: EventT; onClose: () => void; onEdit: (m: MenuItem) => void; onNew: () => void }) {
  const s = useStore();
  const { t, locale } = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const inMenu = (m: MenuItem) => s.menu.some((x) => x.eventId === event.id && x.name === m.name && x.category === m.category);
  const add = () => { update((st) => { st.menuLibrary.filter((m) => picked.includes(m.id)).forEach((m) => st.menu.push({ ...m, id: uid(), eventId: event.id, selected: false, createdAt: Date.now() })); }); onClose(); };
  const cats = MENU_CATEGORIES.filter((c) => s.menuLibrary.some((m) => m.category === c));
  return (
    <Modal title={t("menu.lib.title")} onClose={onClose} wide>
      <p className="muted small" style={{ marginTop: 0 }}>{t("menu.lib.desc")}</p>
      {cats.length === 0 && <p className="muted">{t("menu.none")}</p>}
      {cats.map((c) => (
        <section key={c} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 4px" }}>{t("menuc." + c)}</h4>
          {s.menuLibrary.filter((m) => m.category === c).map((m) => {
            const had = inMenu(m);
            return (
              <div key={m.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }}>
                <label className="row" style={{ margin: 0, color: "var(--ink)", gap: 10, flexWrap: "nowrap", flex: 1, opacity: had ? .5 : 1 }}>
                  <input type="checkbox" disabled={had} checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} />
                  <span className="menuimg" style={{ width: 40, height: 40 }}>{m.image ? <img src={m.image} alt="" /> : <Utensils size={16} className="muted" />}</span>
                  <span><b>{m.name}</b>{had && <span className="muted small"> · {t("menu.lib.added")}</span>}<div className="muted small">{m.description}</div></span>
                </label>
                <span className="row" style={{ gap: 0, flexWrap: "nowrap" }}>
                  <span style={{ fontWeight: 600, marginRight: 6 }}>{money(m.price, locale)}</span>
                  <button className="ghost icon" aria-label={t("menu.edit")} title={t("menu.edit")} onClick={() => onEdit(m)}><Pencil size={15} /></button>
                  <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => { if (confirm(t("confirm.delete"))) update((st) => { st.menuLibrary = st.menuLibrary.filter((x) => x.id !== m.id); }); }}><Trash2 size={15} /></button>
                </span>
              </div>
            );
          })}
        </section>
      ))}
      <div className="row between" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={onNew}><Plus size={15} /> {t("menu.lib.new")}</button>
        <span className="row"><button className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={!picked.length} onClick={add}>{t("menu.lib.addsel", { n: picked.length })}</button></span>
      </div>
    </Modal>
  );
}

/** Menu of the event: dishes and drinks by category, with price, picture and whether they are selected for the event. */
export default function MenuTab({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [modal, setModal] = useState<{ item?: MenuItem; category?: string; library?: boolean } | null>(null);
  const [lib, setLib] = useState(false);
  const [pic, setPic] = useState<MenuItem | null>(null);
  const [onlySel, setOnlySel] = useState(false);
  const items = s.menu.filter((m) => m.eventId === event.id);
  const sel = items.filter((m) => m.selected);
  const people = s.guests.filter((g) => g.eventId === event.id && g.status !== "declined").reduce((n, g) => n + g.invitees, 0);
  const perPerson = sel.reduce((n, m) => n + m.price, 0);
  const toggle = (m: MenuItem) => update((st) => { const x = st.menu.find((y) => y.id === m.id)!; x.selected = !x.selected; });
  const cats = MENU_CATEGORIES.filter((c) => items.some((m) => m.category === c && (!onlySel || m.selected)));

  return (
    <>
      <div className="grid g4 stickbar">
        <div className="card"><div className="muted small">{t("menu.selected")}</div><h2 style={{ margin: 0 }}>{sel.length}<span className="muted small"> / {items.length}</span></h2></div>
        <div className="card"><div className="muted small">{t("menu.perperson")}</div><h2 style={{ margin: 0 }}>{money(perPerson, locale)}</h2></div>
        <div className="card"><div className="muted small">{t("menu.guests")}</div><h2 style={{ margin: 0 }}>{people}</h2></div>
        <div className="card"><div className="muted small">{t("menu.total")}</div><h2 style={{ margin: 0, color: "var(--teal)" }}>{money(perPerson * people, locale)}</h2></div>
      </div>
      <div className="row" style={{ margin: "14px 0" }}>
        <button onClick={() => setModal({})}><Plus size={16} /> {t("menu.add")}</button>
        <button className="ghost" onClick={() => setLib(true)}><BookOpen size={16} /> {t("menu.lib.open")}</button>
        <ApprovalButton event={event} scope="menu" subject={t("tab.menu")} disabled={sel.length === 0} summary={() => [...MENU_CATEGORIES.filter((c) => sel.some((m) => m.category === c)).flatMap((c) => [`${t("menuc." + c)}:`, ...sel.filter((m) => m.category === c).map((m) => `  · ${m.name} — ${money(m.price, locale)}`)]), `${t("menu.perperson")}: ${money(perPerson, locale)}`, `${t("menu.guests")}: ${people} · ${t("menu.total")}: ${money(perPerson * people, locale)}`]} snap={() => ({ k: "menu", perPerson, items: sel.map((m) => ({ category: m.category, name: m.name, price: m.price })) })} />
        <label className="row small" style={{ margin: "0 0 0 8px", color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} />{t("menu.onlysel")}</label>
      </div>
      {items.length === 0 && <div className="card muted"><Utensils size={18} /> {t("menu.none")}</div>}
      {cats.map((c) => (
        <section key={c} style={{ marginBottom: 22 }}>
          <h3 style={{ margin: "0 0 8px" }}>{t("menuc." + c)}</h3>
          <div className="menugrid">
            <button className="menuaddtile" aria-label={t("menu.add")} title={t("menu.add")} onClick={() => setModal({ category: c })}><Plus size={24} /></button>
            {items.filter((m) => m.category === c && (!onlySel || m.selected)).map((m) => (
              <div key={m.id} className={`card menucard${m.selected ? " picked" : ""}`}>
                <div className="menuimg big" style={{ cursor: m.image ? "zoom-in" : undefined }} onClick={() => m.image && setPic(m)}>{m.image ? <img src={m.image} alt={m.name} /> : <Utensils size={28} className="muted" />}</div>
                <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start", marginTop: 8 }}>
                  <b>{m.name}</b><span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(m.price, locale)}</span>
                </div>
                {m.description && <p className="muted small" style={{ margin: "4px 0", flex: 1 }}>{m.description}</p>}
                <div className="row between" style={{ marginTop: 6 }}>
                  <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={m.selected} onChange={() => toggle(m)} />{t("menu.select")}</label>
                  <span className="row" style={{ gap: 0 }}>
                    {!s.menuLibrary.some((x) => x.name === m.name && x.category === m.category) && <button className="ghost icon" aria-label={t("menu.lib.saveone")} title={t("menu.lib.saveone")} onClick={() => update((st) => { st.menuLibrary.push({ ...m, id: uid(), eventId: "", selected: false }); })}><BookmarkPlus size={15} /></button>}
                    <button className="ghost icon" aria-label={t("menu.edit")} title={t("menu.edit")} onClick={() => setModal({ item: m })}><Pencil size={15} /></button>
                    <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => { if (confirm(t("confirm.delete"))) update((st) => { st.menu = st.menu.filter((x) => x.id !== m.id); }); }}><Trash2 size={15} /></button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {lib && !modal && <LibraryModal event={event} onClose={() => setLib(false)} onEdit={(m) => setModal({ item: m, library: true })} onNew={() => setModal({ library: true })} />}
      {pic && <ImageLightbox src={pic.image} title={pic.name} onClose={() => setPic(null)} />}
      {modal && <ItemModal event={event} item={modal.item} category={modal.category} library={modal.library} onClose={() => setModal(null)} />}
    </>
  );
}
