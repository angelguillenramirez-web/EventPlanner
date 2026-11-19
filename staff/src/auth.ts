import { checkPassword, hashPassword, passwordIssues, verifyTotp } from "./crypto";
import { getState, log, setPresence, setSession, update, type Staff } from "./store";
import { SUPABASE_AUTH, supabase } from "./supabase";

export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60_000;
const GENERIC = "Invalid email, password or code.";

const byEmail = (email: string) => getState().staff.find((m) => m.email.toLowerCase() === email.trim().toLowerCase());
const fail = (id: string) => update((s) => {
  const m = s.staff.find((x) => x.id === id);
  if (!m) return;
  m.failed += 1;
  if (m.failed >= MAX_FAILS) { m.lockedUntil = Date.now() + LOCK_MS; m.failed = 0; s.audit.unshift({ id: Math.random().toString(36).slice(2), at: Date.now(), by: "System", action: "Account locked after failed sign-ins", target: m.email }); }
});

export type Step1 = { ok: true; staff: Staff } | { ok: false; error: string };
/** Step 1: email + password. The reply never says which of the two was wrong (no account enumeration). */
export async function checkCredentials(email: string, password: string): Promise<Step1> {
  const m = byEmail(email);
  if (!m) { await hashPassword(password); return { ok: false, error: GENERIC }; } // equalise timing
  if (m.lockedUntil > Date.now()) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((m.lockedUntil - Date.now()) / 60000)} min or ask a super admin to unlock the account.` };
  if (!m.active) { await hashPassword(password); return { ok: false, error: GENERIC }; }
  if (!(await checkPassword(password, m.salt, m.hash))) { fail(m.id); return { ok: false, error: GENERIC }; }
  return { ok: true, staff: m };
}

/** Sets a new password (first login or forced change). */
export async function changePassword(staffId: string, current: string, next: string): Promise<string | null> {
  const m = getState().staff.find((x) => x.id === staffId);
  if (!m) return "Account not found.";
  const issues = passwordIssues(next);
  if (issues.length) return "Password needs " + issues.join(", ") + ".";
  if (current === next) return "Choose a different password.";
  const { salt, hash } = await hashPassword(next);
  update((s) => { const x = s.staff.find((y) => y.id === staffId)!; x.salt = salt; x.hash = hash; x.mustChangePassword = false; });
  log(m.name, "Changed own password");
  return null;
}

/** Step 2: authenticator code. On success the session starts. `enrolling` also marks the authenticator as set up. */
export async function checkCode(staffId: string, code: string, enrolling = false): Promise<string | null> {
  const m = getState().staff.find((x) => x.id === staffId);
  if (!m) return GENERIC;
  if (m.lockedUntil > Date.now()) return "Account temporarily locked.";
  const step = await verifyTotp(m.totpSecret, code, m.lastTotpStep);
  if (step === null) { fail(m.id); return GENERIC; }
  update((s) => { const x = s.staff.find((y) => y.id === staffId)!; x.lastTotpStep = step; x.failed = 0; x.lastLogin = Date.now(); if (enrolling) x.totpEnrolled = true; });
  setSession(m.id);
  setPresence(m.id, "online");
  log(m.name, enrolling ? "Authenticator enrolled and signed in" : "Signed in", m.email);
  return null;
}

export function signOut(m?: { id: string; name: string }) {
  if (m) { log(m.name, "Signed out"); setPresence(m.id, "offline"); }
  setSession(null);
  if (SUPABASE_AUTH) void supabase.auth.signOut();
}

/**
 * Real sign-in (email + password through Supabase Auth). Whoever is not an ACTIVE row in staff_members is signed straight
 * back out, and every failure shows the same message (no account enumeration). The local Staff record uses the Supabase
 * user id so the rest of the console works unchanged. Second factor: turned on later in the database (staff_security).
 */
type Row = { user_id: string; email: string; name: string; role: Staff["role"]; active: boolean; avatar: string | null; title: string | null; presence_note: string | null; created_at: string };
const toStaff = (row: Row, extra: Partial<Staff> = {}): Staff => ({
  id: row.user_id, name: row.name || row.email, email: row.email, role: row.role, active: row.active,
  avatar: row.avatar ?? "", title: row.title ?? "", presence: "offline", presenceNote: row.presence_note ?? "", presenceAt: Date.now(),
  salt: "", hash: "", mustChangePassword: false, totpSecret: "", totpEnrolled: true, lastTotpStep: 0, failed: 0, lockedUntil: 0,
  lastLogin: 0, createdAt: Date.parse(row.created_at) || Date.now(), ...extra,
});
let pending: Staff | null = null;

function finishSignIn(m: Staff) {
  update((s) => { const i = s.staff.findIndex((x) => x.id === m.id); if (i >= 0) s.staff[i] = { ...s.staff[i], ...m }; else s.staff.push(m); });
  setSession(m.id);
  log(m.name, "Signed in", m.email);
}

/** Reads the real staff list (RLS lets only staff do this) and makes it the console's staff list. */
export async function loadStaff(): Promise<string | null> {
  const { data, error } = await supabase.from("staff_members").select("*").order("created_at");
  if (error || !data) return "Could not load the staff list.";
  if (!data.length) return "The staff list came back empty."; // never replace the list with nothing (e.g. a request sent before the session was ready)
  update((s) => { const old = new Map(s.staff.map((x) => [x.id, x])); s.staff = (data as Row[]).map((r) => toStaff(r, { presence: old.get(r.user_id)?.presence ?? "offline", lastLogin: old.get(r.user_id)?.lastLogin ?? 0 })); });
  return null;
}

/** Super-admin actions that need the server (create account, reset password, deactivate). */
export async function staffAdmin(body: Record<string, unknown>): Promise<{ ok: true; tempPassword?: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("Staff-admin", { body });
  if (error) {
    let code = "server";
    const res = (error as { context?: Response }).context;
    try { const b = await res?.json(); code = b?.error ?? b?.message ?? b?.msg ?? code; } catch { code = "http " + (res?.status ?? "?") + " " + (error as Error).message.slice(0, 80); }
    return { ok: false, error: code };
  }
  return data?.ok ? { ok: true, tempPassword: data.tempPassword } : { ok: false, error: data?.error ?? "server" };
}

/**
 * Real sign-in (email + password through Supabase Auth). Whoever is not an ACTIVE row in staff_members is signed straight
 * back out, and every failure shows the same message (no account enumeration). The local Staff record uses the Supabase
 * user id so the rest of the console works unchanged. Returns "change" when the account still has a temporary password
 * (the person must choose their own before entering). Second factor: turned on later in the database (staff_security).
 */
export async function signInSupabase(email: string, password: string): Promise<{ error: string } | "change" | "ok"> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  const why = (x: string) => ({ error: GENERIC + (import.meta.env.DEV ? ` [dev: ${x}]` : "") });
  if (error || !data.user) return why("auth: " + (error?.message ?? "no user"));
  const { data: row, error: e2 } = await supabase.from("staff_members").select("*").eq("user_id", data.user.id).maybeSingle();
  if (e2 || !row || !row.active) { await supabase.auth.signOut(); return why("staff row: " + (e2?.message ?? (!row ? "not found or blocked by security rules" : "inactive"))); }
  const m = toStaff(row as Row, { presence: "online", lastLogin: Date.now() });
  if (data.user.user_metadata?.must_change_password) { pending = m; return "change"; }
  finishSignIn(m);
  return "ok";
}

/** Replaces the temporary password with the person's own, then finishes signing in. */
export async function setSupabasePassword(next: string): Promise<string | null> {
  if (!pending) return "Sign in again.";
  const issues = passwordIssues(next);
  if (issues.length) return "Password needs " + issues.join(", ") + ".";
  const { error } = await supabase.auth.updateUser({ password: next, data: { must_change_password: false } });
  if (error) return /same|different/i.test(error.message) ? "Choose a different password." : "Could not save the password. Try again.";
  finishSignIn(pending); pending = null;
  return null;
}

/** True while a Supabase session exists (used to drop the local session if it was ended elsewhere). */
export async function hasSupabaseSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
