import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Link with the Staff Console through the local bridge (bridge/server.mjs). Everything here is best-effort:
// if the bridge is not running the app keeps working with its own data.
const BASE = "http://localhost:5175";

export interface RemoteStatus { taskId: string; status: string; label?: string; replies?: { at: number; text: string }[] }
export interface PublicData {
  /** Discount coupons created by staff: code → percent off. */
  coupons?: Record<string, number>;
  plans: Record<string, { name: string; monthly: number; yearly: number }> | null;
  web: { maintenance: boolean; banner: string; seoTitle: string; seoDescription: string } | null;
  design: { primary: string; accent: string; heroTitle: string; heroSubtitle: string; ctaLabel: string } | null;
  templates: { id: string; name: string; category: string; html: string; css: string; version?: number; full?: boolean; suits?: string[] }[];
}

/* Support goes through Supabase when the customer has a real account (works online); local test accounts keep using the bridge above. */
const isUuid = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
/** The customer has the replies on screen: tell the database (once per new reply) so the support team can see they were read. Harmless if the database function is not installed yet. */
const marked = new Map<string, number>();
function markSeen(thread: string, staffReplies: number, on = true) {
  if (!on || !staffReplies || (marked.get(thread) ?? 0) >= staffReplies) return;
  marked.set(thread, staffReplies);
  void Promise.resolve(supabase.rpc("mark_messages_seen", { p_thread: thread })).then((r) => { if (r.error) { console.warn("1Plan: could not record the read time:", r.error.message); marked.delete(thread); } }, () => marked.delete(thread));
}
const sbUser = async () => { try { return (await supabase.auth.getSession()).data.session?.user ?? null; } catch { return null; } };

export async function sendRequest(b: { kind: "support" | "design"; title: string; description: string; customerName: string; customerEmail: string }): Promise<string | null> {
  const u = await sbUser();
  if (u) {
    try {
      const { data: t, error } = await supabase.from("support_threads").insert({ customer_id: u.id, channel: "written", kind: b.kind, subject: b.title.slice(0, 200), customer_name: b.customerName, customer_email: b.customerEmail }).select("id, ref").single();
      if (error || !t) return null;
      const { error: e2 } = await supabase.from("support_messages").insert({ thread_id: t.id, author: u.id, body: (b.description || b.title).slice(0, 5000) });
      return e2 ? null : (t.ref as string);
    } catch { return null; }
  }
  try {
    const r = await fetch(BASE + "/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return r.ok ? ((await r.json()) as { ref: string }).ref : null;
  } catch { return null; }
}
export async function fetchStatuses(refs: string[], mark = true): Promise<Record<string, RemoteStatus>> {
  if (!refs.length) return {};
  const out: Record<string, RemoteStatus> = {};
  const u = await sbUser();
  let rest = refs;
  if (u) {
    try {
      const { data: th } = await supabase.from("support_threads").select("id, ref, status").in("ref", refs);
      if (th?.length) {
        const { data: ms } = await supabase.from("support_messages").select("thread_id, body, created_at").in("thread_id", th.map((x) => x.id)).eq("from_staff", true).order("created_at");
        for (const t of th) markSeen(t.id as string, (ms ?? []).filter((m) => m.thread_id === t.id).length, mark);
        for (const t of th) out[t.ref as string] = { taskId: t.ref as string, status: t.status as string, replies: (ms ?? []).filter((m) => m.thread_id === t.id).map((m) => ({ at: Date.parse(m.created_at as string), text: m.body as string })) };
        rest = refs.filter((r) => !out[r]);
      }
    } catch { /* fall through to the bridge */ }
    if (!rest.length) return out;
  }
  refs = rest;
  try { const r = await fetch(BASE + "/api/requests/status?refs=" + encodeURIComponent(refs.join(","))); return r.ok ? { ...out, ...(await r.json()) } : out; } catch { return out; }
}
/** Prices, web settings and published templates managed by staff. Null while offline. */
export function usePublic(): PublicData | null {
  const [d, setD] = useState<PublicData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(BASE + "/api/public").then((r) => (r.ok ? r.json() : null)).then((x) => { if (alive) setD(x); }).catch(() => { if (alive) setD(null); });
    load();
    const i = setInterval(load, 15000);
    return () => { alive = false; clearInterval(i); };
  }, []);
  return d;
}

export interface LiveMsg { id: string; from: "me" | "support"; text: string; at: number }
/** Live chat with the support team. Returns the chat id, or null when the bridge is unreachable. */
export async function sendChat(b: { chatId: string; text: string; customerName: string; customerEmail: string }): Promise<string | null> {
  const u = await sbUser();
  if (u && (!b.chatId || isUuid(b.chatId))) {
    try {
      const id = b.chatId || crypto.randomUUID();
      const { error } = await supabase.from("support_threads").upsert({ id, customer_id: u.id, channel: "chat", kind: "support", subject: "Live chat", customer_name: b.customerName, customer_email: b.customerEmail }, { onConflict: "id", ignoreDuplicates: true });
      if (error) return null;
      const { error: e2 } = await supabase.from("support_messages").insert({ thread_id: id, author: u.id, body: b.text.slice(0, 5000) });
      return e2 ? null : id;
    } catch { return null; }
  }
  try {
    const r = await fetch(BASE + "/api/chats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return r.ok ? ((await r.json()) as { chatId: string }).chatId : null;
  } catch { return null; }
}
export async function fetchChat(chatId: string, mark = true): Promise<{ messages: LiveMsg[]; closed: boolean } | null> {
  if (isUuid(chatId) && (await sbUser())) {
    try {
      const { data: t } = await supabase.from("support_threads").select("closed").eq("id", chatId).maybeSingle();
      if (!t) return null;
      const { data: ms } = await supabase.from("support_messages").select("id, from_staff, body, created_at").eq("thread_id", chatId).order("created_at");
      markSeen(chatId, (ms ?? []).filter((m) => m.from_staff).length, mark);
      return { closed: !!t.closed, messages: (ms ?? []).map((m) => ({ id: m.id as string, from: m.from_staff ? "support" : "me", text: m.body as string, at: Date.parse(m.created_at as string) })) };
    } catch { return null; }
  }
  try { const r = await fetch(BASE + "/api/chats/" + encodeURIComponent(chatId)); return r.ok ? await r.json() : null; } catch { return null; }
}
