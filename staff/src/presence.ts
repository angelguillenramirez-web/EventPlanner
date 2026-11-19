import { useEffect, useState } from "react";
import { SUPABASE_AUTH, supabase } from "./supabase";

/**
 * Who else has this request open right now (ids of other staff members).
 * Real accounts: a private Supabase Realtime presence channel per request (nothing is stored; the database rules in
 * staff/supabase/patches/009-presence.sql let only active staff join). Local demo copy: a BroadcastChannel between browser tabs.
 */
export function useViewers(taskId: string | undefined, meId: string): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds([]);
    if (!taskId) return;

    if (SUPABASE_AUTH) {
      const ch = supabase.channel(`task:${taskId}`, { config: { presence: { key: meId }, private: true } });
      const sync = () => setIds(Object.keys(ch.presenceState()).filter((k) => k !== meId));
      ch.on("presence", { event: "sync" }, sync).subscribe((status) => { if (status === "SUBSCRIBED") void ch.track({ at: Date.now() }); });
      return () => { void supabase.removeChannel(ch); };
    }

    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("643-presence");
    const seen = new Map<string, number>();
    const recompute = () => setIds([...seen].filter(([, at]) => Date.now() - at < 9000).map(([id]) => id));
    const here = () => bc.postMessage({ t: "here", task: taskId, id: meId });
    bc.onmessage = (e) => {
      const m = e.data as { t: string; task: string; id: string };
      if (m.task !== taskId || m.id === meId) return;
      if (m.t === "bye") seen.delete(m.id);
      else { if (!seen.has(m.id)) here(); seen.set(m.id, Date.now()); }
      recompute();
    };
    here();
    const iv = setInterval(() => { here(); recompute(); }, 3000);
    return () => { clearInterval(iv); bc.postMessage({ t: "bye", task: taskId, id: meId }); bc.close(); };
  }, [taskId, meId]);
  return ids;
}
