import { useMemo, useState } from "react";
import { useT } from "../i18n";
import { COLLAB_KINDS, iso, useStore, type EventT, type Task } from "../store";
import { CalendarDays, ChevronDown, Plus, Search, User } from "../icons";
import { DoneBox, LikeButton, TaskPanel } from "./Tasks";
import { PRIORITIES, PriBadge } from "./ui";

type ViewMode = "list" | "board" | "calendar";
type GroupBy = "eventdate" | "event" | "priority" | "due" | "status" | "assignee";
type Who = { mode: "me" | "all" | "people"; people: string[] };
const GROUPS: GroupBy[] = ["eventdate", "event", "priority", "due", "status", "assignee"];
const PRI_ORDER = [...PRIORITIES, ""];

/** Assigned-to filter: me, everyone, specific people or whole groups (by kind and role). */
function WhoFilter({ who, setWho }: { who: Who; setWho: (w: Who) => void }) {
  const s = useStore();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const people = [s.userName, ...s.team.map((m) => m.name)];
  const toggle = (names: string[]) => {
    const all = names.every((n) => who.people.includes(n));
    const next = all ? who.people.filter((p) => !names.includes(p)) : [...new Set([...who.people, ...names])];
    setWho({ mode: next.length ? "people" : "all", people: next });
  };
  const groups: { key: string; label: string; names: string[] }[] = [
    ...COLLAB_KINDS.map((k) => ({ key: "k" + k, label: t("collab.kind." + k), names: s.team.filter((m) => m.kind === k).map((m) => m.name) })),
    ...[...new Set(s.team.map((m) => m.role))].map((r) => ({ key: "r" + r, label: `${t("mt.role")}: ${t("team.role." + r)}`, names: s.team.filter((m) => m.role === r).map((m) => m.name) })),
  ].filter((g) => g.names.length);
  const label = who.mode === "me" ? t("mt.me") : who.mode === "all" ? t("mt.everyone") : who.people.length === 1 ? `@${who.people[0]}` : `${who.people.length} ${t("mt.people").toLowerCase()}`;
  return (
    <span style={{ position: "relative" }}>
      <button className="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><User size={15} /> {t("mt.assigned")}: <b>{label}</b> <ChevronDown size={14} /></button>
      {open && (
        <>
          <div className="menu-bg" onClick={() => setOpen(false)} />
          <div className="menu" role="menu" style={{ left: 0, right: "auto", minWidth: 270, zIndex: 25, maxHeight: "60vh", overflowY: "auto" }}>
            <button role="menuitemradio" aria-checked={who.mode === "me"} onClick={() => setWho({ mode: "me", people: [] })}><input type="radio" readOnly checked={who.mode === "me"} /> {t("mt.me")}</button>
            <button role="menuitemradio" aria-checked={who.mode === "all"} onClick={() => setWho({ mode: "all", people: [] })}><input type="radio" readOnly checked={who.mode === "all"} /> {t("mt.everyone")}</button>
            <div className="muted small" style={{ padding: "8px 10px 2px" }}>{t("mt.people")}</div>
            {people.map((n, i) => <button key={n + i} role="menuitemcheckbox" aria-checked={who.people.includes(n)} onClick={() => toggle([n])}><input type="checkbox" readOnly checked={who.mode === "people" && who.people.includes(n)} /> @{n}{i === 0 && <span className="muted small"> · {t("task.you")}</span>}</button>)}
            {groups.length > 0 && <div className="muted small" style={{ padding: "8px 10px 2px" }}>{t("mt.groups")}</div>}
            {groups.map((g) => <button key={g.key} role="menuitemcheckbox" aria-checked={g.names.every((n) => who.people.includes(n))} onClick={() => toggle(g.names)}><input type="checkbox" readOnly checked={who.mode === "people" && g.names.every((n) => who.people.includes(n))} /> {g.label} <span className="muted small">({g.names.length})</span></button>)}
          </div>
        </>
      )}
    </span>
  );
}

