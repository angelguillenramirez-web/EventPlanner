import { useState } from "react";
import { useT } from "../i18n";
import { update, useStore } from "../store";
import { LangSwitch, Logo, ThemeToggle } from "../shared";
import { Check, X } from "../icons";

/** The guest's page behind the personal RSVP link: …/rsvp/<event name>/<guest name> (or the older …/rsvp/<code>). */
export default function Rsvp({ parts }: { parts: string[] }) {
  const { t, locale } = useT();
  const s = useStore();
  const code = parts[parts.length - 1];
  const g = s.guests.find((x) => x.token === code);
  const ev = g ? s.events.find((e) => e.id === g.eventId) : undefined;
  const [done, setDone] = useState<"" | "confirmed" | "declined">("");
  const answer = (v: "confirmed" | "declined") => { update((st) => { const x = st.guests.find((y) => y.token === code); if (x) x.status = v; }); setDone(v); };
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: 520, maxWidth: "100%", textAlign: "center" }}>
        <div className="row between"><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        {!g || !ev ? <><h2>{t("rsvp.pg.invalid")}</h2><p className="muted">{t("rsvp.pg.invalid.sub")}</p></> : (
          <>
            <p className="muted" style={{ marginBottom: 0 }}>{t("rsvp.pg.hello", { name: g.name })}</p>
            <h1 style={{ margin: "4px 0" }}>{ev.name}</h1>
            <p style={{ margin: 0 }}>{new Date(ev.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" })}</p>
            <p className="muted" style={{ marginTop: 2 }}>{[ev.venue, ev.location].filter(Boolean).join(" · ")}</p>
            {ev.description && <p>{ev.description}</p>}
            <p className="small muted">{t("rsvp.pg.party", { n: g.invitees })}</p>
            {done || g.status === "confirmed" || g.status === "declined" ? (
              <p role="status" style={{ color: (done || g.status) === "confirmed" ? "var(--teal)" : "var(--rose)", fontWeight: 700 }}>{t((done || g.status) === "confirmed" ? "rsvp.pg.yes" : "rsvp.pg.no")}</p>
            ) : null}
            <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
              <button onClick={() => answer("confirmed")}><Check size={16} /> {t("rsvp.pg.attend")}</button>
              <button className="ghost" onClick={() => answer("declined")}><X size={16} /> {t("rsvp.pg.decline")}</button>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>{t("rsvp.pg.change")}</p>
          </>
        )}
      </div>
    </div>
  );
}
