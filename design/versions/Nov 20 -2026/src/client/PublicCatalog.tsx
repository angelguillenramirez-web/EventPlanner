import { useMemo, useState } from "react";
import { useT } from "../i18n";
import { useStore, type Service, type SupplierProfile } from "../store";
import { LangSwitch, Logo, ThemeToggle } from "../shared";
import { Globe, Mail, MapPin, Phone, AtSign, Check, Star } from "../icons";

const money = (n: number, locale: string) => "$" + n.toLocaleString(locale, { maximumFractionDigits: 2 });
const href = (w: string) => (/^https?:\/\//i.test(w) ? w : "https://" + w);
const insta = (v: string) => `https://instagram.com/${v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")}`;

/** One service: photo, price, a short description, and the details (what is included, event types) on request. */
function ServiceCard({ x, price }: { x: Service; price: string }) {
  const { t, tn } = useT();
  const [more, setMore] = useState(false);
  const hasMore = x.includes.length > 0 || x.eventTypes.length > 0 || x.description.length > 110;
  return (
    <article className="pc-card">
      {x.image ? <img className="pc-img" src={x.image} alt="" /> : <div className="pc-img pc-noimg" aria-hidden />}
      <div className="pc-body">
        <div className="row" style={{ gap: 6 }}>
          <span className="badge">{t("svcc." + x.category)}</span>
          {x.featured && <span className="badge pc-feat"><Star size={11} fill="currentColor" /> {t("pub.featured")}</span>}
        </div>
        <h3 className="pc-name">{x.name}</h3>
        <div className="pc-price">{price}{x.duration && <span className="muted small"> · {x.duration}</span>}</div>
        <p className={`muted small pc-desc${more ? " open" : ""}`}>{x.description}</p>
        {more && (
          <>
            {x.includes.length > 0 && <ul className="small pc-inc">{x.includes.map((i) => <li key={i}><Check size={13} /> {i}</li>)}</ul>}
            {x.eventTypes.length > 0 && <div className="row" style={{ gap: 4 }}>{x.eventTypes.map((e) => <span key={e} className="badge">{tn(e)}</span>)}</div>}
          </>
        )}
        {hasMore && <button type="button" className="ghost sm pc-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? t("pub.less") : t("pub.details")}</button>}
      </div>
    </article>
  );
}

/** The catalog as visitors see it: hero, about and services. Also used (inert) as the live preview while editing the business profile. */
export function CatalogView({ p, name, logo, services, inert }: { p: SupplierProfile; name: string; logo: string; services: Service[]; inert?: boolean }) {
  const { t, tn, locale } = useT();
  const [cat, setCat] = useState("all");
  const [ev, setEv] = useState("all");
  const all = useMemo(() => services.filter((x) => x.active).sort((a, b) => Number(b.featured) - Number(a.featured)), [services]);
  const cats = [...new Set(all.map((x) => x.category))];
  const evs = [...new Set(all.flatMap((x) => x.eventTypes))];
  const list = all.filter((x) => (cat === "all" || x.category === cat) && (ev === "all" || x.eventTypes.includes(ev)));
  const price = (x: Service) => (x.priceModel === "quote" ? t("svcp.quote") : `${money(x.price, locale)}${x.priceModel === "hourly" ? ` / ${t("svc.hr")}` : x.priceModel === "perGuest" ? ` / ${t("svc.guest")}` : ""}`);
  const place = [p.city, p.country].filter(Boolean).join(", ");
  const cats0 = p.categories?.length ? p.categories : [p.category];
  const phone = p.phone.replace(/[^\d+]/g, "");
  return (
    <div className="pc-q" onClickCapture={inert ? (e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); } : undefined}>
      <div className="pc-wrap">
        <header className="pc-hero">
          <div className="pc-cover" style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined} aria-hidden />
          <div className="pc-id">
            <div className="pc-logo">{logo ? <img src={logo} alt="" /> : <span>{(name || "?")[0]}</span>}</div>
            <div className="pc-title">
              <h1>{name || t("sprof.name")}</h1>
              {p.tagline && <p className="pc-tag">{p.tagline}</p>}
              <div className="row small muted" style={{ gap: 6 }}>
                {cats0.map((c) => <span key={c} className="badge">{t("supc." + c)}</span>)}
                {place && <span className="row" style={{ gap: 3 }}><MapPin size={13} />{place}</span>}
              </div>
            </div>
            <div className="pc-actions">
              {p.phone && <a className="btnlike pc-btn" href={`tel:${phone}`}><Phone size={15} /> {t("pub.call")}</a>}
              {p.email && <a className="btnlike pc-btn ghost" href={`mailto:${p.email}`}><Mail size={15} /> {t("pub.email")}</a>}
              {p.web && <a className="btnlike pc-btn ghost" href={href(p.web)} target="_blank" rel="noopener noreferrer"><Globe size={15} /> {t("pub.web")}</a>}
              {p.instagram && <a className="btnlike pc-btn ghost" href={insta(p.instagram)} target="_blank" rel="noopener noreferrer"><AtSign size={15} /> Instagram</a>}
            </div>
          </div>
        </header>

        <div className="pc-two">
          {(p.about || p.supports.length > 0) && <section className="pc-about"><h2>{t("pub.about")}</h2>{p.about && <p>{p.about}</p>}{p.supports.length > 0 && <><div className="muted small" style={{ margin: "10px 0 4px" }}>{t("pub.serves")}</div><div className="row" style={{ gap: 4 }}>{p.supports.map((e) => <span key={e} className="badge">{tn(e)}</span>)}</div></>}</section>}
          <aside className="pc-info">
            <h3>{t("pub.info")}</h3>
            <div className="row" style={{ gap: 4 }}>{cats0.map((c) => <span key={c} className="badge">{t("supc." + c)}</span>)}</div>
            {place && <div className="pc-row"><MapPin size={15} /><span>{place}</span></div>}
            {p.phone && <div className="pc-row"><Phone size={15} /><span>{p.phone}</span></div>}
            {p.email && <div className="pc-row"><Mail size={15} /><span>{p.email}</span></div>}
            {p.web && <div className="pc-row"><Globe size={15} /><span>{p.web}</span></div>}
            {p.instagram && <div className="pc-row"><AtSign size={15} /><span>{p.instagram}</span></div>}
            {p.from > 0 && <div className="pc-row"><b>{"$".repeat(p.tier)}</b><span>{t("pub.from")} {money(p.from, locale)}</span></div>}
          </aside>
        </div>

        <section>
          <div className="row between" style={{ alignItems: "baseline" }}><h2 style={{ margin: "0 0 10px" }}>{t("nav.services")}</h2><span className="muted small">{t("pub.count", { n: list.length })}</span></div>
          {(cats.length > 1 || evs.length > 1) && (
            <div className="pc-filters">
              {cats.length > 1 && <div className="row" style={{ gap: 6 }} role="group" aria-label={t("svc.category")}>
                <button className={`chip${cat === "all" ? " on" : ""}`} aria-pressed={cat === "all"} onClick={() => setCat("all")}>{t("pub.all")}</button>
                {cats.map((c) => <button key={c} className={`chip${cat === c ? " on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{t("svcc." + c)}</button>)}
              </div>}
              {evs.length > 1 && <div className="row" style={{ gap: 6 }} role="group" aria-label={t("sup.supports")}>
                <button className={`chip${ev === "all" ? " on" : ""}`} aria-pressed={ev === "all"} onClick={() => setEv("all")}>{t("pub.allev")}</button>
                {evs.map((e) => <button key={e} className={`chip${ev === e ? " on" : ""}`} aria-pressed={ev === e} onClick={() => setEv(e)}>{tn(e)}</button>)}
              </div>}
            </div>
          )}
          {list.length === 0 && <p className="muted">{t("none")}</p>}
          <div className="pc-grid">{list.map((x) => <ServiceCard key={x.id} x={x} price={price(x)} />)}</div>
        </section>
      </div>
    </div>
  );
}

/** Open, view-only page of a business: profile hero, about, and the service catalog. Anyone with the link can read it; nothing can be changed here. */
export default function PublicCatalog({ slug }: { slug: string }) {
  const { t } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const open = p.catalogOpen && p.slug === slug;
  const name = p.name || s.accounts.find((a) => a.id === s.sessionId)?.company || s.userName;
  return (
    <div className="pc-page">
      <div className="pc-top"><div className="row between"><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div></div>
      {!open ? (
        <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 560, margin: "0 auto" }}><h2>{t("cat.na")}</h2><p className="muted">{t("cat.na.sub")}</p></div>
      ) : (
        <>
          <CatalogView p={p} name={name} logo={s.businessLogo} services={s.services} />
          <footer className="pc-foot muted small">{t("cat.viewonly")} · {t("pub.powered")}</footer>
        </>
      )}
    </div>
  );
}
