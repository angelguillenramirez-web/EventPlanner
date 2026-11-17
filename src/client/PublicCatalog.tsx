import { useT } from "../i18n";
import { useStore, type Service } from "../store";
import { LangSwitch, Logo, ThemeToggle } from "../shared";
import { Globe, Mail, MapPin, Phone, AtSign } from "../icons";

const money = (n: number, locale: string) => "$" + n.toLocaleString(locale, { maximumFractionDigits: 2 });

/** Open, view-only page of a business's service catalog. Anyone with the link can read it; nothing can be changed here. */
export default function PublicCatalog({ slug }: { slug: string }) {
  const { t, tn, locale } = useT();
  const s = useStore();
  const p = s.supplierProfile;
  const open = p.catalogOpen && p.slug === slug;
  const list = s.services.filter((x) => x.active).sort((a, b) => Number(b.featured) - Number(a.featured));
  const price = (x: Service) => (x.priceModel === "quote" ? t("svcp.quote") : `${money(x.price, locale)}${x.priceModel === "hourly" ? ` / ${t("svc.hr")}` : x.priceModel === "perGuest" ? ` / ${t("svc.guest")}` : ""}`);
  return (
    <div style={{ minHeight: "100vh", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="row between" style={{ marginBottom: 20 }}><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        {!open ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}><h2>{t("cat.na")}</h2><p className="muted">{t("cat.na.sub")}</p></div>
        ) : (
          <>
            <header className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {s.businessLogo && <img src={s.businessLogo} alt="" style={{ width: 84, height: 84, objectFit: "contain", borderRadius: 12, background: "var(--soft)" }} />}
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ margin: 0 }}>{p.name}</h1>
                {p.tagline && <p style={{ margin: "4px 0" }}>{p.tagline}</p>}
                <p className="muted small row" style={{ gap: 10, margin: 0 }}>
                  {(p.city || p.country) && <span className="row" style={{ gap: 3 }}><MapPin size={13} />{[p.city, p.country].filter(Boolean).join(", ")}</span>}
                  {p.phone && <span className="row" style={{ gap: 3 }}><Phone size={13} />{p.phone}</span>}
                  {p.email && <a className="row" style={{ gap: 3 }} href={`mailto:${p.email}`}><Mail size={13} />{p.email}</a>}
                  {p.web && <span className="row" style={{ gap: 3 }}><Globe size={13} />{p.web}</span>}
                  {p.instagram && <span className="row" style={{ gap: 3 }}><AtSign size={13} />{p.instagram}</span>}
                </p>
              </div>
            </header>
            {p.about && <p style={{ maxWidth: 720 }}>{p.about}</p>}
            <h2>{t("nav.services")}</h2>
            {list.length === 0 && <p className="muted">{t("none")}</p>}
            <div className="grid g3">
              {list.map((x) => (
                <article className="card" key={x.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {x.image && <img src={x.image} alt="" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 12 }} />}
                  <div className="row between" style={{ flexWrap: "nowrap" }}><b>{x.name}</b><b>{price(x)}</b></div>
                  <div className="row" style={{ gap: 4 }}><span className="badge">{t("svcc." + x.category)}</span>{x.duration && <span className="muted small">{x.duration}</span>}</div>
                  <p className="muted small" style={{ margin: 0 }}>{x.description}</p>
                  {x.includes.length > 0 && <ul className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>{x.includes.map((i) => <li key={i}>{i}</li>)}</ul>}
                  {x.eventTypes.length > 0 && <div className="row" style={{ gap: 4 }}>{x.eventTypes.map((e) => <span key={e} className="badge">{tn(e)}</span>)}</div>}
                </article>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 24 }}>{t("cat.viewonly")}</p>
          </>
        )}
      </div>
    </div>
  );
}
