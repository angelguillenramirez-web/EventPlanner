import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { canManage, getEventFor, getUser } from "@/lib/auth";
import { uploadDir } from "@/lib/util";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  await getEventFor(user, doc.eventId); // 404s when the user has no access
  if (!canManage(user) && !doc.visibleToClient) return new Response("Not found", { status: 404 });
  const data = await readFile(path.join(uploadDir(), doc.storedName)).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
