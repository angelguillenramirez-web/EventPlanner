"use server";

import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { checkPassword, endSession, getEventFor, getManagedEvent, hashPassword, requireRole, requireUser, startSession } from "@/lib/auth";
import { CHECKLIST_TEMPLATES, EVENT_STATUSES, EVENT_TYPES, FIELD_TYPES, MAX_UPLOAD_BYTES, type FormField } from "@/lib/constants";
import { appUrl, dateOrNull, num, parseCsv, str, uploadDir } from "@/lib/util";
import { getLang } from "@/lib/i18n";

const touch = (eventId: string) => revalidatePath(`/app/events/${eventId}`, "layout");

/* ---------- auth & session ---------- */
export async function login(_: unknown, fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(String(fd.get("password") ?? ""), user.passwordHash))) return { error: true };
  await startSession(user.id);
  redirect("/app");
}
export async function logout() {
  await endSession();
  redirect("/login");
}
export async function setLang(fd: FormData) {
  const lang = str(fd, "lang") === "en" ? "en" : "es";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  let back = str(fd, "back");
  try {
    const ref = (await headers()).get("referer");
    if (ref) { const u = new URL(ref); back = u.pathname + u.search; }
  } catch {}
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}

/* ---------- users ---------- */
// Superadmin creates organizers/clients; organizers may only create clients.
export async function createUser(_: unknown, fd: FormData) {
  const me = await requireRole("SUPERADMIN", "ORGANIZER");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  let role = str(fd, "role");
  if (me.role === "ORGANIZER") role = "CLIENT";
  if (!["ORGANIZER", "CLIENT"].includes(role) || !email || !name) return { error: "invalid" };
  if (await db.user.findUnique({ where: { email } })) return { error: "emailTaken" };
  const temp = randomUUID().slice(0, 8);
  await db.user.create({ data: { email, name, role, passwordHash: await hashPassword(temp), createdById: me.id } });
  revalidatePath("/app/users");
  return { ok: true, temp, email };
}
// Only the superadmin can delete users (and never themself).
export async function deleteUser(fd: FormData) {
  const me = await requireRole("SUPERADMIN");
  const id = str(fd, "id");
  if (id === me.id) return;
  const owned = await db.event.count({ where: { organizerId: id } });
  if (owned > 0) return; // protect data: reassign/delete events first
  await db.event.updateMany({ where: { clientId: id }, data: { clientId: null } });
  await db.user.delete({ where: { id } });
  revalidatePath("/app/users");
}
export async function changePassword(fd: FormData) {
  const me = await requireUser();
  const p = String(fd.get("password") ?? "");
  if (p.length < 8) return;
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(p) } });
}

/* ---------- events ---------- */
function eventData(fd: FormData) {
  const type = str(fd, "type");
  const status = str(fd, "status");
  return {
    title: str(fd, "title") || "Untitled",
    type: (EVENT_TYPES as readonly string[]).includes(type) ? type : "OTHER",
    status: (EVENT_STATUSES as readonly string[]).includes(status) ? status : "PLANNING",
    date: dateOrNull(str(fd, "date")) ?? new Date(),
    venue: str(fd, "venue"),
    description: str(fd, "description"),
    rsvpDeadline: dateOrNull(str(fd, "rsvpDeadline")),
  };
}
async function validClientId(me: { id: string; role: string }, id: string) {
  if (!id) return null;
  const c = await db.user.findUnique({ where: { id } });
  if (!c || c.role !== "CLIENT") return null;
  if (me.role === "ORGANIZER" && c.createdById !== me.id) return null;
  return c.id;
}
export async function createEvent(fd: FormData) {
  const me = await requireRole("SUPERADMIN", "ORGANIZER");
  const data = eventData(fd);
  const clientId = await validClientId(me, str(fd, "clientId"));
  const ev = await db.event.create({ data: { ...data, organizerId: me.id, clientId } });
  if (str(fd, "template") === "on") {
    const lang = await getLang();
    const tpl = CHECKLIST_TEMPLATES[data.type] ?? CHECKLIST_TEMPLATES.OTHER;
    await db.checklistItem.createMany({
      data: tpl.map(([category, es, en, days], i) => ({
        eventId: ev.id, category, title: lang === "es" ? es : en, position: i,
        dueDate: new Date(data.date.getTime() - days * 86400000),
      })),
    });
  }
  redirect(`/app/events/${ev.id}`);
}
export async function updateEvent(fd: FormData) {
  const me = await requireUser();
  const ev = await getManagedEvent(me, str(fd, "eventId"));
  const clientId = await validClientId(me, str(fd, "clientId"));
  await db.event.update({ where: { id: ev.id }, data: { ...eventData(fd), clientId } });
  touch(ev.id);
}
export async function deleteEvent(fd: FormData) {
  const me = await requireUser();
  const ev = await getManagedEvent(me, str(fd, "eventId"));
  const docs = await db.document.findMany({ where: { eventId: ev.id } });
  await Promise.all(docs.map((d) => unlink(path.join(uploadDir(), d.storedName)).catch(() => {})));
  await db.event.delete({ where: { id: ev.id } });
  redirect("/app");
}

