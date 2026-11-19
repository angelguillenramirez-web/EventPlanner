import { BUILTIN_TEMPLATES } from "../../src/templates";
import { useSyncExternalStore } from "react";
import { hashPassword, newTotpSecret } from "./crypto";
import { KB_VERSION, seedArticles } from "./kbSeed";
import { SUPABASE_AUTH } from "./supabase";
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31]).join("");

// ───────── Types ─────────
export type Role = "super_admin" | "support" | "designer";
export const ROLES: Role[] = ["super_admin", "support", "designer"];
export const ROLE_LABEL: Record<Role, string> = { super_admin: "Super admin", support: "Customer support", designer: "Designer" };
/** Which team handles which kind of request. */
export type TaskKind = "support" | "design" | "admin";
export const KIND_TEAM: Record<TaskKind, Role> = { support: "support", design: "designer", admin: "super_admin" };
export const KIND_PREFIX: Record<TaskKind, string> = { support: "SUP", design: "DSN", admin: "ADM" };
export const KIND_SLA_HOURS: Record<TaskKind, number> = { support: 24, design: 72, admin: 48 };

export type Presence = "online" | "busy" | "meeting" | "lunch" | "break" | "away" | "offline";
export const PRESENCE: Record<Presence, { label: string; color: string }> = {
  online: { label: "Online", color: "#2f9e6e" }, busy: { label: "Busy — do not disturb", color: "#C7465C" }, meeting: { label: "In a meeting", color: "#8b6fd6" },
  lunch: { label: "On lunch", color: "#d99a1e" }, break: { label: "On a break", color: "#e98a3c" }, away: { label: "Away", color: "#4EB1E8" }, offline: { label: "Offline", color: "#8a9b98" },
};
export const PRESENCE_LIST = Object.keys(PRESENCE) as Presence[];
export interface Staff {
  id: string; name: string; email: string; role: Role; active: boolean;
  /** Profile picture (small data URL), job title, and availability. Staff-only: never sent to the 1Plan app or customers. */
  avatar: string; title: string; presence: Presence; presenceNote: string; presenceAt: number;
  salt: string; hash: string; mustChangePassword: boolean;
  totpSecret: string; totpEnrolled: boolean; lastTotpStep: number;
  failed: number; lockedUntil: number; lastLogin: number; createdAt: number;
}
export type TaskStatus = "new" | "assigned" | "in_progress" | "waiting" | "done";
export const STATUSES: TaskStatus[] = ["new", "assigned", "in_progress", "waiting", "done"];
export const STATUS_LABEL: Record<TaskStatus, string> = { new: "New", assigned: "Assigned", in_progress: "In progress", waiting: "Waiting on customer", done: "Done" };
export type Priority = "low" | "normal" | "high" | "urgent";
export interface TaskNote { id: string; by: string; at: number; text: string; internal: boolean; customer?: boolean }
export interface TaskEvent { at: number; by: string; text: string }
export interface Task {
  id: string; kind: TaskKind; title: string; description: string; requester: string; customerId: string; priority: Priority;
  status: TaskStatus; assigneeId: string | null; createdAt: number; updatedAt: number; resolvedAt: number; source: "platform" | "staff";
  templateId: string; notes: TaskNote[]; history: TaskEvent[];
  /** Reference given by the 1Plan app when the request came from a customer. */
  ref?: string;
  /** How the customer reached us: live chat or a written request. */
  channel: "chat" | "written";
  /** Time of the first reply to the customer (for response-time metrics). */
  firstResponseAt: number;
  /** Support → design hand-off: `handoff` is the design task created from this one, `origin` the support task it came from. */
  handoff?: string; origin?: string;
}
export type PayStatus = "paid" | "failed" | "refunded" | "pending";
export interface Payment { id: string; at: number; amount: number; plan: string; method: string; status: PayStatus; issue: string }
export interface Customer {
  id: string; name: string; email: string; plan: CustomerPlan; status: "active" | "blocked" | "locked";
  createdAt: number; lastLogin: number; payments: Payment[]; tempPassword: string; tempPasswordAt: number;
  /** Real accounts only (read from Supabase): subscription state. */
  sub?: { status: string; cycle: string; trialEnd: number; periodEnd: number; type: string };
}
export type TplStatus = "draft" | "published";
export type TplSource = "template" | "request" | "draft";
export const SOURCE_LABEL: Record<TplSource, string> = { template: "Template", request: "Event request", draft: "Draft" };
export interface TplComment { id: string; by: string; at: number; text: string }
export interface Template { id: string; name: string; category: string; status: TplStatus; html: string; css: string; version: number; updatedAt: number; publishedAt: number; by: string; source: TplSource; tags: string[]; comments: TplComment[]; taskId?: string; versions?: { id: string; at: number; name: string; html: string; css: string }[];
  /** Full-page template (a complete HTML document with its own data block). Built-in ones ship with 1Plan; staff can edit or unpublish them but not delete them. */
  full?: boolean; builtin?: string; suits?: string[]; baseHash?: string; edited?: boolean }
