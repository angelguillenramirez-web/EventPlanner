import { useState } from "react";
import { isOpen, KIND_SLA_HOURS, presenceTimes, PRESENCE, PRESENCE_LIST, ROLE_LABEL, useStore, type Staff, type Task } from "../store";
import { downloadCsv, fmtAge, fmtDate, PresenceTag, Stat } from "../ui";

const H = 3600_000, D = 24 * H;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Customer-support metrics with downloadable reports. Support sees their own numbers; a super admin sees the team and each agent. */
export default function Metrics({ me }: { me: Staff }) {
  const s = useStore();
  const [range, setRange] = useState(30);
  const [who, setWho] = useState<string>(me.role === "super_admin" ? "team" : me.id);
  const from = Date.now() - range * D;
  const agents = s.staff.filter((m) => m.role === "support");
  const mine = (t: Task) => t.kind === "support" && (who === "team" ? true : t.assigneeId === who);
  const all = s.tasks.filter((t) => mine(t) && t.createdAt >= from);
  const done = all.filter((t) => t.status === "done");
  const replied = all.filter((t) => t.firstResponseAt);
  const frt = replied.map((t) => t.firstResponseAt - t.createdAt);
  const res = done.map((t) => t.resolvedAt - t.createdAt);
  const sla = KIND_SLA_HOURS.support * H;
  const within = done.filter((t) => t.resolvedAt - t.createdAt <= sla).length;
  const late = all.filter((t) => isOpen(t) && Date.now() - t.createdAt > sla).length;
  const days = Array.from({ length: Math.min(range, 30) }, (_, i) => dayKey(Date.now() - (Math.min(range, 30) - 1 - i) * D));
  const perDay = days.map((d) => all.filter((t) => dayKey(t.createdAt) === d).length);
  const maxD = Math.max(1, ...perDay);
  const byStatus = ["new", "assigned", "in_progress", "waiting", "done"].map((k) => [k, all.filter((t) => t.status === k).length] as const);
  const chat = all.filter((t) => t.channel === "chat").length;
  const rowFor = (m: Staff) => {
    const own = s.tasks.filter((t) => t.kind === "support" && t.assigneeId === m.id && t.createdAt >= from);
    const d = own.filter((t) => t.status === "done"), r = own.filter((t) => t.firstResponseAt);
    return { name: m.name, handled: own.length, resolved: d.length, open: own.filter(isOpen).length, frt: avg(r.map((t) => t.firstResponseAt - t.createdAt)), res: avg(d.map((t) => t.resolvedAt - t.createdAt)), sla: d.length ? Math.round((d.filter((t) => t.resolvedAt - t.createdAt <= sla).length / d.length) * 100) : 0 };
  };
  const stamp = new Date().toISOString().slice(0, 10);
  const dlRequests = () => downloadCsv(`support-requests-${stamp}.csv`, [["Task ID", "Title", "Customer", "Channel", "Priority", "Status", "Agent", "Created", "First response (min)", "Resolved", "Resolution (h)", "Within SLA"],
    ...all.map((t) => [t.id, t.title, t.requester, t.channel, t.priority, t.status, s.staff.find((m) => m.id === t.assigneeId)?.name ?? "", new Date(t.createdAt).toISOString(), t.firstResponseAt ? Math.round((t.firstResponseAt - t.createdAt) / 60000) : "", t.resolvedAt ? new Date(t.resolvedAt).toISOString() : "", t.resolvedAt ? Math.round(((t.resolvedAt - t.createdAt) / H) * 10) / 10 : "", t.status === "done" ? (t.resolvedAt - t.createdAt <= sla ? "yes" : "no") : ""])]);
  const dlAgents = () => downloadCsv(`support-agents-${stamp}.csv`, [["Agent", "Requests", "Resolved", "Open", "Avg first response (min)", "Avg resolution (h)", "Resolved within SLA %"], ...agents.map((m) => { const r = rowFor(m); return [r.name, r.handled, r.resolved, r.open, Math.round(r.frt / 60000), Math.round((r.res / H) * 10) / 10, r.sla]; })]);
  const dlDaily = () => downloadCsv(`support-daily-${stamp}.csv`, [["Date", "New requests"], ...days.map((d, i) => [d, perDay[i]])]);

  return (
    <>
      <div className="row between"><h1>Support metrics</h1>
        <div className="row">
          <div className="seg" role="group" aria-label="Period">{[7, 30, 90].map((d) => <button key={d} aria-pressed={range === d} onClick={() => setRange(d)}>{d} days</button>)}</div>
          {me.role === "super_admin" && <select aria-label="Agent" style={{ width: "auto" }} value={who} onChange={(e) => setWho(e.target.value)}><option value="team">Whole team</option>{agents.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
        </div></div>
      <p className="muted" style={{ marginTop: -4 }}>{who === "team" ? "Customer support team" : s.staff.find((m) => m.id === who)?.name} · last {range} days · SLA target {KIND_SLA_HOURS.support} h</p>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat n={all.length} label="Requests received" />
        <Stat n={frt.length ? fmtAge(avg(frt)) : "—"} label="Avg first response" />
        <Stat n={res.length ? fmtAge(avg(res)) : "—"} label="Avg time to resolve" />
        <Stat n={pct(within, done.length)} label="Resolved within SLA" />
        <Stat n={done.length} label="Resolved" />
        <Stat n={all.filter(isOpen).length} label="Still open" />
        <Stat n={late} label="Open and late" />
        <Stat n={pct(chat, all.length)} label="Via live chat" />
      </div>
      <div className="grid g2" style={{ marginBottom: 14 }}>
        <div className="card"><h3>New requests per day</h3>
          <div className="bars" role="img" aria-label={`Requests per day, peak ${maxD}`}>{perDay.map((n, i) => <i key={i} className={n ? "" : "z"} style={{ height: `${(n / maxD) * 100}%` }} title={`${days[i]}: ${n}`} />)}</div>
          <div className="row between muted small"><span>{days[0]}</span><span>{days[days.length - 1]}</span></div></div>
        <div className="card"><h3>By status</h3>{byStatus.map(([k, n]) => <div key={k} className="row" style={{ flexWrap: "nowrap", marginBottom: 6 }}><span style={{ width: 90 }}>{k.replace("_", " ")}</span><div className="bar grow"><i style={{ width: `${all.length ? (n / all.length) * 100 : 0}%` }} /></div><b style={{ width: 28, textAlign: "right" }}>{n}</b></div>)}</div>
      </div>
      {me.role === "super_admin" && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>By agent</h3>
          <div style={{ overflowX: "auto" }}><table><thead><tr><th>Agent</th><th>Requests</th><th>Resolved</th><th>Open</th><th>Avg first response</th><th>Avg resolution</th><th>Within SLA</th></tr></thead>
            <tbody>{agents.map((m) => { const r = rowFor(m); return <tr key={m.id}><td>{r.name}</td><td>{r.handled}</td><td>{r.resolved}</td><td>{r.open}</td><td>{r.frt ? fmtAge(r.frt) : "—"}</td><td>{r.res ? fmtAge(r.res) : "—"}</td><td>{r.resolved ? r.sla + "%" : "—"}</td></tr>; })}</tbody></table></div>
        </div>
      )}
      <div className="card">
        <h3>Download reports</h3>
        <div className="row"><button onClick={dlRequests}>Requests (CSV)</button>{me.role === "super_admin" && <button onClick={dlAgents}>Agent performance (CSV)</button>}<button className="ghost" onClick={dlDaily}>Daily volume (CSV)</button><button className="ghost" onClick={() => window.print()}>Print / save as PDF</button></div>
        <p className="muted small" style={{ marginBottom: 0 }}>CSV files open in Excel, Numbers or Google Sheets. Reports follow the period and agent selected above.</p>
      </div>
    </>
  );
}

/** Super admin: who is available right now and how time was spent today (staff only; customers never see this). */
export function PresenceBoard() {
  const s = useStore();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const rows = s.staff.filter((m) => m.active).map((m) => ({ m, t: presenceTimes(s, m.id, +start) }));
  const dl = () => downloadCsv(`team-availability-${new Date().toISOString().slice(0, 10)}.csv`, [["Name", "Profile", "Current status", "Note", ...PRESENCE_LIST.map((p) => `${PRESENCE[p].label} today (min)`)], ...rows.map(({ m, t }) => [m.name, ROLE_LABEL[m.role], PRESENCE[m.presence].label, m.presenceNote, ...PRESENCE_LIST.map((p) => Math.round(t[p] / 60000))])]);
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="row between"><h3>Team availability <span className="muted small">(staff only — customers never see this)</span></h3><button className="ghost sm" onClick={dl}>Download (CSV)</button></div>
      <div style={{ overflowX: "auto" }}><table>
        <thead><tr><th>Member</th><th>Profile</th><th>Now</th><th>Since</th>{["online", "lunch", "break", "meeting"].map((p) => <th key={p}>{PRESENCE[p as keyof typeof PRESENCE].label.split(" —")[0]} today</th>)}</tr></thead>
        <tbody>{rows.map(({ m, t }) => <tr key={m.id}><td>{m.name}</td><td>{ROLE_LABEL[m.role]}</td><td><PresenceTag p={m.presence} note={m.presenceNote} /></td><td className="small">{fmtDate(m.presenceAt)}</td>{["online", "lunch", "break", "meeting"].map((p) => <td key={p} className="small">{fmtAge(t[p as keyof typeof t])}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}
