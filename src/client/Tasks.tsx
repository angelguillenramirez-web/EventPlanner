import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { COLORS, DAY, PLANS, iso, newTask, openUpsell, patchTask, uid, update, useStore, type EventT, type Priority, type Status, type Task, type TaskField, type ViewMode } from "../store";
import { ThumbsUp, ArchiveRestore, Archive, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Copy, GripVertical, LockI, MoreVertical, Pencil, Plus, Settings, Tag as TagIcon, Trash2, User, X } from "../icons";
import { Modal, NoteView, PRIORITIES, PriBadge, RichText, isEmptyHtml, sanitizeHtml } from "./ui";

export const ALL_FIELDS: TaskField[] = ["start", "due", "tag", "priority", "links"];
const STATUS_COLORS = [COLORS.blue, COLORS.gold, COLORS.teal, COLORS.rose];

/* ---------- ordering helpers (drag & drop) ---------- */
function moveTask(id: string, beforeId: string | null, statusId?: string) {
  update((st) => {
    const i = st.tasks.findIndex((x) => x.id === id);
    if (i < 0 || id === beforeId) return;
    if (statusId) patchTask(st, id, { statusId });
    const [tk] = st.tasks.splice(i, 1);
    const j = beforeId ? st.tasks.findIndex((x) => x.id === beforeId) : -1;
    if (j < 0) st.tasks.push(tk); else st.tasks.splice(j, 0, tk);
  });
}
function moveStatus(eventId: string, id: string, beforeId: string) {
  update((st) => {
    const e = st.events.find((x) => x.id === eventId)!;
    const i = e.statuses.findIndex((x) => x.id === id);
    if (i < 0 || id === beforeId) return;
    const [s] = e.statuses.splice(i, 1);
    const j = e.statuses.findIndex((x) => x.id === beforeId);
    e.statuses.splice(j < 0 ? e.statuses.length : j, 0, s);
  });
}
const shiftDay = (d: string, n: number) => new Date(new Date(d + "T12:00").getTime() + n * DAY).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((new Date(a + "T12:00").getTime() - new Date(b + "T12:00").getTime()) / DAY);