/* ---------- checklist (client may edit too) ---------- */
export async function addTask(fd: FormData) {
  const me = await requireUser();
  const ev = await getEventFor(me, str(fd, "eventId"));
  const title = str(fd, "title");
  if (!title) return;
  const last = await db.checklistItem.aggregate({ where: { eventId: ev.id }, _max: { position: true } });
  await db.checklistItem.create({
    data: { eventId: ev.id, title, category: str(fd, "category"), dueDate: dateOrNull(str(fd, "due")), position: (last._max.position ?? 0) + 1 },
  });
  touch(ev.id);
}
export async function toggleTask(fd: FormData) {
  const me = await requireUser();
  const item = await db.checklistItem.findUnique({ where: { id: str(fd, "id") } });
  if (!item) return;
  await getEventFor(me, item.eventId);
  await db.checklistItem.update({ where: { id: item.id }, data: { done: !item.done } });
  touch(item.eventId);
}
export async function deleteTask(fd: FormData) {
  const me = await requireUser();
  const item = await db.checklistItem.findUnique({ where: { id: str(fd, "id") } });
  if (!item) return;
  await getEventFor(me, item.eventId);
  await db.checklistItem.delete({ where: { id: item.id } });
  touch(item.eventId);
}

/* ---------- schedule (organizer only) ---------- */
export async function addScheduleItem(fd: FormData) {
  const me = await requireUser();
  const ev = await getManagedEvent(me, str(fd, "eventId"));
  const startsAt = dateOrNull(str(fd, "startsAt"));
  const title = str(fd, "title");
  if (!startsAt || !title) return;
  let endsAt = dateOrNull(str(fd, "endsAt"));
  if (endsAt && endsAt < startsAt) endsAt = null; // rule: end must not precede start
  await db.scheduleItem.create({ data: { eventId: ev.id, title, startsAt, endsAt, location: str(fd, "location"), notes: str(fd, "notes") } });
  touch(ev.id);
}
export async function deleteScheduleItem(fd: FormData) {
  const me = await requireUser();
  const item = await db.scheduleItem.findUnique({ where: { id: str(fd, "id") } });
  if (!item) return;
  await getManagedEvent(me, item.eventId);
  await db.scheduleItem.delete({ where: { id: item.id } });
  touch(item.eventId);
}

