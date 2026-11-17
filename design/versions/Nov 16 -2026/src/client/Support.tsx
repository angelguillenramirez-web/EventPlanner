import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { getState, uid, update, useStore, type Support } from "../store";
import { X } from "../icons";
import { fetchChat, fetchStatuses, sendChat, sendRequest, type LiveMsg } from "../bridge";

const CHAT_KEY = "ep-live-chat-id";
const readId = () => { try { return localStorage.getItem(CHAT_KEY) ?? ""; } catch { return ""; } };
const saveId = (v: string) => { try { v ? localStorage.setItem(CHAT_KEY, v) : localStorage.removeItem(CHAT_KEY); } catch { /* private mode */ } };

/** Floating customer-support button (always visible) + panel with chat and requests. */
export default function SupportWidget() {
  const s = useStore();
  const { t, locale } = useT();
  const [tab, setTab] = useState<"chat" | "requests">("chat");
  const [f, setF] = useState({ subject: "", message: "", kind: "support" as "support" | "design" });
  const [msg, setMsg] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const [chatId, setChatId] = useState(readId);
  const [live, setLive] = useState<LiveMsg[]>([]);
  const [closed, setClosed] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [s.chat.length, live.length, tab, s.supportOpen]);
  // while the panel is open: pull the agents' answers to the live chat
  useEffect(() => {
    if (!s.supportOpen || !chatId) return;
    let alive = true;
    const tick = async () => { const r = await fetchChat(chatId); if (!alive || !r) return; setLive(r.messages); setClosed(r.closed); };
    tick(); const i = setInterval(tick, 2500); return () => { alive = false; clearInterval(i); };
  }, [s.supportOpen, chatId]);
  const setOpen = (v: boolean) => update((st) => { st.supportOpen = v; });

  const deliver = async (r: { id: string; subject: string; message: string; kind?: "support" | "design" }) => {
    const ref = await sendRequest({ kind: r.kind ?? "support", title: r.subject, description: r.message, customerName: getState().userName, customerEmail: getState().userEmail });
    if (ref) update((st) => { const x = st.support.find((y) => y.id === r.id); if (x) x.ref = ref; });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r: Support = { id: uid(), subject: f.subject.trim(), message: f.message.trim(), status: "open", createdAt: Date.now(), kind: f.kind, ref: "" };
    update((st) => { st.support.unshift(r); });
    deliver(r);
    setF({ subject: "", message: "", kind: "support" });
  };
  // while the panel is open: retry requests that could not be delivered and pull the staff team's progress
  useEffect(() => {
    if (!s.supportOpen) return;
    const tick = async () => {
      const cur = getState().support;
      for (const r of cur.filter((x) => x.ref === "")) await deliver(r);
      const refs = getState().support.map((x) => x.ref).filter((x): x is string => !!x);
      const st = await fetchStatuses(refs);
      update((state) => { for (const r of state.support) { const x = r.ref ? st[r.ref] : undefined; if (x) { r.taskId = x.taskId; r.remote = x.status; r.replies = x.replies ?? []; r.status = x.status === "done" || (x.replies?.length ?? 0) > 0 ? "answered" : "open"; } } });
    };
    tick(); const i = setInterval(tick, 5000); return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.supportOpen]);
  const send = async () => {
    const text = msg.trim();
    if (!text) return;
    setMsg(""); setOffline(false);
    const id = await sendChat({ chatId: closed ? "" : chatId, text, customerName: getState().userName, customerEmail: getState().userEmail });
    if (!id) { setMsg(text); setOffline(true); return; }
    if (id !== chatId) { saveId(id); setChatId(id); setLive([]); setClosed(false); }
    const r = await fetchChat(id); if (r) { setLive(r.messages); setClosed(r.closed); }
  };
  const newChat = () => { saveId(""); setChatId(""); setLive([]); setClosed(false); };

  return (
    <>
      {s.supportOpen && (
        <section className="support-panel" aria-label={t("nav.support")}>
          <div className="row between" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <b>{t("nav.support")}</b>
            <button className="ghost icon" aria-label={t("close")} onClick={() => setOpen(false)}><X size={16} /></button>
          </div>
          <div className="tabs" style={{ margin: 0, padding: "0 8px" }}>
            <a href="#" aria-current={tab === "chat" ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab("chat"); }}>{t("chat.title")}</a>
            <a href="#" aria-current={tab === "requests" ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab("requests"); }}>{t("support.mine")}</a>
          </div>
          <div style={{ padding: 14, overflowY: "auto", flex: 1 }}>
            {tab === "chat" ? (
              <>
                <div className="chat" ref={box} aria-live="polite">{s.chat.slice(0, 1).map((m) => <div key={m.id} className="msg">{m.text}</div>)}{live.map((m) => <div key={m.id} className={`msg${m.from === "me" ? " me" : ""}`}>{m.text}</div>)}</div>
                {offline && <div className="alert" role="alert" style={{ marginTop: 8 }}>{t("chat.offline")}</div>}
                {closed && <div className="muted small" style={{ marginTop: 8 }}>{t("chat.closed")} <button className="ghost sm" onClick={newChat}>{t("chat.new")}</button></div>}
                <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
                  <input style={{ flex: 1 }} value={msg} aria-label={t("chat.ph")} placeholder={t("chat.ph")} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} />
                  <button onClick={() => void send()}>{t("support.send")}</button>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={submit} className="grid" style={{ gap: 10 }}>
                  <div><label htmlFor="sk">{t("support.type")}</label><select id="sk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "support" | "design" })}><option value="support">{t("support.type.help")}</option><option value="design">{t("support.type.design")}</option></select></div>
                  <div><label htmlFor="ss">{t("support.subject")}</label><input id="ss" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
                  <div><label htmlFor="sm">{t("message")}</label><textarea id="sm" rows={3} required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
                  <button>{t("support.send")}</button>
                </form>
                {s.support.map((r) => (
                  <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <div className="row between"><b>{r.subject}</b><span className="badge">{r.remote ? t("support.st." + r.remote) : t("support." + r.status)}</span></div>
                    {r.taskId && <div className="muted small">{t("support.ticket")} {r.taskId}</div>}
                    {r.ref === "" && <div className="muted small">{t("support.pending")}</div>}
                    {r.replies?.map((x, i) => <div key={i} className="msg" style={{ margin: "6px 0 0" }}>{x.text}</div>)}
                    <div className="muted small">{new Date(r.createdAt).toLocaleDateString(locale)} · {r.message}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
