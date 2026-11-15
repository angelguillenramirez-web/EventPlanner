import { db } from "@/lib/db";
import { getEventFor, getUser } from "@/lib/auth";
import { toCsv } from "@/lib/util";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ev = await getEventFor(user, id);
  const guests = await db.guest.findMany({ where: { eventId: id }, orderBy: { name: "asc" } });
  const csv = toCsv([
    ["name", "email", "phone", "seats", "status", "attendees", "dietary", "message"],
    ...guests.map((g) => [g.name, g.email, g.phone, g.maxParty, g.status, g.attendees, g.dietary, g.message]),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="guests-${ev.id}.csv"` } });
}
