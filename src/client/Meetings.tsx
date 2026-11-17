import { useState } from "react";
import { useT } from "../i18n";
import { iso, uid, update, useStore, type EventT, type Meeting } from "../store";
import { CalendarPlus, Check, Clock, Copy, Pencil, Plus, Trash2, Users, Video } from "../icons";
import { Modal } from "./ui";
import { ask } from "./Ask";

const rnd = (chars: string, n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
// Prototype: links look like the real thing but are generated locally, not created at Google or Zoom.
const fakeLink = (p: Meeting["provider"]) => (p === "meet" ? `https://meet.google.com/${rnd("abcdefghijkmnpqrstuvwxyz", 3)}-${rnd("abcdefghijkmnpqrstuvwxyz", 4)}-${rnd("abcdefghijkmnpqrstuvwxyz", 3)}` : `https://zoom.us/j/${rnd("0123456789", 10)}`);
const startOf = (m: Meeting) => new Date(`${m.date}T${m.time}`);

function icsFor(m: Meeting) {
  const f = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const esc = (x: string) => x.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const st = startOf(m), en = new Date(st.getTime() + m.duration * 60000);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//1Plan//Meetings//EN", "BEGIN:VEVENT", `UID:${m.id}@eventplanner`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(st)}`, `DTEND:${f(en)}`, `SUMMARY:${esc(m.title)}`, `DESCRIPTION:${esc((m.agenda ? m.agenda + "\n" : "") + m.link)}`, `LOCATION:${esc(m.link)}`, "END:VEVENT", "END:VCALENDAR"];
  return lines.join("\r\n");
}
function downloadIcs(m: Meeting) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([icsFor(m)], { type: "text/calendar;charset=utf-8" }));
  a.download = `${m.title.replace(/[^\w-]+/g, "_")}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ScheduleModal({ event, meeting, date, onClose }: { event: EventT; meeting?: Meeting; date?: string; onClose: () => void }) {
  const s = useStore();
  const { t } = useT();
  const [f, setF] = useState({ title: meeting?.title ?? "", date: meeting?.date ?? date ?? iso(7), time: meeting?.time ?? "10:00", duration: meeting?.duration ?? 30, provider: (meeting?.provider ?? "meet") as Meeting["provider"], agenda: meeting?.agenda ?? "" });
  const [who, setWho] = useState<string[]>(meeting?.attendees ?? []);
  const people = s.team.filter((m) => m.kind === "client" ? m.eventIds.includes(event.id) : (m.scopeAll || m.eventIds.includes(event.id))).map((m) => m.name); // your team and the clients created for this event; guests are not listed
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    update((st) => {
      if (meeting) { const m = st.meetings.find((x) => x.id === meeting.id)!; Object.assign(m, { title: f.title.trim(), date: f.date, time: f.time, duration: f.duration, agenda: f.agenda.trim(), attendees: who }); if (m.provider !== f.provider) { m.provider = f.provider; m.link = fakeLink(f.provider); } }
      else st.meetings.push({ id: uid(), eventId: event.id, title: f.title.trim(), date: f.date, time: f.time, duration: f.duration, provider: f.provider, link: fakeLink(f.provider), agenda: f.agenda.trim(), attendees: who, createdAt: Date.now() });
    });
    onClose();
  };
  return (
    <Modal title={meeting ? t("meet.edit") : t("meet.schedule")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="full"><label htmlFor="mt">{t("meet.title")} *</label><input id="mt" autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="full">
          <label>{t("meet.provider")}</label>
          <div className="scope" role="group" aria-label={t("meet.provider")}>
            <button type="button" className={f.provider === "meet" ? "" : "ghost"} aria-pressed={f.provider === "meet"} onClick={() => setF({ ...f, provider: "meet" })}><Video size={15} /> Google Meet</button>
            <button type="button" className={f.provider === "zoom" ? "" : "ghost"} aria-pressed={f.provider === "zoom"} onClick={() => setF({ ...f, provider: "zoom" })}><Video size={15} /> Zoom</button>
          </div>
        </div>
        <div><label htmlFor="md">{t("date")}</label><input id="md" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label htmlFor="mh">{t("meet.time")}</label><input id="mh" type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div><label htmlFor="mu">{t("meet.duration")}</label>
          <select id="mu" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })}>{[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}</select></div>
        <div className="full"><label>{t("meet.attendees")}</label>
          <div className="row">{people.length === 0 && <span className="muted small">—</span>}{people.map((p, i) => (
            <label key={p + i} className="row small" style={{ margin: 0, color: "var(--ink)", gap: 4 }}>
              <input type="checkbox" checked={who.includes(p)} onChange={(e) => setWho(e.target.checked ? [...who, p] : who.filter((x) => x !== p))} />{p}</label>
          ))}</div></div>
        <div className="full"><label htmlFor="ma">{t("meet.agenda")}</label><textarea id="ma" rows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></div>
        <p className="muted small full" style={{ margin: 0 }}>{t("meet.note")}</p>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{meeting ? t("save") : t("meet.create")}</button></div>
      </form>
    </Modal>
  );
}

type MView = "calendar" | "list" | "gantt";
const DAY = 86400000;
const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Meetings({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [modal, setModal] = useState<{ meeting?: Meeting; date?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [view, setView] = useState<MView>("calendar");
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const list = s.meetings.filter((m) => m.eventId === event.id).sort((a, b) => +startOf(a) - +startOf(b));
  const now = Date.now();
  const isPast = (m: Meeting) => +startOf(m) + m.duration * 60000 < now;
  const copy = async (m: Meeting) => { try { await navigator.clipboard.writeText(m.link); } catch { /* clipboard may be blocked */ } setCopied(m.id); setTimeout(() => setCopied(null), 1500); };
  const del = (m: Meeting) => ask(t("confirm.delete"), () => update((x) => { x.meetings = x.meetings.filter((y) => y.id !== m.id); }), { danger: true });
  const color = (m: Meeting) => (m.provider === "meet" ? "var(--teal)" : "var(--blue)");
  const actions = (m: Meeting) => (
    <>
      <button className="ghost icon" aria-label={t("meet.edit")} title={t("meet.edit")} onClick={(e) => { e.stopPropagation(); setModal({ meeting: m }); }}><Pencil size={15} /></button>
      <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={(e) => { e.stopPropagation(); del(m); }}><Trash2 size={15} /></button>
    </>
  );

  const card = (m: Meeting) => {
    const st = startOf(m);
    return (
      <div className="card" key={m.id} style={{ opacity: isPast(m) ? .65 : 1 }} onDoubleClick={() => setModal({ meeting: m })}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>{m.title}</h3>
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <span className="badge row" style={{ gap: 4, display: "inline-flex" }}><Video size={12} />{m.provider === "meet" ? "Google Meet" : "Zoom"}</span>
            {actions(m)}
          </span>
        </div>
        <div className="row muted small" style={{ gap: 14, margin: "6px 0" }}>
          <span className="row" style={{ gap: 4 }}><Clock size={13} />{st.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })} · {m.duration} min</span>
          {m.attendees.length > 0 && <span className="row" style={{ gap: 4 }}><Users size={13} />{m.attendees.join(", ")}</span>}
        </div>
        {m.agenda && <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{m.agenda}</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <code className="small" style={{ background: "var(--soft)", padding: "3px 8px", borderRadius: 8, overflowWrap: "anywhere" }}>{m.link}</code>
          <button className="ghost sm" onClick={() => copy(m)}>{copied === m.id ? <><Check size={13} /> {t("meet.copied")}</> : <><Copy size={13} /> {t("meet.copy")}</>}</button>
          <button className="ghost sm" onClick={() => downloadIcs(m)}><CalendarPlus size={13} /> {t("meet.ics")}</button>
        </div>
      </div>
    );
  };

  const calendar = () => {
    const first = new Date(month);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
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
            const k = dkey(d);
            const dl = list.filter((m) => m.date === k);
            return (
              <div key={k} className={`d${d.getMonth() !== month.getMonth() ? " dim" : ""}${k === iso() ? " today" : ""}`} title={t("meet.dbl")} onDoubleClick={() => setModal({ date: k })}>
                {d.getDate()}
                {dl.map((m) => (
                  <div key={m.id} className="mchip" style={{ background: color(m), opacity: isPast(m) ? .55 : 1 }} title={`${m.time} · ${m.title}`} onDoubleClick={(e) => { e.stopPropagation(); setModal({ meeting: m }); }}>
                    <span className="mt">{m.time} {m.title}</span>
                    <span className="macts">{actions(m)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const gantt = () => {
    if (!list.length) return <p className="muted">{t("none")}</p>;
    const min = +new Date(list[0].date + "T00:00") - 2 * DAY, max = +new Date(list[list.length - 1].date + "T00:00") + 8 * DAY;
    const n = Math.max(14, Math.ceil((max - min) / DAY)), W = 30;
    const idx = (d: string) => Math.round((+new Date(d + "T00:00") - min) / DAY);
    const todayIdx = Math.round((+new Date(iso() + "T00:00") - min) / DAY);
    return (
      <div className="gantt">
        <div style={{ minWidth: 240 + n * W }}>
          <div className="grow-g" style={{ gridTemplateColumns: `240px repeat(${n}, ${W}px)`, background: "var(--soft)" }}>
            <div style={{ padding: "0 8px" }} className="small muted">{t("meet.title")}</div>
            {Array.from({ length: n }, (_, i) => { const d = new Date(min + i * DAY); return <div key={i} className="small muted" style={{ textAlign: "center", fontSize: ".65rem" }} title={d.toLocaleDateString(locale)}>{d.getDate() === 1 || i === 0 ? d.toLocaleDateString(locale, { month: "short" }) : d.getDate()}</div>; })}
          </div>
          {list.map((m) => (
            <div className="grow-g" key={m.id} style={{ gridTemplateColumns: `240px ${n * W}px` }} onDoubleClick={() => setModal({ meeting: m })}>
              <div className="row between" style={{ padding: "0 8px", flexWrap: "nowrap", gap: 2 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span><span className="row" style={{ gap: 0, flexWrap: "nowrap" }}>{actions(m)}</span></div>
              <div style={{ position: "relative", height: 34 }}>
                {todayIdx >= 0 && todayIdx < n && <div style={{ position: "absolute", left: todayIdx * W, top: 0, bottom: 0, width: 2, background: "var(--danger)", opacity: .6 }} />}
                <div className="gbar" style={{ position: "absolute", top: 7, left: idx(m.date) * W, width: W, background: color(m), opacity: isPast(m) ? .55 : 1 }} title={`${m.time} · ${m.title}`} />
                <span className="small muted" style={{ position: "absolute", top: 8, left: idx(m.date) * W + W + 6, whiteSpace: "nowrap" }}>{m.time} · {m.duration} min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const upcoming = list.filter((m) => !isPast(m)), past = list.filter(isPast);
  const views: [MView, string][] = [["calendar", "view.calendar"], ["list", "view.list"], ["gantt", "view.gantt"]];
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="seg" role="group" aria-label={t("view")}>{views.map(([v, k]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{t(k)}</button>)}</div>
        <button onClick={() => setModal({})}><Plus size={16} /> {t("meet.schedule")}</button>
      </div>
      {view === "calendar" && calendar()}
      {view === "gantt" && gantt()}
      {view === "list" && (
        <>
          {list.length === 0 && <p className="muted">{t("none")}</p>}
          {upcoming.length > 0 && <div className="grid">{upcoming.map(card)}</div>}
          {past.length > 0 && <><h3 style={{ margin: "18px 0 8px" }}>{t("meet.past")}</h3><div className="grid">{past.map(card)}</div></>}
        </>
      )}
      {modal && <ScheduleModal event={event} meeting={modal.meeting} date={modal.date} onClose={() => setModal(null)} />}
    </>
  );
}
