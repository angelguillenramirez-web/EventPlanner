import { useState } from "react";
import { useT } from "./i18n";
import { usePublic } from "./bridge";
import { COLORS, TRIAL_DAYS, yearlySaving, go, useStore, type Plan } from "./store";
import { money, planBullets, usePrices } from "./client/Billing";
import { LangSwitch, Logo, ThemeToggle } from "./shared";
import { CalendarRange, Check, FileText, FolderOpen, Handshake, Headset, Heart, LayoutGrid, Mail, Sparkles, Table2, TypeIcon } from "./icons";

const FEATURES: [React.ReactNode, string][] = [[<LayoutGrid />, "tracker"], [<CalendarRange />, "scheduler"], [<Mail />, "invites"], [<FileText />, "forms"], [<FolderOpen />, "docs"], [<Table2 />, "tables"], [<Handshake />, "vendors"], [<Headset />, "support"]];
const TYPES = ["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate"]; // each has a soft pastel tile (see .etype.t-* in styles.css)
type Cycle = "monthly" | "yearly";

function PlanCard({ id, pop, cycle }: { id: Plan; pop?: boolean; cycle: Cycle }) {
  const { t, locale } = useT();
  const price = usePrices();
  const shown = cycle === "monthly" ? price(id, "monthly") : price(id, "yearly") / 12; // yearly plans are shown as a monthly equivalent
  return (
    <div className={`card plan${pop ? " pop" : ""}`}>
      {pop && <span className="popbadge">{t("plan.popular")}</span>}
      <h3>{t("plan." + id)}</h3>
      <p className="muted small" style={{ margin: "0 0 14px" }}>{t("plan.tag." + id)}</p>
      <div className="price">{money(Math.round(shown * 100) / 100, locale)}<span className="muted"> {t("plan.permonth")}</span></div>
      <p className="muted small plannote">{cycle === "yearly" ? t("land.billedyear", { amount: money(price(id, "yearly"), locale), save: money(yearlySaving(id), locale) }) : t("plan.yearly", { amount: money(price(id, "yearly"), locale), save: money(yearlySaving(id), locale) })}</p>
      <ul className="ticks">{planBullets(id, t).map((i) => <li key={i}>{i}</li>)}</ul>
      <button className={pop ? "" : "ghost"} style={{ width: "100%", justifyContent: "center" }} onClick={() => go("/join")}>{t("cta.start")}</button>
    </div>
  );
}

export default function Landing() {
  const { t } = useT();
  useStore();
  const price = usePrices();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const pct = Math.round((yearlySaving("basic") / (price("basic", "monthly") * 12)) * 100);
  const pub = usePublic(); // prices and announcement managed from the staff console (when connected)
  return (
    <>
      {pub?.web?.banner && <div role="status" style={{ background: "var(--gold)", color: "#14203A", textAlign: "center", padding: "8px 12px", fontWeight: 600 }}>{pub.web.banner}</div>}
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
          <span className="kicker"><i className="kdot" />{t("hero.kicker")}</span>
          <h1>{t("hero.t1")}<span className="hl">{t("hero.t2")}</span></h1>
          <p className="lead">{t("hero.sub")}</p>
          <div className="row"><button className="lg" onClick={() => go("/join")}>{t("cta.start")} →</button><button className="ghost lg" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>{t("nav.pricing")}</button></div>
          <div className="proof"><span className="av" aria-hidden><i style={{ background: "#46C8B2" }} /><i style={{ background: "#FF7A59" }} /><i style={{ background: "#B9A6FF" }} /><i style={{ background: "#FFD96B" }} /></span><span>{t("land.proof", { n: TRIAL_DAYS })}</span></div>
        </div>
        <div className="mock" aria-hidden="true">
          <div className="row between" style={{ marginBottom: 10 }}><b className="serif">Boda de Sofía & Daniel</b><span className="mchip"><Heart size={13} /> {t("type.wedding")}</span></div>
          <div className="grid g3">
            {[["To do", COLORS.blue, ["Plan de mesas", "Enviar invitaciones"]], ["In progress", COLORS.gold, ["Catering", "Fotógrafo"]], ["Done", COLORS.teal, ["Reservar lugar"]]].map(([n, c, ts]) => (
              <div className="col" key={n as string}><b className="small"><span className="dot" style={{ background: c as string }} /> {n as string}</b>{(ts as string[]).map((x) => <div className="tk" key={x}>{x}</div>)}</div>
            ))}
          </div>
          <div className="float f1"><span className="fi" style={{ background: "var(--teal-soft)", color: "var(--teal-ink)" }}><Check size={16} /></span>{t("land.chip.guests")}</div>
          <div className="float f2"><span className="fi" style={{ background: "var(--coral-soft)", color: "var(--coral-ink)" }}><Heart size={15} /></span>{t("land.chip.rsvp")}</div>
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
            <div className="row">{["columns", "calendar", "gantt"].map((v) => <span className="badge viewpill" key={v}>{t("view." + v)}</span>)}</div>
            <ul className="muted ticks"><li>{t("tracker.b1")}</li><li>{t("tracker.b2")}</li><li>{t("tracker.b3")}</li></ul>
          </div>
          <div className="grid g2">
            <div className="landinv p-coral"><div className="small">{t("inv.demo.wed")}</div><h4>Sofía & Daniel</h4><Heart size={18} /></div>
            <div className="landinv p-butter"><div className="small">{t("inv.demo.bday")}</div><h4>¡Valentina 15!</h4><TypeIcon type="birthday" size={18} /></div>
          </div>
        </div>
      </div></section>

      <section className="sec" id="events">
        <span className="kicker">{t("nav.events")}</span><h2>{t("types.title")}</h2>
        <div className="grid g3" style={{ marginTop: 20 }}>
          {TYPES.map((id) => <div className={`etype t-${id}`} key={id}><TypeIcon type={id} size={28} /><h3>{t("type." + id)}</h3><p>{t("type." + id + ".d")}</p></div>)}
        </div>
        <div className="card" style={{ marginTop: 24 }}><h3>{t("planners.title")}</h3><p className="muted" style={{ margin: 0 }}>{t("planners.sub")}</p></div>
      </section>

      <section className="sec" id="pricing" style={{ paddingTop: 24 }}>
        <span className="kicker">{t("nav.pricing")}</span><h2>{t("pricing.title")}</h2>
        <div className="seg" role="group" aria-label={t("bill.cycle")} style={{ marginTop: 6 }}>
          <button aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>{t("bill.monthly")}</button>
          <button aria-pressed={cycle === "yearly"} onClick={() => setCycle("yearly")}>{t("bill.yearly")} · −{pct}%</button>
        </div>
        <div className="grid g3" style={{ marginTop: 24 }}><PlanCard id="basic" cycle={cycle} /><PlanCard id="planner" pop cycle={cycle} /><PlanCard id="pro" cycle={cycle} /></div>
        <p className="muted small">{t("plan.countnote")} {t("plan.yearnote")} {t("plan.trialnote", { n: TRIAL_DAYS })}</p>
      </section>

      <section className="sec" style={{ paddingTop: 0, paddingBottom: 0 }}><div className="ctabox">
        <h2>{t("cta.title")}</h2><button className="lg" onClick={() => go("/join")}>{t("cta.start")} →</button>
      </div></section>
      <footer className="lf">© 2026 1Plan · {t("footer")}</footer>
    </>
  );
}