/** My tasks: every task of every event, grouped and filtered however the planner needs. */
export default function MyTasks() {
  const s = useStore();
  const { t, locale } = useT();
  const [view, setView] = useState<ViewMode>("list");
  const [group, setGroup] = useState<GroupBy>("eventdate");
  const [who, setWho] = useState<Who>({ mode: "me", people: [] });
  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ n: number } | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const evOf = (id: string | null) => s.events.find((e) => e.id === id);
  const statusOf = (x: Task) => evOf(x.eventId)?.statuses.find((y) => y.id === x.statusId);
  const events = [...s.events].sort((a, b) => a.date.localeCompare(b.date));
  const today = iso();
  const all = s.tasks.filter((x) => !x.parentId && !statusOf(x)?.archived);
  const tasks = all.filter((x) =>
    (who.mode === "all" || (who.mode === "me" ? x.assignees.includes(s.userName) : x.assignees.some((a) => who.people.includes(a)))) &&
    (!eventId || x.eventId === eventId) && (showDone || !x.done) &&
    (!q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.name.localeCompare(b.name));
  const d = (iso0: string) => new Date(iso0 + "T12:00").toLocaleDateString(locale, { day: "numeric", month: "short" });

  const groups = useMemo(() => {
    const out: { key: string; label: string; color?: string; items: Task[] }[] = [];
    const add = (key: string, label: string, x: Task, color?: string) => { let g = out.find((y) => y.key === key); if (!g) { g = { key, label, color, items: [] }; out.push(g); } g.items.push(x); };
    tasks.forEach((x) => {
      const ev = evOf(x.eventId);
      if (group === "eventdate" || group === "event") add(ev?.id ?? "none", ev ? (group === "eventdate" ? `${ev.name} · ${new Date(ev.date + "T12:00").toLocaleDateString(locale, { dateStyle: "medium" })}` : ev.name) : t("mt.noevent"), x, s.eventTypes.find((e) => e.id === ev?.type)?.color);
      else if (group === "priority") add(x.priority || "none", x.priority ? t("pri." + x.priority) : t("mt.nopri"), x);
      else if (group === "due") { const k = !x.due ? "z" : x.due < today ? "a" : x.due === today ? "b" : x.due <= iso(7) ? "c" : "d"; add(k, t("mt.due." + k), x, k === "a" ? "var(--rose)" : undefined); }
      else if (group === "status") { const st = statusOf(x); add(st?.name ?? "-", st?.name ?? "—", x, st?.color); }
      else if (x.assignees.length) x.assignees.forEach((n) => add(n, "@" + n, x)); else add("none", t("mt.unassigned"), x);
    });
    const order = (g: { key: string }) => group === "eventdate" ? (evOf(g.key)?.date ?? "9999") : group === "event" ? (evOf(g.key)?.name ?? "zzz") : group === "priority" ? String(PRI_ORDER.indexOf(g.key === "none" ? "" : g.key)).padStart(2, "0") : g.key;
    return group === "status" ? out : out.sort((a, b) => order(a).localeCompare(order(b)));
  }, [tasks, group, s.events, locale]); // eslint-disable-line

  const stats = [
    [t("mt.open"), tasks.filter((x) => !x.done).length, undefined],
    [t("mt.overdue"), tasks.filter((x) => !x.done && x.due && x.due < today).length, "var(--rose)"],
    [t("mt.week"), tasks.filter((x) => !x.done && x.due && x.due >= today && x.due <= iso(7)).length, "var(--gold)"],
    [t("mt.done"), tasks.filter((x) => x.done).length, "var(--teal)"],
  ] as const;

  const chip = (x: Task) => { const ev = evOf(x.eventId); const st = statusOf(x); return (
    <>
      {ev && <span className="badge row" style={{ gap: 4, display: "inline-flex" }}><CalendarDays size={11} />{ev.name}</span>}
      <PriBadge p={x.priority} />
      {x.due && <span className="small" style={{ color: !x.done && x.due < today ? "var(--rose)" : "var(--muted)" }}>{d(x.due)}</span>}
      {st && <span className="pill" style={{ background: st.color, color: "#0c1a18" }}>{st.name}</span>}
    </>
  ); };
  const list = () => groups.length === 0 ? <p className="muted">{t("mt.none")}</p> : (
    <>
      {groups.map((g) => (
        <section key={g.key} style={{ marginBottom: 18 }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>{g.color && <span className="dot" style={{ background: g.color }} />}<b>{g.label}</b><span className="muted">{g.items.length}</span></div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {g.items.map((x) => (
              <div key={x.id} className={`mtrow${x.done ? " tdone" : ""}`} tabIndex={0} role="button" onClick={() => setOpen(x.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(x.id)}>
                <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}><DoneBox task={x} /><b>{x.name}</b></span>
                <span className="row" style={{ gap: 8 }}>{chip(x)}</span>
                <span className="muted small">{x.assignees.map((a) => "@" + a).join(", ")}</span>
                <LikeButton task={x} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
  const board = () => groups.length === 0 ? <p className="muted">{t("mt.none")}</p> : (
    <div className="board">
      {groups.map((g) => (
        <div key={g.key} className="bcol">
          <div className="head row">{g.color && <span className="dot" style={{ background: g.color }} />}<b>{g.label}</b><span className="muted" style={{ flex: 1 }}>{g.items.length}</span></div>
          <div className="list">
            {g.items.map((x) => (
              <div key={x.id} className={`tcard${x.done ? " tdone" : ""}`} style={{ cursor: "pointer" }} tabIndex={0} role="button" onClick={() => setOpen(x.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(x.id)}>
                <div className="row" style={{ flexWrap: "nowrap", gap: 8, alignItems: "flex-start" }}><DoneBox task={x} /><b>{x.name}</b></div>
                <div className="mrow"><div className="meta">{chip(x)}{x.assignees.length > 0 && <span className="row" style={{ gap: 3 }}><User size={12} />{x.assignees.map((a) => "@" + a).join(", ")}</span>}</div><LikeButton task={x} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  const calendar = () => {
    const first = new Date(month);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
    const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="ghost sm" aria-label="‹" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <b>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
          <button className="ghost sm" aria-label="›" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="cal">
          {wd.map((x) => <div className="h" key={x}>{x}</div>)}
          {days.map((x) => {
            const k = key(x);
            const dl = tasks.filter((y) => (y.due || y.start) === k);
            return (
              <div key={k} className={`d${x.getMonth() !== month.getMonth() ? " dim" : ""}${k === today ? " today" : ""}`}>
                {x.getDate()}
                {dl.slice(0, 3).map((y) => <button key={y.id} className={`chip${y.done ? " tdone" : ""}`} style={{ background: statusOf(y)?.color ?? "var(--soft)" }} title={`${y.name} · ${evOf(y.eventId)?.name ?? ""}`} onClick={() => setOpen(y.id)}>{y.name}</button>)}
                {dl.length > 3 && <span className="muted">+{dl.length - 3}</span>}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const openTask = s.tasks.find((x) => x.id === open);
  const openEv: EventT | undefined = openTask ? evOf(openTask.eventId) : undefined;
  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}><h1 style={{ margin: 0 }}>{t("nav.mytasks")}</h1><button onClick={() => setCreating({ n: Date.now() })}><Plus size={16} /> {t("task.add")}</button></div>
      <p className="muted" style={{ marginTop: 0 }}>{t("mt.desc")}</p>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        {stats.map(([l, n, c]) => <div className="card" key={l}><div className="muted small">{l}</div><h2 style={{ margin: 0, color: c }}>{n}</h2></div>)}
      </div>
      <div className="row between stickbar" style={{ marginBottom: 8 }}>
        <div className="seg" role="group" aria-label={t("view")}>
          {(["list", "board", "calendar"] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{t("mt.view." + v)}</button>)}
        </div>
        <div className="row">
          {view !== "calendar" && <label className="row small" style={{ margin: 0, gap: 6 }}>{t("mt.groupby")}
            <select aria-label={t("mt.groupby")} value={group} onChange={(e) => setGroup(e.target.value as GroupBy)} style={{ width: "auto" }}>{GROUPS.map((g) => <option key={g} value={g}>{t("mt.group." + g)}</option>)}</select></label>}
          <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />{t("mt.showdone")}</label>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <WhoFilter who={who} setWho={setWho} />
        <select aria-label={t("mt.event")} value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ width: "auto" }}>
          <option value="">{t("mt.allevents")}</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name} · {d(e.date)}</option>)}
        </select>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><Search size={16} className="muted" /><input style={{ width: 200 }} value={q} placeholder={t("search")} aria-label={t("search")} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {view === "list" && list()}
      {view === "board" && board()}
      {view === "calendar" && calendar()}
      {open && openTask && <TaskPanel key={open} taskId={open} statuses={openEv?.statuses ?? []} onClose={() => setOpen(null)} />}
      {creating && (() => { const ev = events.find((e) => e.id === eventId); return <TaskPanel key={creating.n} create={{ eventId: ev?.id ?? null, statusId: ev?.statuses.find((x) => !x.archived)?.id ?? "" }} statuses={[]} events={events} onClose={() => setCreating(null)} />; })()}
    </>
  );
}
