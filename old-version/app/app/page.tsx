import Link from "next/link";
import { db } from "@/lib/db";
import { canManage, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { Bar, statusTone } from "../components";

export default async function Dashboard() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const where = user.role === "SUPERADMIN" ? {} : user.role === "ORGANIZER" ? { organizerId: user.id } : { clientId: user.id };
  const events = await db.event.findMany({
    where, orderBy: { date: "asc" },
    include: { checklist: { select: { done: true } }, guests: { select: { status: true, attendees: true } }, organizer: { select: { name: true } } },
  });
  const guestTotal = events.reduce((n, e) => n + e.guests.length, 0);
  const attending = events.reduce((n, e) => n + e.guests.reduce((m, g) => m + g.attendees, 0), 0);

  const days = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000);
  return (
    <>
      <div className="row between">
        <h1>{user.role === "SUPERADMIN" ? t("allEvents") : t("dashboard")}</h1>
        {canManage(user) && <Link className="btn" href="/app/events/new">+ {t("newEvent")}</Link>}
      </div>
      {user.role === "SUPERADMIN" && (
        <div className="stats">
          <div className="stat"><b>{events.length}</b>{t("totalEvents")}</div>
          <div className="stat"><b>{guestTotal}</b>{t("totalGuests")}</div>
          <div className="stat"><b>{attending}</b>{t("headcount")}</div>
          <div className="stat"><b>{await db.user.count()}</b>{t("users")}</div>
        </div>
      )}
      {events.length === 0 && <p className="muted">{t("noEvents")}</p>}
      <div className="grid">
        {events.map((e) => {
          const done = e.checklist.filter((c) => c.done).length;
          const d = days(e.date);
          return (
            <Link key={e.id} href={`/app/events/${e.id}`} className="card" style={{ textDecoration: "none", color: "inherit", marginBottom: 0 }}>
              <div className="row between"><span className="badge">{t("type." + e.type)}</span><span className={`badge ${statusTone(e.status)}`}>{t("status." + e.status)}</span></div>
              <h3 style={{ marginTop: 8 }}>{e.title}</h3>
              <p className="muted" style={{ margin: "0 0 8px" }}>
                {e.date.toLocaleDateString(locale, { dateStyle: "long" })} · {d > 0 ? t("daysLeft", { n: d }) : d === 0 ? t("today") : t("past")}
                {user.role === "SUPERADMIN" && <><br />{t("organizer")}: {e.organizer.name}</>}
              </p>
              <Bar value={done} max={e.checklist.length} />
              <p className="muted" style={{ margin: "4px 0 0" }}>{done}/{e.checklist.length} {t("tasks")} · {e.guests.reduce((m, g) => m + g.attendees, 0)} {t("attendeesCount").toLowerCase()}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
