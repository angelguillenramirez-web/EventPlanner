import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Role } from "./constants";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const COOKIE = "session";

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function startSession(userId: string) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === "production" });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return await db.user.findUnique({ where: { id: payload.uid as string } });
  } catch {
    return null;
  }
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
export async function requireRole(...roles: Role[]) {
  const u = await requireUser();
  if (!roles.includes(u.role as Role)) notFound();
  return u;
}

export const canManage = (u: { role: string }) => u.role === "SUPERADMIN" || u.role === "ORGANIZER";

/** Loads an event if the user may see it; 404 otherwise. */
export async function getEventFor(user: SessionUser, id: string) {
  const e = await db.event.findUnique({ where: { id }, include: { organizer: true, client: true } });
  if (!e) notFound();
  const ok =
    user.role === "SUPERADMIN" ||
    (user.role === "ORGANIZER" && e.organizerId === user.id) ||
    (user.role === "CLIENT" && e.clientId === user.id);
  if (!ok) notFound();
  return e;
}
/** Same as getEventFor but requires organizer/superadmin. */
export async function getManagedEvent(user: SessionUser, id: string) {
  if (!canManage(user)) notFound();
  return getEventFor(user, id);
}
