import { Fragment, useEffect, useRef, useState } from "react";
import { addTemplate, assignTask, canSee, createTask, handOffToDesigner, isNewTask, isOpen, KIND_TEAM, markSeen, patchTask, useSeen, ROLE_LABEL, setStatus, STATUSES, STATUS_LABEL, uid, useStore, type Priority, type Staff, type TaskKind, type TaskStatus } from "../store";
import { Avatar, fmtAge, fmtDate, go, isLate, Modal, PriorityBadge, StatusBadge, taskAge, useTick } from "../ui";
import { TaskTable } from "./Dashboard";
import { Eye, Lock } from "../icons";
import { useViewers } from "../presence";

export default function Tasks({ me, route }: { me: Staff; route: string }) {
  const id = route.split("/")[2];
  return id ? <Detail me={me} id={id} /> : <Queue me={me} />;
}

function Queue({ me }: { me: Staff }) {
  const s = useStore();
  useSeen();
  useTick();
  const [owner, setOwner] = useState<"all" | "me" | "none">("all");
  const [st, setSt] = useState<"open" | "all">("open");
  const [kind, setKind] = useState<"all" | TaskKind>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const visible = s.tasks.filter((t) => canSee(me, t));
  const rows = visible.filter((t) => (st === "all" || isOpen(t)) && (kind === "all" || t.kind === kind) && (owner === "all" || (owner === "me" ? t.assigneeId === me.id : !t.assigneeId)) && (!q || (t.id + t.title + t.requester).toLowerCase().includes(q.toLowerCase())));
  const unassigned = visible.filter((t) => !t.assigneeId && isOpen(t));
  const claim = (tid: string) => assignTask(tid, me.name, me.id);
  return (
    <>
      <div className="row between"><h1>Team queue</h1>{me.role === "super_admin" && <button onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ New request"}</button>}</div>
      <p className="muted" style={{ marginTop: -4 }}>{me.role === "super_admin" ? "All requests from all teams." : `${ROLE_LABEL[me.role]} requests. Every new request gets a unique task ID and is auto-assigned to the least busy teammate.${me.role === "support" ? " You work on requests sent by customers (written or live chat); you cannot create them." : ""}`}</p>
      {adding && me.role === "super_admin" && <NewRequest me={me} done={() => setAdding(false)} />}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Waiting for an owner ({unassigned.length})</h3>
          {unassigned.map((t) => <div key={t.id} className="row between" style={{ padding: "4px 0" }}><span><a className="mono" href={"#/tasks/" + t.id}>{t.id}</a> {t.title}{isNewTask(t, me.id) && <span className="badge b-new" style={{ marginLeft: 6 }}>New</span>}</span><button className="sm" onClick={() => claim(t.id)}>Take it</button></div>)}
        </div>
      )}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row">
            <div className="seg"><button aria-pressed={st === "open"} onClick={() => setSt("open")}>Open</button><button aria-pressed={st === "all"} onClick={() => setSt("all")}>All</button></div>
            <div className="seg">{(["all", "me", "none"] as const).map((x) => <button key={x} aria-pressed={owner === x} onClick={() => setOwner(x)}>{x === "all" ? "Everyone" : x === "me" ? "Mine" : "Unassigned"}</button>)}</div>
            {me.role === "super_admin" && <select aria-label="Type" style={{ width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">All types</option><option value="support">Support</option><option value="design">Design</option><option value="admin">Admin</option></select>}
          </div>
          <input style={{ width: 220 }} placeholder="Search ID, title, customer…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TaskTable rows={rows} me={me} showOwner statusReadOnly />
      </div>
    </>
  );
}

/** Staff can also open a request by hand (e.g. a customer phoned in). */
function NewRequest({ me, done }: { me: Staff; done: () => void }) {
  const s = useStore();
  const kinds: TaskKind[] = me.role === "super_admin" ? ["support", "design", "admin"] : me.role === "support" ? ["support"] : ["design"];
  const [f, setF] = useState({ kind: kinds[0], title: "", description: "", customerId: "", priority: "normal" as Priority });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = s.customers.find((x) => x.id === f.customerId);
    const t = createTask({ kind: f.kind, title: f.title.trim(), description: f.description.trim(), customerId: f.customerId, requester: c ? `${c.name} <${c.email}>` : "", priority: f.priority, source: "staff", by: me.name });
    done(); go("/tasks/" + t.id);
  };
  return (
    <form className="card form" style={{ marginBottom: 14 }} onSubmit={submit}>
      <div><label htmlFor="nk">Type</label><select id="nk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as TaskKind })}>{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
      <div><label htmlFor="nc">Customer</label><select id="nc" value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}><option value="">— none —</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor="np">Priority</label><select id="np" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</select></div>
      <div className="full"><label htmlFor="nt">Title</label><input id="nt" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="full"><label htmlFor="nd">Details</label><textarea id="nd" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="full"><button>Create request</button></div>
    </form>
  );
}

