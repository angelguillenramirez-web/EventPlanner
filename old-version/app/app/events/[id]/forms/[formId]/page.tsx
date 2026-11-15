import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { addFormField, deleteForm, removeFormField, toggleForm } from "@/app/actions";
import { FIELD_TYPES, type FormField } from "@/lib/constants";
import { appUrl } from "@/lib/util";
import ConfirmDelete from "@/app/ConfirmDelete";

export default async function FormDetail({ params }: { params: Promise<{ id: string; formId: string }> }) {
  const { id, formId } = await params;
  const user = await requireUser();
  await getEventFor(user, id);
  const { t, locale } = await getT();
  const form = await db.form.findUnique({ where: { id: formId }, include: { responses: { orderBy: { createdAt: "desc" } } } });
  if (!form || form.eventId !== id) notFound();
  const fields: FormField[] = JSON.parse(form.fields);
  const manage = canManage(user);
  return (
    <>
      <h2>{form.title}</h2>
      <div className="card">
        <div className="row between">
          <span className={`badge ${form.isOpen ? "ok" : "bad"}`}>{form.isOpen ? t("open") : t("closed")}</span>
          {manage && (
            <div className="row">
              <form action={toggleForm}><input type="hidden" name="formId" value={form.id} /><button className="ghost sm">{t("toggleOpen")}</button></form>
              <form action={deleteForm}><input type="hidden" name="formId" value={form.id} /><ConfirmDelete small label={t("delete")} msg={t("confirmDelete")} /></form>
            </div>
          )}
        </div>
        <p className="muted">{t("shareLink")}: <a href={`/f/${form.token}`} target="_blank">{appUrl()}/f/{form.token}</a></p>
      </div>

      {manage && (
        <form action={addFormField} className="card fields">
          <input type="hidden" name="formId" value={form.id} />
          <div className="full"><label htmlFor="label">{t("fieldLabel")}</label><input id="label" name="label" required /></div>
          <div><label htmlFor="type">{t("fieldType")}</label><select id="type" name="type">{FIELD_TYPES.map((x) => <option key={x} value={x}>{t("ft." + x)}</option>)}</select></div>
          <div><label htmlFor="options">{t("options")}</label><input id="options" name="options" /></div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}><input type="checkbox" name="required" /> {t("required")}</label>
          <button>{t("addField")}</button>
        </form>
      )}

      <div className="card">
        {fields.map((f) => (
          <div key={f.id} className="task">
            <div className="t">{f.label} {f.required && "*"} <span className="muted">· {t("ft." + f.type)}{f.options ? ` (${f.options.join(", ")})` : ""}</span></div>
            {manage && <form action={removeFormField}><input type="hidden" name="formId" value={form.id} /><input type="hidden" name="fieldId" value={f.id} /><ConfirmDelete small label="✕" msg={t("confirmDelete")} /></form>}
          </div>
        ))}
        {fields.length === 0 && <p className="muted">{t("noItems")}</p>}
      </div>

      <div className="row between">
        <h3>{t("responses")} ({form.responses.length})</h3>
        <a className="btn ghost sm" href={`/api/events/${id}/forms/${form.id}/responses.csv`}>{t("exportCsv")}</a>
      </div>
      <div className="card tablewrap">
        {form.responses.length === 0 ? <p className="muted">{t("noResponses")}</p> : (
          <table>
            <thead><tr><th>{t("name")}</th>{fields.map((f) => <th key={f.id}>{f.label}</th>)}<th>{t("date")}</th></tr></thead>
            <tbody>
              {form.responses.map((r) => {
                const a = JSON.parse(r.answers) as Record<string, string>;
                return <tr key={r.id}><td>{r.respondent}</td>{fields.map((f) => <td key={f.id}>{a[f.id]}</td>)}<td>{r.createdAt.toLocaleDateString(locale)}</td></tr>;
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
