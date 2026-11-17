import { useState } from "react";
import { useT } from "../i18n";
import { PLANS, openUpsell, uid, update, useStore, type EventT } from "../store";
import { LockI, X } from "../icons";

export function Todos({ event }: { event: EventT }) {
  const s = useStore();
  const { t } = useT();
  const [text, setText] = useState("");
  if (!PLANS[s.plan].todos) return <LockedCard k="todos" />;
  const list = s.todos.filter((x) => x.eventId === event.id);
  const add = () => { if (!text.trim()) return; update((st) => { st.todos.push({ id: uid(), eventId: event.id, text: text.trim(), done: false }); }); setText(""); };
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="row"><input style={{ flex: 1 }} value={text} placeholder={t("todo.new")} aria-label={t("todo.new")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /><button onClick={add}>{t("add")}</button></div>
      {list.length === 0 && <p className="muted">{t("none")}</p>}
      {list.map((x) => (
        <div className="row" key={x.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
          <input type="checkbox" className="tcheck" checked={x.done} aria-label={x.text} onChange={() => update((st) => { const y = st.todos.find((z) => z.id === x.id)!; y.done = !y.done; })} />
          <span className="grow" style={{ textDecoration: x.done ? "line-through" : undefined, color: x.done ? "var(--muted)" : undefined }}>{x.text}</span>
          <button className="danger sm icon" aria-label={t("delete")} onClick={() => update((st) => { st.todos = st.todos.filter((z) => z.id !== x.id); })}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function LockedCard({ k }: { k: string }) {
  const { t } = useT();
  return <div className="card" style={{ maxWidth: 560, borderColor: "var(--gold)" }}><h3><LockI /> {t("upsell.title")}</h3><p>{t("upsell." + k)}</p><button onClick={() => openUpsell(k)}>{t("upsell.cta")}</button></div>;
}

export function UserAdmin({ event }: { event: EventT }) {
  const s = useStore();
  const { t } = useT();
  const [f, setF] = useState({ name: "", email: "" });
  const [created, setCreated] = useState<{ email: string; pw: string } | null>(null);
  const max = PLANS[s.plan].subUsers;
  if (max === 0) return <LockedCard k="subusers" />;
  const full = event.subUsers.length >= max;
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (full) { openUpsell("subusers"); return; }
    const pw = Math.random().toString(36).slice(2, 10);
    update((st) => { st.events.find((x) => x.id === event.id)!.subUsers.push({ id: uid(), name: f.name.trim(), email: f.email.trim(), password: pw }); });
    setCreated({ email: f.email, pw }); setF({ name: "", email: "" });
  };
  return (
    <>
      <p className="muted">{t("users.desc")} · {t("users.count", { n: event.subUsers.length, max: max === Infinity ? "∞" : max })}</p>
      <form onSubmit={add} className="card form" style={{ marginBottom: 14 }}>
        <div><label htmlFor="un">{t("name")}</label><input id="un" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="ue">{t("email")}</label><input id="ue" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <button>{t("users.create")}</button>
        {created && <p className="full" role="status" style={{ margin: 0, color: "var(--teal)" }}>{t("users.created")} <b>{created.email}</b> · <code>{created.pw}</code></p>}
      </form>
      <div className="card">
        <table><thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th /></tr></thead>
          <tbody>
            {event.subUsers.length === 0 && <tr><td colSpan={4} className="muted">{t("none")}</td></tr>}
            {event.subUsers.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge">{t("role.enduser")}</span></td>
                <td><button className="danger sm" onClick={() => update((st) => { const e = st.events.find((x) => x.id === event.id)!; e.subUsers = e.subUsers.filter((x) => x.id !== u.id); })}>{t("delete")}</button></td></tr>
            ))}
          </tbody></table>
      </div>
    </>
  );
}