export interface ApiKey { id: string; name: string; service: string; last4: string; status: "active" | "revoked"; createdAt: number; rotatedAt: number }
/** Customer plans of 1Plan. Ids stay basic / planner / pro (as stored by the customer app); the names customers see are Essential / Premier / Unlimited. "none" = no active plan or trial. */
export type CustomerPlan = "none" | "basic" | "planner" | "pro";
export const PLAN_LABEL: Record<CustomerPlan, string> = { none: "No plan", basic: "Essential", planner: "Premier", pro: "Unlimited" };
export const TRIAL_DAYS = 7;
/** What each plan allows, as defined in the customer app (Infinity = unlimited). Reference for support; the customer app enforces it. */
export const PLAN_RULES: { label: string; values: Record<"basic" | "planner" | "pro", string> }[] = [
  { label: "Events per 30 days (archived, cancelled and deleted count)", values: { basic: "2", planner: "4", pro: "Unlimited" } },
  { label: "Invitations per event", values: { basic: "25", planner: "50", pro: "Unlimited" } },
  { label: "Table arrangements per event (active and archived count)", values: { basic: "1", planner: "2", pro: "Unlimited" } },
  { label: "Print table arrangements", values: { basic: "No", planner: "No", pro: "Yes" } },
  { label: "Custom task statuses (otherwise To do / In progress / Done)", values: { basic: "No", planner: "Yes", pro: "Yes" } },
  { label: "Documents", values: { basic: "No", planner: "Yes", pro: "Yes" } },
  { label: "Itineraries per event", values: { basic: "1", planner: "Unlimited", pro: "Unlimited" } },
  { label: "Request a custom invitation design", values: { basic: "No", planner: "Yes", pro: "Yes" } },
  { label: "Design changes per invitation", values: { basic: "0", planner: "3", pro: "Unlimited" } },
  { label: "Custom RSVP link name", values: { basic: "No", planner: "No", pro: "Yes" } },
  { label: "Agreements", values: { basic: "No", planner: "Yes", pro: "Yes" } },
  { label: "Meetings", values: { basic: "No", planner: "Yes", pro: "Yes" } },
  { label: "Collaborators", values: { basic: "2", planner: "5", pro: "Unlimited" } },
];
export const DEFAULT_PLANS: Plans = { basic: { name: "Essential", monthly: 40, yearly: 432 }, planner: { name: "Premier", monthly: 70, yearly: 756 }, pro: { name: "Unlimited", monthly: 110, yearly: 1188 } };
export interface Plans { [k: string]: { monthly: number; yearly: number; name: string } }
/** Discount coupon created by a super admin: the customer types `code` at checkout and gets `percent` off. */
export interface Coupon { id: string; code: string; percent: number; note: string; active: boolean; expires: string; createdAt: number; by: string }
export interface Config {
  plans: Plans;
  coupons?: Coupon[];
  apiKeys: ApiKey[];
  web: { maintenance: boolean; banner: string; seoTitle: string; seoDescription: string; analyticsId: string };
  design: { primary: string; accent: string; heroTitle: string; heroSubtitle: string; ctaLabel: string };
}
// internal task manager (work tasks, not tied to any event)
export interface WStatus { id: string; name: string; color: string }
export type WPriority = "" | "low" | "medium" | "high" | "urgent";
export interface WorkTask {
  id: string; ownerId: string; name: string; statusId: string; description: string; start: string; due: string; priority: WPriority;
  tags: string[]; assignees: string[]; done: boolean; likes: string[]; notes: { id: string; by: string; at: number; text: string }[]; history: { id: string; at: number; by: string; text: string }[]; createdAt: number;
}
// internal chat
export interface Channel { id: string; name: string; kind: "group" | "dm"; members: string[]; by: string; at: number; topic: string }
export interface Msg { id: string; ch: string; by: string; at: number; text: string; sticker?: string; img?: string; replyTo?: string; reactions: Record<string, string[]>; edited?: boolean; deleted?: boolean; pinned?: boolean }
// knowledge base
export interface Article { id: string; title: string; category: string; tags: string[]; body: string; updatedAt: number; by: string }
export interface Audit { id: string; at: number; by: string; action: string; target: string }
export interface Session { staffId: string; expires: number }
export interface State {
  theme: "light" | "dark";
  staff: Staff[]; tasks: Task[]; customers: Customer[]; templates: Template[]; config: Config; audit: Audit[];
  counters: Record<TaskKind, number>;
  presenceLog: { staffId: string; status: Presence; at: number }[];
  work: WorkTask[]; wstatuses: WStatus[]; wtags: string[];
  channels: Channel[]; messages: Msg[]; reads: Record<string, Record<string, number>>;
  kb: Article[]; kbSeededAt: number; kbVersion?: number;
  seeded: number;
}

