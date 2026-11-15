import { useT } from "./i18n";
import { usePublic } from "./bridge";
import { COLORS, TRIAL_DAYS, yearlySaving, go, useStore, type Plan } from "./store";
import { money, planBullets, usePrices } from "./client/Billing";
import { LangSwitch, Logo, ThemeToggle } from "./shared";
import { CalendarRange, FileText, FolderOpen, Handshake, Headset, LayoutGrid, Mail, Sparkles, Table2, TypeIcon } from "./icons";

const FEATURES: [React.ReactNode, string][] = [[<LayoutGrid />, "tracker"], [<CalendarRange />, "scheduler"], [<Mail />, "invites"], [<FileText />, "forms"], [<FolderOpen />, "docs"], [<Table2 />, "tables"], [<Handshake />, "vendors"], [<Headset />, "support"]];
const TYPES: [string, string][] = [["wedding", COLORS.rose], ["birthday", COLORS.gold], ["babyshower", COLORS.blue], ["graduation", COLORS.teal], ["anniversary", COLORS.rose], ["corporate", COLORS.blue]];

function PlanCard({ id, pop }: { id: Plan; pop?: boolean }) {
  const { t, locale } = useT();
  const price = usePrices();
  return (
    <div className={`card plan${pop ? " pop" : ""}`}>
      {pop && <span className="badge" style={{ background: "var(--teal)", color: "var(--on-primary)", position: "absolute", top: -10, right: 14 }}>{t("plan.popular")}</span>}
      <h3>{t("plan." + id)}</h3>
      <p className="muted small" style={{ margin: "0 0 6px" }}>{t("plan.tag." + id)}</p>
      <div className="price">{money(price(id, "monthly"), locale)}<span style={{ fontSize: ".9rem" }} className="muted"> {t("plan.permonth")}</span></div>
      <p className="muted small" style={{ margin: "0 0 4px" }}>{t("plan.yearly", { amount: money(price(id, "yearly"), locale), save: money(yearlySaving(id), locale) })}</p>
      <ul>{planBullets(id, t).map((i) => <li key={i}>{i}</li>)}</ul>
      <button className={pop ? "" : "ghost"} style={{ width: "100%", justifyContent: "center" }} onClick={() => go("/join")}>{t("cta.start")}</button>
    </div>
  );
}

