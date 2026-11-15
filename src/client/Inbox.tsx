import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { NOTIF_TYPES, go, iso, newTask, uid, update, useStore, unreadCounts, type InboxMsg, type NotifType, type Thread } from "../store";
import { SUPPLIERS, SUPPLIER_CATEGORIES, type Supplier } from "../suppliers";
import { useMedia } from "../shared";
import { ArrowLeft, Archive, ArchiveRestore, Bell, BellOff, Check, CheckCheck, ListTodo, MailOpen, Paperclip, Pin, PinOff, Plus, Search, Send, Settings, ThumbsDown, ThumbsUp, Users, Wallet, ClipboardCheck, CalendarCheck, Store } from "../icons";
import { Modal } from "./ui";
import { money } from "./Billing";

const supOf = (id: string): Supplier | undefined => SUPPLIERS.find((x) => x.id === id);
const HUES: Record<string, number> = { venue: 340, catering: 25, photo: 210, music: 270, decor: 140, cake: 320, entertainment: 50, rentals: 180, beauty: 300, transport: 100 };
const Avatar = ({ sup, size = 40 }: { sup?: Supplier; size?: number }) => <span className="inbav" style={{ width: size, height: size, background: `hsl(${HUES[sup?.category ?? ""] ?? 200} 45% 38%)` }}>{(sup?.name ?? "?")[0]}</span>;
const NICON: Record<NotifType, React.ReactNode> = { approval: <ClipboardCheck size={16} />, supplier: <Store size={16} />, task: <ListTodo size={16} />, guest: <CalendarCheck size={16} />, collab: <Users size={16} />, billing: <Wallet size={16} /> };
const kb = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

/** Relative time in the user's language ("3 h ago", "yesterday"). */
const useAgo = () => {
  const { locale } = useT();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return (ms: number) => {
    const d = (ms - Date.now()) / 1000, a = Math.abs(d);
    if (a < 60) return rtf.format(0, "second");
    if (a < 3600) return rtf.format(Math.round(d / 60), "minute");
    if (a < 86400) return rtf.format(Math.round(d / 3600), "hour");
    if (a < 86400 * 7) return rtf.format(Math.round(d / 86400), "day");
    return new Date(ms).toLocaleDateString(locale, { dateStyle: "medium" });
  };
};

/** Inbox = conversations with suppliers + the notifications feed. */
export default function Inbox({ sub }: { sub: string }) {
  const { t } = useT();
  const s = useStore();
  const c = unreadCounts(s);
  const tab = sub === "notifications" ? "notifs" : "msgs";
  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>{t("nav.inbox")}</h1>
        <div className="seg" role="tablist" aria-label={t("nav.inbox")}>
          <button role="tab" aria-selected={tab === "msgs"} aria-pressed={tab === "msgs"} onClick={() => go("/app/inbox")}>{t("inb.messages")}{c.msgs > 0 && <span className="inbbadge">{c.msgs}</span>}</button>
          <button role="tab" aria-selected={tab === "notifs"} aria-pressed={tab === "notifs"} onClick={() => go("/app/inbox/notifications")}>{t("inb.notifications")}{c.notifs > 0 && <span className="inbbadge">{c.notifs}</span>}</button>
        </div>
      </div>
      {tab === "notifs" ? <Notifications /> : <Messages open={sub} />}
    </>
  );
}