// ───────── Store ─────────
const KEY = "ep-staff.v1";
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const H = 3600_000;

let state: State = load() ?? ({ seeded: 0 } as State);
const subs = new Set<() => void>();
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
function load(): State | null { try { const r = localStorage.getItem(KEY); return r ? migrate(JSON.parse(r) as State) : null; } catch { return null; } }
export const hashDoc = (str: string) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h >>> 0); };
/** The full-page templates that ship with 1Plan show up in the library as published designs. A newer shipped design replaces a copy nobody has edited. */
function ensureBuiltins(s: State) {
  if (!s.templates) return;
  const now = Date.now();
  for (const b of BUILTIN_TEMPLATES) {
    const base = hashDoc(b.html), t = s.templates.find((x) => x.id === b.id);
    if (!t) s.templates.push({ id: b.id, name: b.name, category: b.category, status: "published", html: b.html, css: "", version: 1, updatedAt: now, publishedAt: now, by: "System", source: "template", tags: [b.category, "full page", "built-in"], comments: [], full: true, builtin: b.id, suits: b.suits, baseHash: base });
    else if (t.builtin && !t.edited && t.baseHash !== base) { t.html = b.html; t.baseHash = base; t.version += 1; t.updatedAt = now; }
  }
}
/** Brings data saved by an older version up to date (new plans of 1Plan) without touching anything else. */
function migrate(s: State): State {
  if (s.config?.plans && "free" in s.config.plans) s.config.plans = structuredClone(DEFAULT_PLANS); // old Free / Planner / Pro price list
  for (const c of s.customers ?? []) if ((c.plan as string) === "free") c.plan = "none";
  // knowledge base: replace the untouched first-version articles with the current ones; articles a super admin edited or added are kept
  if (s.kb && (s.kbVersion ?? 1) < KB_VERSION) {
    const now = Date.now();
    s.kb = [...seedArticles(now, "Ana Ruiz"), ...s.kb.filter((a) => !(/^kb\d+$/.test(a.id) && a.updatedAt === s.kbSeededAt))];
    s.kbSeededAt = now; s.kbVersion = KB_VERSION;
  }
  ensureBuiltins(s);
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ } }
export const getState = () => state;
// another tab of this browser changed the data (e.g. a colleague's chat message in the prototype): pick it up
try { addEventListener("storage", (e) => { if (e.key === KEY) { const n = load(); if (n) { state = n; subs.forEach((f) => f()); } } }); } catch { /* ignore */ }
export function update(fn: (s: State) => void) { fn(state); state = { ...state }; save(); subs.forEach((f) => f()); }
export function useStore(): State { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getState); }
export function resetAll() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(SKEY); } catch { /* ignore */ } location.reload(); }

