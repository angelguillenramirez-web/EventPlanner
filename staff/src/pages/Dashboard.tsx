import { useState } from "react";
import { fmtAge, fmtDate, go, isLate, PriorityBadge, Stat, StatusBadge, taskAge, useTick } from "../ui";
import { PresenceBoard } from "./Metrics";
import { isNewTask, isOpen, ROLE_LABEL, setStatus, STATUSES, STATUS_LABEL, useSeen, useStore, type Staff, type Task, type TaskStatus } from "../store";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Benchmark: every employee tracks their own requests (task ID, creation time, status). */
export default function Dashboard({ me }: { me: Staff }) {
  const s = useStore();
  useTick();
  const [f, setF] = useState<"open" | "all" | TaskStatus>("open");
  const [q, setQ] = useState("");
  const mine = s.tasks.filter((t) => t.assigneeId === me.id);
  const open = mine.filter(isOpen), done = mine.filter((t) => t.status === "done");
  const week = Date.now() - 7 * 864e5;
  const rows = mine.filter((t) => (f === "all" ? true : f === "open" ? isOpen(t) : t.status === f) && (!q || (t.id + t.title + t.requester).toLowerCase().includes(q.toLowerCase())));
  const unclaimed = s.tasks.filter((t) => !t.assigneeId && isOpen(t) && (me.role === "super_admin" || (t.kind === "support" && me.role === "support") || (t.kind === "design" && me.role === "designer"))).length;

  return (
    <>
      <h1>My requests</h1>
      <p className="muted" style={{ marginTop: -4 }}>{me.name} · {ROLE_LABEL[me.role]}</p>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat n={open.length} label="Open requests" />
        <Stat n={mine.filter((t) => t.status === "in_progress").length} label="In progress" />
        <Stat n={done.filter((t) => t.resolvedAt > week).length} label="Done in the last 7 days" />
        <Stat n={done.length ? fmtAge(avg(done.map((t) => t.resolvedAt - t.createdAt))) : "—"} label="Average time to resolve" />
      </div>
      {open.some(isLate) && <div className="alert" style={{ marginBottom: 14 }}>{open.filter(isLate).length} request(s) are past their target time.</div>}
      {unclaimed > 0 && <div className="warn" style={{ marginBottom: 14 }}>{unclaimed} request(s) are waiting in your team queue with no owner. <a href="#/tasks">Open the team queue</a></div>}

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="seg" role="group" aria-label="Filter">
            {(["open", "all", ...STATUSES] as const).map((x) => <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x === "open" ? "Open" : x === "all" ? "All" : STATUS_LABEL[x]}</button>)}
          </div>
          <input style={{ width: 220 }} placeholder="Search ID, title, customer…" aria-label="Search requests" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TaskTable rows={rows} me={me} />
      </div>

      {me.role === "super_admin" && <TeamBoard />}
      {me.role === "super_admin" && <PresenceBoard />}
    </>
  );
}

/** `statusReadOnly`: show the status as a tag only (the Team queue); otherwise the owner or a super admin can change it from the row. */
export function TaskTable({ rows, me, showOwner, statusReadOnly }: { rows: Task[]; me: Staff; showOwner?: boolean; statusReadOnly?: boolean }) {
  const s = useStore();
  useSeen();
  if (!rows.length) return <p className="muted" style={{ margin: 8 }}>Nothing here.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead><tr><th>Task ID</th><th>Request</th><th>Created</th><th>Age</th>{showOwner && <th>Owner</th>}<th>Priority</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={`click${isNewTask(t, me.id) ? " isnew" : ""}`} onClick={() => go("/tasks/" + t.id)}>
              <td className="mono"><a href={"#/tasks/" + t.id}>{t.id}</a></td>
              <td><b>{t.title}</b>{isNewTask(t, me.id) && <span className="badge b-new" style={{ marginLeft: 6 }}>New</span>}{t.channel === "chat" && <span className="badge" style={{ marginLeft: 6 }}>live chat</span>}<div className="muted small">{t.requester || "—"}</div></td>
              <td className="small">{fmtDate(t.createdAt)}</td>
              <td className="small">{fmtAge(taskAge(t))} {isLate(t) && <span className="badge b-late">late</span>}</td>
              {showOwner && <td className="small">{s.staff.find((m) => m.id === t.assigneeId)?.name ?? <i className="muted">unassigned</i>}</td>}
              <td><PriorityBadge p={t.priority} /></td>
              <td onClick={(e) => e.stopPropagation()}>
                {!statusReadOnly && (t.assigneeId === me.id || me.role === "super_admin")
                  ? <select aria-label={`Status of ${t.id}`} style={{ padding: "3px 6px", width: "auto" }} value={t.status} onChange={(e) => setStatus(t.id, me.name, e.target.value as TaskStatus)}>{STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
                  : <StatusBadge s={t.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Super admin: workload and speed per team member. */
function TeamBoard() {
  const s = useStore();
  const members = s.staff.filter((m) => m.role !== "super_admin");
  const max = Math.max(1, ...members.map((m) => s.tasks.filter((t) => t.assigneeId === m.id && isOpen(t)).length));
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>Team workload</h3>
      <table>
        <thead><tr><th>Member</th><th>Team</th><th>Open</th><th style={{ width: "28%" }}>Load</th><th>Done</th><th>Avg. resolve</th><th>Late</th></tr></thead>
        <tbody>
          {members.map((m) => {
            const own = s.tasks.filter((t) => t.assigneeId === m.id), o = own.filter(isOpen), d = own.filter((t) => t.status === "done");
            return <tr key={m.id}><td>{m.name}{!m.active && <span className="badge"> inactive</span>}</td><td>{ROLE_LABEL[m.role]}</td><td>{o.length}</td><td><div className="bar"><i style={{ width: `${(o.length / max) * 100}%` }} /></div></td><td>{d.length}</td><td>{d.length ? fmtAge(avg(d.map((t) => t.resolvedAt - t.createdAt))) : "—"}</td><td>{o.filter(isLate).length}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
