import { createTask, getState, subscribe, update, type Article, type Audit, type Coupon, type Customer, type Task, type Channel, type Msg, type WStatus, type WorkTask } from "./store";
import { supabase } from "./supabase";
import { loadStaff } from "./auth";

/**
 * Cloud sync (real accounts only). The console keeps working on its local state; this module mirrors selected collections
 * to Supabase so every staff member sees the same data. Today: knowledge base, coupons, plan prices and the audit log.
 *
 * How it works: `known` remembers what the database holds. When the local list differs it is pushed (upserts + deletes);
 * every 15 s and when the window regains focus the database is read and, if it differs and nothing is waiting to be
 * pushed, becomes the local list. Last write wins. A failed push is retried on the next change or poll.
 */
export type CloudState = { kb: "idle" | "ok" | "error"; note: string };
let status: CloudState = { kb: "idle", note: "" };
const listeners = new Set<() => void>();
const setStatus = (s: CloudState) => { status = s; listeners.forEach((f) => f()); };
export const cloudStatus = () => status;
export const onCloud = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/**
 * Generic list mirror. `known` remembers what the database holds (id → signature). When the local list differs it is pushed
 * (upserts + deletes) — only if `canWrite`; every 15 s and on window focus the database is read and, if it differs and nothing
 * is waiting to be pushed, becomes the local list. Last write wins. A failed push is retried on the next change or poll.
 * An empty database is seeded from this console's list (by a user who can write).
 */
function listSync<T extends { id: string }, R>(o: {
  name: string; table: string; key: string; canWrite: boolean; seed?: boolean; every?: number; upsert?: boolean;
  get: () => T[]; set: (list: T[]) => void; toRow: (x: T) => R; fromRow: (r: R) => T; sig: (x: T) => string;
}) {
  let known: Map<string, string> | null = null;
  let busy = false, dirty = false, dead = false;
  const sigs = (l: T[]) => new Map(l.map((x) => [x.id, o.sig(x)]));

  const pull = async () => {
    const { data, error } = await supabase.from(o.table).select("*");
    if (error || !data) throw new Error(error?.message ?? "no data");
    return (data as R[]).map(o.fromRow);
  };
  const push = async (local: T[]) => {
    const up = local.filter((a) => known!.get(a.id) !== o.sig(a));
    const gone = [...known!.keys()].filter((id) => !local.some((a) => a.id === id));
    // new rows are inserted, known rows updated one by one (an upsert would be checked against the INSERT rules, which an assignee or editor may not satisfy)
    if (o.upsert) { // two consoles may create the same row (e.g. a customer request) at once: last write wins instead of an error
      if (up.length) { const { error } = await supabase.from(o.table).upsert(up.map(o.toRow) as never, { onConflict: o.key }); if (error) throw new Error(error.message); }
    }
    const fresh = o.upsert ? [] : up.filter((a) => !known!.has(a.id)), edit = o.upsert ? [] : up.filter((a) => known!.has(a.id));
    if (fresh.length) { const { error } = await supabase.from(o.table).insert(fresh.map(o.toRow) as never); if (error) throw new Error(error.message); }
    for (const a of edit) { const { error } = await supabase.from(o.table).update(o.toRow(a) as never).eq(o.key, a.id); if (error) throw new Error(error.message); }
    if (gone.length) { const { error } = await supabase.from(o.table).delete().in(o.key, gone); if (error) throw new Error(error.message); }
    up.forEach((a) => known!.set(a.id, o.sig(a))); gone.forEach((id) => known!.delete(id));
  };
  const hasPending = (local: T[]) => local.some((a) => known!.get(a.id) !== o.sig(a)) || [...known!.keys()].some((id) => !local.some((a) => a.id === id));

  const tick = async () => {
    if (busy || dead) { dirty = true; return; }
    busy = true;
    try {
      const remote = await pull();
      const local = o.get();
      if (known === null) {
        known = sigs(remote);
        if (!remote.length && (o.seed ?? true)) { if (o.canWrite) await push(local); }
        else o.set(remote); // seed:false = never upload this console's local (demo) copy; the database is the truth
      } else if (o.canWrite && hasPending(local)) await push(local); // our edits win this round
      else if (remote.length !== known.size || remote.some((a) => known!.get(a.id) !== o.sig(a))) { known = sigs(remote); o.set(remote); }
      if (status.kb !== "ok" || status.note) setStatus({ kb: "ok", note: "" });
    } catch (e) { setStatus({ kb: "error", note: o.name + ": " + (e as Error).message }); }
    finally { busy = false; if (dirty && !dead) { dirty = false; setTimeout(tick, 400); } }
  };

  let t: ReturnType<typeof setTimeout> | undefined;
  const un = subscribe(() => { if (known === null || !o.canWrite) return; clearTimeout(t); t = setTimeout(tick, 800); });
  const iv = setInterval(tick, o.every ?? 15_000);
  const onFocus = () => void tick();
  addEventListener("focus", onFocus);
  void tick();
  return () => { dead = true; un(); clearInterval(iv); clearTimeout(t); removeEventListener("focus", onFocus); };
}