// ───────── Session (tab-scoped, idle timeout) ─────────
const SKEY = "ep-staff.session";
export const IDLE_MS = 15 * 60_000;
export function getSession(): Session | null {
  try { const s = JSON.parse(sessionStorage.getItem(SKEY) ?? "null") as Session | null; return s && s.expires > Date.now() ? s : null; } catch { return null; }
}
export function setSession(staffId: string | null) {
  try { if (staffId) sessionStorage.setItem(SKEY, JSON.stringify({ staffId, expires: Date.now() + IDLE_MS })); else sessionStorage.removeItem(SKEY); } catch { /* ignore */ }
}
export const touchSession = () => { const s = getSession(); if (s) setSession(s.staffId); };

// ───────── Audit + tasks ─────────
export function log(by: string, action: string, target = "") {
  update((s) => { s.audit.unshift({ id: uid(), at: Date.now(), by, action, target }); if (s.audit.length > 500) s.audit.length = 500; });
}
export const isOpen = (t: Task) => t.status !== "done";
/** Super admins see every request; other profiles only the kind their team handles. */
export const canSee = (me: Staff, t: Task) => me.role === "super_admin" || KIND_TEAM[t.kind] === me.role;
export function openLoad(s: State, staffId: string) { return s.tasks.filter((t) => t.assigneeId === staffId && isOpen(t)).length; }
/** Auto-assignment by team scope: the active member of the right team with the fewest open tasks. */
export function pickAssignee(s: State, kind: TaskKind): string | null {
  const pool = s.staff.filter((m) => m.active && m.role === KIND_TEAM[kind]);
  if (!pool.length) return null;
  return pool.map((m) => ({ id: m.id, n: openLoad(s, m.id) })).sort((a, b) => a.n - b.n)[0].id;
}
export interface NewTask { kind: TaskKind; title: string; description?: string; requester?: string; customerId?: string; priority?: Priority; source?: Task["source"]; templateId?: string; by?: string; ref?: string; channel?: Task["channel"]; origin?: string }
/** Every support / design request generates a unique, sequential task ID (SUP-000001, DSN-000001...) and is auto-assigned. */
export function createTask(n: NewTask): Task {
  let task!: Task;
  update((s) => {
    s.counters[n.kind] += 1;
    // real accounts: several people create tasks at once, so a counter would collide: use a random code (customer requests keep the number the database gave them)
    const id = n.ref && /^(SUP|DSN|ADM)-/.test(n.ref) && SUPABASE_AUTH ? n.ref : SUPABASE_AUTH ? `${KIND_PREFIX[n.kind]}-${randomCode()}` : `${KIND_PREFIX[n.kind]}-${String(s.counters[n.kind]).padStart(6, "0")}`;
    const assigneeId = pickAssignee(s, n.kind);
    const now = Date.now();
    const who = assigneeId ? s.staff.find((m) => m.id === assigneeId)?.name : "";
    task = {
      id, kind: n.kind, title: n.title, description: n.description ?? "", requester: n.requester ?? "", customerId: n.customerId ?? "", priority: n.priority ?? "normal",
      status: assigneeId ? "assigned" : "new", assigneeId, createdAt: now, updatedAt: now, resolvedAt: 0, source: n.source ?? "platform", templateId: n.templateId ?? "", ref: n.ref, channel: n.channel ?? "written", firstResponseAt: 0, origin: n.origin,
      notes: [], history: [{ at: now, by: n.by ?? "System", text: "Request created" }, ...(assigneeId ? [{ at: now, by: "System", text: `Auto-assigned to ${who} (${ROLE_LABEL[KIND_TEAM[n.kind]]} team)` }] : [{ at: now, by: "System", text: "No active team member available: waiting in the team queue" }])],
    };
    s.tasks.unshift(task);
  });
  return task;
}
export function patchTask(id: string, by: string, fn: (t: Task, s: State) => string | void) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    const what = fn(t, s);
    t.updatedAt = Date.now();
    if (what) t.history.push({ at: t.updatedAt, by, text: what });
  });
}
export function setStatus(id: string, by: string, status: TaskStatus) {
  let origin = "";
  patchTask(id, by, (t) => { const from = t.status; t.status = status; t.resolvedAt = status === "done" ? Date.now() : 0; if (status === "done" && t.origin) origin = t.origin; return `Status: ${STATUS_LABEL[from]} → ${STATUS_LABEL[status]}`; });
  // a design handed over by support is finished: tell the support request it came from
  if (origin) patchTask(origin, "System", (t) => { t.notes.push({ id: uid(), by: "System", at: Date.now(), text: `The design team finished ${id}. You can now reply to the customer.`, internal: true }); return `Design ${id} finished by the design team`; });
}
/** Customer support hands a request over to a designer: a linked design task (DSN-…) is created and assigned. */
export function handOffToDesigner(id: string, by: string, designerId: string | null, note: string): Task | null {
  const src = getState().tasks.find((t) => t.id === id);
  if (!src || src.handoff) return null;
  const d = createTask({ kind: "design", title: src.title, description: `${src.description}\n\n— Handed over by ${by} from ${id}${note ? ": " + note : ""}`, requester: src.requester, customerId: src.customerId, priority: src.priority, source: "staff", by, origin: id });
  if (designerId) assignTask(d.id, by, designerId);
  const who = getState().staff.find((m) => m.id === (designerId ?? getState().tasks.find((t) => t.id === d.id)?.assigneeId))?.name ?? "the design team";
  patchTask(id, by, (t) => { t.handoff = d.id; if (t.status === "new" || t.status === "assigned") t.status = "in_progress"; t.notes.push({ id: uid(), by, at: Date.now(), text: `Handed over to ${who} as ${d.id}${note ? ": " + note : ""}`, internal: true }); return `Handed over to designer ${who} (${d.id})`; });
  log(by, "Handed request to designer", `${id} → ${d.id}`);
  return d;
}