export default function Landing() {
  const { t } = useT();
  useStore();
  const pub = usePublic(); // prices and announcement managed from the staff console (when connected)
  return (
    <>
      {pub?.web?.banner && <div role="status" style={{ background: "var(--gold)", color: "#14110a", textAlign: "center", padding: "8px 12px", fontWeight: 600 }}>{pub.web.banner}</div>}
      <nav className="lnav"><div className="in">
        <Logo href="#/" />
        <a className="l" href="#features" onClick={(e) => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); }}>{t("nav.features")}</a>
        <a className="l" href="#events" onClick={(e) => { e.preventDefault(); document.getElementById("events")?.scrollIntoView({ behavior: "smooth" }); }}>{t("nav.events")}</a>
        <a className="l" href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); }}>{t("nav.pricing")}</a>
        <LangSwitch /><ThemeToggle />
        <button className="ghost" onClick={() => go("/login")}>{t("login")}</button><button onClick={() => go("/join")}>{t("signup")}</button>
      </div></nav>

      <header className="hero"><div className="sec">
        <div>
          <span className="kicker">{t("hero.kicker")}</span>
          <h1>{t("hero.title")}</h1>
          <p className="lead">{t("hero.sub")}</p>
          <div className="row"><button onClick={() => go("/join")}>{t("cta.start")}</button><button className="ghost" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>{t("nav.pricing")}</button></div>
        </div>
        <div className="mock" aria-hidden="true">
          <div className="row between" style={{ marginBottom: 8 }}><b className="serif">Boda de Sofía & Daniel</b><TypeIcon type="wedding" /></div>
          <div className="grid g3">
            {[["To do", COLORS.blue, ["Plan de mesas", "Enviar invitaciones"]], ["In progress", COLORS.gold, ["Catering", "Fotógrafo"]], ["Done", COLORS.teal, ["Reservar lugar"]]].map(([n, c, ts]) => (
              <div className="col" key={n as string}><b className="small"><span className="dot" style={{ background: c as string }} /> {n as string}</b>{(ts as string[]).map((x) => <div className="tk" key={x}>{x}</div>)}</div>
            ))}
          </div>
        </div>
      </div></header>

      <section className="sec" id="features">
        <span className="kicker">{t("nav.features")}</span><h2>{t("feat.title")}</h2><p className="muted">{t("feat.sub")}</p>
        <div className="grid g4" style={{ marginTop: 20 }}>
          {FEATURES.map(([ic, k]) => <div className="card feat" key={k}><div className="ic">{ic}</div><h3>{t("feat." + k)}</h3><p className="muted small" style={{ margin: 0 }}>{t("feat." + k + ".d")}</p></div>)}
        </div>
      </section>

      <section style={{ background: "var(--soft)" }}><div className="sec">
        <div className="grid g2" style={{ alignItems: "center", gap: 40 }}>
          <div>
            <span className="kicker">{t("tracker.kicker")}</span><h2>{t("tracker.title")}</h2><p className="muted">{t("tracker.sub")}</p>
            <div className="row">{["columns", "calendar", "gantt"].map((v) => <span className="badge" key={v}>{t("view." + v)}</span>)}</div>
            <ul className="muted"><li>{t("tracker.b1")}</li><li>{t("tracker.b2")}</li><li>{t("tracker.b3")}</li></ul>
          </div>
          <div className="grid g2">
            <div className="invcard" style={{ background: COLORS.rose, fontFamily: "Georgia, serif" }}><div className="small">{t("inv.demo.wed")}</div><h2 style={{ color: "#fff" }}>Sofía & Daniel</h2><TypeIcon type="wedding" /></div>
            <div className="invcard" style={{ background: COLORS.gold, color: "#241f05" }}><div className="small">{t("inv.demo.bday")}</div><h2>¡Valentina 15!</h2><TypeIcon type="birthday" /></div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 28, textAlign: "center" }}>
          <span className="kicker"><Sparkles size={14} style={{ verticalAlign: -2 }} /> {t("plan.pro")}</span><h3>{t("ai.title")}</h3><p className="muted" style={{ margin: 0 }}>{t("ai.sub")}</p>
        </div>
      </div></section>

      <section className="sec" id="events">
        <span className="kicker">{t("nav.events")}</span><h2>{t("types.title")}</h2>
        <div className="grid g3" style={{ marginTop: 20 }}>
          {TYPES.map(([id, c]) => <div className="etype" key={id} style={{ background: c }}><TypeIcon type={id} size={32} /><h3>{t("type." + id)}</h3><p>{t("type." + id + ".d")}</p></div>)}
        </div>
        <div className="card" style={{ marginTop: 24 }}><h3>{t("planners.title")}</h3><p className="muted" style={{ margin: 0 }}>{t("planners.sub")}</p></div>
      </section>

      <section className="sec" id="pricing" style={{ paddingTop: 24 }}>
        <span className="kicker">{t("nav.pricing")}</span><h2>{t("pricing.title")}</h2>
        <div className="grid g3" style={{ marginTop: 24 }}><PlanCard id="basic" /><PlanCard id="planner" pop /><PlanCard id="pro" /></div>
        <p className="muted small">{t("plan.countnote")} {t("plan.yearnote")} {t("plan.trialnote", { n: TRIAL_DAYS })}</p>
      </section>

      <section className="hero"><div className="sec" style={{ display: "block", textAlign: "center", padding: "56px 24px" }}>
        <h2>{t("cta.title")}</h2><button onClick={() => go("/join")}>{t("cta.start")}</button>
      </div></section>
      <footer className="lf">© 2026 A plan · {t("footer")}</footer>
    </>
  );
}
