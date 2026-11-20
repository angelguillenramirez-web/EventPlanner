import { Fragment, useMemo, useState } from "react";
import { useT } from "../i18n";
import { eventLimit, eventsLast30, go, iso, me, newEvent, openUpsell, update, useStore, type EventStatus } from "../store";
import { ArrowDownUp, CalendarDays, Hourglass, ListChecks, Lock, Plus, Search, SlidersHorizontal, TypeIcon, Users } from "../icons";
import { Modal } from "./ui";
import { Bar } from "./ui";
import Countdown from "./Countdown";
import EventForm from "./EventForm";
import { setSearch, useSearch } from "../search";
import { DI } from "../navicons";
import { confetti, toast } from "../motion";

type VM = "cards" | "created" | "event" | "type";

export function EventsList() {
  const s = useStore();
  const { t, tn, locale } = useT();
  const q = useSearch(), setQ = setSearch; // shared with the search box in the top bar
  const [menu, setMenu] = useState(false);
  const [adv, setAdv] = useState(false);
  const [creating, setCreating] = useState(false);
  const [vm, setVm] = useState<VM>("cards"); // cards by default
  const [type, setType] = useState("");
  const [status, setStatus] = useState<EventStatus | "all">("active");
  const [desc, setDesc] = useState(false);
  const [basis, setBasis] = useState<"event" | "created">("event");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const used = eventsLast30(s);
  const lim = eventLimit(s);
  const createdDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  // greeting and the four summary cards (only the events this person can see)
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "greet.morning" : hour < 19 ? "greet.afternoon" : "greet.evening", { name: me(s).name.split(" ")[0] });
  const scoped = (() => {
    const mem = s.viewAs ? s.team.find((m) => m.id === s.viewAs) : undefined;
    return s.events.filter((e) => e.status === "active" && (!mem || mem.scopeAll || mem.eventIds.includes(e.id)));
  })();
  const scopedIds = new Set(scoped.map((e) => e.id));
  const guestsOk = s.guests.filter((g) => scopedIds.has(g.eventId) && g.status === "confirmed").reduce((n, g) => n + (g.invitees || 1), 0);
  const typesInUse = s.eventTypes.filter((x) => scoped.some((e) => e.type === x.id));
  const weekEnd = iso(7);
  const tasksSoon = s.tasks.filter((x) => x.eventId && scopedIds.has(x.eventId) && !x.parentId && !x.done && x.due && x.due <= weekEnd).length;
  const nextIn = scoped.map((e) => daysTo(e)).filter((d) => d >= 0).sort((a, b) => a - b)[0];
  const stats: [React.ReactNode, string, number | null, string][] = [
    [<DI k="cal" size={20} />, "stat.events", scoped.length, "teal"], [<DI k="guest" size={20} />, "stat.guests", guestsOk, "coral"],
    [<DI k="chk" size={20} />, "stat.tasks", tasksSoon, "butter"], [<Hourglass size={20} />, "stat.next", nextIn ?? null, "lilac"],
  ];

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const mem = s.viewAs ? s.team.find((m) => m.id === s.viewAs) : undefined;
    const rows = s.events.filter((e) => {
      if (mem && !mem.scopeAll && !mem.eventIds.includes(e.id)) return false; // collaborators only see the events they were given
      if (status !== "all" && e.status !== status) return false;
      if (type && e.type !== type) return false;
      if (kw && ![e.name, tn(e.type), e.venue, e.location, e.description, e.date].some((x) => x.toLowerCase().includes(kw))) return false;
      const d = basis === "event" ? e.date : createdDay(e.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
    rows.sort((a, b) => vm === "created" ? a.createdAt - b.createdAt : vm === "type" ? tn(a.type).localeCompare(tn(b.type)) || a.date.localeCompare(b.date) : a.date.localeCompare(b.date));
    return desc ? rows.reverse() : rows;
  }, [s.events, s.viewAs, s.team, s.lang, q, type, status, vm, desc, basis, from, to]); // eslint-disable-line
  const filtered = type || from || to || status !== "active";
  const clear = () => { setType(""); setFrom(""); setTo(""); setStatus("active"); };
  const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString(locale, { dateStyle: "medium" });
  const place = (e: { venue: string; location: string }) => [e.venue, e.location].filter(Boolean).join(", ");

  const card = (e: (typeof list)[number]) => {
    const ty = s.eventTypes.find((x) => x.id === e.type);
    const tasks = s.tasks.filter((x) => x.eventId === e.id && !x.parentId);
    const doneId = e.statuses[e.statuses.length - 1].id;
    const done = tasks.filter((x) => x.statusId === doneId).length;
    const days = daysTo(e);
    return (
      <a key={e.id} href={`#/app/event/${e.id}/tasks`} className="card evc evcover" style={{ opacity: e.status === "active" ? 1 : .7, ["--accent" as string]: ty?.color }}>
        <div className="cover" style={{ background: `color-mix(in srgb, ${ty?.color ?? "var(--teal)"} 24%, var(--surface))`, ["--tc" as string]: ty?.color ?? "var(--teal)" }}>
          
          <span className="tag"><TypeIcon type={e.type} size={14} />{tn(e.type)}</span>
          <Countdown date={e.date} time={e.time} variant="card" />
        </div>
        <div className="evtext">
          {e.status !== "active" && <span className="badge" style={{ marginBottom: 6 }}>{t("estatus." + e.status)}</span>}
          <h3>{e.name}</h3>
          <p className="muted small" style={{ margin: "2px 0 12px" }}>
            {new Date(e.date + "T12:00").toLocaleDateString(locale, { dateStyle: "long" })} · {days >= 0 ? t("days.left", { n: days }) : t("days.past")}
            {place(e) && <><br />{place(e)}</>}
          </p>
          <div className="row between small" style={{ marginBottom: 6 }}><span className="muted">{done}/{tasks.length} {t("tasks").toLowerCase()}</span><b>{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</b></div>
          <Bar value={done} max={tasks.length} />
        </div>
      </a>
    );
  };
  const row = (e: (typeof list)[number]) => (
    <tr key={e.id} style={{ cursor: "pointer", opacity: e.status === "active" ? 1 : .7 }} onClick={() => go(`/app/event/${e.id}/tasks`)}>
      <td><b>{e.name}</b>{e.status !== "active" && <> <span className="badge">{t("estatus." + e.status)}</span></>}</td>
      <td><span className="row" style={{ gap: 6 }}><TypeIcon type={e.type} size={15} />{tn(e.type)}</span></td>
      <td>{fmt(createdDay(e.createdAt))}</td><td>{fmt(e.date)}{e.time ? ` · ${e.time}` : ""}</td><td><Countdown date={e.date} time={e.time} variant="inline" /></td><td>{place(e)}</td>
    </tr>
  );
  const table = () => {
    const groups = vm === "type" ? [...new Set(list.map((e) => e.type))] : [null];
    return (
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr><th>{t("event.name")}</th><th>{t("event.type")}</th><th>{t("created.date")}</th><th>{t("event.date")}</th><th>{t("ev.countdown.col")}</th><th>{t("venue")}</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g ?? "all"}>
                {g && <tr><td colSpan={6} className="grouphead"><span className="row" style={{ gap: 6 }}><TypeIcon type={g} size={15} />{tn(g)} · {list.filter((e) => e.type === g).length}</span></td></tr>}
                {list.filter((e) => g === null || e.type === g).map(row)}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  const views: [VM, string][] = [["cards", "vm.cards"], ["created", "vm.created"], ["event", "vm.event"], ["type", "vm.type"]];

  return (
    <>
      <div className="row between">
        <div><h1>{greeting}</h1><p className="muted" style={{ margin: 0 }}>{t("events.summary", { events: scoped.length, tasks: tasksSoon })}</p></div>
        {!s.viewAs && <button onClick={() => setCreating(true)}><Plus size={17} /> {t("nav.create")}</button>}
      </div>

      <div className="stats">
        {stats.map(([ic, k, n, tone]) => (
          <div className="card stat" key={k}>
            <div className={`sq ${tone}`}>{ic}</div>
            <div><b data-count={n ?? undefined}>{n ?? "–"}</b><span className="l">{t(k)}</span></div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="searchbar">
          <Search size={17} />
          <input aria-label={t("search")} aria-haspopup="menu" aria-expanded={menu} value={q} placeholder={t("search.ph")} onChange={(e) => setQ(e.target.value)}
            onFocus={() => setMenu(true)} onBlur={() => setMenu(false)} onKeyDown={(e) => e.key === "Escape" && setMenu(false)} />
          {menu && !q && (
            <div className="menu" role="menu" style={{ left: 0, right: 0 }} onMouseDown={(e) => e.preventDefault()}>
              <button role="menuitem" onClick={() => { setAdv(!adv); setMenu(false); }}><SlidersHorizontal size={15} /> {adv ? t("search.simple") : t("search.advanced")}</button>
            </div>
          )}
        </div>
        <div className="seg" role="group" aria-label={t("view")}>{views.map(([v, k]) => <button key={v} aria-pressed={vm === v} onClick={() => setVm(v)}>{t(k)}</button>)}</div>
        <button className="ghost icon" aria-label={desc ? t("sort.desc") : t("sort.asc")} title={desc ? t("sort.desc") : t("sort.asc")} onClick={() => setDesc(!desc)}><ArrowDownUp size={16} /></button>
      </div>

      {adv && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="filters">
            <div><label htmlFor="ft">{t("event.type")}</label><select id="ft" value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("all")}</option>{s.eventTypes.map((x) => <option key={x.id} value={x.id}>{tn(x.id)}</option>)}</select></div>
            <div><label htmlFor="fs">{t("status")}</label><select id="fs" value={status} onChange={(e) => setStatus(e.target.value as EventStatus | "all")}>{(["active", "archived", "cancelled"] as const).map((x) => <option key={x} value={x}>{t("estatus." + x)}</option>)}<option value="all">{t("all")}</option></select></div>
            <div><label htmlFor="fb">{t("range.basis")}</label><select id="fb" value={basis} onChange={(e) => setBasis(e.target.value as "event" | "created")}><option value="event">{t("event.date")}</option><option value="created">{t("created.date")}</option></select></div>
            <div><label htmlFor="ff">{t("range.from")}</label><input id="ff" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label htmlFor="ft2">{t("range.to")}</label><input id="ft2" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
            {filtered && <button className="ghost" onClick={clear}>{t("filters.clear")}</button>}
          </div>
        </div>
      )}
      {typesInUse.length > 1 && (
        <div className="tchips" role="group" aria-label={t("event.type")}>
          <button className="tchip" aria-pressed={!type} onClick={() => setType("")}>{t("all")}</button>
          {typesInUse.map((x) => <button key={x.id} className="tchip" aria-pressed={type === x.id} onClick={() => setType(type === x.id ? "" : x.id)}>{tn(x.id)}</button>)}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 0 }}>{t(list.length === 1 ? "events.count.one" : "events.count.other", { n: list.length })} · {desc ? t("sort.desc") : t("sort.asc")}</p>

      {list.length === 0 && <p className="muted">{t("events.none")}</p>}
      {vm === "cards" ? <div className="grid g3">{list.map(card)}{!s.viewAs && <button className="evc evadd" onClick={() => setCreating(true)}><Plus size={30} />{t("events.newtile")}</button>}</div> : list.length > 0 && table()}
      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
    </>
  );
}

/** Days left to an event: with a start time, whole days until that moment; otherwise until the day. */
const daysTo = (e: { date: string; time?: string }) => (e.time ? Math.floor((new Date(`${e.date}T${e.time}`).getTime() - Date.now()) / 86400000) : Math.ceil((new Date(e.date + "T12:00").getTime() - Date.now()) / 86400000));

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const { t } = useT();
  const lim = eventLimit(s);
  const blocked = eventsLast30(s) >= lim;
  return (
    <Modal title={t("nav.create")} onClose={onClose} wide>
      {blocked && <p className="card" style={{ borderColor: "var(--gold)", boxShadow: "none" }}><Lock size={14} style={{ verticalAlign: -2 }} /> {t(lim === 0 ? "events.nosub" : "events.limit", { max: lim })} <button className="sm" onClick={() => openUpsell("events")}>{t("upsell.cta")}</button></p>}
      <EventForm initial={{ name: "", type: "", picture: "", description: "", date: iso(60), location: "", venue: "" }} submitLabel={t("create")} onCancel={onClose}
        onSubmit={(v) => {
          if (blocked) { openUpsell("events"); return; }
          update((st) => { st.events.push(newEvent(v, s.defaultFields)); st.eventLog.push(Date.now()); });
          onClose(); // stay on My events
          confetti(innerWidth / 2, innerHeight / 3); toast(t("toast.created"));
        }} />
    </Modal>
  );
}
