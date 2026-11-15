import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { addScheduleItem, deleteScheduleItem } from "@/app/actions";
import ConfirmDelete from "@/app/ConfirmDelete";
import { toInputDT } from "@/lib/util";

export default async function Schedule({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEventFor(user, id);
  const { t, locale } = await getT();
  const items = await db.scheduleItem.findMany({ where: { eventId: id }, orderBy: { startsAt: "asc" } });
  const manage = canManage(user);
  const tm = (d: Date) => d.toLocaleTimeString(locale, { timeStyle: "short" });
  let lastDay = "";
  return (
    <>
      {manage && (
        <form action={addScheduleItem} className="card fields">
          <input type="hidden" name="eventId" value={id} />
          <div className="full"><label htmlFor="title">{t("title")}</label><input id="title" name="title" required /></div>
          <div><label htmlFor="startsAt">{t("startsAt")}</label><input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={toInputDT(ev.date)} /></div>
          <div><label htmlFor="endsAt">{t("endsAt")}</label><input id="endsAt" name="endsAt" type="datetime-local" /></div>
          <div><label htmlFor="location">{t("location")}</label><input id="location" name="location" /></div>
          <div className="full"><label htmlFor="notes">{t("notes")}</label><input id="notes" name="notes" /></div>
          <button>{t("addItem")}</button>
        </form>
      )}
      {items.length === 0 && <p className="muted">{t("noItems")}</p>}
      <div className="timeline">
        {items.map((s) => {
          const day = s.startsAt.toLocaleDateString(locale, { dateStyle: "full" });
          const head = day !== lastDay ? <h3 style={{ marginTop: 12 }}>{day}</h3> : null;
          lastDay = day;
          return (
            <div key={s.id}>
              {head}
              <div className="item">
                <b>{tm(s.startsAt)}{s.endsAt && ` – ${tm(s.endsAt)}`}</b> · {s.title}
                {s.location && <span className="muted"> · 📍 {s.location}</span>}
                {s.notes && <div className="muted">{s.notes}</div>}
                {manage && <form action={deleteScheduleItem} style={{ display: "inline", marginLeft: 8 }}><input type="hidden" name="id" value={s.id} /><ConfirmDelete small label="✕" msg={t("confirmDelete")} /></form>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
