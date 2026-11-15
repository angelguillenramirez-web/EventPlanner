import { useEffect, useMemo, useRef, useState } from "react";
import { dmChannel, markRead, sendMsg, uid, unreadIn, update, useStore, type Channel, type Msg, type Staff } from "../store";
import { Avatar, Modal, readAvatar } from "../ui";
import { Image as ImageIcon, Pin, Plus, Search, Send, Smile, Users, X } from "../icons";

/** Internal staff chat: groups, direct messages, emoji, stickers, animated GIF-style reactions, pictures, replies, reactions, pins and search. */
const EMOJI: Record<string, string> = {
  "😀": "😀😃😄😁😆😅😂🤣🙂😉😊😇🥰😍🤩😘😋😛😜🤪🤔🤗🤭🫡😎🥳😏😒🙄😬😮😯😴🤤😷🤒🤯😱😢😭😤😡🥺😳🫠",
  "👍": "👍👎👌✌️🤞🤟🤘👏🙌🫶🙏💪👋🤝✍️👀🧠❤️🧡💛💚💙💜🖤🤍💔💯✅❌⚠️❓❗⭐🌟✨🔥💥🎉🎊",
  "🍕": "🍕🍔🌮🍣🍝🥗🍰🎂🍪🍩🍫🍿☕🍵🥂🍷🍺🍎🍌🍇🍓🥑🌽🥐",
  "⚽": "⚽🏀🎮🎧🎸🎨🎬📷🚀✈️🚗🏖️🏔️🎁🎈🎀📅📌📎💡🔔🔒🔑💻📱🖥️📝📊📈",
};
const STICKERS = ["🥳", "😎", "🤝", "🙌", "💯", "🔥", "👏", "🫶", "😂", "🤯", "😴", "🫡", "☕", "🍕", "🎉", "🚀", "✅", "🆘", "👀", "🤔"];
const GIFS: [string, string][] = [["an-bounce", "🎉"], ["an-bounce", "🥳"], ["an-spin", "🌟"], ["an-shake", "😂"], ["an-pulse", "❤️"], ["an-pulse", "🔥"], ["an-bounce", "👏"], ["an-shake", "👋"], ["an-spin", "🍕"], ["an-bounce", "🚀"], ["an-pulse", "💯"], ["an-shake", "😱"]];
const QUICK = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

export default function Chat({ me }: { me: Staff }) {
  const s = useStore();
  const [cur, setCur] = useState<string>("general");
  const [showPane, setShowPane] = useState(false); // phone: list ↔ conversation
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState(false);
  const [q, setQ] = useState("");
  const mine = s.channels.filter((c) => c.members.includes(me.id));
  const nameOf = (c: Channel) => (c.kind === "dm" ? s.staff.find((m) => m.id === c.members.find((x) => x !== me.id))?.name ?? "Colleague" : "# " + c.name);
  const groups = mine.filter((c) => c.kind === "group"), dms = mine.filter((c) => c.kind === "dm");
  const others = s.staff.filter((m) => m.id !== me.id && m.active && !dms.some((c) => c.members.includes(m.id)));
  const ch = mine.find((c) => c.id === cur) ?? groups[0];
  const row = (c: Channel) => {
    const n = unreadIn(s, me.id, c.id);
    const peer = c.kind === "dm" ? s.staff.find((m) => m.id === c.members.find((x) => x !== me.id)) : undefined;
    return <button key={c.id} className="ch row" aria-current={ch?.id === c.id} style={{ flexWrap: "nowrap", gap: 8 }} onClick={() => { setCur(c.id); setShowPane(true); }}>
      {peer ? <Avatar m={peer} size={24} dot /> : <Users size={16} />}<span className="grow">{nameOf(c).replace(/^# /, "")}</span>{n > 0 && <span className="navbadge">{n}</span>}</button>;
  };
  return (
    <>
      <h1>Team chat</h1>
      <div className={`card chat${showPane ? " open" : ""}`}>
        <div className="list">
          <div className="row between" style={{ padding: "2px 4px 6px" }}><b className="small muted">GROUPS</b><button className="ghost sm icon" aria-label="New group" title="New group" onClick={() => setCreating(true)}><Plus size={14} /></button></div>
          {groups.map(row)}
          <div style={{ padding: "10px 4px 6px" }}><b className="small muted">DIRECT MESSAGES</b></div>
          {dms.map(row)}
          {others.map((m) => <button key={m.id} className="ch row" style={{ flexWrap: "nowrap", gap: 8, opacity: .8 }} onClick={() => { const c = dmChannel(me.id, m.id); setCur(c.id); setShowPane(true); }}><Avatar m={m} size={24} dot /><span className="grow">{m.name}</span><span className="muted small">message</span></button>)}
        </div>
        {ch ? <Pane key={ch.id} me={me} ch={ch} title={nameOf(ch)} q={q} setQ={setQ} onBack={() => setShowPane(false)} onSettings={() => setSettings(true)} /> : <div className="pane" style={{ padding: 20 }}>Pick a conversation.</div>}
      </div>
      {creating && <NewGroup me={me} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); setCur(id); setShowPane(true); }} />}
      {settings && ch && ch.kind === "group" && <GroupSettings me={me} ch={ch} onClose={() => setSettings(false)} />}
    </>
  );
}