/** "2:15 PM", or with the date when it was seen on another day than it was sent. */
const seenLabel = (seen: number, sent: number) => new Date(seen).toLocaleString(undefined, new Date(seen).toDateString() === new Date(sent).toDateString() ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function Detail({ me, id }: { me: Staff; id: string }) {
  const s = useStore();
  useTick();
  const [text, setText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [more, setMore] = useState(false); // long request text expanded
  const viewers = useViewers(id, me.id); // other staff with this request open right now
  const [pendingDone, setPendingDone] = useState(false); // "Done" chosen in the status list, waiting for the confirm button
  const [hand, setHand] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = s.tasks.find((x) => x.id === id);
  const nNotes = t?.notes.length ?? 0;
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [nNotes, id]); // show the newest message
  useEffect(() => { if (t) markSeen(me.id, t.id); }, [id, nNotes, me.id]); // opening a request (or a message arriving while it is open) clears its "new" marker
  if (!t || !canSee(me, t)) return <div className="card"><h2>Request not found</h2><p className="muted">It does not exist or belongs to another team.</p><a className="btn" href="#/tasks">Back to the queue</a></div>;
  const owner = s.staff.find((m) => m.id === t.assigneeId);
  const team = s.staff.filter((m) => m.active && (me.role === "super_admin" ? true : m.role === KIND_TEAM[t.kind]));
  const cust = s.customers.find((c) => c.id === t.customerId);
  const rm = /^(.*?)\s*<([^>]+)>\s*$/.exec(t.requester ?? "");
  const reqName = rm ? rm[1] : t.requester, reqEmail = rm ? rm[2] : ""; // "Name <email>"
  // Only requests that came from a customer (they have a reference) can be answered; the conversation shows what the customer sees.
  const canReply = !!t.ref;
  const convo = t.notes.filter((n) => !n.internal);
  const internalNotes = t.notes.filter((n) => n.internal).slice().reverse(); // newest first
  const hm = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    patchTask(t.id, me.name, (x) => { x.notes.push({ id: uid(), by: me.name, at: Date.now(), text: text.trim(), internal: false }); if (!x.firstResponseAt) x.firstResponseAt = Date.now(); return "Replied to the customer"; });
    if (t.status !== "done") setStatus(t.id, me.name, "waiting");
    setText("");
  };
  const addInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    patchTask(t.id, me.name, (x) => { x.notes.push({ id: uid(), by: me.name, at: Date.now(), text: noteText.trim(), internal: true }); return "Added an internal note"; });
    setNoteText("");
  };
  const startDesign = () => {
    let tplId = t.templateId;
    if (!tplId) { const tpl = addTemplate(me.name, `Design for ${t.id}`, "custom", undefined, "request", t.id); tplId = tpl.id; patchTask(t.id, me.name, (x) => { x.templateId = tplId; if (x.status === "new" || x.status === "assigned") x.status = "in_progress"; return "Design started in the studio"; }); }
    go("/studio/" + tplId);
  };
  const tpl = s.templates.find((x) => x.id === t.templateId);
  return (
    <>
      <div className="rq-header">
        <div className="rq-header-main">
          <h1 className="rq-title"><span className="mono">{t.id}</span> · {t.title}</h1>
          <span className="muted small rq-created">Created {fmtDate(t.createdAt)}{t.source === "staff" ? " · opened by staff" : ""}</span>
          <div className="row" style={{ gap: 6 }}><PriorityBadge p={t.priority} /><StatusBadge s={t.status} />{isLate(t) && <span className="badge b-late">late</span>}</div>
        </div>
        {viewers.length > 0 && (
          <div className="rq-viewers" aria-label="Also viewing this request">
            <Eye size={14} /><span className="small">Also viewing</span>
            {viewers.map((vid) => { const v = s.staff.find((x) => x.id === vid); return v ? <span key={vid} className="rq-viewer" title={`${v.name} · ${v.email}`}><Avatar m={v} size={26} dot /></span> : null; })}
          </div>
        )}
      </div>
      <div className="grid split" style={{ marginTop: 8, alignItems: "start" }}>
        <div className="grid">
          <div className="card rq">
            <div className="rq-head">
              <div className="rq-from">
                <Avatar m={{ name: reqName || "?", avatar: "" }} size={34} />
                <div style={{ minWidth: 0 }}><b>{reqName || "—"}</b><div className="muted small">{reqEmail || (t.source === "staff" ? "opened by staff" : "")}</div></div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge">{t.kind === "support" ? (t.channel === "chat" ? "live chat" : "written request") : t.kind === "design" ? "design request" : "admin request"}</span>
                {cust && (me.role === "support" || me.role === "super_admin") && <a className="btn ghost sm" href={"#/customers/" + cust.id + "/from/" + t.id}>Customer account</a>}
              </div>
            </div>
            {t.description && <>
              <p className={`rq-desc${more ? "" : " clamp"}`}>{t.description}</p>
              {t.description.length > 180 && <button type="button" className="linkbtn" onClick={() => setMore(!more)}>{more ? "Show less" : "Show more"}</button>}
            </>}
            {t.kind === "design" && <div className="row" style={{ marginTop: 8 }}><button onClick={startDesign}>{tpl ? "Continue in design studio" : "Start design in studio"}</button>{tpl && <span className="muted small">Linked design: {tpl.name} ({tpl.status})</span>}</div>}
          </div>
          {(canReply || convo.length > 0) && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Conversation</h3>
              <div className="cv" ref={box} role="log" aria-live="polite">
                {!convo.length && <p className="muted" style={{ margin: 0, textAlign: "center" }}>No messages yet.</p>}
                {convo.map((n, i) => {
                  const prev = convo[i - 1];
                  const newDay = !prev || new Date(prev.at).toDateString() !== new Date(n.at).toDateString();
                  return (
                    <Fragment key={n.id}>
                      {newDay && <div className="cv-day">{new Date(n.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>}
                      <div className={`cv-row ${n.customer ? "in" : "out"}`}>
                        {n.customer && <span className="cv-av" aria-hidden="true">{(n.by || "C").trim()[0]?.toUpperCase()}</span>}
                        <div>
                          <div className="cv-meta">{n.customer ? <><b>{n.by}</b> · customer</> : <><b>{n.by}</b> · reply to customer</>} · {hm(n.at)}</div>
                          <div className="cv-bub">{n.text}</div>
                          {!n.customer && n.seenAt ? <div className="cv-seen" title="The customer opened this reply">Seen {seenLabel(n.seenAt, n.at)}</div> : null}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
              {canReply && (
                <form onSubmit={sendReply} className="cv-composer reply">
                  <textarea rows={2} aria-label="Reply to the customer" placeholder="Write your reply…" value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
                  <div className="row between">
                    <span className="muted small">Enter to send · Shift+Enter for a new line{t.status !== "done" ? " · sets “Waiting on customer”" : ""}</span>
                    <button disabled={!text.trim()}>Send reply</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
        <div className="grid">
          <div className="card rqpanel">
            <div className="rqpanel-head">Request</div>
            <div className="rqpanel-body">
              <div className="rq-field">
                <label>Owner</label>
                <div className="rq-owner rq-info">{owner ? <><Avatar m={owner} size={26} dot /><span>{owner.name}</span></> : <span className="muted">Unassigned</span>}</div>
              </div>
              <div className="rq-field">
                <label htmlFor="st">Status</label>
                <select id="st" className="stsel" data-st={pendingDone ? "done" : t.status} value={pendingDone ? "done" : t.status} onChange={(e) => { const v = e.target.value as TaskStatus; if (v === "done" && t.status !== "done") setPendingDone(true); else { setPendingDone(false); setStatus(t.id, me.name, v); } }}>
                  {STATUSES.map((x) => <option key={x} value={x}>{x === "done" ? "Done (mark as done)" : STATUS_LABEL[x]}</option>)}
                </select>
                {pendingDone && (
                  <div className="rq-confirm" role="alertdialog" aria-label="Confirm marking as done">
                    <span className="small">Mark this request as done?</span>
                    <button className="sm" onClick={() => { setStatus(t.id, me.name, "done"); setPendingDone(false); }}>Confirm</button>
                    <button className="ghost sm" onClick={() => setPendingDone(false)}>Cancel</button>
                  </div>
                )}
                {t.status === "done" && <span className="rq-resolved">Resolved in {fmtAge(taskAge(t))}</span>}
              </div>
              <div className="rq-field">
                <label htmlFor="ac">Actions</label>
                <select id="ac" className="actsel" value="" onChange={(e) => {
                  const v = e.target.value; e.target.value = "";
                  if (v === "me") assignTask(t.id, me.name, me.id);
                  else if (v === "queue") assignTask(t.id, me.name, null);
                  else if (v === "hand") setHand(true);
                  else if (v.startsWith("to:")) assignTask(t.id, me.name, v.slice(3));
                }}>
                  <option value="">Choose an action…</option>
                  {t.assigneeId !== me.id && <option value="me">Assign to me</option>}
                  {t.assigneeId && <option value="queue">Return to the team queue</option>}
                  {t.kind === "support" && !t.handoff && t.status !== "done" && (me.role === "support" || me.role === "super_admin") && <option value="hand">Hand over to a designer…</option>}
                  {me.role === "super_admin" && <optgroup label="Assign to">{team.filter((m) => m.id !== me.id && m.id !== t.assigneeId).map((m) => <option key={m.id} value={"to:" + m.id}>{m.name} ({openCount(s.tasks, m.id)} open)</option>)}</optgroup>}
                </select>
              </div>
              {(t.handoff || t.origin || t.status !== "done") && (
                <div className="rq-sub muted small">
                  {t.status !== "done" && <span>Open for {fmtAge(taskAge(t))}</span>}
                  {t.handoff && <span>Handed over to design as {me.role === "support" ? <b className="mono">{t.handoff}</b> : <a className="mono" href={"#/tasks/" + t.handoff}>{t.handoff}</a>}</span>}
                  {t.origin && <span>Handed over by support from <b className="mono">{t.origin}</b></span>}
                </div>
              )}
            </div>
          </div>
          <div className="card cv-notes">
            <div className="row between"><h3 style={{ margin: 0 }}><Lock size={14} /> Internal notes</h3><span className="muted small">only staff</span></div>
            <form onSubmit={addInternal} className="grid" style={{ gap: 6, marginTop: 8 }}>
              <textarea rows={2} aria-label="Internal note" placeholder="Write a note for your team…" value={noteText} onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
              <div className="row between"><span className="muted small">The customer never sees these.</span><button className="sm" disabled={!noteText.trim()}>Add note</button></div>
            </form>
            <div className="grid" style={{ gap: 6, marginTop: 8 }}>
              {!internalNotes.length && <p className="muted small" style={{ margin: 0 }}>No internal notes yet.</p>}
              {internalNotes.map((n) => <div key={n.id} className="cv-internal"><div className="cv-meta">{n.by} · {fmtDate(n.at)}</div><div className="cv-text">{n.text}</div></div>)}
            </div>
          </div>
          <details className="card hist">
            <summary><b>History</b> <span className="muted small">({t.history.length})</span></summary>
            <div className="tl">{[...t.history].reverse().map((h, i) => <div key={i}><div className="small">{h.text}</div><div className="muted small">{h.by} · {fmtDate(h.at)}</div></div>)}</div>
          </details>
        </div>
      </div>
      {hand && <HandOff me={me} t={t} onClose={() => setHand(false)} />}
    </>
  );
}
function HandOff({ me, t, onClose }: { me: Staff; t: { id: string }; onClose: () => void }) {
  const s = useStore();
  const designers = s.staff.filter((m) => m.active && m.role === "designer");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title={`Hand over ${t.id} to a designer`} onClose={onClose}>
      <form className="grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); const d = handOffToDesigner(t.id, me.name, to || null, note.trim()); void d; onClose(); }}>
        <p className="muted small" style={{ margin: 0 }}>A linked design task (DSN-…) is created with the customer and request details. You keep this request and can reply to the customer.</p>
        <div><label htmlFor="hd">Designer</label><select id="hd" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Automatic (least busy)</option>{designers.map((m) => <option key={m.id} value={m.id}>{m.name} ({openCount(s.tasks, m.id)} open) — {m.presence}</option>)}</select></div>
        <div><label htmlFor="hn">Note for the designer</label><textarea id="hn" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Style, colours, date, deadline…" /></div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button>Hand over</button></div>
      </form>
    </Modal>
  );
}
const openCount = (tasks: { assigneeId: string | null; status: TaskStatus }[], id: string) => tasks.filter((t) => t.assigneeId === id && t.status !== "done").length;

