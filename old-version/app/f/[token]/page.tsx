import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { submitFormResponse } from "@/app/actions";
import { LangSwitch } from "@/app/components";
import type { FormField } from "@/lib/constants";

export default async function PublicForm({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ saved?: string; missing?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const form = await db.form.findUnique({ where: { token }, include: { event: true } });
  if (!form) notFound();
  const { t } = await getT();
  const fields: FormField[] = JSON.parse(form.fields);
  return (
    <div className="center card" style={{ margin: "4vh auto" }}>
      <div className="row between"><span className="muted">{form.event.title}</span><LangSwitch back={`/f/${token}`} /></div>
      <h1>{form.title}</h1>
      {form.description && <p className="muted">{form.description}</p>}
      {sp.saved ? <p className="okmsg" role="status">{t("thanks")}</p> : !form.isOpen ? <p className="err">{t("formClosed")}</p> : (
        <form action={submitFormResponse} className="fields" style={{ gridTemplateColumns: "1fr" }}>
          <input type="hidden" name="token" value={token} />
          {sp.missing && <p className="err" role="alert">*</p>}
          <div><label htmlFor="respondent">{t("yourName")}</label><input id="respondent" name="respondent" maxLength={120} /></div>
          {fields.map((f) => (
            <div key={f.id}>
              {f.type === "checkbox" ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)" }}><input type="checkbox" name={f.id} /> {f.label}</label>
              ) : (
                <>
                  <label htmlFor={f.id}>{f.label}{f.required && " *"}</label>
                  {f.type === "textarea" ? <textarea id={f.id} name={f.id} rows={3} required={f.required} />
                    : f.type === "select" ? <select id={f.id} name={f.id} required={f.required}><option value="">—</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
                    : <input id={f.id} name={f.id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} required={f.required} />}
                </>
              )}
            </div>
          ))}
          <button>{t("submit")}</button>
        </form>
      )}
    </div>
  );
}