// ── Knowledge base ──
type KRow = { id: string; title: string; category: string; tags: string[]; body: string; updated_at: string; by_name: string };
const kbSync = (canWrite: boolean) => listSync<Article, KRow>({
  name: "knowledge base", table: "kb_articles", key: "id", canWrite,
  get: () => getState().kb,
  set: (l) => update((s) => { s.kb = [...l].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); }),
  toRow: (a) => ({ id: a.id, title: a.title, category: a.category, tags: a.tags, body: a.body, updated_at: new Date(a.updatedAt).toISOString(), by_name: a.by }),
  fromRow: (r) => ({ id: r.id, title: r.title, category: r.category, tags: r.tags, body: r.body, updatedAt: Date.parse(r.updated_at), by: r.by_name }),
  sig: (a) => JSON.stringify([a.title, a.category, a.tags, a.body, a.updatedAt, a.by]),
});

// ── Coupons (super admin writes; the code is the id) ──
type CRow = { code: string; percent: number; note: string; active: boolean; expires: string | null; created_at: string; by_name: string };
type CoupC = Coupon & { id: string };
const couponSync = (canWrite: boolean) => listSync<CoupC, CRow>({
  name: "coupons", table: "coupons", key: "code", canWrite,
  get: () => (getState().config.coupons ?? []).map((c) => ({ ...c, id: c.code })),
  set: (l) => update((s) => { s.config.coupons = l; }),
  toRow: (c) => ({ code: c.code, percent: c.percent, note: c.note, active: c.active, expires: c.expires || null, created_at: new Date(c.createdAt).toISOString(), by_name: c.by }),
  fromRow: (r) => ({ id: r.code, code: r.code, percent: r.percent, note: r.note, active: r.active, expires: r.expires ?? "", createdAt: Date.parse(r.created_at), by: r.by_name }),
  sig: (c) => JSON.stringify([c.code, c.percent, c.note, c.active, c.expires, c.createdAt, c.by]),
});

// ── Plan prices ──
type PRow = { plan: string; name: string; monthly: number; yearly: number };
type Pl = { id: string; name: string; monthly: number; yearly: number };
export const priceSync = (canWrite: boolean) => listSync<Pl, PRow>({
  name: "plan prices", table: "plan_prices", key: "plan", canWrite,
  get: () => Object.entries(getState().config.plans).map(([id, p]) => ({ id, ...p })),
  set: (l) => update((s) => { s.config.plans = { ...s.config.plans, ...Object.fromEntries(l.map((p) => [p.id, { name: p.name, monthly: p.monthly, yearly: p.yearly }])) }; }),
  toRow: (p) => ({ plan: p.id, name: p.name, monthly: p.monthly, yearly: p.yearly }),
  fromRow: (r) => ({ id: r.plan, name: r.name, monthly: Number(r.monthly), yearly: Number(r.yearly) }),
  sig: (p) => JSON.stringify([p.name, p.monthly, p.yearly]),
});

