import { useMemo, useRef, useState } from "react";
import { uid, update, useStore, type Staff, type WorkTask, type WPriority, type WStatus } from "../store";
import { Avatar, Modal } from "../ui";
import { Archive, CalendarDays, GripVertical, Plus, Tag as TagIcon, ThumbsUp, Trash2, User, X } from "../icons";

/**
 * Internal task manager: same structure as the Event Planner task tracker (board, Gantt, calendar, list; lists, dates,
 * priority, tags, responsible people, notes, history) but for work only — it is not linked to any customer event.
 */
const DAY = 864e5;
const PRI: WPriority[] = ["low", "medium", "high", "urgent"];
const day = (d: string) => new Date(d + "T12:00");
const iso = (d = new Date()) => d.toISOString().slice(0, 10);
const shift = (d: string, n: number) => iso(new Date(day(d).getTime() + n * DAY));
const diff = (a: string, b: string) => Math.round((+day(a) - +day(b)) / DAY);
const fmt = (d: string) => (d ? day(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const PriBadge = ({ p }: { p: WPriority }) => (p ? <span className={`badge ${p === "urgent" ? "b-urgent" : p === "high" ? "b-high" : ""}`}>{p}</span> : null);

function patch(id: string, by: string, p: Partial<WorkTask>, what?: string) {
  update((s) => { const t = s.work.find((x) => x.id === id); if (!t) return; Object.assign(t, p); if (what) t.history.unshift({ id: uid(), at: Date.now(), by, text: what }); });
}
function move(id: string, beforeId: string | null, statusId?: string) {
  update((s) => {
    const i = s.work.findIndex((x) => x.id === id); if (i < 0 || id === beforeId) return;
    if (statusId) { const t = s.work[i]; t.statusId = statusId; t.done = statusId === "done"; }
    const [t] = s.work.splice(i, 1); const j = beforeId ? s.work.findIndex((x) => x.id === beforeId) : -1;
    if (j < 0) s.work.push(t); else s.work.splice(j, 0, t);
  });
}

export default function Work({ me }: { me: Staff }) {
  const s = useStore();
  const [view, setView] = useState<"board" | "gantt" | "calendar" | "list">("board");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [create, setCreate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [over, setOver] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const drag = useRef<{ id: string; day?: string; col?: string } | null>(null);
  const statuses = s.wstatuses;
  const tasks = useMemo(() => s.work.filter((t) => (scope === "all" && me.role === "super_admin" ? true : t.ownerId === me.id || t.assignees.includes(me.id)) && (!tag || t.tags.includes(tag)) && (!q || t.name.toLowerCase().includes(q.toLowerCase()))), [s, scope, tag, q, me]);
  const stOf = (id: string) => statuses.find((x) => x.id === id) ?? statuses[0];
  const name = (id: string) => s.staff.find((m) => m.id === id)?.name.split(" ")[0] ?? "?";
  const start = (e: React.DragEvent, id: string, d?: string) => { drag.current = { id, day: d }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); e.stopPropagation(); };
  const end = () => { drag.current = null; setOver(null); };
  const allow = (e: React.DragEvent, k: string) => { if (drag.current) { e.preventDefault(); setOver(k); } };
  const dropTask = (e: React.DragEvent, t: WorkTask) => { if (!drag.current) return; e.preventDefault(); e.stopPropagation(); move(drag.current.id, t.id, t.statusId); end(); };
  const dropCol = (e: React.DragEvent, st: WStatus) => { if (!drag.current) return; e.preventDefault(); move(drag.current.id, null, st.id); end(); };
  const allTags = [...new Set([...s.wtags, ...s.work.flatMap((t) => t.tags)])];

  const meta = (t: WorkTask) => (
    <div className="meta">
      <PriBadge p={t.priority} />
      {t.tags.map((g) => <span key={g} className="badge row" style={{ gap: 3 }}><TagIcon size={11} />{g}</span>)}
      {t.due && <span className="row" style={{ gap: 3 }}><CalendarDays size={12} />{fmt(t.due)}</span>}
      {t.assignees.length > 0 && <span className="row" style={{ gap: 3 }}><User size={12} />{t.assignees.map((a) => "@" + name(a)).join(", ")}</span>}
    </div>
  );
  const doneBox = (t: WorkTask) => <input type="checkbox" className="tcheck" aria-label="Done" checked={t.done} onClick={(e) => e.stopPropagation()} onChange={(e) => patch(t.id, me.name, { done: e.target.checked, statusId: e.target.checked ? "done" : statuses[0].id }, e.target.checked ? "Marked as done" : "Reopened")} />;
  const like = (t: WorkTask) => { const on = t.likes.includes(me.id); return <button className={`likebtn${on ? " on" : ""}`} aria-pressed={on} aria-label="Like" onClick={(e) => { e.stopPropagation(); patch(t.id, me.name, { likes: on ? t.likes.filter((x) => x !== me.id) : [...t.likes, me.id] }); }}><ThumbsUp size={14} fill={on ? "currentColor" : "none"} />{t.likes.length > 0 && <span>{t.likes.length}</span>}</button>; };
  const addBtn = (sid: string) => <button className="addtask" onClick={() => setCreate(sid)}><Plus size={15} /> Add task</button>;

  const board = () => (
    <div className="board" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(240px, 1fr)) 44px` }}>
      {statuses.map((st) => (
        <div key={st.id} className={`bcol${over === "s" + st.id ? " over" : ""}`} onDragOver={(e) => allow(e, "s" + st.id)} onDragLeave={() => setOver(null)} onDrop={(e) => dropCol(e, st)}>
          <div className="head row"><span className="dot" style={{ background: st.color }} /><b onDoubleClick={() => { const n = prompt("Rename list", st.name); if (n?.trim()) update((x) => { x.wstatuses.find((y) => y.id === st.id)!.name = n.trim(); }); }} title="Double-click to rename">{st.name}</b><span className="muted" style={{ flex: 1 }}>{tasks.filter((x) => x.statusId === st.id).length}</span></div>
          <div className="list">
            {tasks.filter((x) => x.statusId === st.id).map((x) => (
              <div key={x.id} className={`tcard${x.done ? " tdone" : ""}${over === x.id ? " dragover-top" : ""}`} draggable onDragStart={(e) => start(e, x.id)} onDragEnd={end} onDragOver={(e) => { if (drag.current) { e.preventDefault(); e.stopPropagation(); setOver(x.id); } }} onDrop={(e) => dropTask(e, x)} onClick={() => setOpen(x.id)} tabIndex={0} role="button" onKeyDown={(e) => e.key === "Enter" && setOpen(x.id)}>
                <div className="row" style={{ flexWrap: "nowrap", gap: 8, alignItems: "flex-start" }}>{doneBox(x)}<b>{x.name}</b></div>
                <div className="mrow">{meta(x)}{like(x)}</div>
              </div>
            ))}
          </div>
          {addBtn(st.id)}
        </div>
      ))}
      <button className="addcol" aria-label="New list" title="New list" onClick={() => setNaming(true)}><Plus size={20} /></button>
    </div>
  );
  const list = () => statuses.map((st) => (
    <div key={st.id} className="listsec" onDragOver={(e) => allow(e, "s" + st.id)} onDrop={(e) => dropCol(e, st)}>
      <div className="head row" style={{ marginBottom: 6 }}><span className="dot" style={{ background: st.color }} /><b>{st.name}</b><span className="muted">{tasks.filter((x) => x.statusId === st.id).length}</span></div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {tasks.filter((x) => x.statusId === st.id).map((x) => (
          <div key={x.id} className={`listrow${x.done ? " tdone" : ""}`} draggable onDragStart={(e) => start(e, x.id)} onDragEnd={end} onDragOver={(e) => { if (drag.current) { e.preventDefault(); setOver(x.id); } }} onDrop={(e) => dropTask(e, x)} onClick={() => setOpen(x.id)}>
            <span className="row" style={{ gap: 6 }}><GripVertical size={14} className="muted" />{doneBox(x)}<b>{x.name}</b></span>
            <span><PriBadge p={x.priority} /></span><span className="muted small">{fmt(x.due)}</span><span className="muted small">{x.assignees.map((a) => "@" + name(a)).join(", ")}</span><span className="muted small">{x.tags.join(", ")}</span>
          </div>
        ))}
        {!tasks.some((x) => x.statusId === st.id) && <div className="muted small" style={{ padding: 12 }}>Nothing here.</div>}
      </div>
      {addBtn(st.id)}
    </div>
  ));
  const calendar = () => {
    const first = new Date(month); const st0 = new Date(first); st0.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => new Date(st0.getTime() + i * DAY));
    const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));
    const drop = (e: React.DragEvent, k: string) => {
      const d = drag.current; if (!d) return; e.preventDefault();
      const t = s.work.find((x) => x.id === d.id)!; const delta = diff(k, d.day ?? t.due ?? t.start);
      patch(t.id, me.name, { start: t.start ? shift(t.start, delta) : k, due: t.due ? shift(t.due, delta) : k }, "Dates moved"); end();
    };
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}><button className="ghost sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><b>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button className="ghost sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
        <div className="cal">
          {wd.map((d) => <div className="h" key={d}>{d}</div>)}
          {days.map((d) => {
            const k = iso(d); const dl = tasks.filter((x) => (x.start || x.due) <= k && k <= (x.due || x.start) && (x.start || x.due));
            return <div key={k} className={`d${d.getMonth() !== month.getMonth() ? " dim" : ""}${over === k ? " drop" : ""}${k === iso() ? " today" : ""}`} onDragOver={(e) => allow(e, k)} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, k)}>{d.getDate()}
              {dl.slice(0, 3).map((x) => <button key={x.id} className={`chip${x.done ? " tdone" : ""}`} draggable onDragStart={(e) => start(e, x.id, k)} onDragEnd={end} style={{ background: stOf(x.statusId).color }} onClick={() => setOpen(x.id)}>{x.name}</button>)}
              {dl.length > 3 && <span className="muted">+{dl.length - 3}</span>}</div>;
          })}
        </div>
        {addBtn(statuses[0].id)}
      </>
    );
  };
  const gantt = () => {
    const dated = tasks.filter((x) => x.start && x.due);
    if (!dated.length) return <><p className="muted">Give tasks a start and due date to see them here.</p>{addBtn(statuses[0].id)}</>;
    const min = Math.min(...dated.map((x) => +new Date(x.start))) - 2 * DAY, max = Math.max(...dated.map((x) => +new Date(x.due))) + 3 * DAY;
    const n = Math.ceil((max - min) / DAY), W = 26, idx = (d: string) => Math.round((+new Date(d) - min) / DAY), today = Math.round((new Date(iso()).getTime() - min) / DAY);
    return (
      <>
        <div className="gantt"><div style={{ minWidth: 200 + n * W }}>
          <div className="grow-g" style={{ gridTemplateColumns: `200px repeat(${n}, ${W}px)`, background: "var(--soft)" }}><div style={{ padding: "0 8px" }} className="small muted">Task</div>{Array.from({ length: n }, (_, i) => { const d = new Date(min + i * DAY); return <div key={i} className="small muted" style={{ textAlign: "center", fontSize: ".65rem" }}>{d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: "short" }) : d.getDate()}</div>; })}</div>
          {dated.map((x) => (
            <div className="grow-g" key={x.id} style={{ gridTemplateColumns: `200px ${n * W}px` }}>
              <div style={{ padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</div>
              <div style={{ position: "relative", height: 34 }}>{today >= 0 && today < n && <div style={{ position: "absolute", left: today * W, top: 0, bottom: 0, width: 2, background: "var(--rose)", opacity: .6 }} />}
                <button className={`gbar${x.done ? " tdone" : ""}`} style={{ position: "absolute", top: 7, left: idx(x.start) * W, width: Math.max(1, idx(x.due) - idx(x.start) + 1) * W, background: stOf(x.statusId).color }} onClick={() => setOpen(x.id)}>{x.name}</button></div>
            </div>
          ))}
        </div></div>
        {addBtn(statuses[0].id)}
      </>
    );
  };

  return (
    <>
      <h1>Task manager</h1>
      <p className="muted" style={{ marginTop: -4 }}>Your internal work tasks. They are not linked to any customer event or request; for customer requests use <a href="#/tasks">Team queue</a>.</p>
      <div className="row between stickbar" style={{ marginBottom: 10 }}>
        <div className="seg" role="group" aria-label="View">{(["board", "gantt", "calendar", "list"] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
        <div className="row">
          {me.role === "super_admin" && <div className="seg"><button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Mine</button><button aria-pressed={scope === "all"} onClick={() => setScope("all")}>Everyone</button></div>}
          <input style={{ width: 180 }} placeholder="Search tasks…" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="tagrow" style={{ marginBottom: 10 }}>{allTags.map((g) => <button key={g} className="tagbtn" aria-pressed={tag === g} onClick={() => setTag(tag === g ? "" : g)}>{g}</button>)}</div>
      {view === "board" && board()}{view === "list" && list()}{view === "calendar" && calendar()}{view === "gantt" && gantt()}
      <button className="fab fab-left" style={{ left: "auto", right: 20, bottom: 20 }} aria-label="Add task" title="Add task" onClick={() => setCreate(statuses[0].id)}><Plus size={24} /></button>
      {create && <Create me={me} statusId={create} onClose={() => setCreate(null)} onDone={(id) => { setCreate(null); setOpen(id); }} />}
      {open && s.work.find((x) => x.id === open) && <Drawer me={me} id={open} onClose={() => setOpen(null)} />}
      {naming && <NewList onClose={() => setNaming(false)} />}
    </>
  );
}

function NewList({ onClose }: { onClose: () => void }) {
  const [n, setN] = useState("");
  const COL = ["#4EB1E8", "#C7B146", "#46C8B2", "#C7465C", "#8b6fd6"];
  return (
    <Modal title="New list" onClose={onClose}>
      <form className="grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (!n.trim()) return; update((s) => { s.wstatuses.splice(Math.max(0, s.wstatuses.length - 1), 0, { id: uid(), name: n.trim(), color: COL[s.wstatuses.length % COL.length] }); }); onClose(); }}>
        <div><label htmlFor="ln">List name</label><input id="ln" autoFocus required value={n} onChange={(e) => setN(e.target.value)} /></div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button>Add</button></div>
      </form>
    </Modal>
  );
}

function Create({ me, statusId, onClose, onDone }: { me: Staff; statusId: string; onClose: () => void; onDone: (id: string) => void }) {
  const s = useStore();
  const [f, setF] = useState({ name: "", statusId, due: "", priority: "medium" as WPriority });
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); if (!f.name.trim()) return;
    const now = Date.now(); const t: WorkTask = { id: uid(), ownerId: me.id, name: f.name.trim(), statusId: f.statusId, description: "", start: iso(), due: f.due, priority: f.priority, tags: [], assignees: [me.id], done: f.statusId === "done", likes: [], notes: [], history: [{ id: uid(), at: now, by: me.name, text: "Task created" }], createdAt: now };
    update((x) => { x.work.push(t); }); onDone(t.id);
  };
  return (
    <Modal title="New task" onClose={onClose}>
      <form className="grid" style={{ gap: 12 }} onSubmit={submit}>
        <div><label htmlFor="wn">Name *</label><input id="wn" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="form">
          <div><label htmlFor="wl">List</label><select id="wl" value={f.statusId} onChange={(e) => setF({ ...f, statusId: e.target.value })}>{s.wstatuses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div><label htmlFor="wd">Due</label><input id="wd" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
          <div><label htmlFor="wp">Priority</label><select id="wp" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as WPriority })}><option value="">—</option>{PRI.map((p) => <option key={p}>{p}</option>)}</select></div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button disabled={!f.name.trim()}>Create</button></div>
      </form>
    </Modal>
  );
}

function Drawer({ me, id, onClose }: { me: Staff; id: string; onClose: () => void }) {
  const s = useStore();
  const t = s.work.find((x) => x.id === id)!;
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const st = s.wstatuses.find((x) => x.id === t.statusId) ?? s.wstatuses[0];
  const set = (p: Partial<WorkTask>, what?: string) => patch(t.id, me.name, p, what);
  const owner = s.staff.find((m) => m.id === t.ownerId);
  const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const addTag = (g: string) => { const v = g.trim().slice(0, 30); if (!v || t.tags.includes(v)) return; update((x) => { if (!x.wtags.includes(v)) x.wtags.unshift(v); }); set({ tags: [...t.tags, v] }, `Tag added: ${v}`); setTagText(""); };
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" aria-label="Task">
        <div className="drawer-head">
          <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <input type="checkbox" className="tcheck" aria-label="Done" checked={t.done} onChange={(e) => set({ done: e.target.checked, statusId: e.target.checked ? "done" : s.wstatuses[0].id }, e.target.checked ? "Marked as done" : "Reopened")} />
            <select aria-label="List" className="statuspill" style={{ background: st.color }} value={t.statusId} onChange={(e) => set({ statusId: e.target.value, done: e.target.value === "done" }, `Moved to ${s.wstatuses.find((x) => x.id === e.target.value)?.name}`)}>{s.wstatuses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </span>
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><button className="ghost icon" aria-label="Delete task" title="Delete" onClick={() => setConfirm(true)}><Trash2 size={16} /></button><button className="ghost icon" aria-label="Close" onClick={onClose}><X size={18} /></button></span>
        </div>
        <div className="drawer-body">
          <input aria-label="Task name" defaultValue={t.name} key={t.id + t.name} style={{ fontSize: "1.2rem", fontWeight: 700, border: 0, background: "transparent", padding: "4px 0" }} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) set({ name: v }, "Renamed"); }} />
          <div className="muted small" style={{ marginBottom: 14 }}>Created {when(t.createdAt)} by {owner?.name ?? "—"}</div>
          <div className="fieldcol">
            <div><label htmlFor="wdesc">Description</label><textarea id="wdesc" rows={3} defaultValue={t.description} key={t.id + "d"} onBlur={(e) => { if (e.target.value !== t.description) set({ description: e.target.value }, "Description updated"); }} /></div>
            <div className="form"><div><label htmlFor="ws">Start</label><input id="ws" type="date" value={t.start} onChange={(e) => set({ start: e.target.value }, "Start date changed")} /></div><div><label htmlFor="wu">Due</label><input id="wu" type="date" value={t.due} min={t.start || undefined} onChange={(e) => set({ due: e.target.value }, "Due date changed")} /></div></div>
            <div><label htmlFor="wpr">Priority</label><select id="wpr" value={t.priority} onChange={(e) => set({ priority: e.target.value as WPriority }, `Priority: ${e.target.value || "none"}`)}><option value="">—</option>{PRI.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div><label>Tags</label>
              <div className="tagrow">{t.tags.map((g) => <span key={g} className="tagchip on"><TagIcon size={12} />{g}<button type="button" className="ghost icon" style={{ padding: 0, border: 0 }} aria-label={`Remove ${g}`} onClick={() => set({ tags: t.tags.filter((y) => y !== g) })}><X size={12} /></button></span>)}</div>
              <div className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}><input list="wtags" placeholder="Add a tag…" aria-label="Add a tag" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagText); } }} /><datalist id="wtags">{s.wtags.map((g) => <option key={g} value={g} />)}</datalist><button type="button" className="ghost sm" onClick={() => addTag(tagText)}>Add</button></div></div>
            <div><label>Responsible</label>
              <div className="tagrow">{s.staff.filter((m) => m.active).map((m) => { const on = t.assignees.includes(m.id); return <button key={m.id} type="button" className="tagbtn row" style={{ gap: 5 }} aria-pressed={on} onClick={() => set({ assignees: on ? t.assignees.filter((x) => x !== m.id) : [...t.assignees, m.id] }, `${on ? "Removed" : "Assigned"} ${m.name}`)}><Avatar m={m} size={16} />{m.name}</button>; })}</div></div>
            <div>
              <label>Notes</label>
              {t.notes.length > 0 && <div className="notelog">{[...t.notes].reverse().map((n) => <div key={n.id}><div className="when">{n.by} · {when(n.at)}</div><div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div></div>)}</div>}
              <textarea rows={2} aria-label="New note" placeholder="Write a note…" value={note} onChange={(e) => setNote(e.target.value)} />
              <div style={{ marginTop: 8 }}><button disabled={!note.trim()} onClick={() => { set({ notes: [...t.notes, { id: uid(), by: me.name, at: Date.now(), text: note.trim() }] }, "Note added"); setNote(""); }}><Plus size={15} /> Add</button></div>
            </div>
            <div><label>History</label><div className="history">{t.history.map((h) => <div key={h.id} className="h"><div>{h.by}: {h.text}</div><div className="when">{when(h.at)}</div></div>)}</div></div>
          </div>
        </div>
      </aside>
      {confirm && (
        <Modal title="Delete this task?" onClose={() => setConfirm(false)}>
          <p style={{ marginTop: 0 }}>“{t.name}” will be removed for everyone it is shared with. This cannot be undone.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="danger" onClick={() => { update((x) => { x.work = x.work.filter((y) => y.id !== t.id); }); onClose(); }}><Archive size={14} /> Delete</button></div>
        </Modal>
      )}
    </>
  );
}
