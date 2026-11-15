import { useEffect, useState } from "react";

// Link with the Staff Console through the local bridge (bridge/server.mjs). Everything here is best-effort:
// if the bridge is not running the app keeps working with its own data.
const BASE = "http://localhost:5175";

export interface RemoteStatus { taskId: string; status: string; label?: string; replies?: { at: number; text: string }[] }
export interface PublicData {
  plans: Record<string, { name: string; monthly: number; yearly: number }> | null;
  web: { maintenance: boolean; banner: string; seoTitle: string; seoDescription: string } | null;
  design: { primary: string; accent: string; heroTitle: string; heroSubtitle: string; ctaLabel: string } | null;
  templates: { id: string; name: string; category: string; html: string; css: string }[];
}

export async function sendRequest(b: { kind: "support" | "design"; title: string; description: string; customerName: string; customerEmail: string }): Promise<string | null> {
  try {
    const r = await fetch(BASE + "/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return r.ok ? ((await r.json()) as { ref: string }).ref : null;
  } catch { return null; }
}
export async function fetchStatuses(refs: string[]): Promise<Record<string, RemoteStatus>> {
  if (!refs.length) return {};
  try { const r = await fetch(BASE + "/api/requests/status?refs=" + encodeURIComponent(refs.join(","))); return r.ok ? await r.json() : {}; } catch { return {}; }
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
  try {
    const r = await fetch(BASE + "/api/chats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return r.ok ? ((await r.json()) as { chatId: string }).chatId : null;
  } catch { return null; }
}
export async function fetchChat(chatId: string): Promise<{ messages: LiveMsg[]; closed: boolean } | null> {
  try { const r = await fetch(BASE + "/api/chats/" + encodeURIComponent(chatId)); return r.ok ? await r.json() : null; } catch { return null; }
}