// ───────── Availability (visible to staff and super admin only) ─────────
export function setPresence(staffId: string, status: Presence, note?: string) {
  update((s) => {
    const m = s.staff.find((x) => x.id === staffId); if (!m) return;
    if (m.presence !== status) { s.presenceLog.push({ staffId, status, at: Date.now() }); if (s.presenceLog.length > 3000) s.presenceLog.splice(0, s.presenceLog.length - 3000); }
    m.presence = status; m.presenceAt = Date.now(); if (note !== undefined) m.presenceNote = note.slice(0, 60);
  });
}
/** Milliseconds spent in each status since `from` (derived from the change log). */
export function presenceTimes(s: State, staffId: string, from: number): Record<Presence, number> {
  const out = Object.fromEntries(PRESENCE_LIST.map((p) => [p, 0])) as Record<Presence, number>;
  const ev = s.presenceLog.filter((e) => e.staffId === staffId).sort((a, b) => a.at - b.at);
  const now = Date.now();
  let cur: Presence = "offline"; let at = from;
  for (const e of ev) { if (e.at <= from) { cur = e.status; continue; } out[cur] += e.at - at; cur = e.status; at = e.at; }
  out[cur] += now - at;
  return out;
}

// ───────── Internal chat ─────────
export function dmChannel(a: string, b: string): Channel {
  const ex = getState().channels.find((c) => c.kind === "dm" && c.members.length === 2 && c.members.includes(a) && c.members.includes(b));
  if (ex) return ex;
  const c: Channel = { id: uid(), name: "", kind: "dm", members: [a, b], by: a, at: Date.now(), topic: "" };
  update((s) => { s.channels.push(c); });
  return c;
}
export function sendMsg(ch: string, by: string, m: Partial<Msg>) {
  update((s) => { s.messages.push({ id: uid(), ch, by, at: Date.now(), text: "", reactions: {}, ...m }); if (!s.reads[by]) s.reads[by] = {}; s.reads[by][ch] = Date.now(); });
}
export function markRead(staffId: string, ch: string) {
  const s = getState(); if ((s.reads[staffId]?.[ch] ?? 0) >= (s.messages.filter((m) => m.ch === ch).at(-1)?.at ?? 0)) return;
  update((x) => { if (!x.reads[staffId]) x.reads[staffId] = {}; x.reads[staffId][ch] = Date.now(); });
}
export function unreadIn(s: State, staffId: string, ch: string) { const r = s.reads[staffId]?.[ch] ?? 0; return s.messages.filter((m) => m.ch === ch && m.at > r && m.by !== staffId && !m.deleted).length; }
export function unreadTotal(s: State, staffId: string) { return s.channels.filter((c) => c.members.includes(staffId)).reduce((n, c) => n + unreadIn(s, staffId, c.id), 0); }
export function assignTask(id: string, by: string, staffId: string | null) {
  patchTask(id, by, (t, s) => {
    t.assigneeId = staffId;
    if (staffId && t.status === "new") t.status = "assigned";
    return staffId ? `Assigned to ${s.staff.find((m) => m.id === staffId)?.name ?? "?"}` : "Returned to the team queue";
  });
}

