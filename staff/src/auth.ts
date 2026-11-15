import { checkPassword, hashPassword, passwordIssues, verifyTotp } from "./crypto";
import { getState, log, setPresence, setSession, update, type Staff } from "./store";

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

export function signOut(m?: { id: string; name: string }) { if (m) { log(m.name, "Signed out"); setPresence(m.id, "offline"); } setSession(null); }
