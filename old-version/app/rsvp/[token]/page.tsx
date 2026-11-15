import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { submitRsvp } from "@/app/actions";
import { LangSwitch } from "@/app/components";

export default async function Rsvp({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { token } = await params;
  const { saved } = await searchParams;
  const g = await db.guest.findUnique({ where: { token }, include: { event: true } });
  if (!g) notFound();
  const { t, locale } = await getT();
  const ev = g.event;
  const closed = ev.status === "CANCELLED" || (ev.rsvpDeadline && ev.rsvpDeadline.getTime() + 86400000 < Date.now());
  return (
    <div className="center card" style={{ margin: "4vh auto" }}>
      <div className="row between"><span className="muted">🎉 {t("app")}</span><LangSwitch back={`/rsvp/${token}`} /></div>
      <div className="hero" style={{ padding: "16px 0" }}>
        <p className="muted">{t("invitedTo")}</p>
        <h1>{ev.title}</h1>
        <p>{ev.date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}{ev.venue && <><br />📍 {ev.venue}</>}</p>
        {ev.description && <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{ev.description}</p>}
        <h3>{g.name}</h3>
      </div>
      {saved && <p className="okmsg" role="status">{t("rsvpThanks")}</p>}
      {g.respondedAt && <p className="muted">{t("rsvpSaved")}: <span className={`badge ${g.status === "ATTENDING" ? "ok" : "bad"}`}>{t("g." + g.status)}</span>{g.attendees ? ` · ${g.attendees}` : ""}</p>}
      {closed ? <p className="err">{t("rsvpClosed")}</p> : (
        <form action={submitRsvp} className="fields" style={{ gridTemplateColumns: "1fr" }}>
          <input type="hidden" name="token" value={token} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)" }}><input type="radio" name="answer" value="yes" defaultChecked={g.status !== "DECLINED"} /> {t("willAttend")}</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)" }}><input type="radio" name="answer" value="no" defaultChecked={g.status === "DECLINED"} /> {t("cannotAttend")}</label>
          </fieldset>
          {g.maxParty > 1 && <div><label htmlFor="attendees">{t("howMany")}</label><input id="attendees" name="attendees" type="number" min={1} max={g.maxParty} defaultValue={g.attendees || g.maxParty} /></div>}
          <div><label htmlFor="dietary">{t("dietary")}</label><input id="dietary" name="dietary" defaultValue={g.dietary} maxLength={300} /></div>
          <div><label htmlFor="message">{t("message")}</label><textarea id="message" name="message" rows={2} defaultValue={g.message} maxLength={500} /></div>
          <button>{t("submit")}</button>
        </form>
      )}
    </div>
  );
}
