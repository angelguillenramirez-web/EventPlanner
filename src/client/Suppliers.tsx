import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { go, uid, update, useStore } from "../store";
import { SUPPLIERS, SUPPLIER_CATEGORIES, profileToSupplier, type Supplier } from "../suppliers";
import { Globe, Mail, MapPin, MessageCircle, Phone, Search, Star, AtSign, IdCard, LockI } from "../icons";
import { Modal } from "./ui";
import { SupplierArt } from "../illustrations";

const tier = (n: number) => "$".repeat(n);


function ContactCard({ sup, onClose }: { sup: Supplier; onClose: () => void }) {
  const { t } = useT();
  const row = (icon: React.ReactNode, v: string, href?: string) => <div className="row" style={{ gap: 10, padding: "6px 0" }}>{icon}{href ? <a href={href} target="_blank" rel="noopener noreferrer">{v}</a> : v}</div>;
  return (
    <Modal title={t("sup.card")} onClose={onClose}>
      <h3 style={{ margin: "0 0 2px" }}>{sup.name}</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>{(sup.categories?.length ? sup.categories : [sup.category]).map((c) => t("supc." + c)).join(", ")} · {sup.city}, {sup.country}</div>
      <p style={{ marginTop: 0 }}>{sup.about}</p>
      {row(<Phone size={16} />, sup.phone, `tel:${sup.phone.replace(/\s/g, "")}`)}
      {row(<Mail size={16} />, sup.email, `mailto:${sup.email}`)}
      {row(<Globe size={16} />, sup.web, `https://${sup.web}`)}
      {row(<AtSign size={16} />, sup.instagram)}
    </Modal>
  );
}

const MAX_CHIPS = 3;
/** One supplier in the market. Also used to preview your own profile (no actions then). */
export function SupplierCard({ x, onChat, onCard, mine }: { x: Supplier; onChat?: () => void; onCard?: () => void; mine?: boolean }) {
  const { t, tn } = useT();
  const cats = x.categories?.length ? x.categories : [x.category];
  const tones = ["var(--teal)", "var(--coral)", "var(--gold)", "var(--blue)", "#9B87F5"];
  const tone = tones[Math.max(0, SUPPLIER_CATEGORIES.indexOf(cats[0])) % tones.length];
  const place = [x.city, x.country].filter(Boolean).join(", ");
  return (
    <article className={`mk-card${mine ? " mine" : ""}`}>
      <div className="mk-cover" style={x.cover ? { backgroundImage: `url(${x.cover})` } : { background: `color-mix(in srgb, ${tone} 26%, var(--surface))`, ["--tc" as string]: tone }}>
        {!x.cover && <span className="mk-art"><SupplierArt cat={cats[0]} /></span>}
        {x.rating > 0 ? <span className="mk-rate"><Star size={12} fill="currentColor" /> {x.rating.toFixed(1)}</span> : <span className="mk-rate mk-new">{t("sup.new")}</span>}
      </div>
      <div className="mk-logo" aria-hidden>{x.logo ? <img src={x.logo} alt="" /> : <span>{(x.name || "?")[0]}</span>}</div>
      <div className="mk-body">
        <h3 className="mk-name">{x.name || "—"}</h3>
        <div className="mk-cats">{cats.map((c) => <span key={c} className="badge">{t("supc." + c)}</span>)}</div>
        <p className="mk-about">{x.tagline || x.about || "\u00A0"}</p>
        <div className="mk-meta">
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><MapPin size={14} />{place || "—"}</span>
          <span><b>{tier(x.tier)}</b> <span className="muted">· {t("sup.from")} ${x.from}</span></span>
        </div>
        {x.supports.length > 0 && <div className="row" style={{ gap: 4 }}>{x.supports.slice(0, MAX_CHIPS).map((e) => <span key={e} className="mk-chip">{tn(e)}</span>)}{x.supports.length > MAX_CHIPS && <span className="mk-chip">+{x.supports.length - MAX_CHIPS}</span>}</div>}
      </div>
      {(onChat || onCard) && <div className="mk-actions">
        {onChat && <button className="sm" onClick={onChat}><MessageCircle size={14} /> {t("sup.chat")}</button>}
        {onCard && <button className="ghost sm" onClick={onCard}><IdCard size={14} /> {t("sup.card")}</button>}
      </div>}
    </article>
  );
}

export default function Suppliers() {
  const s = useStore();
  const { t, tn } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [place, setPlace] = useState("");
  const [card, setCard] = useState<Supplier | null>(null);
  /** Opens (or starts) the conversation with this supplier in the Inbox. */
  const message = (x: Supplier) => {
    const ev = s.events[0]?.id ?? "";
    let id = s.threads.find((th) => th.supplierId === x.id)?.id;
    if (!id) { id = uid(); const nid = id; update((st) => { st.threads.push({ id: nid, supplierId: x.id, eventId: ev, pinned: false, archived: false, muted: false, createdAt: Date.now(), msgs: [] }); }); }
    go("/app/inbox/" + id);
  };
  const all = useMemo(() => [...(s.supplierProfile.published && s.supplierProfile.name ? [profileToSupplier(s.supplierProfile)] : []), ...SUPPLIERS], [s.supplierProfile]);
  const places = useMemo(() => [...new Set(all.map((x) => `${x.city}, ${x.country}`))].sort(), []);
  const list = all.filter((x) =>
    (!cat || x.category === cat || !!x.categories?.includes(cat as never)) && (!type || x.supports.includes(type)) && (!price || x.tier === Number(price)) && (!place || `${x.city}, ${x.country}` === place) &&
    (!q.trim() || (x.name + " " + x.about).toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <>
      <h1 style={{ margin: "0 0 4px" }}>{t("nav.suppliers")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{t("sup.desc")}</p>
      <div className="card form" style={{ marginBottom: 14, gridTemplateColumns: "2fr repeat(4, 1fr)" }}>
        <div><label htmlFor="sq">{t("search")}</label><div className="row" style={{ flexWrap: "nowrap", gap: 6 }}><Search size={16} className="muted" /><input id="sq" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div><label htmlFor="sc">{t("sup.service")}</label><select id="sc" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t("all")}</option>{SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c}>{t("supc." + c)}</option>)}</select></div>
        <div><label htmlFor="st">{t("sup.supports")}</label><select id="st" value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("all")}</option>{s.eventTypes.map((e) => <option key={e.id} value={e.id}>{tn(e.id)}</option>)}</select></div>
        <div><label htmlFor="sp">{t("sup.prices")}</label><select id="sp" value={price} onChange={(e) => setPrice(e.target.value)}><option value="">{t("all")}</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{tier(n)}</option>)}</select></div>
        <div><label htmlFor="sl">{t("sup.location")}</label><select id="sl" value={place} onChange={(e) => setPlace(e.target.value)}><option value="">{t("all")}</option>{places.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
      </div>
      {list.length === 0 && <p className="muted">{t("none")}</p>}
      <div className="grid g3">
        {list.map((x) => (
          <SupplierCard key={x.id} x={x} mine={x.mine} onChat={x.mine ? undefined : () => message(x)} onCard={() => setCard(x)} />
        ))}
      </div>
      {card && <ContactCard sup={card} onClose={() => setCard(null)} />}
    </>
  );
}