// ── Work tasks (visible only to owner + assignees; a super admin sees all) ──
type WRow = { id: string; owner: string; assignees: string[]; data: WorkTask };
const workSync = () => listSync<WorkTask, WRow>({
  name: "work tasks", table: "work_tasks", key: "id", canWrite: true, seed: false, every: 8_000,
  get: () => getState().work,
  set: (l) => update((s) => { s.work = l; }),
  toRow: (t) => ({ id: t.id, owner: t.ownerId, assignees: t.assignees, data: t, updated_at: new Date().toISOString() } as WRow),
  fromRow: (r) => ({ ...r.data, id: r.id }),
  sig: (t) => JSON.stringify(t),
});
const statusSync = () => listSync<WStatus, { id: string; name: string; color: string; pos: number }>({
  name: "work statuses", table: "work_statuses", key: "id", canWrite: true,
  get: () => getState().wstatuses,
  set: (l) => update((s) => { s.wstatuses = l; }),
  toRow: (x) => ({ id: x.id, name: x.name, color: x.color, pos: getState().wstatuses.findIndex((y) => y.id === x.id) }),
  fromRow: (r) => ({ id: r.id, name: r.name, color: r.color }),
  sig: (x) => JSON.stringify([x.name, x.color, getState().wstatuses.findIndex((y) => y.id === x.id)]),
});
const tagSync = () => listSync<{ id: string }, { tag: string }>({
  name: "work tags", table: "work_tags", key: "tag", canWrite: true,
  get: () => getState().wtags.map((id) => ({ id })),
  set: (l) => update((s) => { s.wtags = l.map((x) => x.id).sort(); }),
  toRow: (x) => ({ tag: x.id }), fromRow: (r) => ({ id: r.tag }), sig: (x) => x.id,
});

// ── Support / design / admin task queue (the database decides who sees which kind) ──
type TRow = { id: string; kind: string; status: string; assignee: string; customer: string; data: Task };
const taskSync = () => listSync<Task, TRow>({
  name: "tasks", table: "tasks", key: "id", canWrite: true, seed: false, every: 5_000, upsert: true,
  get: () => getState().tasks,
  set: (l) => update((s) => { s.tasks = [...l].sort((a, b) => b.createdAt - a.createdAt); }),
  toRow: (t) => ({ id: t.id, kind: t.kind, status: t.status, assignee: t.assigneeId ?? "", customer: t.customerId ?? "", data: t }),
  fromRow: (r) => ({ ...r.data, id: r.id }),
  sig: (t) => JSON.stringify(t),
});

/**
 * Customer support through Supabase. 1Plan writes a thread (+ messages) per live chat or written request; every console of the
 * right team turns new threads into requests in the queue (the request number is the ticket number the database gave),
 * adds each customer message as a customer note, and writes staff replies and the request status back for the customer.
 * Everything is idempotent (note ids = message ids, replies are de-duplicated by local_id), so two consoles never double up.
 */