/* ---------- tag picker: selected tags as chips, a "+" opens the list (search or create) ---------- */
function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const s = useStore();
  const { t } = useT();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const q = text.trim().slice(0, 30);
  const exact = s.tags.find((x) => x.toLowerCase() === q.toLowerCase());
  const options = s.tags.filter((x) => !value.includes(x) && x.toLowerCase().includes(q.toLowerCase())).slice(0, 8); // latest first
  const close = () => { setOpen(false); setText(""); };
  const pick = (tag: string) => { if (!value.includes(tag)) onChange([...value, tag]); close(); };
  const create = () => { if (!q) return; if (exact) return pick(exact); update((st) => { st.tags.unshift(q); }); pick(q); };
  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ gap: 6 }}>
        {value.map((x) => <span key={x} className="tagchip on"><TagIcon size={12} />{x}<button type="button" className="ghost icon" style={{ padding: 0, border: 0 }} aria-label={`${t("tag.clear")} ${x}`} onClick={() => onChange(value.filter((y) => y !== x))}><X size={12} /></button></span>)}
        <button type="button" className="ghost icon addchip" id="tt" aria-label={t("tag.add")} title={t("tag.add")} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}><Plus size={15} /></button>
      </div>
      {open && (
        <>
          <div className="menu-bg" onClick={close} />
          <div className="menu" role="listbox" style={{ left: 0, right: "auto", minWidth: 240, zIndex: 5 }}>
            <input autoFocus value={text} placeholder={t("tag.new")} aria-label={t("task.tag")} autoComplete="off" style={{ marginBottom: 4 }} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") close(); }} />
            {options.map((x) => <button type="button" key={x} role="option" onClick={() => pick(x)}><TagIcon size={13} />{x}</button>)}
            {q && !exact && <button type="button" role="option" onClick={create}><Plus size={13} />{t("tag.createnamed", { name: q })}</button>}
            {!options.length && !(q && !exact) && <div className="muted small" style={{ padding: "6px 10px" }}>{t("none")}</div>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- assignees: several users created by the account owner; "+" opens the list ---------- */
function AssigneePicker({ value, onChange }: { value: string[]; onChange: (names: string[]) => void }) {
  const s = useStore();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const canAssign = PLANS[s.plan].assign;
  const users = [{ id: "owner", name: s.userName, you: true }, ...s.team.map((m) => ({ id: m.id, name: m.name, you: false }))];
  const options = users.filter((u) => !value.includes(u.name));
  const pick = (u: { name: string; you: boolean }) => { if (!u.you && !canAssign) { openUpsell("assign"); return; } onChange([...value, u.name]); setOpen(false); };
  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ gap: 6 }}>
        {value.map((x) => <span key={x} className="tagchip on"><User size={12} />@{x}<button type="button" className="ghost icon" style={{ padding: 0, border: 0 }} aria-label={`${t("task.assignee.rm")} ${x}`} onClick={() => onChange(value.filter((y) => y !== x))}><X size={12} /></button></span>)}
        <button type="button" className="ghost icon addchip" id="tr" aria-label={t("task.assignee.add")} title={t("task.assignee.add")} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}><Plus size={15} /></button>
      </div>
      {open && (
        <>
          <div className="menu-bg" onClick={() => setOpen(false)} />
          <div className="menu" role="listbox" style={{ left: 0, right: "auto", minWidth: 220, zIndex: 5 }}>
            {options.length === 0 && <div className="muted small" style={{ padding: "6px 10px" }}>{t("none")}</div>}
            {options.map((u) => {
              const locked = !u.you && !canAssign;
              return <button type="button" key={u.id} role="option" onClick={() => pick(u)}><User size={14} />@{u.name}{u.you && <span className="muted small"> · {t("task.you")}</span>}{locked && <LockI />}</button>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function LikeButton({ task, size = 14 }: { task: Task; size?: number }) {
  const s = useStore();
  const { t } = useT();
  const mine = task.likes.includes(s.userName);
  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); update((st) => { const x = st.tasks.find((y) => y.id === task.id)!; x.likes = mine ? x.likes.filter((n) => n !== st.userName) : [...x.likes, st.userName]; }); };
  return (
    <button className={`likebtn${mine ? " on" : ""}`} aria-pressed={mine} aria-label={mine ? t("task.unlike") : t("task.like")} title={mine ? t("task.unlike") : t("task.like")} onClick={toggle} onDoubleClick={(e) => e.stopPropagation()} draggable={false}>
      <ThumbsUp size={size} fill={mine ? "currentColor" : "none"} />{task.likes.length > 0 && <span>{task.likes.length}</span>}
    </button>
  );
}
export function DoneBox({ task }: { task: Task }) {
  const { t } = useT();
  return (
    <input type="checkbox" className="tcheck" aria-label={t("task.done")} title={t("task.done")} checked={task.done} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} draggable={false}
      onChange={(e) => update((st) => { patchTask(st, task.id, { done: e.target.checked }); })} />
  );
}

/* ---------- task window: floating while creating, right-side panel once the task exists ---------- */
type PanelProps = { statuses: Status[]; onClose: () => void; taskId?: string; create?: { eventId: string | null; statusId: string }; events?: EventT[] };
export function TaskPanel({ taskId, create, statuses: statusesProp, events, onClose }: PanelProps) {
  const s = useStore();
  const { t, locale } = useT();
  const creating = !!create;
  const [local, setLocal] = useState<Task | null>(() => create ? newTask({ eventId: create.eventId, name: "", statusId: create.statusId, assignees: [s.userName], start: "", due: "", priority: "" }) : null);
  const task = creating ? local : s.tasks.find((x) => x.id === taskId) ?? null;
  // from "My tasks" the event can be chosen: its lists (statuses) follow the chosen event
  const statuses = creating && events ? (events.find((e) => e.id === task?.eventId)?.statuses.filter((x) => !x.archived) ?? []) : statusesProp;
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [desc, setDesc] = useState(task?.description ?? "");
  const [draft, setDraft] = useState("");
  const editor = useRef<{ clear: () => void }>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !confirm) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, confirm]);
  useEffect(() => { setMenu(false); setRenaming(false); setDesc(task?.description ?? ""); setDraft(""); }, [taskId]); // eslint-disable-line
  if (!task) return null;
  const set = (patch: Partial<Task>) => { if (creating) setLocal({ ...task, ...patch }); else update((st) => { patchTask(st, taskId!, patch); }); };
  const has = (_f: TaskField) => true; // customization is paused: every task option is always shown
  const st = statuses.find((x) => x.id === task.statusId) ?? statuses[0] ?? { id: "", name: "—", color: "var(--muted)" };
  const field = (label: React.ReactNode, id: string, control: React.ReactNode) => <div><label htmlFor={id}>{label}</label>{control}</div>;
  const remove = () => {
    update((x) => { x.tasks = x.tasks.filter((y) => y.id !== taskId); x.tasks.forEach((y) => { y.links = y.links.filter((l) => l !== taskId); }); });
    setConfirm(false); onClose();
  };
  const commitName = (v: string) => { if (v.trim()) set({ name: v.trim() }); setRenaming(false); };
  const addNote = () => {
    if (isEmptyHtml(draft)) return;
    const note = { id: uid(), html: sanitizeHtml(draft), at: Date.now() };
    update((x) => { const tk = x.tasks.find((y) => y.id === taskId)!; tk.notes.unshift(note); tk.history.unshift({ id: uid(), at: Date.now(), by: x.userName, key: "note" }); });
    editor.current?.clear(); setDraft("");
  };
  const submitCreate = () => {
    if (!task.name.trim()) return;
    const now = Date.now();
    update((x) => { x.tasks.push({ ...task, name: task.name.trim(), description: desc, createdAt: now, history: [{ id: uid(), at: now, by: x.userName, key: "created" }] }); });
    onClose();
  };
  const when = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }); // local time
  const d = (iso: string | undefined) => (iso ? new Date(iso + "T12:00").toLocaleDateString(locale, { dateStyle: "medium" }) : "—");
  const histText = (h: Task["history"][number]) => {
    const dateKey = h.key === "start" || h.key === "due";
    const v = (x: string | undefined) => (dateKey ? d(x) : h.key === "priority" ? (x ? t("pri." + x) : "—") : x || "—");
    return t("hist." + h.key, { by: h.by || s.userName, from: v(h.from), to: v(h.to) });
  };

  const fieldsBlock = (
    <div className="fieldcol">
      <div><label htmlFor="tdesc">{t("description")}</label>
        <textarea id="tdesc" rows={3} value={desc} placeholder={t("task.desc.ph")} onChange={(e) => setDesc(e.target.value)} onBlur={() => { if (!creating && desc !== task.description) set({ description: desc }); }} /></div>
      {has("start") && field(t("task.start"), "tst", <input id="tst" type="date" value={task.start} onChange={(e) => set({ start: e.target.value })} />)}
      {has("due") && field(t("task.due"), "tdu", <input id="tdu" type="date" value={task.due} min={task.start || undefined} onChange={(e) => set({ due: e.target.value })} />)}
      {has("tag") && <div><label htmlFor="tt">{t("task.tag")}</label><TagPicker value={task.tags} onChange={(v) => set({ tags: v })} /></div>}
      {field(<>{t("task.responsible")} *</>, "tr", <AssigneePicker value={task.assignees} onChange={(v) => set({ assignees: v })} />)}
      {has("priority") && field(t("task.priority"), "tp", <select id="tp" value={task.priority} onChange={(e) => set({ priority: e.target.value as Priority })}><option value="">—</option>{PRIORITIES.map((p) => <option key={p} value={p}>{t("pri." + p)}</option>)}</select>)}
    </div>
  );

  if (creating) {
    return (
      <Modal title={t("task.add")} onClose={onClose} headerExtra={statuses.length > 0 ? (
        <select aria-label={t("status")} className="statusmini" value={task.statusId} onChange={(e) => set({ statusId: e.target.value })}>
          {statuses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>) : undefined}>
        <div className="fieldcol" style={{ marginTop: 12 }}>
          {events && (
            <div><label htmlFor="tev">{t("mt.event")}</label>
              <select id="tev" value={task.eventId ?? ""} onChange={(e) => { const ev = events.find((x) => x.id === e.target.value); setLocal({ ...task, eventId: ev?.id ?? null, statusId: ev?.statuses.find((x) => !x.archived)?.id ?? "" }); }}>
                <option value="">{t("mt.noevent")}</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {new Date(e.date + "T12:00").toLocaleDateString(locale, { dateStyle: "medium" })}</option>)}
              </select>
              <div className="muted small">{t("mt.event.hint")}</div>
            </div>
          )}
          <div><label htmlFor="tname">{t("task.name")} *</label><input id="tname" autoFocus required value={task.name} placeholder={t("task.name.ph")} onChange={(e) => setLocal({ ...task, name: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 14 }}>{fieldsBlock}</div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="ghost" onClick={onClose}>{t("cancel")}</button>
          <button disabled={!task.name.trim()} onClick={submitCreate}>{t("task.create")}</button>
        </div>
      </Modal>
    );
  }
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" aria-label={t("task.edit")}>
        <div className="drawer-head">
          <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <DoneBox task={task} />
            <select aria-label={t("status")} className="statuspill" style={{ background: st.color }} value={task.statusId} onChange={(e) => set({ statusId: e.target.value })}>
              {statuses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </span>
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <LikeButton task={task} size={17} />
          <button className="ghost icon" aria-label={t("close")} title={t("close")} onClick={onClose}><X size={18} /></button>
          </span>
        </div>
        <div className="drawer-body">
          <div className="namehead" style={{ marginBottom: 4 }}>
            {renaming
              ? <input autoFocus aria-label={t("task.name")} defaultValue={task.name} onBlur={(e) => commitName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitName(e.currentTarget.value); if (e.key === "Escape") setRenaming(false); }} />
              : <h2 style={task.done ? { opacity: .5, textDecoration: "line-through" } : undefined}>{task.name}</h2>}
            {!renaming && (
              <div style={{ position: "relative" }}>
                <button className="ghost icon pencil" aria-label={t("task.options")} title={t("task.options")} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Pencil size={15} /></button>
                {menu && (
                  <>
                    <div className="menu-bg" onClick={() => setMenu(false)} />
                    <div className="menu" role="menu" style={{ zIndex: 2, minWidth: 150 }}>
                      <button role="menuitem" onClick={() => { setMenu(false); setRenaming(true); }}><Pencil size={14} /> {t("task.rename")}</button>
                      <button role="menuitem" style={{ color: "var(--rose)" }} onClick={() => { setMenu(false); setConfirm(true); }}><Trash2 size={14} /> {t("delete")}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="muted small" style={{ marginBottom: 16 }}>{t("task.created")}: {when(task.createdAt)}</div>
          {fieldsBlock}
          <div className="fieldcol" style={{ marginTop: 14 }}>
            <div>
              <label>{t("notes")}</label>
              {task.notes.length > 0 && (
                <div className="notelog">{task.notes.map((n) => <div key={n.id}><div className="when">{when(n.at)}</div><NoteView html={n.html} /></div>)}</div>
              )}
              <RichText ref={editor} onChange={setDraft} />
              <div style={{ marginTop: 8 }}><button disabled={isEmptyHtml(draft)} onClick={addNote}><Plus size={15} /> {t("add")}</button></div>
            </div>
            <div>
              <label>{t("task.history")}</label>
              <div className="history">
                {task.history.map((h) => <div key={h.id} className="h"><div>{histText(h)}</div><div className="when">{when(h.at)}</div></div>)}
              </div>
            </div>
          </div>
        </div>
      </aside>
      {confirm && (
        <Modal title={t("task.delete.title")} onClose={() => setConfirm(false)}>
          <p style={{ marginTop: 0 }}>{t("task.delete.warn", { name: task.name })}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="ghost" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button className="danger" onClick={remove}>{t("delete")}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- delete a board (column) ---------- */
function DeleteStatusModal({ event, status, onClose }: { event: EventT; status: Status; onClose: () => void }) {
  const s = useStore();
  const { t } = useT();
  const [typed, setTyped] = useState("");
  const n = s.tasks.filter((x) => x.eventId === event.id && x.statusId === status.id).length; // includes sub tasks
  const need = n > 0; // boards with tasks require typing DELETE
  const remove = () => {
    update((st) => {
      st.tasks = st.tasks.filter((x) => !(x.eventId === event.id && x.statusId === status.id));
      st.tasks.forEach((x) => { x.links = x.links.filter((l) => st.tasks.some((y) => y.id === l)); });
      const e = st.events.find((x) => x.id === event.id)!;
      e.statuses = e.statuses.filter((x) => x.id !== status.id);
    });
    onClose();
  };
  return (
    <Modal title={t("board.delete.title", { name: status.name })} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{need ? t("board.delete.warn.tasks", { n }) : t("board.delete.warn")}</p>
      {need && <div><label htmlFor="dl">{t("board.delete.type")}</label><input id="dl" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} /></div>}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="danger" disabled={need && typed !== "DELETE"} onClick={remove}>{t("delete")}</button>
      </div>
    </Modal>
  );
}

/* ---------- new status (column) ---------- */
function StatusNameModal({ event, onClose }: { event: EventT; onClose: () => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    update((st) => { const ev = st.events.find((x) => x.id === event.id)!; ev.statuses.push({ id: uid(), name: name.trim(), color: STATUS_COLORS[ev.statuses.length % 4] }); });
    onClose();
  };
  return (
    <Modal title={t("status.add")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="full"><label htmlFor="sn">{t("status.name")}</label><input id="sn" autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="row"><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{t("add")}</button></div>
      </form>
    </Modal>
  );
}

/* ---------- tracker ---------- */
type Drag = { kind: "task" | "col"; id: string; day?: string } | null;

export default function TaskTracker({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [view, setView] = useState<ViewMode>("board"); // always opens in board view
  const [open, setOpen] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ statusId: string; n: number } | null>(null);
  const [naming, setNaming] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const drag = useRef<Drag>(null);
  const [colMenu, setColMenu] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const active = event.statuses.filter((x) => !x.archived); // archived lists are hidden from every view (restore them from the gear)
  const archived = event.statuses.filter((x) => x.archived);
  const tasks = useMemo(() => s.tasks.filter((x) => x.eventId === event.id && !x.parentId && !event.statuses.find((y) => y.id === x.statusId)?.archived), [s.tasks, event.id, event.statuses]);
  const statusOf = (id: string) => event.statuses.find((x) => x.id === id) ?? active[0];
  const has = (_f: TaskField) => true; // customization is paused: every task option is always on
  const firstStatus = active[0].id;
  const copyList = (st: Status) => update((x) => {
    const e = x.events.find((y) => y.id === event.id)!;
    const nid = uid();
    e.statuses.splice(e.statuses.findIndex((y) => y.id === st.id) + 1, 0, { id: nid, name: `${st.name} (${t("board.copy")})`, color: st.color });
    const now = Date.now();
    x.tasks.filter((y) => y.eventId === event.id && y.statusId === st.id).forEach((y) => x.tasks.push({ ...structuredClone(y), id: uid(), statusId: nid, createdAt: now, done: y.done, likes: [], history: [{ id: uid(), at: now, by: x.userName, key: "created" }] }));
  });
  const setArchived = (id: string, v: boolean) => update((x) => { const e = x.events.find((y) => y.id === event.id)!; const st = e.statuses.find((y) => y.id === id)!; if (v) st.archived = true; else delete st.archived; });

  const startTask = (e: React.DragEvent, id: string, day?: string) => { drag.current = { kind: "task", id, day }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); e.stopPropagation(); };
  const startCol = (e: React.DragEvent, id: string) => { drag.current = { kind: "col", id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); };
  const endDrag = () => { drag.current = null; setOver(null); };
  const dropOnTask = (e: React.DragEvent, target: Task) => { const d = drag.current; if (d?.kind !== "task") return; e.preventDefault(); e.stopPropagation(); moveTask(d.id, target.id, target.statusId); endDrag(); };
  const dropOnStatus = (e: React.DragEvent, st: Status) => {
    const d = drag.current; if (!d) return; e.preventDefault();
    if (d.kind === "task") moveTask(d.id, null, st.id); else moveStatus(event.id, d.id, st.id);
    endDrag();
  };
  const allow = (e: React.DragEvent, key: string) => { if (drag.current) { e.preventDefault(); setOver(key); } };

  const addBtn = (statusId: string) => <button className="addtask" onClick={() => setQuick({ statusId, n: Date.now() })}><Plus size={15} /> {t("task.add")}</button>;
  const meta = (x: Task) => {
    return (
      <div className="meta">
        {has("priority") && <PriBadge p={x.priority} />}
        {has("tag") && x.tags.map((g) => <span key={g} className="badge row" style={{ gap: 3 }}><TagIcon size={11} />{g}</span>)}
        {has("due") && x.due && <span className="row" style={{ gap: 3 }}><CalendarDays size={12} />{new Date(x.due + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>}
        {x.assignees.length > 0 && <span className="row" style={{ gap: 3 }}><User size={12} />{x.assignees.map((a) => "@" + a).join(", ")}</span>}
      </div>
    );
  };
  const rename = (id: string, name: string) => {
    const v = name.trim();
    if (v) update((x) => { x.events.find((e) => e.id === event.id)!.statuses.find((y) => y.id === id)!.name = v; });
    setRenaming(null);
  };
  const colHead = (st: Status) => (
    <div className="head row" draggable={renaming !== st.id} onDragStart={(e) => startCol(e, st.id)} onDragEnd={endDrag} title={t("task.dragcol")}>
      <span className="dot" style={{ background: st.color }} />
      {renaming === st.id
        ? <input autoFocus defaultValue={st.name} aria-label={t("status")} style={{ width: 130, padding: "2px 6px" }} onBlur={(e) => rename(st.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(st.id, e.currentTarget.value); if (e.key === "Escape") setRenaming(null); }} />
        : <b onDoubleClick={() => setRenaming(st.id)} title={t("status.rename")} style={{ cursor: "text" }}>{st.name}</b>}
      <span className="muted" style={{ flex: 1 }}>{tasks.filter((x) => x.statusId === st.id).length}</span>
      <span style={{ position: "relative" }}>
        <button className="ghost icon" aria-label={t("board.menu")} title={t("board.menu")} aria-haspopup="menu" aria-expanded={colMenu === st.id} onClick={() => setColMenu(colMenu === st.id ? null : st.id)}><MoreVertical size={16} /></button>
        {colMenu === st.id && (
          <>
            <div className="menu-bg" onClick={() => setColMenu(null)} />
            <div className="menu" role="menu" style={{ zIndex: 25, minWidth: 170 }}>
              <button role="menuitem" onClick={() => { setColMenu(null); setQuick({ statusId: st.id, n: Date.now() }); }}><Plus size={14} /> {t("task.add")}</button>
              <button role="menuitem" onClick={() => { setColMenu(null); copyList(st); }}><Copy size={14} /> {t("board.copylist")}</button>
              <button role="menuitem" disabled={active.length < 2} onClick={() => { setColMenu(null); setArchived(st.id, true); }}><Archive size={14} /> {t("board.archive")}</button>
              <button role="menuitem" style={{ color: "var(--rose)" }} disabled={active.length < 2} onClick={() => { setColMenu(null); setDeleting(st.id); }}><Trash2 size={14} /> {t("board.deletelist")}</button>
            </div>
          </>
        )}
      </span>
    </div>
  );
  const addStatusBtn = (cls: string) => <button className={cls} aria-label={t("status.add")} title={t("status.add")} onClick={() => setNaming(true)}><Plus size={cls === "addcol" ? 20 : 15} />{cls === "addtask" && <> {t("status.add")}</>}</button>;

  const board = () => (
    <div className="board" style={{ gridTemplateColumns: `repeat(${active.length}, minmax(260px, 1fr)) 44px` }}>
      {active.map((st) => (
        <div key={st.id} className={`bcol${over === "s" + st.id ? " over" : ""}`} onDragOver={(e) => allow(e, "s" + st.id)} onDragLeave={() => setOver(null)} onDrop={(e) => dropOnStatus(e, st)}>
          {colHead(st)}
          <div className="list">
            {tasks.filter((x) => x.statusId === st.id).map((x) => (
              <div key={x.id} className={`tcard${x.done ? " tdone" : ""}${over === x.id ? " dragover-top" : ""}`} draggable onDragStart={(e) => startTask(e, x.id)} onDragEnd={endDrag}
                onDragOver={(e) => { if (drag.current?.kind === "task") { e.preventDefault(); e.stopPropagation(); setOver(x.id); } }} onDrop={(e) => dropOnTask(e, x)}
                onClick={() => setOpen(x.id)} tabIndex={0} role="button" onKeyDown={(e) => e.key === "Enter" && setOpen(x.id)}>
                <div className="row" style={{ flexWrap: "nowrap", gap: 8, alignItems: "flex-start" }}><DoneBox task={x} /><b>{x.name}</b></div>
                <div className="mrow">{meta(x)}<LikeButton task={x} /></div>
              </div>
            ))}
          </div>
          {addBtn(st.id)}
        </div>
      ))}
      {addStatusBtn("addcol")}
    </div>
  );

  const list = () => (
    <div>
      {active.map((st) => (
        <div key={st.id} className={`listsec${over === "s" + st.id ? " over" : ""}`} onDragOver={(e) => allow(e, "s" + st.id)} onDragLeave={() => setOver(null)} onDrop={(e) => dropOnStatus(e, st)}>
          <div style={{ marginBottom: 6 }}>{colHead(st)}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {tasks.filter((x) => x.statusId === st.id).map((x) => (
              <div key={x.id} className={`listrow${x.done ? " tdone" : ""}${over === x.id ? " dragover-top" : ""}`} draggable onDragStart={(e) => startTask(e, x.id)} onDragEnd={endDrag}
                onDragOver={(e) => { if (drag.current?.kind === "task") { e.preventDefault(); e.stopPropagation(); setOver(x.id); } }} onDrop={(e) => dropOnTask(e, x)} onClick={() => setOpen(x.id)}>
                <span className="row" style={{ gap: 6 }}><GripVertical size={14} className="muted" /><DoneBox task={x} /><b>{x.name}</b></span>
                <span>{has("priority") && <PriBadge p={x.priority} />}</span>
                <span className="muted small">{has("due") && x.due && new Date(x.due + "T12:00").toLocaleDateString(locale, { dateStyle: "medium" })}</span>
                <span className="muted small">{x.assignees.map((a) => "@" + a).join(", ")}</span>
                <span className="muted small">{has("tag") && x.tags.join(", ")}</span>
              </div>
            ))}
            {tasks.filter((x) => x.statusId === st.id).length === 0 && <div className="muted small" style={{ padding: 12 }}>{t("none")}</div>}
          </div>
          {addBtn(st.id)}
        </div>
      ))}
      {addStatusBtn("addtask")}
    </div>
  );

  const calendar = () => {
    const first = new Date(month);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY));
    const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
    const dropDay = (e: React.DragEvent, k: string) => {
      const d = drag.current; if (d?.kind !== "task") return;
      e.preventDefault();
      const tk = tasks.find((x) => x.id === d.id)!;
      const from = d.day ?? tk.due ?? tk.start;
      const delta = dayDiff(k, from);
      update((st) => { const y = st.tasks.find((z) => z.id === d.id)!; patchTask(st, d.id, { start: y.start ? shiftDay(y.start, delta) : k, due: y.due ? shiftDay(y.due, delta) : k }); });
      endDrag();
    };
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="ghost sm" aria-label="‹" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <b>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
          <button className="ghost sm" aria-label="›" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="cal">
          {wd.map((d) => <div className="h" key={d}>{d}</div>)}
          {days.map((d) => {
            const k = d.toISOString().slice(0, 10);
            const dl = tasks.filter((x) => (x.start || x.due) <= k && k <= (x.due || x.start));
            return (
              <div key={k} className={`d${d.getMonth() !== month.getMonth() ? " dim" : ""}${over === k ? " drop" : ""}`} onDragOver={(e) => allow(e, k)} onDragLeave={() => setOver(null)} onDrop={(e) => dropDay(e, k)}>
                {d.getDate()}
                {dl.slice(0, 3).map((x) => <button key={x.id} className={`chip${x.done ? " tdone" : ""}`} draggable onDragStart={(e) => startTask(e, x.id, k)} onDragEnd={endDrag} style={{ background: statusOf(x.statusId).color }} onClick={() => setOpen(x.id)}>{x.name}</button>)}
                {dl.length > 3 && <span className="muted">+{dl.length - 3}</span>}
              </div>
            );
          })}
        </div>
        {addBtn(firstStatus)}
      </>
    );
  };

  const gantt = () => {
    const dated = tasks.filter((x) => x.start && x.due);
    if (!dated.length) return <><p className="muted">{t("gantt.empty")}</p>{addBtn(firstStatus)}</>;
    const min = Math.min(...dated.map((x) => +new Date(x.start))) - 2 * DAY;
    const max = Math.max(...dated.map((x) => +new Date(x.due))) + 3 * DAY;
    const n = Math.ceil((max - min) / DAY);
    const W = 26;
    const dayIdx = (d: string) => Math.round((+new Date(d) - min) / DAY);
    const todayIdx = Math.round((new Date(iso()).getTime() - min) / DAY);
    return (
      <>
        <div className="gantt">
          <div style={{ minWidth: 220 + n * W }}>
            <div className="grow-g" style={{ gridTemplateColumns: `220px repeat(${n}, ${W}px)`, background: "var(--soft)" }}>
              <div style={{ padding: "0 8px" }} className="small muted">{t("task.name")}</div>
              {Array.from({ length: n }, (_, i) => { const d = new Date(min + i * DAY); return <div key={i} className="small muted" style={{ textAlign: "center", fontSize: ".65rem" }} title={d.toLocaleDateString(locale)}>{d.getDate() === 1 || i === 0 ? d.toLocaleDateString(locale, { month: "short" }) : d.getDate()}</div>; })}
            </div>
            {dated.map((x) => (
              <div className={`grow-g${over === x.id ? " dragover-top" : ""}`} key={x.id} style={{ gridTemplateColumns: `220px ${n * W}px` }} draggable onDragStart={(e) => startTask(e, x.id)} onDragEnd={endDrag}
                onDragOver={(e) => { if (drag.current?.kind === "task") { e.preventDefault(); setOver(x.id); } }} onDrop={(e) => dropOnTask(e, x)}>
                <div className="row" style={{ padding: "0 8px", gap: 4, flexWrap: "nowrap", overflow: "hidden", cursor: "grab" }}><GripVertical size={14} className="muted" /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span></div>
                <div style={{ position: "relative", height: 34 }}>
                  {todayIdx >= 0 && todayIdx < n && <div style={{ position: "absolute", left: todayIdx * W, top: 0, bottom: 0, width: 2, background: "var(--rose)", opacity: .6 }} />}
                  <button className={`gbar${x.done ? " tdone" : ""}`} style={{ position: "absolute", top: 7, left: dayIdx(x.start) * W, width: Math.max(1, dayIdx(x.due) - dayIdx(x.start) + 1) * W, background: statusOf(x.statusId).color }} onClick={() => setOpen(x.id)}>{x.name}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {addBtn(firstStatus)}
      </>
    );
  };

  const views: [ViewMode, string][] = [["board", "view.board"], ["gantt", "view.gantt"], ["calendar", "view.calendar"], ["list", "view.list"]];
  return (
    <>
      <div className="row between stickbar">
        <div className="seg" role="group" aria-label={t("view")}>{views.map(([v, k]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{t(k)}</button>)}</div>
        <button className="ghost icon" aria-label={t("task.customize")} title={t("task.customize")} onClick={() => setCustom(true)}><Settings size={18} /></button>
      </div>
      {view === "board" && board()}
      {view === "list" && list()}
      {view === "calendar" && calendar()}
      {view === "gantt" && gantt()}
      <button className="fab fab-left" aria-label={t("task.add")} title={t("task.add")} onClick={() => setQuick({ statusId: firstStatus, n: Date.now() })}><Plus size={24} /></button>
      {quick && <TaskPanel key={quick.n} create={{ eventId: event.id, statusId: quick.statusId }} statuses={active} onClose={() => setQuick(null)} />}
      {custom && (
        <Modal title={t("task.customize")} onClose={() => setCustom(false)}>
          <h3 style={{ marginTop: 0 }}>{t("board.archived")}</h3>
          {archived.length === 0 ? <p className="muted">{t("board.archived.none")}</p> : archived.map((st) => (
            <div key={st.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: st.color }} /><b>{st.name}</b><span className="muted small">{s.tasks.filter((x) => x.eventId === event.id && x.statusId === st.id).length}</span></span>
              <span className="row" style={{ gap: 2 }}>
                <button className="ghost icon" aria-label={t("board.restore")} title={t("board.restore")} onClick={() => setArchived(st.id, false)}><ArchiveRestore size={16} /></button>
                <button className="ghost icon" aria-label={t("board.deletelist")} title={t("board.deletelist")} onClick={() => { setCustom(false); setDeleting(st.id); }}><Trash2 size={16} /></button>
              </span>
            </div>
          ))}
        </Modal>
      )}
      {naming && <StatusNameModal event={event} onClose={() => setNaming(false)} />}
      {deleting && event.statuses.find((x) => x.id === deleting) && <DeleteStatusModal event={event} status={event.statuses.find((x) => x.id === deleting)!} onClose={() => setDeleting(null)} />}
      {open && <TaskPanel taskId={open} statuses={event.statuses} onClose={() => setOpen(null)} />}
    </>
  );
}
