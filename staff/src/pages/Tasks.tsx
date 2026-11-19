import { Fragment, useEffect, useRef, useState } from "react";
import { addTemplate, assignTask, canSee, createTask, handOffToDesigner, isNewTask, isOpen, KIND_TEAM, markSeen, patchTask, useSeen, ROLE_LABEL, setStatus, STATUSES, STATUS_LABEL, uid, useStore, type Priority, type Staff, type TaskKind, type TaskStatus } from "../store";
import { fmtAge, fmtDate, go, isLate, Modal, PriorityBadge, StatusBadge, taskAge, useTick } from "../ui";
import { TaskTable } from "./Dashboard";
import { Lock } from "../icons";

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
        <TaskTable rows={rows} me={me} showOwner />
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

function Detail({ me, id }: { me: Staff; id: string }) {
  const s = useStore();
  useTick();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"" | "note" | "reply">(""); // "" = pick a sensible default
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
  // Only requests that came from a customer (they have a reference) can be answered; everything else is internal notes.
  const canReply = !!t.ref;
  const last = t.notes[t.notes.length - 1];
  const replyMode = canReply && (mode ? mode === "reply" : !last || !!last.customer); // default: reply while the customer is waiting
  const internal = !replyMode;
  const hm = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    patchTask(t.id, me.name, (x) => { x.notes.push({ id: uid(), by: me.name, at: Date.now(), text: text.trim(), internal }); return internal ? "Added an internal note" : "Replied to the customer"; });
    if (!internal) patchTask(t.id, me.name, (x) => { if (!x.firstResponseAt) x.firstResponseAt = Date.now(); });
    if (!internal && t.status !== "done") setStatus(t.id, me.name, "waiting");
    setText("");
  };
  const startDesign = () => {
    let tplId = t.templateId;
    if (!tplId) { const tpl = addTemplate(me.name, `Design for ${t.id}`, "custom", undefined, "request", t.id); tplId = tpl.id; patchTask(t.id, me.name, (x) => { x.templateId = tplId; if (x.status === "new" || x.status === "assigned") x.status = "in_progress"; return "Design started in the studio"; }); }
    go("/studio/" + tplId);
  };
  const tpl = s.templates.find((x) => x.id === t.templateId);
  return (
    <>
      <p><a href="#/tasks">← Team queue</a></p>
      <div className="row between"><h1 style={{ margin: 0 }}><span className="mono">{t.id}</span> · {t.title}</h1><div className="row"><PriorityBadge p={t.priority} /><StatusBadge s={t.status} />{isLate(t) && <span className="badge b-late">late</span>}</div></div>
      <div className="grid split" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="grid">
          <div className="card">
            <h3>Request</h3>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{t.description || <i className="muted">No details.</i>}</p>
            <div className="muted small">From {t.requester || "—"} · {t.kind === "support" ? (t.channel === "chat" ? "live chat · " : "written request · ") : ""}{t.source === "staff" ? "opened by staff" : "sent from the platform"} · created {fmtDate(t.createdAt)}</div>
            {t.kind === "design" && <div className="row" style={{ marginTop: 10 }}><button onClick={startDesign}>{tpl ? "Continue in design studio" : "Start design in studio"}</button>{tpl && <span className="muted small">Linked design: {tpl.name} ({tpl.status})</span>}</div>}
            {cust && <div className="row" style={{ marginTop: 10 }}>{(me.role === "support" || me.role === "super_admin") && <a className="btn ghost sm" href={"#/customers/" + cust.id}>Open customer account</a>}</div>}
          </div>
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Conversation</h3><span className="muted small">{t.notes.length} {t.notes.length === 1 ? "message" : "messages"}</span></div>
            <div className="cv" ref={box} role="log" aria-live="polite">
              {!t.notes.length && <p className="muted" style={{ margin: 0, textAlign: "center" }}>No messages yet.</p>}
              {t.notes.map((n, i) => {
                const prev = t.notes[i - 1];
                const newDay = !prev || new Date(prev.at).toDateString() !== new Date(n.at).toDateString();
                return (
                  <Fragment key={n.id}>
                    {newDay && <div className="cv-day">{new Date(n.at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>}
                    {n.internal ? (
                      <div className="cv-internal">
                        <div className="cv-meta"><Lock size={12} /> <b>Internal note</b> · {n.by} · {hm(n.at)} · only staff can see this</div>
                        <div className="cv-text">{n.text}</div>
                      </div>
                    ) : (
                      <div className={`cv-row ${n.customer ? "in" : "out"}`}>
                        {n.customer && <span className="cv-av" aria-hidden="true">{(n.by || "C").trim()[0]?.toUpperCase()}</span>}
                        <div>
                          <div className="cv-meta">{n.customer ? <><b>{n.by}</b> · customer</> : <><b>{n.by}</b> · reply to customer</>} · {hm(n.at)}</div>
                          <div className="cv-bub">{n.text}</div>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
            <form onSubmit={addNote} className={`cv-composer ${replyMode ? "reply" : "notebox"}`}>
              {canReply ? (
                <div className="seg" role="group" aria-label="Message type">
                  <button type="button" aria-pressed={replyMode} onClick={() => setMode("reply")}>Reply to customer</button>
                  <button type="button" aria-pressed={!replyMode} onClick={() => setMode("note")}><Lock size={12} /> Internal note</button>
                </div>
              ) : <div className="muted small">This request has no customer to reply to, so messages here are internal notes.</div>}
              <div className="cv-hint">{replyMode ? "The customer will see this message." : "Only staff can see this. The customer never will."}</div>
              <textarea rows={3} aria-label={replyMode ? "Reply to the customer" : "Internal note"} placeholder={replyMode ? "Write your reply to the customer…" : "Write a note for your team…"} value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
              <div className="row between">
                <span className="muted small">Enter to send · Shift+Enter for a new line{replyMode && t.status !== "done" ? " · sending sets the status to “Waiting on customer”" : ""}</span>
                <button disabled={!text.trim()}>{replyMode ? "Send reply" : "Add note"}</button>
              </div>
            </form>
          </div>
        </div>
        <div className="grid">
          <div className="card grid" style={{ gap: 10 }}>
            <div><label htmlFor="st">Status</label><select id="st" value={t.status} onChange={(e) => setStatus(t.id, me.name, e.target.value as TaskStatus)}>{STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select></div>
            <div><label htmlFor="ow">Owner</label>
              <select id="ow" value={t.assigneeId ?? ""} onChange={(e) => assignTask(t.id, me.name, e.target.value || null)}><option value="">Unassigned (team queue)</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name} ({openCount(s.tasks, m.id)} open)</option>)}</select></div>
            {t.assigneeId !== me.id && <button className="ghost" onClick={() => assignTask(t.id, me.name, me.id)}>Assign to me</button>}
            {t.kind === "support" && !t.handoff && t.status !== "done" && (me.role === "support" || me.role === "super_admin") && <button className="ghost" onClick={() => setHand(true)}>Hand over to a designer</button>}
            {t.handoff && <div className="muted small">Handed over to design as {me.role === "support" ? <b className="mono">{t.handoff}</b> : <a className="mono" href={"#/tasks/" + t.handoff}>{t.handoff}</a>}</div>}
            {t.origin && <div className="muted small">Handed over by support from <b className="mono">{t.origin}</b></div>}
            {t.status !== "done" && <button onClick={() => setStatus(t.id, me.name, "done")}>Mark as done</button>}
            <div className="muted small">Owner: {owner?.name ?? "—"} · {t.status === "done" ? `resolved in ${fmtAge(taskAge(t))}` : `open for ${fmtAge(taskAge(t))}`}</div>
          </div>
          <div className="card">
            <h3>History</h3>
            <div className="tl">{[...t.history].reverse().map((h, i) => <div key={i}><div className="small">{h.text}</div><div className="muted small">{h.by} · {fmtDate(h.at)}</div></div>)}</div>
          </div>
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

