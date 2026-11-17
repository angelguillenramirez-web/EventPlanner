import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { CLOUD_SKIP, blankWorkspace, getState, go, subscribe, update, type Plan, type State } from "./store";

/**
 * Real accounts and cloud saving (Supabase).
 *  - Sign-up, log-in and password reset use Supabase Auth.
 *  - Each planner's workspace (everything except CLOUD_SKIP) is saved as ONE JSON row in `workspaces`,
 *    protected by row-level security (see supabase/schema.sql).
 * Collaborator / client logins are still the local prototype (they get real accounts in the next phase).
 */
const PREFIX = "sb:";
export const isCloudId = (id: string) => id.startsWith(PREFIX);

/* ── save status (shown by <CloudBadge/>) ── */
export type CloudStatus = "idle" | "saving" | "saved" | "error";
let status: CloudStatus = "idle";
const statusSubs = new Set<() => void>();
const setStatus = (s: CloudStatus) => { status = s; statusSubs.forEach((f) => f()); };
export const useCloudStatus = () => useSyncExternalStore((cb) => { statusSubs.add(cb); return () => { statusSubs.delete(cb); }; }, () => status);

/* ── internals ── */
const SYNC_KEY = "aplan-sync"; // { uid, dirty }: unsaved local changes survive a refresh or a lost connection
const readSync = (): { uid: string; dirty: boolean } => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) ?? "") ?? { uid: "", dirty: false }; } catch { return { uid: "", dirty: false }; } };
const writeSync = (uid: string, dirty: boolean) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ uid, dirty })); } catch { /* ignore */ } };

let recovery = false;    // arrived from a password-reset link: go to the new-password page, not the app
let ready = false;       // the user's workspace is loaded: only then may we save
let loadedFor = "";      // user id whose workspace is in memory
let lastSaved = "";      // JSON of the last workspace known to be in the database
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: { uid: string; json: string; data: Record<string, unknown> } | null = null;

const toWorkspace = (st: State): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(st)) if (!CLOUD_SKIP.has(k)) o[k] = v;
  const a = st.accounts.find((x) => x.id === st.sessionId);
  o.cloudAccount = a ? { profile: a.profile, company: a.company, promo: a.promo } : null;
  return o;
};

async function push(uid: string, data: Record<string, unknown>, json: string): Promise<boolean> {
  setStatus("saving");
  const { error } = await supabase.from("workspaces").upsert({ user_id: uid, data });
  if (error) { console.error("cloud save failed", error.message); setStatus("error"); return false; }
  lastSaved = json; writeSync(uid, false); setStatus("saved");
  return true;
}

async function flush() {
  const p = pending; if (!p || !ready || p.json === lastSaved) return;
  await push(p.uid, p.data, p.json);
}

/** Loads the signed-in user's workspace (or starts an empty one) and signs the app in. */
async function loadFor(user: User, fromLink: boolean) {
  if (loadedFor === user.id && ready) return;
  ready = false; loadedFor = user.id;
  const sync = readSync();
  const { data: row, error } = await supabase.from("workspaces").select("data").eq("user_id", user.id).maybeSingle();
  if (error) { console.error("cloud load failed", error.message); setStatus("error"); loadedFor = ""; return; }
  const keepLocal = sync.uid === user.id && sync.dirty && isCloudId(getState().sessionId) && getState().sessionId === PREFIX + user.id;
  const saved = (row?.data && Object.keys(row.data as object).length ? row.data : null) as (Record<string, unknown> & { cloudAccount?: { profile: State["accounts"][number]["profile"]; company?: string; promo?: string } | null }) | null;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  if (!keepLocal) {
    update((st) => {
      Object.assign(st, blankWorkspace(), saved ?? {});
      delete (st as unknown as Record<string, unknown>).cloudAccount;
      const name = st.userName || meta.full_name || (user.email ?? "");
      st.accounts = st.accounts.filter((a) => !isCloudId(a.id));
      st.accounts.push({ id: PREFIX + user.id, name, email: user.email ?? "", company: saved?.cloudAccount?.company ?? meta.company ?? "", password: "", promo: saved?.cloudAccount?.promo ?? meta.promo ?? "", token: "", confirmed: true, confirmedAt: Date.now(), createdAt: Date.parse(user.created_at) || Date.now(), profile: saved?.cloudAccount?.profile ?? null, accountType: st.accountType });
      st.loggedIn = true; st.sessionId = PREFIX + user.id; st.viewAs = ""; st.userName = name; st.userEmail = user.email ?? "";
    });
  } else update((st) => { st.loggedIn = true; st.userEmail = user.email ?? ""; });
  ready = true;
  if (cameBackFromStripe()) void waitForSubscription(); else void refreshSubscription();
  const st = getState(); const data = toWorkspace(st); const json = JSON.stringify(data);
  pending = { uid: user.id, json, data };
  if (keepLocal || !saved) await push(user.id, data, json); else { lastSaved = json; writeSync(user.id, false); setStatus("saved"); }
  if (fromLink && !recovery) { // arrived from the e-mail link: continue where sign-up left off
    const a = getState().accounts.find((x) => x.id === PREFIX + user.id);
    go(!a?.profile ? "/welcome" : !getState().accountType ? "/choose-type" : "/app");
  }
}

