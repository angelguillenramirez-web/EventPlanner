import { db } from "@/lib/db";
import { getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { addTask, deleteTask, toggleTask } from "@/app/actions";
import { Bar } from "@/app/components";
import ConfirmDelete from "@/app/ConfirmDelete";

export default async function Checklist({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  await getEventFor(user, id);
  const { t, locale } = await getT();
  const items = await db.checklistItem.findMany({ where: { eventId: id }, orderBy: [{ done: "asc" }, { dueDate: "asc" }, { position: "asc" }] });
  const done = items.filter((i) => i.done).length;
  const now = Date.now();
  return (
    <>
      <div className="card">
        <Bar value={done} max={items.length} />
        <p className="muted" style={{ margin: "6px 0 0" }}>{done}/{items.length} {t("tasks")}</p>
      </div>
      <form action={addTask} className="card fields">
        <input type="hidden" name="eventId" value={id} />
        <div className="full"><label htmlFor="title">{t("addTask")}</label><input id="title" name="title" required /></div>
        <div><label htmlFor="category">{t("category")}</label><input id="category" name="category" /></div>
        <div><label htmlFor="due">{t("due")}</label><input id="due" name="due" type="date" /></div>
        <button>{t("add")}</button>
      </form>
      <div className="card">
        {items.length === 0 && <p className="muted">{t("noItems")}</p>}
        {items.map((i) => {
          const late = !i.done && i.dueDate && i.dueDate.getTime() < now;
          return (
            <div key={i.id} className={`task${i.done ? " done" : ""}`}>
              <form action={toggleTask}><input type="hidden" name="id" value={i.id} /><button className="check" aria-label={i.title} aria-pressed={i.done}>{i.done ? "✓" : ""}</button></form>
              <div className="t">{i.title}<br /><span className="muted">{i.category}{i.category && i.dueDate ? " · " : ""}{i.dueDate?.toLocaleDateString(locale, { dateStyle: "medium" })}</span></div>
              {late && <span className="badge bad">{t("overdue")}</span>}
              <form action={deleteTask}><input type="hidden" name="id" value={i.id} /><ConfirmDelete small label="✕" msg={t("confirmDelete")} /></form>
            </div>
          );
        })}
      </div>
    </>
  );
}
