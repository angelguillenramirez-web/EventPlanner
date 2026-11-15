import { useEffect, useState, useSyncExternalStore } from "react";
import { KIND_SLA_HOURS, PRESENCE, STATUS_LABEL, type Presence, type Priority, type Staff, type Task, type TaskStatus } from "./store";
import { X } from "lucide-react";

// hash router
const sub = (f: () => void) => { addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); };
export const useRoute = () => useSyncExternalStore(sub, () => location.hash.slice(1) || "/");
export const go = (p: string) => { location.hash = p; };

export const fmtDate = (t: number) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
export function fmtAge(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = m / 60;
  return h < 48 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h / 24)}d`;
}
export const money = (n: number) => `$${n.toFixed(2)}`;
export const StatusBadge = ({ s }: { s: TaskStatus }) => <span className={`badge b-${s}`}>{STATUS_LABEL[s]}</span>;
export const PriorityBadge = ({ p }: { p: Priority }) => (p === "urgent" || p === "high" ? <span className={`badge b-${p}`}>{p}</span> : <span className="badge">{p}</span>);
export const isLate = (t: Task) => t.status !== "done" && Date.now() - t.createdAt > KIND_SLA_HOURS[t.kind] * 3600_000;
/** Time the request has been (or was) open. */
export const taskAge = (t: Task) => (t.status === "done" ? t.resolvedAt - t.createdAt : Date.now() - t.createdAt);
export function Stat({ n, label }: { n: React.ReactNode; label: string }) { return <div className="card stat"><b>{n}</b><span>{label}</span></div>; }
export function Tabs({ items, cur }: { items: [string, string][]; cur: string }) {
  return <nav className="tabs">{items.map(([h, l]) => <a key={h} href={"#" + h} aria-current={cur === h ? "page" : undefined}>{l}</a>)}</nav>;
}
/** Re-render every `ms` so ages stay fresh. */
export function useTick(ms = 30000) { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]); }
export function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button className="ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { prompt("Copy this value:", text); } }}>{ok ? "Copied" : label}</button>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { width: 860 } : { width: "min(460px, 100%)" }}>
        <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>{title}</h3><button className="ghost sm icon" aria-label="Close" onClick={onClose}><X size={14} /></button></div>
        {children}
      </div>
    </div>
  );
}
/** Round profile picture, or initials when there is none. A coloured dot shows availability (staff-only). */
export function Avatar({ m, size = 32, dot }: { m: Pick<Staff, "name" | "avatar"> & Partial<Pick<Staff, "presence">>; size?: number; dot?: boolean }) {
  const ini = m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {m.avatar ? <img src={m.avatar} alt="" /> : <b>{ini}</b>}
      {dot && m.presence && <i className="pdot" title={PRESENCE[m.presence].label} style={{ background: PRESENCE[m.presence].color }} />}
    </span>
  );
}
export const PresenceTag = ({ p, note }: { p: Presence; note?: string }) => <span className="row" style={{ gap: 5, flexWrap: "nowrap" }}><i className="pdot static" style={{ background: PRESENCE[p].color }} />{PRESENCE[p].label}{note ? <span className="muted small"> · {note}</span> : null}</span>;
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Resizes a picked image to a small square JPEG data URL (kept in the profile). */
export function readAvatar(file: File, size = 160): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d")!; const m = Math.min(img.width, img.height); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Not an image")); };
    img.src = url;
  });
}