export const BLANK_TPL = `<div style="font-family:Georgia,serif;text-align:center;padding:60px 28px;max-width:560px;margin:24px auto;border:2px solid #C7B146;border-radius:16px"><h1 style="font-size:44px;margin:0 0 12px">Event name</h1><p>Date · Venue</p></div>`;
export function addTemplate(by: string, name: string, category: string, html = BLANK_TPL, source: TplSource = "draft", taskId?: string): Template {
  const t: Template = { id: uid(), name, category, status: "draft", html, css: "", version: 1, updatedAt: Date.now(), publishedAt: 0, by, source, tags: [], comments: [], taskId };
  update((s) => { s.templates.unshift(t); });
  return t;
}

/** A full-page template added by staff (imported .html). Starts as a draft; publish it to make it appear in the customer app. */
export function addFullTemplate(by: string, name: string, category: string, html: string): Template {
  const t: Template = { id: uid(), name, category, status: "draft", html, css: "", version: 1, updatedAt: Date.now(), publishedAt: 0, by, source: "template", tags: [category, "full page"], comments: [], full: true, suits: [category] };
  update((s) => { s.templates.unshift(t); });
  return t;
}

// ───────── Seed (demo data) ─────────
export const DEMO_PASSWORD = "Staff-Demo-2026!"; // demo-only accounts; real accounts are created by a super admin
const demoStaff: [string, string, Role][] = [
  ["Ana Ruiz", "admin@eventplanner.test", "super_admin"],
  ["Marco Silva", "support@eventplanner.test", "support"],
  ["Diego Vega", "designer@eventplanner.test", "designer"],
];
const TITLE: Record<Role, string> = { super_admin: "Platform administrator", support: "Customer support specialist", designer: "Design specialist" };
const tplHtml = (title: string, sub: string, bg: string, fg: string) =>
  `<div style="background:${bg};color:${fg};font-family:Georgia,serif;text-align:center;padding:60px 28px;max-width:560px;margin:24px auto;border-radius:16px"><div style="letter-spacing:.3em;text-transform:uppercase;font-size:12px">You are invited</div><h1 style="font-size:44px;margin:18px 0">${title}</h1><p style="font-size:16px">${sub}</p><a href="#rsvp" style="display:inline-block;margin-top:18px;padding:12px 28px;border-radius:999px;background:${fg};color:${bg};text-decoration:none;font-family:sans-serif;font-weight:700">RSVP</a></div>`;