function Pane({ me, ch, title, q, setQ, onBack, onSettings }: { me: Staff; ch: Channel; title: string; q: string; setQ: (v: string) => void; onBack: () => void; onSettings: () => void }) {
  const s = useStore();
  const end = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [picker, setPicker] = useState<"" | "emoji" | "sticker" | "gif">("");
  const [cat, setCat] = useState(Object.keys(EMOJI)[0]);
  const [pinsOnly, setPinsOnly] = useState(false);
  const [err, setErr] = useState("");
  const msgs = useMemo(() => s.messages.filter((m) => m.ch === ch.id && (!pinsOnly || m.pinned) && (!q || (!m.deleted && m.text.toLowerCase().includes(q.toLowerCase())))), [s, ch.id, q, pinsOnly]);
  const who = (id: string) => s.staff.find((m) => m.id === id);
  const first = (id: string) => who(id)?.name.split(" ")[0] ?? "Former member";
  useEffect(() => { markRead(me.id, ch.id); end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, ch.id, me.id]);
  const send = () => {
    const t = text.trim(); if (!t) return;
    if (edit) update((x) => { const m = x.messages.find((y) => y.id === edit); if (m && m.by === me.id) { m.text = t; m.edited = true; } });
    else sendMsg(ch.id, me.id, { text: t, replyTo: reply ?? undefined });
    setText(""); setReply(null); setEdit(null); setPicker("");
  };
  const react = (m: Msg, e: string) => update((x) => { const y = x.messages.find((z) => z.id === m.id)!; const l = y.reactions[e] ?? []; const on = l.includes(me.id); const n = on ? l.filter((i) => i !== me.id) : [...l, me.id]; if (n.length) y.reactions[e] = n; else delete y.reactions[e]; });
  const pic = async (f?: File) => { if (!f) return; setErr(""); try { sendMsg(ch.id, me.id, { img: await readAvatar(f, 420), text: "" }); } catch { setErr("That file is not a picture."); } };
  const render = (t: string) => t.split(/(@\w+)/g).map((p, i) => (p.startsWith("@") && s.staff.some((m) => m.name.split(" ")[0].toLowerCase() === p.slice(1).toLowerCase()) ? <mark key={i}>{p}</mark> : p));
  const members = ch.members.map(who).filter(Boolean) as Staff[];
  const sticker = (v: string) => { const [a, e] = v.includes(":") ? v.split(":") : ["", v]; return <div className="sticker"><span className={a}>{e}</span></div>; };
  const pick = (e: string) => setText((t) => t + e);
  return (
    <div className="pane">
      <div className="head">
        <button className="ghost sm onlyphone" onClick={onBack} aria-label="Back to the list">‹</button>
        <b>{title}</b>{ch.kind === "group" && <span className="muted small">{members.length} members{ch.topic ? " · " + ch.topic : ""}</span>}
        <span className="grow" />
        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <span style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 8, top: 10, opacity: .5 }} /><input aria-label="Search messages" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 130, paddingLeft: 26 }} /></span>
          <button className="ghost sm icon" aria-pressed={pinsOnly} title="Pinned messages" aria-label="Pinned messages" onClick={() => setPinsOnly(!pinsOnly)}><Pin size={14} /></button>
          {ch.kind === "group" && <button className="ghost sm icon" title="Members and settings" aria-label="Members and settings" onClick={onSettings}><Users size={14} /></button>}
        </div>
      </div>
      <div className="msgs" role="log" aria-live="polite">
        {msgs.length === 0 && <p className="muted">{q || pinsOnly ? "No messages found." : "No messages yet. Say hello 👋"}</p>}
        {msgs.map((m) => {
          const a = who(m.by); const mineM = m.by === me.id; const re = m.replyTo ? s.messages.find((x) => x.id === m.replyTo) : undefined;
          return (
            <div key={m.id} className={`msg${mineM ? " me" : ""}`}>
              {a ? <Avatar m={a} size={30} dot /> : <Avatar m={{ name: "?", avatar: "" }} size={30} />}
              <div style={{ minWidth: 0 }}>
                <div className="small muted"><b style={{ color: "var(--ink)" }}>{a?.name ?? "Former member"}</b> · {new Date(m.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}{m.edited && " · edited"}{m.pinned && " · 📌"}</div>
                {m.deleted ? <div className="bub muted"><i>Message deleted</i></div> : m.sticker ? sticker(m.sticker) : (
                  <div className="bub">
                    {re && <div className="quote">{first(re.by)}: {re.deleted ? "deleted message" : re.text || (re.img ? "📷 Picture" : re.sticker ? "Sticker" : "")}</div>}
                    {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{render(m.text)}</div>}
                    {m.img && <img className="pic" src={m.img} alt="Shared picture" />}
                  </div>
                )}
                <div>{Object.entries(m.reactions).map(([e, l]) => <button key={e} className={`rx${l.includes(me.id) ? " on" : ""}`} title={l.map(first).join(", ")} onClick={() => react(m, e)}>{e} {l.length}</button>)}</div>
                {!m.deleted && (
                  <div className="tools">
                    {QUICK.slice(0, 3).map((e) => <button key={e} className="ghost sm" aria-label={`React ${e}`} onClick={() => react(m, e)}>{e}</button>)}
                    <button className="ghost sm" aria-label="More reactions" onClick={() => { const e = prompt("Reaction (an emoji):", "🎉"); if (e?.trim()) react(m, e.trim().slice(0, 4)); }}>＋</button>
                    <button className="ghost sm" onClick={() => setReply(m.id)}>Reply</button>
                    <button className="ghost sm" onClick={() => update((x) => { const y = x.messages.find((z) => z.id === m.id)!; y.pinned = !y.pinned; })}>{m.pinned ? "Unpin" : "Pin"}</button>
                    {mineM && !m.sticker && !m.img && <button className="ghost sm" onClick={() => { setEdit(m.id); setText(m.text); }}>Edit</button>}
                    {(mineM || me.role === "super_admin") && <button className="ghost sm" onClick={() => { if (confirm("Delete this message?")) update((x) => { const y = x.messages.find((z) => z.id === m.id)!; y.deleted = true; y.text = ""; y.img = undefined; y.sticker = undefined; }); }}>Delete</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="composer">
        {picker && (
          <div className="picker" role="dialog" aria-label="Emoji, stickers and GIFs">
            <div className="cats">
              {picker === "emoji" ? Object.keys(EMOJI).map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} aria-label={`Category ${c}`}>{c}</button>) : <b className="small" style={{ padding: 4 }}>{picker === "sticker" ? "Stickers" : "Animated GIFs"}</b>}
              <span className="grow" /><button aria-label="Close" onClick={() => setPicker("")}><X size={14} /></button>
            </div>
            {picker === "emoji" && <div className="gridp">{[...EMOJI[cat].matchAll(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu)].map((m) => m[0]).map((e, i) => <button key={i} onClick={() => pick(e)}>{e}</button>)}</div>}
            {picker === "sticker" && <div className="gridp big">{STICKERS.map((e) => <button key={e} aria-label={`Send sticker ${e}`} onClick={() => { sendMsg(ch.id, me.id, { sticker: e }); setPicker(""); }}>{e}</button>)}</div>}
            {picker === "gif" && <div className="gridp big">{GIFS.map(([a, e], i) => <button key={i} aria-label={`Send animated ${e}`} onClick={() => { sendMsg(ch.id, me.id, { sticker: `${a}:${e}` }); setPicker(""); }}><span className={a}>{e}</span></button>)}</div>}
          </div>
        )}
        {(reply || edit) && <div className="row between small muted"><span>{edit ? "Editing your message" : `Replying to ${first(s.messages.find((m) => m.id === reply)?.by ?? "")}`}</span><button className="ghost sm" onClick={() => { setReply(null); setEdit(null); setText(""); }}>Cancel</button></div>}
        {err && <div className="alert" role="alert">{err}</div>}
        <div className="row">
          <button className="ghost icon" aria-label="Emoji" title="Emoji" aria-pressed={picker === "emoji"} onClick={() => setPicker(picker === "emoji" ? "" : "emoji")}><Smile size={18} /></button>
          <button className="ghost sm" aria-label="Stickers" title="Stickers" onClick={() => setPicker(picker === "sticker" ? "" : "sticker")}>Stickers</button>
          <button className="ghost sm" aria-label="GIFs" title="Animated GIFs" onClick={() => setPicker(picker === "gif" ? "" : "gif")}>GIF</button>
          <label className="btn ghost icon" style={{ margin: 0, cursor: "pointer" }} title="Send a picture" aria-label="Send a picture"><ImageIcon size={18} /><input type="file" accept="image/*" hidden onChange={(e) => { pic(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <textarea rows={1} aria-label="Message" placeholder={`Message ${title.replace(/^# /, "#")} — use @name to mention`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button aria-label="Send" onClick={send} disabled={!text.trim()}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function NewGroup({ me, onClose, onDone }: { me: Staff; onClose: () => void; onDone: (id: string) => void }) {
  const s = useStore();
  const [name, setName] = useState(""); const [topic, setTopic] = useState(""); const [sel, setSel] = useState<string[]>([]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); const n = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); if (!n) return;
    const c: Channel = { id: uid(), name: n, kind: "group", members: [me.id, ...sel], by: me.id, at: Date.now(), topic: topic.trim() };
    update((x) => { x.channels.push(c); }); sendMsg(c.id, me.id, { text: `created the group #${n}` }); onDone(c.id);
  };
  return (
    <Modal title="New group" onClose={onClose}>
      <form className="grid" style={{ gap: 12 }} onSubmit={submit}>
        <div><label htmlFor="gn">Group name *</label><input id="gn" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. weekend-cover" /></div>
        <div><label htmlFor="gt">Topic</label><input id="gt" value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
        <div><label>Members</label><div className="tagrow">{s.staff.filter((m) => m.id !== me.id && m.active).map((m) => <button type="button" key={m.id} className="tagbtn row" style={{ gap: 5 }} aria-pressed={sel.includes(m.id)} onClick={() => setSel(sel.includes(m.id) ? sel.filter((x) => x !== m.id) : [...sel, m.id])}><Avatar m={m} size={16} />{m.name}</button>)}</div></div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button disabled={!name.trim()}>Create group</button></div>
      </form>
    </Modal>
  );
}

function GroupSettings({ me, ch, onClose }: { me: Staff; ch: Channel; onClose: () => void }) {
  const s = useStore();
  const admin = ch.by === me.id || me.role === "super_admin";
  const set = (fn: (c: Channel) => void) => update((x) => { const c = x.channels.find((y) => y.id === ch.id); if (c) fn(c); });
  return (
    <Modal title={`# ${ch.name}`} onClose={onClose}>
      <div className="grid" style={{ gap: 12 }}>
        {admin && <div><label htmlFor="gtt">Topic</label><input id="gtt" defaultValue={ch.topic} onBlur={(e) => set((c) => { c.topic = e.target.value.trim(); })} /></div>}
        <div><label>Members ({ch.members.length})</label>
          {ch.members.map((id) => { const m = s.staff.find((x) => x.id === id); return m ? <div key={id} className="row between" style={{ padding: "4px 0" }}><span className="row"><Avatar m={m} size={26} dot />{m.name}<span className="muted small">{m.title}</span></span>{admin && id !== me.id && <button className="ghost sm" onClick={() => set((c) => { c.members = c.members.filter((x) => x !== id); })}>Remove</button>}</div> : null; })}</div>
        {admin && s.staff.some((m) => m.active && !ch.members.includes(m.id)) && <div><label>Add people</label><div className="tagrow">{s.staff.filter((m) => m.active && !ch.members.includes(m.id)).map((m) => <button key={m.id} className="tagbtn" onClick={() => set((c) => { c.members.push(m.id); })}>+ {m.name}</button>)}</div></div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          {ch.id !== "general" ? <button className="danger" onClick={() => { if (confirm("Leave this group?")) { set((c) => { c.members = c.members.filter((x) => x !== me.id); }); onClose(); } }}>Leave group</button> : <span className="muted small">Everyone stays in #general.</span>}
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
