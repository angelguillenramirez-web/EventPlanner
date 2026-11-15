import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { uid, update, useStore, type ActHist, type Activity, type Dot, type EventT } from "../store";
import { Copy, ChevronLeft, ChevronRight, Award, Beer, Bell, BriefcaseBusiness, Bus, Cake, Camera, Car, ChevronDown, ChevronUp, Church, ClipboardCheck, Clock, Coffee, Crown, Disc3, DoorOpen, FileText, Flame, Flower2, Gem, Gift, Handshake, HeartHandshake, Hotel, IceCream, Laptop, Lightbulb, MapPin, Martini, Megaphone, Mic, Music, Pencil, PartyPopper, Pizza, Plane, Plus, Presentation, Salad, Sparkles, Speaker, Star, Ticket, Trash2, Trophy, TypeIcon, Users, Utensils, Video, Wine } from "../icons";
import { Modal } from "./ui";
import ApprovalButton from "./Approval";

const ACT_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  // celebration & party
  party: PartyPopper, cake: Cake, gift: Gift, music: Music, dj: Disc3, mic: Mic, camera: Camera, video: Video, crown: Crown, gem: Gem, flame: Flame, sparkles: Sparkles, star: Star, heart: HeartHandshake, flower: Flower2, church: Church, icecream: IceCream,
  // food & drinks
  food: Utensils, wine: Wine, cocktail: Martini, beer: Beer, coffee: Coffee, pizza: Pizza, salad: Salad,
  // office & corporate
  presentation: Presentation, briefcase: BriefcaseBusiness, handshake: Handshake, laptop: Laptop, megaphone: Megaphone, award: Award, trophy: Trophy, ticket: Ticket, clipboard: ClipboardCheck, file: FileText, lightbulb: Lightbulb, speaker: Speaker,
  // logistics
  car: Car, bus: Bus, plane: Plane, hotel: Hotel, door: DoorOpen, users: Users, bell: Bell, clock: Clock, pin: MapPin,
};
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDur = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`);
const startMs = (a: Activity) => new Date(`${a.date}T${a.time || "00:00"}`).getTime();
const endMs = (a: Activity) => startMs(a) + a.duration * 60000;
const endTime = (a: Activity) => { const d = new Date(endMs(a)); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

/** Default date/time for a new activity: right when the latest activity ends, so the order stays chronological. */
function nextSlot(all: Activity[], eventDate: string) {
  if (!all.length) return { date: eventDate, time: "09:00" };
  const d = new Date(Math.max(...all.map(endMs)));
  return { date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, time: `${p2(d.getHours())}:${p2(d.getMinutes())}` };
}

const slotOf = (ms: number) => { const d = new Date(ms); return { date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, time: `${p2(d.getHours())}:${p2(d.getMinutes())}` }; };

function ActivityModal({ event, all, itinId, dotId, activity, preset, onClose }: { event: EventT; all: Activity[]; itinId: string; dotId: string | null; activity?: Activity; preset?: { date: string; time: string }; onClose: () => void }) {
  const { t, locale } = useT();
  const [f, setF] = useState<Activity>(() => activity ?? { id: uid(), name: "", ...(preset ?? nextSlot(all, event.date)), duration: 30, location: "", comments: [], history: [] });
  const dow = (d: string) => (d ? new Date(d + "T12:00").toLocaleDateString(locale, { weekday: "short" }) : "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const a = { ...f, name: f.name.trim(), location: f.location.trim() };
    update((st) => {
      const by = st.userName, at = Date.now();
      if (activity) {
        const ch: ActHist[] = [];
        (["name", "date", "time", "duration", "location"] as const).forEach((k) => { if (String(activity[k]) !== String(a[k])) ch.push({ id: uid(), at, by, key: k }); });
        a.history = [...ch.reverse(), ...(activity.history ?? [])]; // newest first
      } else a.history = [{ id: uid(), at, by, key: "created" }];
      if (activity && dotId) { const d = st.dots.find((x) => x.id === dotId)!; d.activities = d.activities.map((x) => (x.id === a.id ? a : x)); }
      else if (dotId) st.dots.find((x) => x.id === dotId)!.activities.push(a);
      else st.dots.push({ id: uid(), eventId: event.id, itinId, activities: [a] }); // a new activity gets its own dot
    });
    onClose();
  };
  return (
    <Modal title={activity ? t("tl.editactivity") : t("tl.addactivity")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="full"><label htmlFor="an">{t("tl.name")} *</label><input id="an" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="ad">{t("date")} · <b>{dow(f.date)}</b></label><input id="ad" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label htmlFor="at">{t("meet.time")}</label><input id="at" type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div><label htmlFor="au">{t("meet.duration")} (min)</label><input id="au" type="number" min={5} step={5} required value={f.duration} onChange={(e) => setF({ ...f, duration: Math.max(5, Number(e.target.value) || 5) })} /></div>
        <div className="full"><label htmlFor="al">{t("location")}</label><input id="al" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        {!activity && !preset && all.length > 0 && <p className="muted small full" style={{ margin: 0 }}>{t("tl.slothint")}</p>}
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{activity ? t("save") : t("add")}</button></div>
      </form>
    </Modal>
  );
}

/** Keeps the speech bubble inside the visible area (below the fixed header, above the window bottom); the arrow keeps pointing at the card. */
function placeCloud(card: HTMLElement) {
  const cloud = card.querySelector<HTMLElement>(".tlcloud");
  if (!cloud) return;
  const r = card.getBoundingClientRect(), h = cloud.offsetHeight;
  const minTop = (document.querySelector(".evhead")?.getBoundingClientRect().bottom ?? 0) + 8;
  const maxTop = window.innerHeight - h - 8;
  const want = r.top + r.height / 2 - h / 2;
  const top = Math.max(minTop, Math.min(want, maxTop));
  cloud.style.setProperty("--shift", `${Math.round(top - want)}px`);
}

/** Icon at the left of an activity name: defaults to the event type icon; clicking it opens the icon list. */
function ActIcon({ event, dotId, a }: { event: EventT; dotId: string; a: Activity }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const Cur = a.icon ? ACT_ICONS[a.icon] : undefined;
  const set = (k: string) => { update((st) => { st.dots.find((d) => d.id === dotId)!.activities.find((x) => x.id === a.id)!.icon = k || undefined; }); setOpen(false); };
  return (
    <span style={{ position: "relative", display: "inline-flex" }} onDoubleClick={(e) => e.stopPropagation()}>
      <button className="ghost icon acticon" aria-label={t("tl.icon")} title={t("tl.icon")} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{Cur ? <Cur size={16} /> : <TypeIcon type={event.type} size={16} />}</button>
      {open && (
        <>
          <div className="menu-bg" style={{ zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="iconpicker" role="menu">
            <button role="menuitem" className={!a.icon ? "on" : ""} title={t("tl.icon.default")} aria-label={t("tl.icon.default")} onClick={() => set("")}><TypeIcon type={event.type} size={16} /></button>
            {Object.entries(ACT_ICONS).map(([k, Ic]) => <button key={k} role="menuitem" className={a.icon === k ? "on" : ""} aria-label={k} title={k} onClick={() => set(k)}><Ic size={16} /></button>)}
          </div>
        </>
      )}
    </span>
  );
}

function History({ a }: { a: Activity }) {
  const { t, locale } = useT();
  const txt = (h: ActHist) => t("tlh." + h.key, { by: h.by, from: h.from ?? "", to: h.to ?? "" });
  if (!a.history?.length) return null;
  return (
    <div className="tlhist">
      <div className="muted" style={{ marginBottom: 3 }}>{t("tl.history")}</div>
      {a.history.map((h) => <div key={h.id}>{txt(h)} · <span className="muted">{new Date(h.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span></div>)}
    </div>
  );
}

function Comments({ dotId, a }: { dotId: string; a: Activity }) {
  const { t, locale } = useT();
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    update((st) => { const x = st.dots.find((d) => d.id === dotId)!.activities.find((y) => y.id === a.id)!; x.comments.push({ id: uid(), by: st.userName, at: Date.now(), text: v }); x.history.unshift({ id: uid(), at: Date.now(), by: st.userName, key: "commentadded" }); });
    setText("");
  };
  return (
    <div className="tlcomments">
      <div className="muted small" style={{ marginBottom: 4 }}>{t("tl.comments")}{a.comments.length > 0 && ` · ${a.comments.length}`}</div>
      {a.comments.map((c) => (
        <div className="c row between" key={c.id} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <div><div className="who">@{c.by} · {new Date(c.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</div>{c.text}</div>
          <button className="ghost icon" aria-label={t("tl.deletecomment")} title={t("tl.deletecomment")} onClick={() => { if (confirm(t("confirm.delete"))) update((st) => { const x = st.dots.find((d) => d.id === dotId)!.activities.find((y) => y.id === a.id)!; x.comments = x.comments.filter((y) => y.id !== c.id); x.history.unshift({ id: uid(), at: Date.now(), by: st.userName, key: "commentdeleted" }); }); }}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="row" style={{ flexWrap: "nowrap", marginTop: 6 }}>
        <input value={text} placeholder={t("tl.comment.ph")} aria-label={t("tl.comments")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="ghost sm" disabled={!text.trim()} onClick={add}>{t("add")}</button>
      </div>
    </div>
  );
}

/** Vertical itinerary: a line with dots; every dot holds one activity, ordered chronologically. */
export default function Timeline({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [modal, setModal] = useState<{ dotId: string | null; activity?: Activity; preset?: { date: string; time: string } } | null>(null);
  const [moving, setMoving] = useState<{ a: Activity; b: Activity; aDot: string; bDot: string; aNew: { date: string; time: string }; bNew: { date: string; time: string }; dir: -1 | 1 } | null>(null);
  const [active, setActive] = useState<string | null>(null); // activity whose bubble has focus (being used): other bubbles stay closed meanwhile
  const itins = s.itineraries.filter((i) => i.eventId === event.id);
  const [curId, setCurId] = useState("");
  const [namer, setNamer] = useState<{ id: string | null; name: string } | null>(null); // adding (id null) or renaming an itinerary
  useEffect(() => { // first visit: create the first itinerary and move the existing activities into it; later visits adopt strays
    const first = itins[0]?.id ?? uid();
    if (!itins.length || s.dots.some((d) => d.eventId === event.id && !d.itinId)) update((st) => {
      if (!st.itineraries.some((i) => i.eventId === event.id)) st.itineraries.push({ id: first, eventId: event.id, name: t("itin.main") });
      st.dots.forEach((d) => { if (d.eventId === event.id && !d.itinId) d.itinId = first; });
    });
  }, [event.id, itins.length]); // eslint-disable-line
  const cur = itins.find((i) => i.id === curId)?.id ?? itins[0]?.id ?? "";
  const curItin = itins.find((i) => i.id === cur);
  const saveName = () => {
    const name = (namer?.name ?? "").trim();
    if (name && namer) {
      if (namer.id) update((st) => { st.itineraries.find((i) => i.id === namer.id)!.name = name; });
      else { const id = uid(); update((st) => { st.itineraries.push({ id, eventId: event.id, name }); }); setCurId(id); }
    }
    setNamer(null);
  };
  const delItin = (i: { id: string; name: string }) => { if (itins.length > 1 && confirm(t("itin.deleteq", { name: i.name }))) { update((st) => { st.itineraries = st.itineraries.filter((x) => x.id !== i.id); st.dots = st.dots.filter((d) => d.itinId !== i.id); }); setCurId(""); } };
  const [itMenu, setItMenu] = useState(false);
  const moveItin = (id: string, dir: -1 | 1) => update((st) => {
    const mine = st.itineraries.filter((x) => x.eventId === event.id), i = mine.findIndex((x) => x.id === id), j = i + dir;
    if (j < 0 || j >= mine.length) return;
    const a = st.itineraries.indexOf(mine[i]), b = st.itineraries.indexOf(mine[j]);
    [st.itineraries[a], st.itineraries[b]] = [st.itineraries[b], st.itineraries[a]];
  });
  const copyItin = (src: { id: string; name: string }) => {
    const id = uid(), at = Date.now();
    update((st) => {
      st.itineraries.push({ id, eventId: event.id, name: t("seat.copyname", { name: src.name }) });
      st.dots.filter((d) => d.itinId === src.id).forEach((d) => st.dots.push({ id: uid(), eventId: event.id, itinId: id, activities: d.activities.map((a) => ({ ...a, id: uid(), comments: [], history: [{ id: uid(), at, by: st.userName, key: "created" as const }] })) }));
    });
    setCurId(id);
  };
  const dots = s.dots.filter((d) => d.eventId === event.id && d.itinId === cur);
  const all = dots.flatMap((d) => d.activities);
  const ordered = [...dots].sort((a, b) => (a.activities.length ? startMs(a.activities[0]) : Infinity) - (b.activities.length ? startMs(b.activities[0]) : Infinity));
  const delDot = (id: string) => { if (confirm(t("tl.deletedot"))) update((st) => { st.dots = st.dots.filter((d) => d.id !== id); }); };
  const proposeMove = (d: Dot, dir: -1 | 1) => {
    const i = ordered.findIndex((x) => x.id === d.id), o = ordered[i + dir];
    const a = d.activities[0], b = o?.activities[0];
    if (!a || !b) return;
    // moving up: A takes B's slot and B starts when A ends; moving down: B takes A's slot and A starts when B ends
    const first = dir === -1 ? a : b, second = dir === -1 ? b : a, slot = dir === -1 ? startMs(b) : startMs(a);
    const firstNew = slotOf(slot), secondNew = slotOf(slot + first.duration * 60000);
    setMoving({ a, b, aDot: d.id, bDot: o.id, aNew: dir === -1 ? firstNew : secondNew, bNew: dir === -1 ? secondNew : firstNew, dir });
    void second;
  };
  const applyMove = () => {
    if (!moving) return;
    update((st) => {
      const by = st.userName, at = Date.now();
      const set = (dotId: string, id: string, n: { date: string; time: string }) => {
        const x = st.dots.find((d) => d.id === dotId)!.activities.find((y) => y.id === id)!;
        (["date", "time"] as const).forEach((k) => { if (x[k] !== n[k]) { x.history.unshift({ id: uid(), at, by, key: k }); x[k] = n[k]; } });
      };
      set(moving.aDot, moving.a.id, moving.aNew); set(moving.bDot, moving.b.id, moving.bNew);
    });
    setMoving(null);
  };
  const row = (d: Dot, idx: number) => (
    <div className="tlrow" key={d.id}>
      <span className="tldot" aria-hidden="true" />
      <div className="tlbody">
        {d.activities.length === 0 && <button className="ghost sm" onClick={() => setModal({ dotId: d.id })}><Plus size={13} /> {t("tl.addactivity")}</button>}
        {d.activities.map((a) => (
          <div className={`tlact card${active && active !== a.id ? " nocloud" : ""}`} key={a.id} tabIndex={0} onFocus={(e) => { setActive(a.id); placeCloud(e.currentTarget); }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive((x) => (x === a.id ? null : x)); }} onKeyDown={(e) => { if (e.key === "Escape") (document.activeElement as HTMLElement | null)?.blur(); }} title={t("tl.dbl")} onMouseEnter={(e) => placeCloud(e.currentTarget)} onMouseMove={(e) => placeCloud(e.currentTarget)} onDoubleClick={() => setModal({ dotId: d.id, activity: a })}>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><ActIcon event={event} dotId={d.id} a={a} /><b>{a.name}</b></div>
            <div className="muted small"><span className="row" style={{ gap: 4 }}><Clock size={12} />{new Date(a.date + "T12:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {a.time}</span></div>
            <div className="tlcloud" onDoubleClick={(e) => e.stopPropagation()}>
              <div className="row between" style={{ marginBottom: 6, flexWrap: "nowrap" }}>
                <div className="row muted small" style={{ gap: 12 }}>
                  <span>{a.time} – {endTime(a)} · {fmtDur(a.duration)}</span>
                  {a.location && <span className="row" style={{ gap: 4 }}><MapPin size={12} />{a.location}</span>}
                </div>
                <div className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                  <button className="ghost icon" aria-label={t("tl.moveup")} title={t("tl.moveup")} disabled={idx === 0} onClick={() => proposeMove(d, -1)}><ChevronUp size={15} /></button>
                  <button className="ghost icon" aria-label={t("tl.movedown")} title={t("tl.movedown")} disabled={idx === ordered.length - 1} onClick={() => proposeMove(d, 1)}><ChevronDown size={15} /></button>
                  <button className="ghost icon" aria-label={t("tl.editactivity")} title={t("tl.editactivity")} onClick={() => setModal({ dotId: d.id, activity: a })}><Pencil size={14} /></button>
                  <button className="ghost icon" aria-label={t("tl.removedot")} title={t("tl.removedot")} onClick={() => delDot(d.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <Comments dotId={d.id} a={a} />
              <History a={a} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <>
      <div className="itintabs" role="tablist" aria-label={t("tab.itinerary")}>
        {itins.map((i) => (
          <span key={i.id} className="itintab" aria-current={i.id === cur}>
            <button role="tab" aria-selected={i.id === cur} onClick={() => setCurId(i.id)} onDoubleClick={() => setNamer({ id: i.id, name: i.name })} title={t("ins.dbl")}>{i.name}</button>
            {i.id === cur && (
              <span style={{ position: "relative", display: "inline-flex" }}>
                <button className="ghost icon" aria-label={t("arr.options")} title={t("arr.options")} aria-haspopup="menu" aria-expanded={itMenu} onClick={() => setItMenu(!itMenu)}><ChevronDown size={15} /></button>
                {itMenu && (
                  <>
                    <div className="menu-bg" onClick={() => setItMenu(false)} />
                    <div className="menu" role="menu" style={{ left: 0, right: "auto", top: "100%", zIndex: 25, minWidth: 180 }}>
                      <button role="menuitem" onClick={() => { setItMenu(false); setNamer({ id: i.id, name: i.name }); }}><Pencil size={14} /> {t("itin.rename")}</button>
                      <button role="menuitem" disabled={itins.indexOf(i) === 0} onClick={() => { setItMenu(false); moveItin(i.id, -1); }}><ChevronLeft size={14} /> {t("tab.left")}</button>
                      <button role="menuitem" disabled={itins.indexOf(i) === itins.length - 1} onClick={() => { setItMenu(false); moveItin(i.id, 1); }}><ChevronRight size={14} /> {t("tab.right")}</button>
                      <button role="menuitem" onClick={() => { setItMenu(false); copyItin(i); }}><Copy size={14} /> {t("seat.copysel")}</button>
                      <button role="menuitem" style={{ color: "var(--rose)" }} disabled={itins.length < 2} onClick={() => { setItMenu(false); delItin(i); }}><Trash2 size={14} /> {t("delete")}</button>
                    </div>
                  </>
                )}
              </span>
            )}
          </span>
        ))}
        <button className="ghost icon" aria-label={t("itin.new")} title={t("itin.new")} onClick={() => setNamer({ id: null, name: "" })}><Plus size={16} /></button>
        <span style={{ flex: 1 }} />
        <ApprovalButton event={event} scope="itinerary" subject={curItin?.name ?? ""} disabled={!all.length} summary={() => [...ordered.flatMap((d) => d.activities).map((a) => `${new Date(a.date + "T12:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} ${a.time}–${endTime(a)} · ${a.name}${a.location ? ` (${a.location})` : ""}`)]} snap={() => ({ k: "itinerary", acts: ordered.flatMap((d) => d.activities).map((a) => ({ when: new Date(a.date + "T12:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }), time: `${a.time}–${endTime(a)}`, name: a.name, location: a.location })) })} />
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{t("tl.desc")}</p>
      <div className="tl">
        {ordered.map((d, i) => (
          <div key={d.id}>
            {row(d, i)}
            {i < ordered.length - 1 && (
              <div className="tlgap">
                <button className="tlplus" aria-label={t("tl.addbetween")} title={t("tl.addbetween")} onClick={() => setModal({ dotId: null, preset: d.activities[0] ? slotOf(endMs(d.activities[0])) : undefined })}><Plus size={11} /></button>
              </div>
            )}
          </div>
        ))}
        <div className="tlrow tlend">
          <button className="tldot add" aria-label={t("tl.addactivity")} title={t("tl.addactivity")} onClick={() => setModal({ dotId: null })}><Plus size={9} /></button>
          <div className="tlbody"><button className="ghost sm" onClick={() => setModal({ dotId: null })}><Plus size={13} /> {t("tl.addactivity")}</button></div>
        </div>
      </div>
      {moving && (
        <Modal title={t("tl.move.title")} onClose={() => setMoving(null)}>
          <p style={{ marginTop: 0 }}>{t("tl.move.desc")}</p>
          {[[moving.a, moving.aNew], [moving.b, moving.bNew]].map(([x, n]) => { const act = x as Activity, nw = n as { date: string; time: string }; return (
            <div key={act.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <b>{act.name}</b>
              <span className="small"><span className="muted">{new Date(act.date + "T12:00").toLocaleDateString(locale, { weekday: "short" })} {act.time}</span> → <b>{new Date(nw.date + "T12:00").toLocaleDateString(locale, { weekday: "short" })} {nw.time}</b></span>
            </div>
          ); })}
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="ghost" onClick={() => setMoving(null)}>{t("cancel")}</button><button onClick={applyMove}>{t("tl.move.confirm")}</button></div>
        </Modal>
      )}
      {namer && (
        <Modal title={namer.id ? t("itin.rename") : t("itin.new")} onClose={() => setNamer(null)}>
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <input autoFocus aria-label={t("tl.name")} placeholder={t("itin.ph")} value={namer.name} onChange={(e) => setNamer({ ...namer, name: e.target.value })} />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button type="button" className="ghost" onClick={() => setNamer(null)}>{t("cancel")}</button><button disabled={!namer.name.trim()}>{namer.id ? t("save") : t("add")}</button></div>
          </form>
        </Modal>
      )}
      {modal && <ActivityModal event={event} all={all} itinId={cur} dotId={modal.dotId} activity={modal.activity} preset={modal.preset} onClose={() => setModal(null)} />}
    </>
  );
}
