import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createEvent } from "@/app/actions";
import { EventFields } from "../EventFields";

export default async function NewEvent() {
  const me = await requireRole("SUPERADMIN", "ORGANIZER");
  const { t } = await getT();
  const clients = await db.user.findMany({ where: { role: "CLIENT", ...(me.role === "ORGANIZER" ? { createdById: me.id } : {}) }, orderBy: { name: "asc" } });
  return (
    <>
      <h1>{t("newEvent")}</h1>
      <form action={createEvent} className="card">
        <EventFields t={t} clients={clients} />
        <p><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="template" defaultChecked /> {t("useTemplate")}</label></p>
        <button>{t("create")}</button>
      </form>
    </>
  );
}