/* ───────────────────────── messages ───────────────────────── */
function Messages({ open }: { open: string }) {
  const { t, locale } = useT();
  const s = useStore();
  const ago = useAgo();
  const phone = useMedia("(max-width: 900px)");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "pinned" | "archived">("all");
  const [ev, setEv] = useState("");
  const [compose, setCompose] = useState(false);
  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return s.threads.filter((th) => {
      if (filter === "archived" ? !th.archived : th.archived) return false;
      if (filter === "unread" && !th.msgs.some((m) => m.from === "them" && !m.read)) return false;
      if (filter === "pinned" && !th.pinned) return false;
      if (ev && th.eventId !== ev) return false;
      if (kw) { const sup = supOf(th.supplierId); if (!((sup?.name ?? "") + " " + th.msgs.map((m) => (m.key ? t(m.key) : m.text)).join(" ")).toLowerCase().includes(kw)) return false; }
      return true;
    }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || last(b) - last(a));
  }, [s.threads, q, filter, ev, locale]); // eslint-disable-line
  const th = s.threads.find((x) => x.id === open);
  const showList = !phone || !th, showConv = !phone || !!th;
  return (
    <div className={`inbox2${phone ? " phone" : ""}`}>
      {showList && (
        <aside className="inblist card" aria-label={t("inb.messages")}>
          <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
            <div className="inbsearch"><Search size={15} /><input value={q} placeholder={t("inb.search")} aria-label={t("inb.search")} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="icon" aria-label={t("inb.new")} title={t("inb.new")} onClick={() => setCompose(true)}><Plus size={17} /></button>
          </div>
          <div className="row" style={{ gap: 4, margin: "8px 0" }}>
            {(["all", "unread", "pinned", "archived"] as const).map((f) => <button key={f} className={`chip${filter === f ? " on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t("inb.f." + f)}</button>)}
          </div>
          {s.events.length > 1 && <select aria-label={t("inb.event")} value={ev} onChange={(e) => setEv(e.target.value)} style={{ marginBottom: 8 }}><option value="">{t("inb.allevents")}</option>{s.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
          <div className="inbrows">
            {list.length === 0 && <p className="muted small" style={{ textAlign: "center", padding: 16 }}>{t("inb.empty")}</p>}
            {list.map((x) => {
              const sup = supOf(x.supplierId), lm = x.msgs[x.msgs.length - 1], un = x.msgs.filter((m) => m.from === "them" && !m.read).length;
              return (
                <a key={x.id} href={`#/app/inbox/${x.id}`} className={`inbrow${x.id === open ? " on" : ""}${un ? " unread" : ""}`}>
                  <Avatar sup={sup} />
                  <span className="inbtxt">
                    <span className="row between" style={{ flexWrap: "nowrap", gap: 6 }}><b className="ell">{sup?.name}</b><span className="muted small nowrap">{ago(last(x))}</span></span>
                    <span className="row between" style={{ flexWrap: "nowrap", gap: 6 }}><span className="muted small ell">{lm ? (lm.from === "me" ? t("inb.you") + ": " : "") + (lm.quote ? t("inb.quote") : lm.key ? t(lm.key) : lm.text || lm.attach?.name) : ""}</span>
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>{x.muted && <BellOff size={12} className="muted" />}{x.pinned && <Pin size={12} className="muted" />}{un > 0 && <span className="inbbadge">{un}</span>}</span></span>
                  </span>
                </a>
              );
            })}
          </div>
        </aside>
      )}
      {showConv && (th ? <Conversation th={th} key={th.id} onBack={phone ? () => go("/app/inbox") : undefined} /> : <div className="card inbempty"><Store size={34} className="muted" /><h3>{t("inb.pick")}</h3><p className="muted">{t("inb.pick.sub")}</p><button onClick={() => setCompose(true)}><Plus size={16} /> {t("inb.new")}</button></div>)}
      {compose && <Compose onClose={() => setCompose(false)} />}
    </div>
  );
}
const last = (x: Thread) => x.msgs[x.msgs.length - 1]?.at ?? x.createdAt;