/** Starts listening: call once at start-up. */
export function initCloud() {
  const params = new URLSearchParams(location.search);
  const fromLink = params.has("code");
  const clean = () => { if (location.search) history.replaceState(null, "", location.pathname + location.hash); };

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recovery = true;
    // Supabase advises against awaiting its own calls inside this callback, so work is deferred.
    setTimeout(async () => {
      if (event === "PASSWORD_RECOVERY") { clean(); if (session?.user) await loadFor(session.user, false); go("/set-password"); return; }
      if (event === "SIGNED_OUT") { if (ready || loadedFor) wipe(); return; }
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) { await loadFor(session.user, fromLink); clean(); }
    }, 0);
  });

  // Save (debounced) every change, and sign out of Supabase when the app signs out.
  let prevSid = getState().sessionId;
  subscribe(() => {
    const st = getState(); const sid = st.sessionId;
    if (isCloudId(prevSid) && !sid) { // signed out of a cloud session
      const p = pending; prevSid = sid; clearTimeout(timer);
      void (async () => {
        if (p && ready && p.json !== lastSaved) await push(p.uid, p.data, p.json);
        await supabase.auth.signOut(); wipe();
      })();
      return;
    }
    prevSid = sid;
    if (!ready || !isCloudId(sid) || sid !== PREFIX + loadedFor) return;
    const data = toWorkspace(st); const json = JSON.stringify(data);
    pending = { uid: loadedFor, json, data };
    if (json === lastSaved) return;
    writeSync(loadedFor, true);
    clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 1200);
  });
  window.addEventListener("pagehide", () => { void flush(); });
}

/** Clears the user's data from this browser (shared computers must not keep it). */
function wipe() {
  ready = false; loadedFor = ""; lastSaved = ""; pending = null; clearTimeout(timer); writeSync("", false); setStatus("idle");
  update((st) => { Object.assign(st, blankWorkspace()); st.accounts = st.accounts.filter((a) => !isCloudId(a.id)); st.loggedIn = false; st.sessionId = ""; st.viewAs = ""; st.userEmail = ""; });
}

/* ── account actions ── */
const home = () => location.origin + "/";
export const cloudSignUp = (v: { name: string; email: string; password: string; company: string; promo: string }) =>
  supabase.auth.signUp({ email: v.email, password: v.password, options: { emailRedirectTo: home(), data: { full_name: v.name, company: v.company, promo: v.promo, account_type: "planner" } } });
export const cloudSignIn = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
export const cloudResend = (email: string) => supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: home() } });
export const cloudResetRequest = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: home() });
export const cloudSetPassword = async (password: string) => { const r = await supabase.auth.updateUser({ password }); if (!r.error) recovery = false; return r; };

