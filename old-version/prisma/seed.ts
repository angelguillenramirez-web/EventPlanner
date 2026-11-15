import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const day = 86400000;

async function main() {
  if ((await db.user.count()) > 0) { console.log("Database already seeded."); return; }
  const h = (p: string) => bcrypt.hashSync(p, 10);
  const admin = await db.user.create({ data: { email: "admin@fiesta.test", name: "Super Admin", role: "SUPERADMIN", passwordHash: h("admin1234") } });
  const org = await db.user.create({ data: { email: "organizer@fiesta.test", name: "Laura Planner", role: "ORGANIZER", passwordHash: h("organizer1234"), createdById: admin.id } });
  const client = await db.user.create({ data: { email: "client@fiesta.test", name: "Ana & Luis", role: "CLIENT", passwordHash: h("client1234"), createdById: org.id } });

  const date = new Date(Date.now() + 60 * day); date.setHours(18, 0, 0, 0);
  const ev = await db.event.create({
    data: { title: "Boda de Ana & Luis", type: "WEDDING", status: "PLANNING", date, venue: "Hacienda Los Arcos", description: "Ceremonia y recepción.", rsvpDeadline: new Date(Date.now() + 40 * day), organizerId: org.id, clientId: client.id },
  });
  const tasks: [string, string, boolean, number][] = [
    ["Reservar lugar", "Venue", true, -120], ["Contratar catering", "Food", true, -60], ["Contratar fotógrafo", "Vendors", false, -30],
    ["Enviar invitaciones", "Invitations", false, -45], ["Plan de mesas", "Seating", false, -7],
  ];
  await db.checklistItem.createMany({ data: tasks.map(([title, category, done, off], i) => ({ eventId: ev.id, title, category, done, position: i, dueDate: new Date(date.getTime() + off * day) })) });
  const at = (h: number, m = 0) => { const d = new Date(date); d.setHours(h, m); return d; };
  await db.scheduleItem.createMany({ data: [
    { eventId: ev.id, title: "Llegada de invitados", startsAt: at(17, 30), location: "Jardín" },
    { eventId: ev.id, title: "Ceremonia", startsAt: at(18), endsAt: at(19), location: "Capilla" },
    { eventId: ev.id, title: "Cena", startsAt: at(20), endsAt: at(22), location: "Salón principal" },
  ] });
  await db.guest.createMany({ data: [
    { eventId: ev.id, name: "María López", email: "maria@example.com", maxParty: 2, status: "ATTENDING", attendees: 2, respondedAt: new Date(), invitedAt: new Date() },
    { eventId: ev.id, name: "Carlos Ruiz", email: "carlos@example.com", maxParty: 1, status: "DECLINED", respondedAt: new Date(), invitedAt: new Date() },
    { eventId: ev.id, name: "Familia Pérez", email: "perez@example.com", maxParty: 4 },
  ] });
  await db.form.create({ data: { eventId: ev.id, title: "Menú y música", description: "Cuéntanos tus preferencias", fields: JSON.stringify([
    { id: "a1", label: "Platillo", type: "select", options: ["Pollo", "Res", "Vegetariano"], required: true },
    { id: "a2", label: "Canción que no puede faltar", type: "text", required: false },
  ]) } });
  console.log("Seeded. Accounts: admin@fiesta.test / admin1234, organizer@fiesta.test / organizer1234, client@fiesta.test / client1234");
}
main().finally(() => db.$disconnect());
