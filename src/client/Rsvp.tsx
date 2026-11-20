import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { update, useStore } from "../store";
import { invSandbox, isFullDoc, personalizeDoc } from "../invitationTemplates";
import { LangSwitch, Logo, ThemeToggle } from "../shared";
import { Check, X } from "../icons";

/** The guest's page behind the personal RSVP link: …/rsvp/<event name>/<guest name> (or the older …/rsvp/<code>). */
export default function Rsvp({ parts }: { parts: string[] }) {
  const { t, locale } = useT();
  const s = useStore();
  const code = parts[parts.length - 1];
  // the link carries the guest's name (…/<event>/<name>/<code>), so a copied link cannot be passed to someone else; older links (…/<code>) still open
  const slug = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const found = s.guests.find((x) => x.token === code);
  const g = found && (parts.length < 3 || parts[parts.length - 2] === (slug(found.name) || "guest")) ? found : undefined;
  const ev = g ? s.events.find((e) => e.id === g.eventId) : undefined;
  const [done, setDone] = useState<"" | "confirmed" | "declined">("");
  const [n, setN] = useState(0); // how many of the party will come
  const counted = useRef(false);
  useEffect(() => { // every time the guest opens the link counts as a view (the planner sees it in Sent invitations)
    if (counted.current || !g || g.status === "draft") return;
    counted.current = true;
    update((st) => { const x = st.guests.find((y) => y.token === code); if (x) { x.views = (x.views ?? 0) + 1; x.lastViewedAt = Date.now(); } });
  }, [code, g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = (v: "confirmed" | "declined") => { update((st) => { const x = st.guests.find((y) => y.token === code); if (x) { x.status = v; x.confirmedN = v === "confirmed" ? Math.min(x.invitees, n || x.invitees) : 0; } }); setDone(v); };
  // the link opens the designed invitation (the approved one) for this guest; the reply given inside it is saved here
  const approvedHtml = (() => { const so = g ? s.signoffs.find((x) => x.eventId === g.eventId && x.scope === "invitations" && x.approvers.every((a) => a.at) && x.snap?.k === "invitation") : undefined; return so?.snap?.k === "invitation" ? so.snap.html : ""; })();
  const frame = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => { // built once per opening (the page inside keeps its own state while the guest answers)
    if (!g || !isFullDoc(approvedHtml)) return "";
    const resp = g.status === "confirmed" ? { answer: "yes" as const, people: g.confirmedN ?? g.invitees } : g.status === "declined" ? { answer: "no" as const, people: 0 } : undefined;
    const bridge = `<script>document.addEventListener("invitation:rsvp",function(e){parent.postMessage({inv:"rsvp",d:e.detail},"*")})</script>`;
    return personalizeDoc(approvedHtml, g.name, g.invitees, resp).replace("</body>", bridge + "</body>");
  }, [code, approvedHtml, g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!doc) return;
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.inv !== "rsvp") return;
      const d = e.data.d as { answer: "yes" | "no"; people: number; message?: string };
      update((st) => { const x = st.guests.find((y) => y.token === code); if (x) { x.status = d.answer === "yes" ? "confirmed" : "declined"; x.confirmedN = d.answer === "yes" ? Math.min(x.invitees, Math.max(1, d.people || x.invitees)) : 0; } });
    };
    window.addEventListener("message", on); return () => window.removeEventListener("message", on);
  }, [doc, code]);
  if (doc) return <iframe ref={frame} title={ev?.name ?? "invitation"} sandbox={invSandbox(doc)} srcDoc={doc} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }} />;
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
              <p role="status" style={{ color: (done || g.status) === "confirmed" ? "var(--teal)" : "var(--danger)", fontWeight: 700 }}>{t((done || g.status) === "confirmed" ? "rsvp.pg.yes" : "rsvp.pg.no")}</p>
            ) : null}
            {g.invitees > 1 && !done && g.status !== "confirmed" && g.status !== "declined" && <div style={{ margin: "8px auto 0", maxWidth: 260 }}><label htmlFor="rn">{t("rsvp.pg.howmany")}</label><select id="rn" value={n || g.invitees} onChange={(e) => setN(Number(e.target.value))}>{Array.from({ length: g.invitees }, (_, i) => i + 1).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>}
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
