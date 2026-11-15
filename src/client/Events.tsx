import { Fragment, useMemo, useState } from "react";
import { useT } from "../i18n";
import { eventLimit, eventsLast30, go, iso, newEvent, openUpsell, update, useStore, type EventStatus } from "../store";
import { ArrowDownUp, Lock, Search, SlidersHorizontal, TypeIcon } from "../icons";
import { Modal } from "./ui";
import { Bar } from "./ui";
import Countdown from "./Countdown";
import EventForm, { EventThumb } from "./EventForm";

type VM = "cards" | "created" | "event" | "type";

export function EventsList() {
  const s = useStore();
  const { t, tn, locale } = useT();
  const [q, setQ] = useState("");
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
    const days = Math.ceil((new Date(e.date + "T12:00").getTime() - Date.now()) / 86400000);
    return (
      <a key={e.id} href={`#/app/event/${e.id}/tasks`} className="card" style={{ position: "relative", textDecoration: "none", borderTop: `4px solid ${ty?.color}`, opacity: e.status === "active" ? 1 : .7 }}>
        <EventThumb picture={e.picture} type={e.type} />
        <Countdown date={e.date} variant="card" />
        <div className="row between"><span className="row small" style={{ gap: 6 }}><TypeIcon type={e.type} size={15} />{tn(e.type)}</span>{e.status !== "active" && <span className="badge">{t("estatus." + e.status)}</span>}</div>
        <h3 style={{ marginTop: 6 }}>{e.name}</h3>
        <p className="muted small" style={{ margin: "0 0 10px" }}>
          {new Date(e.date + "T12:00").toLocaleDateString(locale, { dateStyle: "long" })} · {days >= 0 ? t("days.left", { n: days }) : t("days.past")}
          {place(e) && <><br />{place(e)}</>}
        </p>
        <Bar value={done} max={tasks.length} />
        <p className="muted small" style={{ margin: "4px 0 0" }}>{done}/{tasks.length} {t("tasks").toLowerCase()}</p>
      </a>
    );
  };
  const row = (e: (typeof list)[number]) => (
    <tr key={e.id} style={{ cursor: "pointer", opacity: e.status === "active" ? 1 : .7 }} onClick={() => go(`/app/event/${e.id}/tasks`)}>
      <td><b>{e.name}</b>{e.status !== "active" && <> <span className="badge">{t("estatus." + e.status)}</span></>}</td>
      <td><span className="row" style={{ gap: 6 }}><TypeIcon type={e.type} size={15} />{tn(e.type)}</span></td>
      <td>{fmt(createdDay(e.createdAt))}</td><td>{fmt(e.date)}</td><td><Countdown date={e.date} variant="inline" /></td><td>{place(e)}</td>
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
        <div><h1>{t("nav.myevents")}</h1>{!s.viewAs && <p className="muted">{t("events.usage", { used, max: lim === Infinity ? "∞" : lim })}</p>}</div>
        {!s.viewAs && <button onClick={() => setCreating(true)}>+ {t("nav.create")}</button>}
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
      <p className="muted small" style={{ marginTop: 0 }}>{t(list.length === 1 ? "events.count.one" : "events.count.other", { n: list.length })} · {desc ? t("sort.desc") : t("sort.asc")}</p>

      {list.length === 0 && <p className="muted">{t("events.none")}</p>}
      {vm === "cards" ? <div className="grid g3">{list.map(card)}</div> : list.length > 0 && table()}
      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
    </>
  );
}

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
        }} />
    </Modal>
  );
}