function Compose({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const s = useStore();
  const [sup, setSup] = useState("");
  const [ev, setEv] = useState(s.events[0]?.id ?? "");
  const [text, setText] = useState("");
  const go2 = () => {
    if (!sup || !text.trim()) return;
    const ex = s.threads.find((x) => x.supplierId === sup && x.eventId === ev);
    const id = ex?.id ?? uid();
    update((st) => {
      let th = st.threads.find((x) => x.id === id);
      if (!th) { th = { id, supplierId: sup, eventId: ev, pinned: false, archived: false, muted: false, createdAt: Date.now(), msgs: [] }; st.threads.push(th); }
      th.archived = false; th.msgs.push({ id: uid(), from: "me", text: text.trim(), at: Date.now(), read: true });
    });
    onClose(); location.hash = `#/app/inbox/${id}`;
  };
  return (
    <Modal title={t("inb.new")} onClose={onClose}>
      <div className="form">
        <div className="full"><label htmlFor="ncs">{t("inb.supplier")} *</label>
          <select id="ncs" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">—</option>{SUPPLIER_CATEGORIES.map((c) => <optgroup key={c} label={t("supc." + c)}>{SUPPLIERS.filter((x) => x.category === c).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select></div>
        <div className="full"><label htmlFor="nce">{t("inb.event")}</label><select id="nce" value={ev} onChange={(e) => setEv(e.target.value)}>{s.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div className="full"><label htmlFor="nct">{t("inb.message")} *</label><textarea id="nct" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={!sup || !text.trim()} onClick={go2}><Send size={15} /> {t("support.send")}</button></div>
      </div>
    </Modal>
  );
}

function Conversation({ th, onBack }: { th: Thread; onBack?: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const sup = supOf(th.supplierId);
  const ev = s.events.find((e) => e.id === th.eventId);
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const [tasked, setTasked] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const patch = (fn: (x: Thread) => void) => update((st) => { const x = st.threads.find((y) => y.id === th.id); if (x) fn(x); });
  useEffect(() => { if (th.msgs.some((m) => m.from === "them" && !m.read)) patch((x) => x.msgs.forEach((m) => { m.read = true; })); }); // eslint-disable-line
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [th.msgs.length, typing]);
  const send = (body = text) => {
    const v = body.trim(); if (!v && !file) return;
    patch((x) => { x.msgs.push({ id: uid(), from: "me", text: v, at: Date.now(), read: true, attach: file ?? undefined }); });
    setText(""); setFile(null); setTyping(true);
    setTimeout(() => { // prototype: the supplier answers automatically
      setTyping(false);
      update((st) => { const x = st.threads.find((y) => y.id === th.id); if (!x) return; const here = location.hash.includes(th.id); x.msgs.push({ id: uid(), from: "them", text: t("sup.autoreply", { name: sup?.name ?? "" }), at: Date.now(), read: here }); });
    }, 1600);
  };
  const quote = (m: InboxMsg, ok: boolean) => patch((x) => { const mm = x.msgs.find((y) => y.id === m.id); if (mm?.quote) mm.quote.status = ok ? "accepted" : "declined"; x.msgs.push({ id: uid(), from: "me", text: t(ok ? "inb.quote.sayok" : "inb.quote.sayno"), at: Date.now(), read: true }); });
  const makeTask = (m: InboxMsg) => {
    const e = ev ?? s.events[0]; if (!e) return;
    const body = m.key ? t(m.key) : m.text;
    update((st) => { st.tasks.push(newTask({ eventId: e.id, name: `${sup?.name}: ${body.length > 70 ? body.slice(0, 67) + "…" : body}`, statusId: e.statuses[0]?.id ?? "", assignees: [st.userName], due: iso(3), description: body })); });
    setTasked((a) => [...a, m.id]);
  };
  const days: [string, InboxMsg[]][] = [];
  th.msgs.forEach((m) => { const d = new Date(m.at).toLocaleDateString(locale, { dateStyle: "full" }); const g = days[days.length - 1]; if (g && g[0] === d) g[1].push(m); else days.push([d, [m]]); });
  const quicks = ["inb.qr.1", "inb.qr.2", "inb.qr.3"];
  return (
    <section className="card inbconv" aria-label={sup?.name}>
      <header className="inbhead">
        {onBack && <button className="ghost icon" aria-label={t("back")} onClick={onBack}><ArrowLeft size={18} /></button>}
        <Avatar sup={sup} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}><b className="ell" style={{ display: "block" }}>{sup?.name}</b><span className="muted small">{sup ? t("supc." + sup.category) : ""} · {sup?.city}</span></div>
        <select aria-label={t("inb.event")} value={th.eventId} onChange={(e) => patch((x) => { x.eventId = e.target.value; })} style={{ width: "auto", maxWidth: 190 }}>{s.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <span className="row" style={{ gap: 0, flexWrap: "nowrap" }}>
          <button className="ghost icon" aria-label={t(th.pinned ? "inb.unpin" : "inb.pin")} title={t(th.pinned ? "inb.unpin" : "inb.pin")} onClick={() => patch((x) => { x.pinned = !x.pinned; })}>{th.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
          <button className="ghost icon" aria-label={t(th.muted ? "inb.unmute" : "inb.mute")} title={t(th.muted ? "inb.unmute" : "inb.mute")} onClick={() => patch((x) => { x.muted = !x.muted; })}>{th.muted ? <Bell size={16} /> : <BellOff size={16} />}</button>
          <button className="ghost icon" aria-label={t("inb.markunread")} title={t("inb.markunread")} onClick={() => { patch((x) => { const l = x.msgs.filter((m) => m.from === "them").slice(-1)[0]; if (l) l.read = false; }); go("/app/inbox"); }}><MailOpen size={16} /></button>
          <button className="ghost icon" aria-label={t(th.archived ? "inb.unarchive" : "inb.archive")} title={t(th.archived ? "inb.unarchive" : "inb.archive")} onClick={() => { patch((x) => { x.archived = !x.archived; }); go("/app/inbox"); }}>{th.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
        </span>
      </header>
      <div className="inbmsgs" ref={box} aria-live="polite">
        {days.map(([d, ms]) => (
          <div key={d}>
            <div className="inbday"><span>{d}</span></div>
            {ms.map((m) => (
              <div key={m.id} className={`inbmsg ${m.from}`}>
                <div className="inbbub">
                  {(m.key || m.text) && <p>{m.key ? t(m.key) : m.text}</p>}
                  {m.attach && <div className="inbfile"><Paperclip size={14} /> <span className="ell">{m.attach.name}</span> <span className="muted small">{kb(m.attach.size)}</span></div>}
                  {m.quote && (
                    <div className={`inbquote ${m.quote.status}`}>
                      <span className="muted small">{t("inb.quote")}</span>
                      <b style={{ fontSize: "1.25rem" }}>{money(m.quote.amount, locale)}</b>
                      {m.quote.status === "pending" ? <div className="row" style={{ gap: 6 }}><button className="sm" onClick={() => quote(m, true)}><ThumbsUp size={14} /> {t("inb.accept")}</button><button className="ghost sm" onClick={() => quote(m, false)}><ThumbsDown size={14} /> {t("inb.decline")}</button></div>
                        : <span className="pill" style={{ background: m.quote.status === "accepted" ? "var(--teal)" : "var(--rose)", color: "#0c1a18", width: "fit-content" }}>{t("inb.quote." + m.quote.status)}</span>}
                    </div>
                  )}
                  <div className="inbmeta">
                    <span>{new Date(m.at).toLocaleTimeString(locale, { timeStyle: "short" })}</span>
                    {m.from === "me" && <span title={t("inb.read")}><CheckCheck size={13} /></span>}
                    {m.from === "them" && (tasked.includes(m.id) ? <span style={{ color: "var(--teal)" }}><Check size={12} /> {t("ag.task.done")}</span> : <button className="ghost sm inbtask" onClick={() => makeTask(m)}><ListTodo size={12} /> {t("ag.task.make")}</button>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {typing && <div className="inbmsg them"><div className="inbbub typing" aria-label={t("inb.typing")}><i /><i /><i /></div></div>}
      </div>
      <footer className="inbcomposer">
        <div className="row" style={{ gap: 4, marginBottom: 6 }}>{quicks.map((k) => <button key={k} className="chip" onClick={() => send(t(k))}>{t(k)}</button>)}</div>
        {file && <div className="inbfile" style={{ marginBottom: 6 }}><Paperclip size={14} /> {file.name} <span className="muted small">{kb(file.size)}</span> <button className="ghost icon" aria-label={t("delete")} onClick={() => setFile(null)}>×</button></div>}
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end", gap: 6 }}>
          <label className="ghost icon filebtn" title={t("inb.attach")} aria-label={t("inb.attach")} style={{ padding: 8 }}><Paperclip size={18} /><input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile({ name: f.name, size: f.size }); e.target.value = ""; }} /></label>
          <textarea rows={1} value={text} placeholder={t("chat.ph")} aria-label={t("chat.ph")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} style={{ flex: 1, resize: "none", maxHeight: 120 }} />
          <button onClick={() => send()} disabled={!text.trim() && !file}><Send size={16} /> <span className="hide-sm">{t("support.send")}</span></button>
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>{t("inb.enter")}</div>
      </footer>
    </section>
  );
}

/* ───────────────────────── notifications ───────────────────────── */
function Notifications() {
  const { t } = useT();
  const s = useStore();
  const ago = useAgo();
  const [type, setType] = useState<"all" | NotifType>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const list = s.notifs.filter((n) => (type === "all" || n.type === type) && (!onlyUnread || !n.read));
  const today = new Date().toDateString();
  const groups: [string, typeof list][] = [[t("inb.today"), list.filter((n) => new Date(n.at).toDateString() === today)], [t("inb.earlier"), list.filter((n) => new Date(n.at).toDateString() !== today)]];
  const open = (id: string, href: string) => { update((st) => { const n = st.notifs.find((x) => x.id === id); if (n) n.read = true; }); go(href); };
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 4 }}>
          {(["all", ...NOTIF_TYPES] as const).map((k) => <button key={k} className={`chip${type === k ? " on" : ""}`} aria-pressed={type === k} onClick={() => setType(k)}>{t(k === "all" ? "inb.f.all" : "inb.t." + k)}</button>)}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <label className="row small" style={{ margin: 0, gap: 4, color: "var(--ink)" }}><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />{t("inb.f.unread")}</label>
          <button className="ghost sm" disabled={!s.notifs.some((n) => !n.read)} onClick={() => update((st) => { st.notifs.forEach((n) => { n.read = true; }); })}><CheckCheck size={14} /> {t("inb.markall")}</button>
          <button className="ghost icon" aria-label={t("inb.prefs")} title={t("inb.prefs")} onClick={() => setPrefs(true)}><Settings size={16} /></button>
        </div>
      </div>
      {list.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 24 }}><Bell size={24} style={{ display: "block", margin: "0 auto 6px" }} />{t("inb.n.empty")}</p>}
      {groups.map(([label, rows]) => rows.length > 0 && (
        <div key={label}>
          <div className="muted small" style={{ margin: "10px 0 4px", fontWeight: 600 }}>{label}</div>
          {rows.map((n) => (
            <button key={n.id} className={`notif${n.read ? "" : " unread"}`} onClick={() => open(n.id, n.href)}>
              <span className="nico">{NICON[n.type]}</span>
              <span style={{ flex: 1, textAlign: "left" }}><span style={{ display: "block" }}>{t(n.key, n.vars)}</span><span className="muted small">{t("inb.t." + n.type)} · {ago(n.at)}</span></span>
              {!n.read && <span className="inbdot" aria-label={t("inb.f.unread")} />}
            </button>
          ))}
        </div>
      ))}
      {prefs && (
        <Modal title={t("inb.prefs")} onClose={() => setPrefs(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>{t("inb.prefs.sub")}</p>
          {NOTIF_TYPES.map((k) => <label key={k} className="row between" style={{ margin: "6px 0", color: "var(--ink)" }}><span className="row" style={{ gap: 8 }}>{NICON[k]} {t("inb.t." + k)}</span><input type="checkbox" style={{ width: "auto" }} checked={s.inboxPrefs.types[k] !== false} onChange={(e) => update((st) => { st.inboxPrefs.types[k] = e.target.checked; })} /></label>)}
          <label htmlFor="dg" style={{ marginTop: 12 }}>{t("inb.digest")}</label>
          <select id="dg" value={s.inboxPrefs.digest} onChange={(e) => update((st) => { st.inboxPrefs.digest = e.target.value as "off" | "daily" | "weekly"; })}>{(["off", "daily", "weekly"] as const).map((d) => <option key={d} value={d}>{t("inb.digest." + d)}</option>)}</select>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button onClick={() => setPrefs(false)}>{t("done")}</button></div>
        </Modal>
      )}
    </div>
  );
}
