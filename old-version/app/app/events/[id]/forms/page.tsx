import Link from "next/link";
import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createForm } from "@/app/actions";

export default async function Forms({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  await getEventFor(user, id);
  const { t } = await getT();
  const forms = await db.form.findMany({ where: { eventId: id }, include: { _count: { select: { responses: true } } }, orderBy: { title: "asc" } });
  return (
    <>
      {canManage(user) && (
        <form action={createForm} className="card fields">
          <input type="hidden" name="eventId" value={id} />
          <div><label htmlFor="title">{t("formTitle")}</label><input id="title" name="title" required /></div>
          <div><label htmlFor="description">{t("description")}</label><input id="description" name="description" /></div>
          <button>{t("newForm")}</button>
        </form>
      )}
      {forms.length === 0 && <p className="muted">{t("noItems")}</p>}
      <div className="grid">
        {forms.map((f) => (
          <Link key={f.id} href={`/app/events/${id}/forms/${f.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{f.title}</h3>
            <span className={`badge ${f.isOpen ? "ok" : "bad"}`}>{f.isOpen ? t("open") : t("closed")}</span>{" "}
            <span className="muted">{f._count.responses} {t("responses").toLowerCase()}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
