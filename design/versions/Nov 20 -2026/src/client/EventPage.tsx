import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { PLANS, go, me, uid, update, useStore, type EventChange, type EventT } from "../store";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, EyeOff, MapPin, Pencil, Plus, TypeIcon, Users, Video } from "../icons";
import TaskTracker from "./Tasks";
import { LockedCard, Todos } from "./EventTabs";
import { PlannerBudgets } from "./Budget";
import Documents from "./Documents";
import Tables from "./Tables";
import MenuTab from "./MenuTab";
import TalentTab from "./Talent";
import AgreementTab from "./Agreement";
import Countdown from "./Countdown";
import { useMedia } from "../shared";
import Meetings from "./Meetings";
import Timeline from "./Timeline";
import Invitations from "./Invitations";
import Guests from "./Guests";
import DesignTab from "./Design";
import EventForm, { mapsDirections } from "./EventForm";
import { Modal } from "./ui";

function EditEventModal({ ev, onClose }: { ev: EventT; onClose: () => void }) {
  const { t, tn, locale } = useT();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [histOpen, setHistOpen] = useState(false); // history stays grouped and closed until the chevron is clicked
  const label = (f: string) => (f === "status" ? t("status") : f === "name" ? t("event.name") : f === "type" ? t("event.type") : f === "date" ? t("event.date") : f === "time" ? t("event.time") : f === "location" ? t("location") : f === "venue" ? t("venue") : t("description"));
  const val = (c: EventChange, to = false) => { const x = to ? c.to : c.from; return (c.field === "type" ? tn(x) : c.field === "status" ? t("estatus." + x) : x) || "—"; };
  const setStatus = (status: EventT["status"]) => { update((st) => { const e = st.events.find((x) => x.id === ev.id)!; if (e.status !== status) (e.log ??= []).unshift({ id: uid(), at: Date.now(), by: me(st).name, field: "status", from: e.status, to: status }); e.status = status; }); onClose(); };
  const remove = () => {
    update((st) => {
      st.events = st.events.filter((e) => e.id !== ev.id);
      st.tasks = st.tasks.filter((x) => x.eventId !== ev.id);
      st.todos = st.todos.filter((x) => x.eventId !== ev.id);
      st.guests = st.guests.filter((x) => x.eventId !== ev.id);
    });
    onClose(); go("/app");
  };
  return (
    <Modal title={t("event.edit")} onClose={onClose} wide>
      <EventForm submitLabel={t("save")} initial={{ name: ev.name, type: ev.type, picture: ev.picture, description: ev.description, date: ev.date, time: ev.time ?? "", location: ev.location, venue: ev.venue }}
        onSubmit={(v) => { update((st) => { const e = st.events.find((x) => x.id === ev.id)!; const who = me(st).name, at = Date.now(); (["name", "type", "date", "time", "location", "venue", "description"] as const).forEach((f) => { const a = String(e[f] ?? ""), b = String(v[f] ?? ""); if (a !== b) (e.log ??= []).unshift({ id: uid(), at, by: who, field: f, from: a, to: b }); }); Object.assign(e, v); }); onClose(); }} />
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
      <h3>{t("event.manage")}</h3>
      <div className="row">
        {ev.status === "archived" ? <button className="ghost" onClick={() => setStatus("active")}>{t("event.restore")}</button> : <button className="ghost" onClick={() => setStatus("archived")}>{t("event.archive")}</button>}
        {ev.status === "cancelled" ? <button className="ghost" onClick={() => setStatus("active")}>{t("event.reactivate")}</button> : <button className="ghost" onClick={() => setStatus("cancelled")}>{t("event.cancel")}</button>}
        <button className="danger" onClick={() => setConfirm(!confirm)} aria-expanded={confirm}>{t("event.delete")}</button>
      </div>
      {confirm && (
        <div className="card" style={{ marginTop: 12, borderColor: "var(--danger)", boxShadow: "none" }}>
          <p style={{ marginTop: 0 }}>{t("event.delete.warn")}</p>
          <label htmlFor="dn">{t("event.delete.type", { name: ev.name })}</label>
          <input id="dn" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <button className="danger" style={{ marginTop: 10 }} disabled={typed !== ev.name} onClick={remove}>{t("event.delete.confirm")}</button>
        </div>
      )}
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0 8px" }} />
      <div className="evhist">
        <button type="button" className="evhead-btn" aria-expanded={histOpen} onClick={() => setHistOpen(!histOpen)}>
          <ChevronDown size={13} style={{ transform: histOpen ? undefined : "rotate(-90deg)", transition: "transform .15s" }} /> <b>{t("event.history")}</b>
          <span className="muted">{(ev.log ?? []).length ? ` · ${t("event.history.n", { n: (ev.log ?? []).length })}` : ""}</span>
        </button>
        {histOpen && (
          <ul>
            {(ev.log ?? []).map((c) => (
              <li key={c.id} className="nowrap-row" title={`${label(c.field)}: ${val(c)} → ${val(c, true)}`}>
                <span className="muted">{new Date(c.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span> · <b>{c.by || "—"}</b> · {label(c.field)}: {c.field === "description" ? t("event.history.edited") : <>{val(c)} → {val(c, true)}</>}
              </li>
            ))}
            <li className="nowrap-row"><span className="muted">{new Date(ev.createdAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span> · {t("event.history.created")}</li>
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default function EventPage({ id, tab }: { id: string; tab: string }) {
  const s = useStore();
  const { t, tn, locale } = useT();
  const [editing, setEditing] = useState(false);
  const [plus, setPlus] = useState(false);
  const [tabMenu, setTabMenu] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const phone = useMedia("(max-width: 700px)");
  const [compactScroll, setCompact] = useState(false);
  const compact = compactScroll || phone; // phones always use the small header
  const wrapRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const ev = s.events.find((e) => e.id === id);

  // Header + tabs stay fixed while scrolling; they shrink once the page is scrolled (hysteresis avoids flicker).
  useEffect(() => {
    const onScroll = () => setCompact((c) => (c ? window.scrollY > 20 : window.scrollY > 80));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { // publish the header height so inner toolbars (task views, guest numbers) can stick right below it
    const el = headRef.current, wrap = wrapRef.current;
    if (!el || !wrap) return;
    const set = () => wrap.style.setProperty("--evhead-h", el.offsetHeight + "px");
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ev?.id]);

  if (!ev) return <><p>{t("events.none")}</p><button onClick={() => go("/app")}>{t("back")}</button></>;
  const ty = s.eventTypes.find((x) => x.id === ev.type);
  const mem = s.viewAs ? s.team.find((m) => m.id === s.viewAs) : undefined; // collaborators only get the tabs their access allows
  const ALL = ["tasks", "todos", "documents", "itinerary", "design", "guests", "invitations", "tables", "menu", "talent", "agreement", ...(s.viewAs ? [] : ["budget"]), ...ev.sections].filter((k) => !mem || mem.access.includes(k) || (k === "talent" && mem.access.length >= 10));
  const order = [...ev.tabOrder.filter((k) => ALL.includes(k)), ...ALL.filter((k) => !ev.tabOrder.includes(k))];
  const rules = PLANS[s.plan];
  const noAccess = (k: string) => (k === "documents" && !rules.documents) || (k === "agreement" && !rules.agreements) || (k === "meetings" && !rules.meetings); // not in this plan: kept under "+" and locked
  const visible = order.filter((k) => !ev.hiddenTabs.includes(k) && !noAccess(k));
  const hiddenList = order.filter((k) => ev.hiddenTabs.includes(k) || noAccess(k));
  const patch = (fn: (e: EventT) => void) => update((st) => { fn(st.events.find((e) => e.id === id)!); });
  const addTab = (k: string) => patch((e) => { e.hiddenTabs = e.hiddenTabs.filter((x) => x !== k); }); // shows a tab that is not on the bar yet
  const dropTab = (target: string) => {
    if (!drag || drag === target) return;
    const next = order.filter((k) => k !== drag);
    next.splice(next.indexOf(target), 0, drag);
    patch((e) => { e.tabOrder = next; });
  };
  const moveTab = (k: string, dir: -1 | 1) => {
    const i = visible.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= visible.length) return;
    const v = [...visible]; [v[i], v[j]] = [v[j], v[i]];
    let n = 0; // keep the hidden tabs where they were; only reshuffle the visible slots
    patch((e) => { e.tabOrder = order.map((x) => (e.hiddenTabs.includes(x) ? x : v[n++])); });
  };
  const hideTab = (k: string) => {
    const rest = visible.filter((x) => x !== k);
    patch((e) => { if (!e.hiddenTabs.includes(k)) e.hiddenTabs.push(k); });
    if (tab === k && rest.length) go(`/app/event/${id}/${rest[Math.max(0, visible.indexOf(k) - 1)]}`);
  };
  const place = [ev.venue, ev.location].filter(Boolean).join(" · ");
  return (
    <div ref={wrapRef} style={{ ["--accent" as string]: ty?.color, minHeight: "calc(100vh + 110px)" }}>
      <div ref={headRef} className={`evhead${compact ? " compact" : ""}`}>
        <div className="row evtop" style={{ alignItems: "center", gap: 16, flexWrap: "nowrap" }}>
          <div className="grow" style={{ minHeight: compact ? 0 : 112, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="ev-title">
              <h1 style={{ margin: 0, fontSize: compact ? "1.15rem" : undefined }}>{ev.name}</h1>
              <button className="ghost icon" aria-label={t("event.edit")} title={t("event.edit")} onClick={() => setEditing(true)}><Pencil size={16} /></button>
              {ev.status !== "active" && <span className="badge">{t("estatus." + ev.status)}</span>}
            </div>
            {!compact && (
              <div className="row muted evmeta" style={{ marginTop: 8, gap: 18 }}>
                <span className="row" style={{ gap: 6 }}><TypeIcon type={ev.type} size={16} />{tn(ev.type)}</span>
                <span className="row" style={{ gap: 6 }}><CalendarDays size={16} />{new Date(ev.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" })}{ev.time ? ` · ${ev.time}` : ""}</span>
                <span className="row" style={{ gap: 6 }}><Users size={16} />{t("ev.guestsn", { n: s.guests.filter((g) => g.eventId === ev.id).reduce((n, g) => n + g.invitees, 0) })}</span>
                {place && <a className="row" style={{ gap: 6, color: "inherit" }} href={mapsDirections([ev.venue, ev.location].filter(Boolean).join(", "))} target="_blank" rel="noopener noreferrer" title={t("map.directions")}><MapPin size={16} />{place}</a>}
              </div>
            )}
          </div>
          <Countdown date={ev.date} time={ev.time} variant={compact ? "compact" : "lg"} />
        </div>
        <nav className="tabs" aria-label="Event sections" style={{ marginBottom: 0 }}>
          {visible.map((k) => (
            <span key={k} className={`tabitem${over === k && drag !== k ? " dragover" : ""}`} draggable onDragStart={(e) => { setDrag(k); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", k); }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(k); } }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); dropTab(k); setDrag(null); setOver(null); }} onDragEnd={() => { setDrag(null); setOver(null); }}>
              <a href={`#/app/event/${id}/${k}`} draggable={false} aria-current={tab === k ? "page" : undefined} title={t("tab.drag")}>{t("tab." + k)}</a>
              <span style={{ position: "relative", display: "inline-flex" }}>
                <button className="ghost icon tabcaret" aria-label={t("tab.options")} title={t("tab.options")} aria-haspopup="menu" aria-expanded={tabMenu === k} onClick={() => setTabMenu(tabMenu === k ? null : k)}><ChevronDown size={13} /></button>
                {tabMenu === k && (
                  <>
                    <div className="menu-bg" onClick={() => setTabMenu(null)} />
                    <div className="menu" role="menu" style={{ left: 0, right: "auto", top: "100%", zIndex: 25, minWidth: 170 }}>
                      <button role="menuitem" disabled={visible.length < 2} onClick={() => { setTabMenu(null); hideTab(k); }}><EyeOff size={14} /> {t("tab.hide")}</button>
                      <button role="menuitem" disabled={visible.indexOf(k) === 0} onClick={() => { setTabMenu(null); moveTab(k, -1); }}><ArrowLeft size={14} /> {t("tab.left")}</button>
                      <button role="menuitem" disabled={visible.indexOf(k) === visible.length - 1} onClick={() => { setTabMenu(null); moveTab(k, 1); }}><ArrowRight size={14} /> {t("tab.right")}</button>
                    </div>
                  </>
                )}
              </span>
            </span>
          ))}
          <span style={{ position: "relative", alignSelf: "center" }}>
            <button className="ghost icon plus" aria-label={t("tab.add")} title={t("tab.add")} aria-haspopup="menu" aria-expanded={plus} onClick={() => setPlus(!plus)}><Plus size={16} /></button>
            {plus && (
              <>
                <div className="menu-bg" onClick={() => setPlus(false)} />
                <div className="menu" role="menu" style={{ left: 0, right: "auto", zIndex: 25, minWidth: 240 }}>
                  {(hiddenList.length > 0 || !ev.sections.includes("meetings")) && <div className="muted small" style={{ padding: "6px 10px" }}>{t("tab.add")}</div>}
                  {hiddenList.map((k) => (
                    <button key={k} role="menuitem" onClick={() => { addTab(k); setPlus(false); go(`/app/event/${id}/${k}`); }}>{t("tab." + k)}</button>
                  ))}
                  {!ev.sections.includes("meetings") && (
                    <button role="menuitem" onClick={() => { patch((e) => { e.sections.push("meetings"); }); setPlus(false); go(`/app/event/${id}/meetings`); }}><Video size={15} /> {t("tab.meetings")}</button>
                  )}
                  {hiddenList.length === 0 && ev.sections.includes("meetings") && <div className="muted small" style={{ padding: "8px 10px" }}>{t("tab.nohidden")}</div>}
                </div>
              </>
            )}
          </span>
        </nav>
      </div>
      <div className="evbody">
        {tab === "tasks" && <TaskTracker key={ev.id} event={ev} />}
        {tab === "todos" && <Todos event={ev} />}
        {tab === "documents" && (rules.documents ? <Documents event={ev} /> : <LockedCard k="documents" />)}
        {tab === "itinerary" && <Timeline event={ev} />}
        {tab === "design" && <DesignTab event={ev} />}
        {tab === "guests" && <Guests event={ev} />}
        {tab === "invitations" && <Invitations event={ev} />}
        {tab === "tables" && <Tables event={ev} />}
        {tab === "menu" && <MenuTab event={ev} />}
        {tab === "talent" && <TalentTab event={ev} />}
        {tab === "agreement" && (rules.agreements ? <AgreementTab event={ev} /> : <LockedCard k="agreements" />)}
        {tab === "budget" && !s.viewAs && <PlannerBudgets eventId={ev.id} />}
        {tab === "meetings" && ev.sections.includes("meetings") && (rules.meetings ? <Meetings event={ev} /> : <LockedCard k="meetings" />)}
      </div>
      {editing && <EditEventModal ev={ev} onClose={() => setEditing(false)} />}
    </div>
  );
}