type ThRow = { id: string; ref: string | null; customer_id: string; channel: "chat" | "written"; kind: "support" | "design"; subject: string; status: string; closed: boolean; customer_name: string; customer_email: string };
type SmRow = { id: string; thread_id: string; from_staff: boolean; internal: boolean; body: string; created_at: string };
function threadSync(role: string) {
  let busy = false, dead = false, cursor = "";
  const sees = (kind: string) => role === "super_admin" || (kind === "support" && role === "support") || (kind === "design" && role === "designer");
  const sentReplies = new Set<string>();
  const sentState = new Map<string, string>();

  const tick = async () => {
    if (busy || dead) return;
    busy = true;
    try {
      const { data: th, error: e1 } = await supabase.from("support_threads").select("*").order("created_at", { ascending: false }).limit(500);
      if (e1 || !th) throw new Error(e1?.message ?? "no threads");
      let q = supabase.from("support_messages").select("*");
      q = cursor ? q.gt("created_at", cursor).order("created_at", { ascending: true }).limit(1000) : q.order("created_at", { ascending: false }).limit(1000);
      const { data: ms, error: e2 } = await q;
      if (e2 || !ms) throw new Error(e2?.message ?? "no messages");
      const msgs = (ms as SmRow[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (msgs.length) cursor = msgs[msgs.length - 1].created_at;
      const threads = (th as ThRow[]).filter((t) => t.ref && sees(t.kind));
      const byThread = new Map<string, SmRow[]>();
      for (const m of msgs) if (!m.from_staff && !m.internal) (byThread.get(m.thread_id) ?? byThread.set(m.thread_id, []).get(m.thread_id)!).push(m);

      for (const t of threads) {
        const mine = byThread.get(t.id) ?? [];
        let task = getState().tasks.find((x) => x.id === t.ref);
        if (!task) {
          if (!mine.length) continue; // wait until the first message is readable
          const who = t.customer_name || t.customer_email || "Customer";
          task = createTask({ kind: t.kind, title: t.channel === "chat" ? `Live chat: ${who}` : t.subject || "Request", description: t.channel === "written" ? mine[0].body : "", requester: t.customer_email ? `${who} <${t.customer_email}>` : who, customerId: t.customer_id, priority: "normal", source: "platform", ref: t.ref!, channel: t.channel, by: who });
        }
        const id = task.id, who = t.customer_name || "Customer";
        // a written request has one customer message and keeps it as the description (not as a note); a chat turns every message into a note
        const toAdd = mine.filter((m) => !task!.notes.some((n) => n.id === m.id) && !(t.channel === "written" && m.body === task!.description));
        if (toAdd.length) update((s) => {
          const x = s.tasks.find((y) => y.id === id); if (!x) return;
          for (const m of toAdd) if (!x.notes.some((n) => n.id === m.id)) x.notes.push({ id: m.id, by: who, at: Date.parse(m.created_at), text: m.body, internal: false, customer: true });
          x.updatedAt = Date.now();
          if (x.status === "waiting" || x.status === "done") { x.status = x.assigneeId ? "in_progress" : "new"; x.resolvedAt = 0; x.history.push({ at: Date.now(), by: "System", text: "Customer wrote again — reopened" }); }
        });
      }

      // staff → customer: replies marked "Reply to customer", and the request status
      const refToThread = new Map(threads.map((t) => [t.ref!, t]));
      for (const task of getState().tasks) {
        const t = refToThread.get(task.ref ?? task.id);
        if (!t) continue;
        const out = task.notes.filter((n) => !n.internal && !n.customer && !sentReplies.has(n.id));
        if (out.length) {
          const { error } = await supabase.from("support_messages").upsert(out.map((n) => ({ thread_id: t.id, from_staff: true, internal: false, body: n.text.slice(0, 5000), local_id: n.id })), { onConflict: "local_id", ignoreDuplicates: true });
          if (error) throw new Error(error.message);
          out.forEach((n) => sentReplies.add(n.id));
        }
        const closed = t.channel === "chat" && task.status === "done";
        const sig = task.status + "|" + closed;
        if (`${t.status}|${t.closed}` !== sig && sentState.get(t.id) !== sig) {
          const { error } = await supabase.from("support_threads").update({ status: task.status, closed }).eq("id", t.id);
          if (error) throw new Error(error.message);
          sentState.set(t.id, sig);
        }
      }
      if (status.note.startsWith("support")) setStatus({ kb: status.kb, note: "" });
    } catch (e) { setStatus({ kb: status.kb, note: "support: " + (e as Error).message }); }
    finally { busy = false; }
  };
  const start = setTimeout(tick, 3_500); // let the request queue load first, so existing requests are not created twice
  const iv = setInterval(tick, 4_000);
  const onFocus = () => void tick();
  addEventListener("focus", onFocus);
  return () => { dead = true; clearTimeout(start); clearInterval(iv); removeEventListener("focus", onFocus); };
}

// ── Team chat: channels (members only) and messages ──
type ChRow = { id: string; kind: "group" | "dm"; members: string[]; data: { name: string; by: string; at: number; topic: string } };
const channelSync = () => listSync<Channel, ChRow>({
  name: "chat channels", table: "chat_channels", key: "id", canWrite: true, seed: false, every: 6_000,
  get: () => getState().channels,
  set: (l) => update((s) => { s.channels = l; }),
  toRow: (c) => ({ id: c.id, kind: c.kind, members: c.members, data: { name: c.name, by: c.by, at: c.at, topic: c.topic } }),
  fromRow: (r) => ({ id: r.id, kind: r.kind, members: r.members, name: r.data.name ?? "", by: r.data.by ?? "", at: r.data.at ?? 0, topic: r.data.topic ?? "" }),
  sig: (c) => JSON.stringify([c.name, c.kind, [...c.members].sort(), c.topic]),
});

/** Messages are read incrementally (only rows changed since the last look), every 4 s, so chat feels live without Realtime. */
type MRow = { id: string; ch: string; at: string; updated_at: string; data: Omit<Msg, "id" | "ch" | "at"> };
function messageSync() {
  const known = new Map<string, string>();
  let cursor = "", first = true, busy = false, dead = false;
  const body = (m: Msg) => { const { id: _i, ch: _c, at: _a, ...rest } = m; void _i; void _c; void _a; return rest; };
  const sg = (m: Msg) => JSON.stringify(body(m));
  const fromRow = (r: MRow): Msg => ({ id: r.id, ch: r.ch, at: Date.parse(r.at), ...r.data });
  const order = (l: Msg[]) => l.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

  const tick = async () => {
    if (busy || dead) return;
    busy = true;
    try {
      // 1) send our new / edited messages
      if (!first) {
        const mine = getState().messages.filter((m) => known.get(m.id) !== sg(m));
        const fresh = mine.filter((m) => !known.has(m.id)), edit = mine.filter((m) => known.has(m.id));
        if (fresh.length) { const { error } = await supabase.from("chat_messages").insert(fresh.map((m) => ({ id: m.id, ch: m.ch, at: new Date(m.at).toISOString(), data: body(m) }))); if (error) throw new Error(error.message); fresh.forEach((m) => known.set(m.id, sg(m))); }
        for (const m of edit) { const { error } = await supabase.from("chat_messages").update({ data: body(m) }).eq("id", m.id); if (error) throw new Error(error.message); known.set(m.id, sg(m)); }
      }
      // 2) read what changed
      let q = supabase.from("chat_messages").select("*");
      q = cursor ? q.gt("updated_at", cursor).order("updated_at", { ascending: true }).limit(500) : q.order("at", { ascending: false }).limit(300);
      const { data, error } = await q;
      if (error || !data) throw new Error(error?.message ?? "no data");
      const rows = data as MRow[];
      if (rows.length) {
        const incoming = rows.map(fromRow);
        incoming.forEach((m) => known.set(m.id, sg(m)));
        cursor = rows.reduce((mx, r) => (r.updated_at > mx ? r.updated_at : mx), cursor);
        update((s) => {
          const map = new Map((first ? [] : s.messages).map((m) => [m.id, m])); // first contact: drop the local (demo) messages
          incoming.forEach((m) => map.set(m.id, m));
          s.messages = order([...map.values()]);
        });
      } else if (first) update((s) => { s.messages = []; });
      first = false;
    } catch (e) { setStatus({ kb: status.kb, note: "chat: " + (e as Error).message }); }
    finally { busy = false; }
  };
  let t: ReturnType<typeof setTimeout> | undefined;
  const un = subscribe(() => { if (first) return; clearTimeout(t); t = setTimeout(tick, 400); });
  const iv = setInterval(tick, 4_000);
  const onFocus = () => void tick();
  addEventListener("focus", onFocus);
  void tick();
  return () => { dead = true; un(); clearInterval(iv); clearTimeout(t); removeEventListener("focus", onFocus); };
}

/**
 * Customers (read-only): the real 1Plan accounts, through the staff_customers view (name, email, plan and subscription state
 * only — never passwords or workspace data). Replaces the demo customers while signed in with a real account.
 */
type CustRow = { user_id: string; email: string | null; full_name: string | null; created_at: string; plan: string | null; cycle: string | null; sub_status: string | null; trial_end: string | null; current_period_end: string | null; last_sign_in_at: string | null; account_type: string | null; banned_until: string | null };
let reloadCustomers: () => void = () => {};
/** Re-reads the customers right away (after an action). */
export const refreshCustomers = () => reloadCustomers();
function customerSync() {
  let dead = false, busy = false, last = "";
  const ms = (x: string | null) => (x ? Date.parse(x) : 0);
  const run = async () => {
    if (busy || dead) return;
    busy = true;
    try {
      const { data, error } = await supabase.from("staff_customers").select("*").order("created_at", { ascending: false });
      if (error || !data) throw new Error(error?.message ?? "no data");
      const list: Customer[] = (data as CustRow[]).map((r) => {
        const live = ["trialing", "active", "past_due"].includes(r.sub_status ?? "");
        return {
          id: r.user_id, name: r.full_name || r.email || "(no name)", email: r.email ?? "",
          plan: live && (r.plan === "basic" || r.plan === "planner" || r.plan === "pro") ? r.plan : "none", status: ms(r.banned_until) > Date.now() ? "blocked" : "active",
          createdAt: ms(r.created_at), lastLogin: ms(r.last_sign_in_at), payments: [], tempPassword: "", tempPasswordAt: 0,
          sub: { status: r.sub_status ?? "none", cycle: r.cycle ?? "", trialEnd: ms(r.trial_end), periodEnd: ms(r.current_period_end), type: r.account_type ?? "planner" },
        };
      });
      const sg = JSON.stringify(list);
      if (sg !== last) { last = sg; update((s) => { s.customers = list; }); }
    } catch (e) { setStatus({ kb: status.kb, note: "customers: " + (e as Error).message }); }
    finally { busy = false; }
  };
  reloadCustomers = () => void run();
  const iv = setInterval(run, 30_000);
  const onFocus = () => void run();
  addEventListener("focus", onFocus);
  void run();
  return () => { dead = true; clearInterval(iv); removeEventListener("focus", onFocus); };
}

/**
 * Audit log: append-only. Entries made in this console after sign-in are uploaded once (the database refuses duplicates by
 * local_id); a super admin also reads the whole log (everyone's entries, including those the server functions wrote).
 */
type ARow = { id: number; at: string; by_name: string; local_id: string | null; action: string; target: string; actor: string | null };
function auditSync(myId: string, isAdmin: boolean) {
  const since = Date.now() - 1000;
  const pushed = new Set<string>();
  let busy = false, dead = false;
  const pending = () => getState().audit.filter((e) => e.at >= since && !pushed.has(e.id));

  const run = async () => {
    if (busy || dead) return;
    busy = true;
    try {
      const todo = pending();
      if (todo.length) {
        const { error } = await supabase.from("audit_log").upsert(
          todo.map((e) => ({ actor: myId, by_name: e.by, local_id: e.id, action: e.action, target: e.target, at: new Date(e.at).toISOString() })),
          { onConflict: "local_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        todo.forEach((e) => pushed.add(e.id));
      }
      if (isAdmin) {
        const { data, error } = await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(500);
        if (error || !data) throw new Error(error?.message ?? "no data");
        const names = new Map(getState().staff.map((m) => [m.id, m.name]));
        const remote: Audit[] = (data as ARow[]).map((r) => ({ id: r.local_id ?? "db" + r.id, at: Date.parse(r.at), by: r.by_name || (r.actor ? names.get(r.actor) : "") || "System", action: r.action, target: r.target }));
        const ids = new Set(remote.map((r) => r.id));
        const merged = [...pending().filter((e) => !ids.has(e.id)), ...remote].sort((a, b) => b.at - a.at).slice(0, 500);
        const same = (x: Audit[], y: Audit[]) => x.length === y.length && x.every((e, i) => e.id === y[i].id);
        if (!same(merged, getState().audit)) update((s) => { s.audit = merged; });
      }
      setStatus({ ...status, note: "" });
    } catch (e) { setStatus({ kb: status.kb, note: "audit: " + (e as Error).message }); }
    finally { busy = false; }
  };
  let t: ReturnType<typeof setTimeout> | undefined;
  const un = subscribe(() => { if (pending().length) { clearTimeout(t); t = setTimeout(run, 600); } });
  const iv = setInterval(run, 15_000);
  const onFocus = () => void run();
  addEventListener("focus", onFocus);
  void run();
  return () => { dead = true; un(); clearInterval(iv); clearTimeout(t); removeEventListener("focus", onFocus); };
}

/** Keeps the staff list (names, roles, avatars) current for every signed-in member, not only super admins. */
function staffSync() {
  let dead = false;
  const run = () => { if (!dead) void loadStaff(); };
  const iv = setInterval(run, 60_000);
  addEventListener("focus", run);
  run();
  return () => { dead = true; clearInterval(iv); removeEventListener("focus", run); };
}

/** Starts mirroring to Supabase; returns the stop function (call on sign-out). */
export function startCloud(me: { id: string; role: string }): () => void {
  const admin = me.role === "super_admin";
  // Plan prices (priceSync) are built but switched off on purpose until the new prices are decided.
  const stops = [staffSync(), kbSync(admin), couponSync(admin), customerSync(), auditSync(me.id, admin), workSync(), taskSync(), threadSync(me.role), statusSync(), tagSync(), channelSync(), messageSync()];
  return () => stops.forEach((s) => s());
}
