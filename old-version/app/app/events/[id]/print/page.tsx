import { db } from "@/lib/db";
import { getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import PrintButton from "./PrintButton";

export default async function PrintView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEventFor(user, id);
  const { t, locale } = await getT();
  const [tasks, schedule, guests] = await Promise.all([
    db.checklistItem.findMany({ where: { eventId: id }, orderBy: { position: "asc" } }),
    db.scheduleItem.findMany({ where: { eventId: id }, orderBy: { startsAt: "asc" } }),
    db.guest.findMany({ where: { eventId: id }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PrintButton label={t("printView")} />
      <h1>{ev.title}</h1>
      <p>{ev.date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })} · {ev.venue}</p>
      <div className="card"><h2>{t("schedule")}</h2>
        {schedule.map((s) => <p key={s.id} style={{ margin: "3px 0" }}><b>{s.startsAt.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</b> {s.title} {s.location && `(${s.location})`}</p>)}</div>
      <div className="card"><h2>{t("checklist")}</h2>
        {tasks.map((c) => <p key={c.id} style={{ margin: "3px 0" }}>{c.done ? "☑" : "☐"} {c.title} <span className="muted">{c.dueDate?.toLocaleDateString(locale)}</span></p>)}</div>
      <div className="card"><h2>{t("guests")} ({guests.reduce((n, g) => n + g.attendees, 0)})</h2>
        {guests.map((g) => <p key={g.id} style={{ margin: "3px 0" }}>{g.name} — {t("g." + g.status)}{g.attendees ? ` (${g.attendees})` : ""}{g.dietary && ` · ${g.dietary}`}</p>)}</div>
    </>
  );
}
