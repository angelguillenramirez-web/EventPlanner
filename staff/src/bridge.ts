import { createTask, getState, STATUS_LABEL, uid, update, type Priority } from "./store";

// Connection with the Event Planner app through the local bridge (bridge/server.mjs).
const BASE = import.meta.env.VITE_BRIDGE_URL ?? "http://localhost:5175";
const KEY = import.meta.env.VITE_BRIDGE_KEY ?? "dev-only-staff-key";
export type Link = "connecting" | "online" | "offline";
let link: Link = "connecting";
const listeners = new Set<() => void>();
const setLink = (l: Link) => { if (l !== link) { link = l; listeners.forEach((f) => f()); } };
export const bridgeLink = () => link;
export const onBridge = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

const call = async (path: string, init?: RequestInit) => {
  const r = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", "x-staff-key": KEY } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

interface Incoming { ref: string; kind: "support" | "design"; title: string; description: string; customerName: string; customerEmail: string; priority: Priority; channel?: "chat" | "written" }

async function pull() {
  const items = (await call("/api/inbox")) as Incoming[];
  const acks: { ref: string; taskId: string }[] = [];
  for (const i of items) {
    const existing = getState().tasks.find((t) => t.ref === i.ref);
    if (existing) { acks.push({ ref: i.ref, taskId: existing.id }); continue; }
    // link to a known customer by email, or register a new one
    let cust = getState().customers.find((c) => c.email.toLowerCase() === i.customerEmail.toLowerCase());
    if (!cust && i.customerEmail) {
      const c = { id: uid(), name: i.customerName || i.customerEmail, email: i.customerEmail, plan: "free" as const, status: "active" as const, createdAt: Date.now(), lastLogin: Date.now(), payments: [], tempPassword: "", tempPasswordAt: 0 };
      update((s) => { s.customers.push(c); });
      cust = c;
    }
    const t = createTask({ kind: i.kind, title: i.title, description: i.description, requester: i.customerEmail ? `${i.customerName || cust?.name} <${i.customerEmail}>` : i.customerName, customerId: cust?.id, priority: i.priority, source: "platform", ref: i.ref, channel: i.channel === "chat" ? "chat" : "written" });
    acks.push({ ref: i.ref, taskId: t.id });
  }
  if (acks.length) await call("/api/inbox/ack", { method: "POST", body: JSON.stringify({ acks }) });
}

interface Chat { id: string; customerName: string; customerEmail: string; msgs: { id: string; text: string; at: number }[] }
/** Live chats from customers: each chat becomes one support request (channel "chat"); each customer message becomes a note on it. */
async function pullChats() {
  const chats = (await call("/api/chats/pull")) as Chat[];
  for (const c of chats) {
    let t = getState().tasks.find((x) => x.ref === c.id);
    if (!t) {
      let cust = c.customerEmail ? getState().customers.find((x) => x.email.toLowerCase() === c.customerEmail.toLowerCase()) : undefined;
      if (!cust && c.customerEmail) {
        const n = { id: uid(), name: c.customerName || c.customerEmail, email: c.customerEmail, plan: "free" as const, status: "active" as const, createdAt: Date.now(), lastLogin: Date.now(), payments: [], tempPassword: "", tempPasswordAt: 0 };
        update((s) => { s.customers.push(n); }); cust = n;
      }
      const who = c.customerName || c.customerEmail || "Visitor";
      t = createTask({ kind: "support", title: `Live chat: ${who}`, description: c.msgs[0]?.text ?? "", requester: c.customerEmail ? `${who} <${c.customerEmail}>` : who, customerId: cust?.id, priority: "normal", source: "platform", ref: c.id, channel: "chat" });
    }
    const id = t.id;
    update((s) => {
      const x = s.tasks.find((y) => y.id === id)!;
      let added = false;
      for (const m of c.msgs) if (!x.notes.some((n) => n.id === m.id)) { x.notes.push({ id: m.id, by: c.customerName || "Customer", at: m.at, text: m.text, internal: false, customer: true }); added = true; }
      if (added) { x.updatedAt = Date.now(); if (x.status === "waiting" || x.status === "done") { x.status = x.assigneeId ? "in_progress" : "new"; x.resolvedAt = 0; x.history.push({ at: Date.now(), by: "System", text: "Customer wrote again in the live chat" }); } }
    });
  }
}

let lastPushed = "";
/** Publishes prices, web settings, published templates and the status of every customer request. */
async function push() {
  const s = getState();
  const statuses: Record<string, unknown> = {};
  for (const t of s.tasks) if (t.ref) statuses[t.ref] = { taskId: t.id, status: t.status, label: STATUS_LABEL[t.status], updatedAt: t.updatedAt, replies: t.notes.filter((n) => !n.internal && !n.customer).map((n) => ({ at: n.at, text: n.text })) };
  const body = JSON.stringify({
    plans: s.config.plans, web: s.config.web, design: s.config.design,
    templates: s.templates.filter((t) => t.status === "published").map((t) => ({ id: t.id, name: t.name, category: t.category, html: t.html, css: t.css, version: t.version })),
    statuses,
  });
  if (body === lastPushed) return;
  await call("/api/published", { method: "PUT", body });
  lastPushed = body;
}

/** Starts the sync loop (every 2 s). Returns a stop function. */
export function startSync() {
  let alive = true;
  const tick = async () => {
    try { await pull(); await pullChats(); await push(); setLink("online"); } catch { setLink("offline"); lastPushed = ""; }
  };
  tick();
  const i = setInterval(() => { if (alive) tick(); }, 2000);
  return () => { alive = false; clearInterval(i); };
}
