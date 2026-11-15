import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { addGuest, deleteGuest, importGuests, inviteAll, inviteGuest } from "@/app/actions";
import { guestTone } from "@/app/components";
import ConfirmDelete from "@/app/ConfirmDelete";
import { appUrl } from "@/lib/util";

export default async function Guests({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  await getEventFor(user, id);
  const { t, locale } = await getT();
  const [guests, mails] = await Promise.all([
    db.guest.findMany({ where: { eventId: id }, orderBy: { name: "asc" } }),
    db.emailLog.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const manage = canManage(user);
  const base = appUrl();
  return (
    <>
      <form action={addGuest} className="card fields">
        <input type="hidden" name="eventId" value={id} />
        <div><label htmlFor="name">{t("name")}</label><input id="name" name="name" required /></div>
        <div><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" /></div>
        <div><label htmlFor="phone">{t("phone")}</label><input id="phone" name="phone" /></div>
        <div><label htmlFor="maxParty">{t("maxParty")}</label><input id="maxParty" name="maxParty" type="number" min={1} max={20} defaultValue={1} /></div>
        <button>{t("addGuest")}</button>
      </form>

      <div className="row" style={{ marginBottom: 16 }}>
        <details className="card" style={{ margin: 0 }}>
          <summary>{t("importCsv")}</summary>
          <form action={importGuests} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="eventId" value={id} />
            <input type="file" name="file" accept=".csv,text/csv" required style={{ width: "auto" }} />
            <button className="sm">{t("import")}</button>
          </form>
        </details>
        <a className="btn ghost" href={`/api/events/${id}/guests.csv`}>{t("exportCsv")}</a>
        {manage && (
          <>
            <form action={inviteAll}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="mode" value="new" /><button className="ghost">{t("sendAll")}</button></form>
            <form action={inviteAll}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="mode" value="remind" /><button className="ghost">{t("sendReminder")}</button></form>
          </>
        )}
      </div>

      <div className="card tablewrap">
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("status")}</th><th>{t("seats")}</th><th>{t("dietary")}</th><th>{t("copyLink")}</th><th></th></tr></thead>
          <tbody>
            {guests.length === 0 && <tr><td colSpan={6} className="muted">{t("noItems")}</td></tr>}
            {guests.map((g) => (
              <tr key={g.id}>
                <td>{g.name}<br /><span className="muted">{g.email || g.phone}</span></td>
                <td><span className={`badge ${guestTone(g.status)}`}>{t("g." + g.status)}</span>{g.invitedAt && <><br /><span className="muted">{t("invited")} {g.invitedAt.toLocaleDateString(locale)}</span></>}</td>
                <td>{g.attendees}/{g.maxParty}</td>
                <td>{g.dietary}{g.message && <div className="muted">“{g.message}”</div>}</td>
                <td><a href={`/rsvp/${g.token}`} target="_blank">/rsvp/…{g.token.slice(-5)}</a></td>
                <td className="row">
                  {manage && <form action={inviteGuest}><input type="hidden" name="id" value={g.id} /><button className="ghost sm">{g.invitedAt ? t("resend") : t("sendInvite")}</button></form>}
                  <form action={deleteGuest}><input type="hidden" name="id" value={g.id} /><ConfirmDelete small label="✕" msg={t("confirmDelete")} /></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manage && mails.length > 0 && (
        <div className="card">
          <h3>{t("outbox")}</h3>
          <p className="muted">{t("outboxNote")}</p>
          {mails.map((m) => (
            <details key={m.id}>
              <summary>{m.createdAt.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })} · {m.toEmail || "—"} · {m.subject}</summary>
              <pre className="mail">{m.body}</pre>
              {m.toEmail && <a className="btn sm ghost" href={`mailto:${m.toEmail}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>{t("openMail")}</a>}
            </details>
          ))}
          <span hidden>{base}</span>
        </div>
      )}
    </>
  );
}
