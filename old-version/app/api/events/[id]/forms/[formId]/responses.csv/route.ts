import { db } from "@/lib/db";
import { getEventFor, getUser } from "@/lib/auth";
import { toCsv } from "@/lib/util";
import type { FormField } from "@/lib/constants";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; formId: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id, formId } = await params;
  await getEventFor(user, id);
  const form = await db.form.findUnique({ where: { id: formId }, include: { responses: { orderBy: { createdAt: "asc" } } } });
  if (!form || form.eventId !== id) return new Response("Not found", { status: 404 });
  const fields: FormField[] = JSON.parse(form.fields);
  const csv = toCsv([
    ["respondent", ...fields.map((f) => f.label), "submitted"],
    ...form.responses.map((r) => { const a = JSON.parse(r.answers); return [r.respondent, ...fields.map((f) => a[f.id] ?? ""), r.createdAt.toISOString()]; }),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="responses-${form.id}.csv"` } });
}