/** Turns a Supabase error into one of our dictionary keys. */
export const authErrorKey = (e: { message?: string; code?: string } | null): string => {
  const m = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "login.err.bad";
  if (m.includes("not confirmed") || m.includes("email_not_confirmed")) return "login.err.unconfirmed";
  if (m.includes("rate") || m.includes("too many") || m.includes("over_email")) return "auth.err.rate";
  if (m.includes("weak") || m.includes("password should")) return "auth.pwshort";
  return "auth.err.generic";
};

/* ── subscription (Stripe). The truth lives in the `subscriptions` table, written only by the Stripe webhook. ── */
const DAY_MS = 86400000;
/** Reads the signed-in user's subscription row and copies it into the app state (plan limits follow it). */
export async function refreshSubscription(): Promise<void> {
  if (!loadedFor) return;
  const { data: r, error } = await supabase.from("subscriptions").select("*").eq("user_id", loadedFor).maybeSingle();
  if (error) { console.error("subscription load failed", error.message); return; }
  update((st) => {
    if (!r || !r.plan || !r.cycle || ["none", "incomplete", "incomplete_expired"].includes(r.status)) { st.sub = { plan: "basic", cycle: "monthly", status: "none", startedAt: 0, renewsAt: 0, trialEndsAt: 0, cancelAtEnd: false, promo: "" }; st.plan = "basic"; return; }
    const status = r.status === "trialing" ? "trialing" : ["active", "past_due"].includes(r.status) ? "active" : r.status === "canceled" ? "canceled" : "expired";
    st.plan = r.plan as Plan;
    st.sub = { plan: r.plan as Plan, cycle: r.cycle, status, startedAt: st.sub.startedAt || Date.now(), renewsAt: r.current_period_end ? Date.parse(r.current_period_end) : 0, trialEndsAt: r.trial_end ? Date.parse(r.trial_end) : 0, cancelAtEnd: !!r.cancel_at_period_end, promo: "" };
  });
}
/** After coming back from Stripe the webhook may take a few seconds: ask again until the subscription shows up. */
export async function waitForSubscription(tries = 10): Promise<void> {
  for (let i = 0; i < tries; i++) { await refreshSubscription(); if (getState().sub.status !== "none") return; await new Promise((r) => setTimeout(r, 1500)); }
}
const call = async (fn: string, body: Record<string, unknown>): Promise<{ url?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke(fn, { body: { ...body, origin: location.origin } });
  if (error) { let msg = "server"; try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* ignore */ } return { error: msg }; }
  return data ?? { error: "server" };
};
/** Goes to Stripe's secure payment page (the free trial applies only to Essential, once per account). */
export const startCheckout = (plan: Plan, cycle: "monthly" | "yearly") => call("create-checkout", { plan, cycle });
/** Stripe's customer portal: card, plan change, invoices. */
export const openBillingPortal = () => call("billing-portal", {});
/** A trial ends now; a paid plan stops at the end of the paid period. */
export const cancelSubscriptionNow = async () => { const r = await call("cancel-subscription", {}); if (!r.error) await waitForChange(); return r; };
async function waitForChange() { for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1500)); const before = JSON.stringify(getState().sub); await refreshSubscription(); if (JSON.stringify(getState().sub) !== before) return; } }
void DAY_MS;

const RETURN_KEY = "aplan-checkout"; // set before leaving for Stripe, so we know to wait for the subscription on return
/** Leaves for Stripe's payment page. Returns an error code only if it could not start. */
export async function goCheckout(plan: Plan, cycle: "monthly" | "yearly"): Promise<string | undefined> {
  const r = await startCheckout(plan, cycle);
  if (r.error === "already_subscribed") return goPortal();
  if (!r.url) return r.error ?? "server";
  try { sessionStorage.setItem(RETURN_KEY, "1"); } catch { /* ignore */ }
  location.href = r.url;
}
export async function goPortal(): Promise<string | undefined> {
  const r = await openBillingPortal();
  if (!r.url) return r.error ?? "server";
  try { sessionStorage.setItem(RETURN_KEY, "1"); } catch { /* ignore */ }
  location.href = r.url;
}
/** True once, when the user just came back from Stripe. */
export const cameBackFromStripe = () => { try { const v = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); return !!v; } catch { return false; } };