export async function ensureSeed() {
  if (state.seeded === 2) return; // v2: three starter accounts; older prototype data is replaced
  const now = Date.now();
  const staff: Staff[] = [];
  for (const [name, email, role] of demoStaff) {
    const { salt, hash } = await hashPassword(DEMO_PASSWORD);
    staff.push({ id: uid(), name, email, role, active: true, avatar: "", title: TITLE[role], presence: "offline", presenceNote: "", presenceAt: now, salt, hash, mustChangePassword: false, totpSecret: newTotpSecret(), totpEnrolled: true, lastTotpStep: 0, failed: 0, lockedUntil: 0, lastLogin: 0, createdAt: now });
  }
  const pay = (d: number, amount: number, plan: string, status: PayStatus, issue = ""): Payment => ({ id: "pay_" + uid(), at: now - d * 24 * H, amount, plan, method: "Visa •••• 4242", status, issue });
  const customers: Customer[] = [
    { id: uid(), name: "Valeria Gómez", email: "valeria@example.com", plan: "pro", status: "active", createdAt: now - 120 * 24 * H, lastLogin: now - 2 * H, payments: [pay(90, 110, "Unlimited", "paid"), pay(60, 110, "Unlimited", "paid"), pay(30, 110, "Unlimited", "paid"), pay(0, 110, "Unlimited", "failed", "Card declined: insufficient funds")], tempPassword: "", tempPasswordAt: 0 },
    { id: uid(), name: "Carlos Mendoza", email: "carlos@example.com", plan: "planner", status: "locked", createdAt: now - 60 * 24 * H, lastLogin: now - 5 * 24 * H, payments: [pay(35, 70, "Premier", "paid"), pay(5, 70, "Premier", "paid")], tempPassword: "", tempPasswordAt: 0 },
    { id: uid(), name: "Renata Díaz", email: "renata@example.com", plan: "pro", status: "active", createdAt: now - 200 * 24 * H, lastLogin: now - 24 * H, payments: [pay(10, 110, "Unlimited", "paid"), pay(9, 110, "Unlimited", "refunded", "Duplicate charge refunded")], tempPassword: "", tempPasswordAt: 0 },
    { id: uid(), name: "Tomás Herrera", email: "tomas@example.com", plan: "none", status: "blocked", createdAt: now - 20 * 24 * H, lastLogin: now - 8 * 24 * H, payments: [], tempPassword: "", tempPasswordAt: 0 },
    { id: uid(), name: "Paula Ortega", email: "paula@example.com", plan: "planner", status: "active", createdAt: now - 45 * 24 * H, lastLogin: now - 3 * H, payments: [pay(15, 70, "Premier", "pending", "Bank transfer awaiting confirmation")], tempPassword: "", tempPasswordAt: 0 },
  ];
  const templates: Template[] = [
    ["Classic Gold", "wedding", "#17130a", "#C7B146", "published"], ["Garden Party", "birthday", "#e9f5f2", "#14302c", "published"], ["Baby Blue", "babyshower", "#eaf4fb", "#1d4f73", "draft"],
  ].map(([name, category, bg, fg, status]) => ({ id: uid(), name, category, status: status as TplStatus, html: tplHtml(name, "Join us for a special celebration", bg, fg), css: "", version: 1, updatedAt: now - 3 * 24 * H, publishedAt: status === "published" ? now - 2 * 24 * H : 0, by: "Diego Vega", source: (status === "draft" ? "draft" : "template") as TplSource, tags: [category, status === "published" ? "catalogue" : "wip"], comments: status === "draft" ? [{ id: uid(), by: "Ana Ruiz", at: now - 24 * H, text: "Please try a softer blue before we publish." }] : [] }));
  const config: Config = {
    plans: structuredClone(DEFAULT_PLANS),
    apiKeys: [
      { id: uid(), name: "Email delivery", service: "Email provider", last4: "a91f", status: "active", createdAt: now - 80 * 24 * H, rotatedAt: 0 },
      { id: uid(), name: "WhatsApp invitations", service: "WhatsApp Business", last4: "77c2", status: "active", createdAt: now - 50 * 24 * H, rotatedAt: 0 },
      { id: uid(), name: "Payments", service: "Payment processor", last4: "0d3e", status: "active", createdAt: now - 100 * 24 * H, rotatedAt: 0 },
    ],
    web: { maintenance: false, banner: "", seoTitle: "1Plan — plan every event in one place", seoDescription: "Tasks, guests, invitations, seating and suppliers for any event.", analyticsId: "" },
    design: { primary: "#46C8B2", accent: "#C7B146", heroTitle: "Plan your event, without the chaos", heroSubtitle: "Guests, invitations, seating and suppliers in one place.", ctaLabel: "Start free" },
  };
  update((s) => {
    Object.assign(s, { theme: "light", staff, customers, templates, config, tasks: [], audit: [], counters: { support: 0, design: 0, admin: 0 }, seeded: 2,
      presenceLog: [], work: [], wtags: ["design", "support", "admin", "urgent"], reads: {}, messages: [], kb: seedArticles(now, "Ana Ruiz"), kbSeededAt: now, kbVersion: KB_VERSION,
      wstatuses: [{ id: "todo", name: "To do", color: "#4EB1E8" }, { id: "doing", name: "In progress", color: "#C7B146" }, { id: "review", name: "In review", color: "#46C8B2" }, { id: "done", name: "Done", color: "#2f9e6e" }],
      channels: [
        { id: "general", name: "general", kind: "group", members: staff.map((m) => m.id), by: staff[0].id, at: now, topic: "Everyone at 643" },
        { id: "support-design", name: "support-design", kind: "group", members: staff.filter((m) => m.role !== "super_admin").map((m) => m.id), by: staff[0].id, at: now, topic: "Hand-offs between support and design" },
      ] });
  });
  const c = customers;
  const mk = (kind: TaskKind, title: string, description: string, who: Customer, priority: Priority, templateId = "") => createTask({ kind, title, description, requester: `${who.name} <${who.email}>`, customerId: who.id, priority, templateId });
  mk("support", "Payment failed on my Pro renewal", "My card was declined but I have funds. Can you retry the charge?", c[0], "high");
  mk("support", "I can't log in — account locked", "After several attempts the account says it is locked.", c[1], "urgent");
  mk("support", "Double charge this month", "I was charged twice, please check.", c[2], "normal");
  mk("support", "How do I send invitations by WhatsApp?", "Where do I connect my WhatsApp number?", c[4], "low");
  mk("design", "Custom wedding invitation — gold & ivory", "Please design an elegant invitation, gold foil look, couple: Valeria & Andrés, 14 June.", c[0], "normal");
  mk("design", "Update: change date on my invitation", "The party moved to 20 July, please update the design.", c[4], "high");
  // age and progress some tasks so the benchmark has data
  update((s) => {
    const ago = (id: string, h: number, status?: TaskStatus) => { const t = s.tasks.find((x) => x.id === id); if (!t) return; t.createdAt = now - h * H; t.updatedAt = now - (h / 2) * H; if (status) { t.status = status; if (status === "done") t.resolvedAt = now - (h / 3) * H; } };
    ago("SUP-000001", 30, "in_progress"); ago("SUP-000002", 3); ago("SUP-000003", 50, "done"); ago("SUP-000004", 1); ago("DSN-000001", 20, "in_progress"); ago("DSN-000002", 6);
    s.audit.unshift({ id: uid(), at: now, by: "System", action: "Demo data created", target: "" });
    const [adm, sup, dsg] = s.staff;
    const reply = (id: string, mins: number) => { const t = s.tasks.find((x) => x.id === id); if (t) t.firstResponseAt = t.createdAt + mins * 60_000; };
    reply("SUP-000001", 42); reply("SUP-000003", 95);
    const t4 = s.tasks.find((x) => x.id === "SUP-000004"); if (t4) t4.channel = "chat";
    const t2 = s.tasks.find((x) => x.id === "SUP-000002"); if (t2) t2.channel = "chat";
    const m = (ch: string, by: string, ago: number, text: string) => s.messages.push({ id: uid(), ch, by, at: now - ago * 60_000, text, reactions: {} });
    m("general", adm.id, 240, "Welcome to the staff chat 👋 Use #support-design for hand-offs."); m("support-design", sup.id, 60, "Heads up: a customer will ask for a wedding design today."); m("support-design", dsg.id, 55, "Great — send it over with the date and style 🎨");
    s.messages[s.messages.length - 1].reactions = { "👍": [sup.id] };
    const wt = (name: string, ownerId: string, statusId: string, priority: WPriority, due: number, tags: string[]): WorkTask => ({ id: uid(), ownerId, name, statusId, description: "", start: new Date(now).toISOString().slice(0, 10), due: new Date(now + due * 24 * H).toISOString().slice(0, 10), priority, tags, assignees: [ownerId], done: statusId === "done", likes: [], notes: [], history: [{ id: uid(), at: now, by: "System", text: "Task created" }], createdAt: now });
    s.work.push(wt("Review pricing page copy", adm.id, "todo", "medium", 3, ["admin"]), wt("Rotate the email provider key", adm.id, "doing", "high", 1, ["admin", "urgent"]), wt("Update the payment-failed macro", sup.id, "todo", "medium", 2, ["support"]), wt("Call back Carlos about the locked account", sup.id, "doing", "urgent", 0, ["support", "urgent"]), wt("Create 3 summer templates", dsg.id, "doing", "high", 5, ["design"]), wt("Refresh the Garden Party thumbnail", dsg.id, "todo", "low", 7, ["design"]));
  });
  update((st) => ensureBuiltins(st));
}