/* ---------- guests ---------- */
export async function addGuest(fd: FormData) {
  const me = await requireUser();
  const ev = await getEventFor(me, str(fd, "eventId"));
  const name = str(fd, "name");
  if (!name) return;
  await db.guest.create({
    data: { eventId: ev.id, name, email: str(fd, "email").toLowerCase(), phone: str(fd, "phone"), maxParty: Math.max(1, num(fd, "maxParty", 1)) },
  });
  touch(ev.id);
}
export async function deleteGuest(fd: FormData) {
  const me = await requireUser();
  const g = await db.guest.findUnique({ where: { id: str(fd, "id") } });
  if (!g) return;
  await getEventFor(me, g.eventId);
  await db.guest.delete({ where: { id: g.id } });
  touch(g.eventId);
}
export async function importGuests(fd: FormData) {
  const me = await requireUser();
  const ev = await getEventFor(me, str(fd, "eventId"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024) return;
  const rows = parseCsv(await file.text());
  const data = rows
    .filter((r) => r[0]?.trim() && !/^(name|nombre)$/i.test(r[0].trim()))
    .slice(0, 2000)
    .map((r) => ({
      eventId: ev.id, name: r[0].trim(), email: (r[1] ?? "").trim().toLowerCase(), phone: (r[2] ?? "").trim(),
      maxParty: Math.max(1, parseInt(r[3] ?? "1", 10) || 1),
    }));
  if (data.length) await db.guest.createMany({ data });
  touch(ev.id);
}

/* ---------- invitations ---------- */
async function sendInvite(ev: { id: string; title: string; date: Date; venue: string; rsvpDeadline: Date | null }, guest: { id: string; name: string; email: string; token: string }, lang: string, reminder = false) {
  const link = `${appUrl()}/rsvp/${guest.token}`;
  const when = ev.date.toLocaleString(lang === "es" ? "es-MX" : "en-US", { dateStyle: "full", timeStyle: "short" });
  const es = lang === "es";
  const subject = reminder
    ? (es ? `Recordatorio: confirma tu asistencia a ${ev.title}` : `Reminder: please RSVP to ${ev.title}`)
    : (es ? `Estás invitado a ${ev.title}` : `You're invited to ${ev.title}`);
  const body = es
    ? `Hola ${guest.name},\n\nTe invitamos a ${ev.title}.\nFecha: ${when}\n${ev.venue ? "Lugar: " + ev.venue + "\n" : ""}\nPor favor confirma tu asistencia aquí:\n${link}\n`
    : `Hi ${guest.name},\n\nYou're invited to ${ev.title}.\nDate: ${when}\n${ev.venue ? "Venue: " + ev.venue + "\n" : ""}\nPlease RSVP here:\n${link}\n`;
  await db.emailLog.create({ data: { eventId: ev.id, guestId: guest.id, toEmail: guest.email, subject, body } });
  await db.guest.update({ where: { id: guest.id }, data: { invitedAt: new Date() } });
}
export async function inviteGuest(fd: FormData) {
  const me = await requireUser();
  const g = await db.guest.findUnique({ where: { id: str(fd, "id") } });
  if (!g) return;
  const ev = await getManagedEvent(me, g.eventId);
  await sendInvite(ev, g, await getLang());
  touch(ev.id);
}
export async function inviteAll(fd: FormData) {
  const me = await requireUser();
  const ev = await getManagedEvent(me, str(fd, "eventId"));
  const mode = str(fd, "mode"); // "new" = never invited, "remind" = invited but pending
  const guests = await db.guest.findMany({
    where: { eventId: ev.id, status: "PENDING", ...(mode === "remind" ? { invitedAt: { not: null } } : { invitedAt: null }) },
  });
  const lang = await getLang();
  for (const g of guests) await sendInvite(ev, g, lang, mode === "remind");
  touch(ev.id);
}

/* ---------- public RSVP (no login; guarded by the guest's secret token) ---------- */
export async function submitRsvp(fd: FormData) {
  const token = str(fd, "token");
  const g = await db.guest.findUnique({ where: { token }, include: { event: true } });
  if (!g) notFound();
  const closed = g.event.status === "CANCELLED" || (g.event.rsvpDeadline && g.event.rsvpDeadline.getTime() + 86400000 < Date.now());
  if (closed) redirect(`/rsvp/${token}`);
  const attending = str(fd, "answer") === "yes";
  // rule: attendees ≤ seats allotted; declining → 0 attendees
  const attendees = attending ? Math.min(g.maxParty, Math.max(1, num(fd, "attendees", 1))) : 0;
  await db.guest.update({
    where: { id: g.id },
    data: {
      status: attending ? "ATTENDING" : "DECLINED", attendees,
      dietary: attending ? str(fd, "dietary").slice(0, 300) : "", message: str(fd, "message").slice(0, 500), respondedAt: new Date(),
    },
  });
  touch(g.eventId);
  redirect(`/rsvp/${token}?saved=1`);
}

/* ---------- forms ---------- */
export async function createForm(fd: FormData) {
  const me = await requireUser();
  const ev = await getManagedEvent(me, str(fd, "eventId"));
  const title = str(fd, "title");
  if (!title) return;
  const f = await db.form.create({ data: { eventId: ev.id, title, description: str(fd, "description") } });
  redirect(`/app/events/${ev.id}/forms/${f.id}`);
}
async function managedForm(id: string) {
  const me = await requireUser();
  const f = await db.form.findUnique({ where: { id } });
  if (!f) notFound();
  await getManagedEvent(me, f.eventId);
  return f;
}
export async function addFormField(fd: FormData) {
  const f = await managedForm(str(fd, "formId"));
  const label = str(fd, "label");
  const type = str(fd, "type") as FormField["type"];
  if (!label || !FIELD_TYPES.includes(type)) return;
  const fields: FormField[] = JSON.parse(f.fields);
  const options = type === "select" ? str(fd, "options").split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  if (type === "select" && !options?.length) return;
  fields.push({ id: randomUUID().slice(0, 8), label, type, options, required: str(fd, "required") === "on" });
  await db.form.update({ where: { id: f.id }, data: { fields: JSON.stringify(fields) } });
  touch(f.eventId);
}
export async function removeFormField(fd: FormData) {
  const f = await managedForm(str(fd, "formId"));
  const fields: FormField[] = JSON.parse(f.fields).filter((x: FormField) => x.id !== str(fd, "fieldId"));
  await db.form.update({ where: { id: f.id }, data: { fields: JSON.stringify(fields) } });
  touch(f.eventId);
}
export async function toggleForm(fd: FormData) {
  const f = await managedForm(str(fd, "formId"));
  await db.form.update({ where: { id: f.id }, data: { isOpen: !f.isOpen } });
  touch(f.eventId);
}
export async function deleteForm(fd: FormData) {
  const f = await managedForm(str(fd, "formId"));
  await db.form.delete({ where: { id: f.id } });
  redirect(`/app/events/${f.eventId}/forms`);
}
export async function submitFormResponse(fd: FormData) {
  const token = str(fd, "token");
  const f = await db.form.findUnique({ where: { token } });
  if (!f) notFound();
  if (!f.isOpen) redirect(`/f/${token}`);
  const fields: FormField[] = JSON.parse(f.fields);
  const answers: Record<string, string> = {};
  for (const fld of fields) {
    let v = fld.type === "checkbox" ? (fd.get(fld.id) ? "yes" : "no") : str(fd, fld.id).slice(0, 2000);
    if (fld.type === "select" && !fld.options?.includes(v)) v = "";
    if (fld.type === "number" && v && isNaN(Number(v))) v = "";
    if (fld.required && fld.type !== "checkbox" && !v) redirect(`/f/${token}?missing=1`);
    answers[fld.id] = v;
  }
  await db.formResponse.create({ data: { formId: f.id, respondent: str(fd, "respondent").slice(0, 120), answers: JSON.stringify(answers) } });
  touch(f.eventId);
  redirect(`/f/${token}?saved=1`);
}

/* ---------- documents ---------- */
export async function uploadDocument(_: unknown, fd: FormData) {
  const me = await requireUser();
  const ev = await getEventFor(me, str(fd, "eventId"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "invalid" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "tooBig" };
  await mkdir(uploadDir(), { recursive: true });
  const storedName = randomUUID(); // never use the client-supplied name on disk
  await writeFile(path.join(uploadDir(), storedName), Buffer.from(await file.arrayBuffer()));
  await db.document.create({
    data: {
      eventId: ev.id, name: file.name.slice(0, 200), category: str(fd, "category"), mime: file.type || "application/octet-stream",
      size: file.size, storedName, uploadedById: me.id,
      visibleToClient: me.role === "CLIENT" ? true : str(fd, "visibleToClient") === "on",
    },
  });
  touch(ev.id);
  return { ok: true };
}
export async function deleteDocument(fd: FormData) {
  const me = await requireUser();
  const d = await db.document.findUnique({ where: { id: str(fd, "id") } });
  if (!d) return;
  const ev = await getEventFor(me, d.eventId);
  if (me.role === "CLIENT" && d.uploadedById !== me.id) return; // clients delete only their own uploads
  void ev;
  await unlink(path.join(uploadDir(), d.storedName)).catch(() => {});
  await db.document.delete({ where: { id: d.id } });
  touch(d.eventId);
}
