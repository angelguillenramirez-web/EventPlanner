import Link from "next/link";
import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { deleteEvent, updateEvent } from "@/app/actions";
import { Bar } from "@/app/components";
import { EventFields } from "../EventFields";

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEventFor(user, id);
  const { t, locale } = await getT();
  const [tasks, guests, next, clients] = await Promise.all([
    db.checklistItem.findMany({ where: { eventId: id } }),
    db.guest.findMany({ where: { eventId: id } }),
    db.scheduleItem.findMany({ where: { eventId: id }, orderBy: { startsAt: "asc" }, take: 3 }),
    canManage(user) ? db.user.findMany({ where: { role: "CLIENT", ...(user.role === "ORGANIZER" ? { createdById: user.id } : {}) } }) : [],
  ]);
  const done = tasks.filter((x) => x.done).length;
  const count = (s: string) => guests.filter((g) => g.status === s).length;
  const headcount = guests.reduce((n, g) => n + g.attendees, 0);

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{headcount}</b>{t("headcount")}</div>
        <div className="stat"><b>{count("ATTENDING")}</b>{t("confirmed")}</div>
        <div className="stat"><b>{count("DECLINED")}</b>{t("declined")}</div>
        <div className="stat"><b>{count("PENDING")}</b>{t("pending")}</div>
      </div>
      <div className="card">
        <h3>{t("progress")}</h3>
        <Bar value={done} max={tasks.length} />
        <p className="muted">{done}/{tasks.length} {t("tasks")}</p>
      </div>
      {next.length > 0 && (
        <div className="card">
          <h3>{t("schedule")}</h3>
          {next.map((s) => <p key={s.id} style={{ margin: "4px 0" }}><b>{s.startsAt.toLocaleTimeString(locale, { timeStyle: "short" })}</b> · {s.title}</p>)}
        </div>
      )}
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <Link className="btn ghost" href={`/app/events/${id}/print`}>{t("printView")}</Link>
      </div>
      {canManage(user) ? (
        <form action={updateEvent} className="card">
          <input type="hidden" name="eventId" value={id} />
          <h3>{t("edit")}</h3>
          <EventFields t={t} ev={ev} clients={clients} />
          <p><button>{t("save")}</button></p>
        </form>
      ) : (
        <div className="card"><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{ev.description || "—"}</p><p className="muted">{t("organizer")}: {ev.organizer.name}</p></div>
      )}
      {canManage(user) && (
        <form action={deleteEvent}>
          <input type="hidden" name="eventId" value={id} />
          <ConfirmDelete label={t("delete")} msg={t("confirmDelete")} />
        </form>
      )}
    </>
  );
}
import ConfirmDelete from "@/app/ConfirmDelete";
