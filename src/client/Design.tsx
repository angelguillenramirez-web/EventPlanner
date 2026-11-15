import { useState } from "react";
import { useT } from "../i18n";
import { COLORS, openUpsell, uid, update, useStore, me, type Comment, type EventT, type Invitation } from "../store";
import { ChevronDown, Heart, LayoutTemplate, LockI, MessageCircle, Plus, Send, Sparkles, X } from "../icons";
import { TEMPLATE_IDS, invitationDoc, templateHtml, type TplText } from "../invitationTemplates";
import { sendRequest } from "../bridge";
import { Modal } from "./ui";
import ApprovalButton from "./Approval";
import Thumb from "./InvThumb";
import { readImage } from "./MenuTab";

const IDEAS: Record<string, { title: string; message: string; template: string; color: string; font: string }[]> = {
  wedding: [{ title: "Con amor, nos casamos", message: "Hoy y siempre. Acompáñanos a celebrar el comienzo de nuestra historia.", template: "floral", color: COLORS.rose, font: "serif" },
    { title: "Save the date", message: "Dos corazones, un solo camino. Te esperamos.", template: "gold", color: COLORS.gold, font: "serif" }],
  birthday: [{ title: "¡Hora de festejar!", message: "Música, pastel y mucha diversión. ¡No faltes!", template: "party", color: COLORS.gold, font: "sans" },
    { title: "Un año más de aventuras", message: "Ven a celebrar conmigo.", template: "modern", color: COLORS.blue, font: "sans" }],
  default: [{ title: "Estás invitado", message: "Queremos compartir este momento contigo.", template: "modern", color: COLORS.teal, font: "sans" }],
};

const PALETTE = ["#C7465C", "#F2A541", "#8FB9A8", "#4EB1E8", "#1f2a37", "#f4f1ea", "#8a5cf5", "#e98a3c"];

/** Read-only view of an invitation. Nobody except A plan staff can edit the HTML. */
function PreviewModal({ inv, onClose }: { inv: Invitation; onClose: () => void }) {
  return (
    <Modal title={inv.name} onClose={onClose} wide>
      <iframe title={inv.name} sandbox="" srcDoc={invitationDoc(inv.html, inv.css)} style={{ width: "100%", height: "68vh", border: "1px solid var(--line)", borderRadius: 5, marginTop: 10, background: "#fff" }} />
    </Modal>
  );
}

/** "Create from template" and "Design with AI": pick/generate a design, then only the basic info can be changed. */
function CreateModal({ event, mode, onClose, onCreated }: { event: EventT; mode: "template" | "ai"; onClose: () => void; onCreated: (i: Invitation) => void }) {
  const { t, tn, locale } = useT();
  const [tpl, setTpl] = useState<string | null>(null);
  const [look, setLook] = useState<{ color: string; font: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [f, setF] = useState({ name: new Date().toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }), title: event.name, message: t("design.msg.default"), date: event.date, venue: [event.venue, event.location].filter(Boolean).join(" · ") });
  const texts = (): TplText => ({ title: f.title, message: f.message, date: new Date(f.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" }), typeName: tn(event.type), venue: f.venue });
  const ev = look ? { ...event, design: { ...event.design, ...look } } : event;
  const generate = () => {
    const list = IDEAS[event.type] ?? IDEAS.default, w = prompt.toLowerCase();
    const idea = list.find((i) => (w.includes("gold") || w.includes("dorad")) ? i.template === "gold" : (w.includes("flor") || w.includes("flower")) ? i.template === "floral" : false) ?? list[Math.floor(Math.random() * list.length)];
    setLook({ color: idea.color, font: idea.font }); setTpl(idea.template); setF((x) => ({ ...x, title: idea.title, message: idea.message }));
  };
  const create = () => {
    if (!tpl) return;
    const now = Date.now();
    onCreated({ id: uid(), eventId: event.id, name: f.name.trim() || t("ins.newname"), html: templateHtml(tpl, ev, texts()), css: "", createdAt: now, modifiedAt: now, versions: [], source: mode, comments: [], likes: [] });
  };
  const designing = mode === "ai" && !tpl;
  return (
    <Modal title={mode === "ai" ? t("ins.ai") : t("ins.fromtpl")} onClose={onClose} wide>
      {designing ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>{t("ins.ai.desc")}</p>
          <label htmlFor="aip">{t("ins.ai.prompt")}</label>
          <textarea id="aip" rows={3} autoFocus value={prompt} placeholder={t("ins.ai.ph")} onChange={(e) => setPrompt(e.target.value)} />
          <p className="muted small">{t("ins.ai.example")}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button onClick={generate}><Sparkles size={15} /> {t("ins.ai.go")}</button></div>
        </>
      ) : (
        <div className="invmake">
          <div>
            {mode === "template" && (
              <div className="invgrid mini" style={{ marginBottom: 12 }}>
                {TEMPLATE_IDS.map((id) => (
                  <button type="button" key={id} className={`tplcard${tpl === id ? " selected" : ""}`} aria-pressed={tpl === id} onClick={() => setTpl(id)}>
                    <Thumb html={templateHtml(id, event, texts())} css="" title={t("tpl." + id)} /><b className="small">{t("tpl." + id)}</b>
                  </button>
                ))}
              </div>
            )}
            {mode === "ai" && tpl && <div className="row" style={{ marginBottom: 10 }}><span className="muted small grow">{t("ins.ai.done")}</span><button className="ghost sm" onClick={() => setTpl(null)}><Sparkles size={13} /> {t("ins.ai.again")}</button></div>}
            {tpl && (
              <div className="form">
                <div className="full"><label htmlFor="in">{t("ins.name")}</label><input id="in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="full"><label htmlFor="it">{t("ins.f.title")}</label><input id="it" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                <div className="full"><label htmlFor="im">{t("ins.f.message")}</label><textarea id="im" rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
                <div><label htmlFor="id">{t("date")}</label><input id="id" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
                <div><label htmlFor="iv">{t("location")}</label><input id="iv" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
                <p className="muted small full" style={{ margin: 0 }}>{t("ins.basiconly")}</p>
              </div>
            )}
          </div>
          <div>
            <div className="muted small" style={{ marginBottom: 4 }}>{t("ins.preview")}</div>
            {tpl ? <Thumb html={templateHtml(tpl, ev, texts())} css="" title="preview" /> : <div className="invthumb" style={{ display: "grid", placeItems: "center" }}><span className="muted small">{t("ins.pick")}</span></div>}
          </div>
        </div>
      )}
      {!designing && <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={!tpl} onClick={create}>{t("ins.use")}</button></div>}
    </Modal>
  );
}

/** "Request design": tell the A plan design team what you want; they deliver up to 3 designs. */
function RequestModal({ event, onClose }: { event: EventT; onClose: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const [colors, setColors] = useState<string[]>([]);
  const [colorsTxt, setColorsTxt] = useState("");
  const [tone, setTone] = useState("");
  const [vibe, setVibe] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [images, setImages] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const addImgs = async (files: FileList | null) => {
    if (!files) return;
    try { const got = await Promise.all(Array.from(files).slice(0, 10 - images.length).map((x) => readImage(x))); setImages((p) => [...p, ...got].slice(0, 10)); setErr(""); } catch { setErr(t("menu.imgerr")); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = { id: uid(), eventId: event.id, colors: [...colors, colorsTxt.trim()].filter(Boolean).join(", "), tone: tone.trim(), vibe: vibe.trim(), links: links.map((x) => x.trim()).filter(Boolean), images, ref: "", createdAt: Date.now(), delivered: false };
    update((st) => { st.designRequests.unshift(r); });
    const description = `${event.name} (${event.date})\n${t("ins.req.colors")}: ${r.colors}\n${t("ins.req.tone")}: ${r.tone}\n${t("ins.req.vibe")}: ${r.vibe}\n${r.links.join("\n")}`;
    sendRequest({ kind: "design", title: `${t("ins.request")}: ${event.name}`, description, customerName: s.userName, customerEmail: s.userEmail }).then((ref) => { if (ref) update((st) => { const x = st.designRequests.find((y) => y.id === r.id); if (x) x.ref = ref; }); });
    onClose();
  };
  void locale;
  return (
    <Modal title={t("ins.request")} onClose={onClose} wide>
      <p className="muted small" style={{ marginTop: 0 }}>{t("ins.req.desc")}</p>
      <form onSubmit={submit} className="form">
        <div className="full"><label>{t("ins.req.colors")}</label>
          <div className="row" style={{ gap: 6 }}>{PALETTE.map((c) => <button type="button" key={c} aria-label={c} aria-pressed={colors.includes(c)} className="colorchip" style={{ background: c, outline: colors.includes(c) ? "3px solid var(--ink)" : "none" }} onClick={() => setColors(colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c])} />)}</div>
          <input style={{ marginTop: 8 }} value={colorsTxt} placeholder={t("ins.req.colors.ph")} onChange={(e) => setColorsTxt(e.target.value)} /></div>
        <div><label htmlFor="rt">{t("ins.req.tone")}</label><input id="rt" value={tone} placeholder={t("ins.req.tone.ph")} onChange={(e) => setTone(e.target.value)} /></div>
        <div><label htmlFor="rv">{t("ins.req.vibe")}</label><input id="rv" value={vibe} placeholder={t("ins.req.vibe.ph")} onChange={(e) => setVibe(e.target.value)} /></div>
        <div className="full"><label>{t("ins.req.links")}</label>
          {links.map((l, i) => <input key={i} type="url" style={{ marginBottom: 6 }} value={l} placeholder="https://…" onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))} />)}
          <button type="button" className="ghost sm" onClick={() => setLinks([...links, ""])}><Plus size={13} /> {t("ins.req.addlink")}</button></div>
        <div className="full"><label>{t("ins.req.images")}</label>
          <div className="row" style={{ gap: 8 }}>
            {images.map((src, i) => <span key={i} style={{ position: "relative" }}><img src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }} /><button type="button" className="ghost icon" style={{ position: "absolute", top: -6, right: -6 }} aria-label={t("delete")} onClick={() => setImages(images.filter((_, j) => j !== i))}><X size={12} /></button></span>)}
            {images.length < 10 && <label className="addimg">+<input type="file" accept="image/*" multiple hidden onChange={(e) => { addImgs(e.target.files); e.target.value = ""; }} /></label>}
          </div>
          {err && <p role="alert" style={{ color: "var(--rose)", margin: "6px 0 0" }}>{err}</p>}</div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button><Send size={15} /> {t("ins.req.send")}</button></div>
      </form>
    </Modal>
  );
}

function InvCard({ inv, event, blocked, onOpen }: { inv: Invitation; event: EventT; blocked: string; onOpen: () => void }) {
  const s = useStore();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const who = me(s).name, liked = (inv.likes ?? []).includes(who);
  const patch = (fn: (i: Invitation) => void) => update((st) => { const i = st.invitations.find((x) => x.id === inv.id); if (i) fn(i); });
  const add = () => { const v = text.trim(); if (!v) return; const c: Comment = { id: uid(), by: me(s).name, at: Date.now(), text: v }; patch((i) => { i.comments = [...(i.comments ?? []), c]; }); setText(""); };
  return (
    <div className="card invcard2">
      <div style={{ cursor: "zoom-in" }} onClick={onOpen} title={t("ins.open")}><Thumb html={inv.html} css={inv.css} title={inv.name} /></div>
      <div className="row between" style={{ marginTop: 8, flexWrap: "nowrap" }}>
        <div style={{ minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.name}</b><span className="muted small">{t("ins.src." + (inv.source ?? "template"))}</span></div>
        <span className="row" style={{ gap: 0, flexWrap: "nowrap" }}>
          <button className={`ghost sm likebtn${liked ? " on" : ""}`} aria-pressed={liked} aria-label={liked ? t("task.unlike") : t("task.like")} title={liked ? t("task.unlike") : t("task.like")} onClick={() => patch((i) => { const l = i.likes ?? []; i.likes = liked ? l.filter((x) => x !== who) : [...l, who]; })}><Heart size={15} fill={liked ? "currentColor" : "none"} /> {(inv.likes ?? []).length || ""}</button>
          <button className="ghost sm" aria-expanded={open} aria-label={t("tl.comments")} title={t("tl.comments")} onClick={() => setOpen(!open)}><MessageCircle size={15} /> {(inv.comments ?? []).length || ""}</button>
        </span>
      </div>
      {open && (
        <div className="tlcomments" style={{ marginTop: 6 }}>
          {(inv.comments ?? []).map((c) => (
            <div className="c row between" key={c.id} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <div><div className="who">@{c.by} · {new Date(c.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</div>{c.text}</div>
            </div>
          ))}
          <div className="row" style={{ flexWrap: "nowrap", marginTop: 6 }}>
            <input value={text} placeholder={t("tl.comment.ph")} aria-label={t("tl.comments")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="ghost sm" disabled={!text.trim()} onClick={add}>{t("add")}</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <ApprovalButton event={event} scope="invitations" subject={inv.name} blocked={blocked} summary={() => [inv.name, t("ins.src." + (inv.source ?? "template")), `${(inv.likes ?? []).length} ♥ · ${(inv.comments ?? []).length} ${t("tl.comments").toLowerCase()}`]} snap={() => ({ k: "invitation", html: inv.html, css: inv.css })} />
      </div>
    </div>
  );
}

/** Invitation tab: A plan designs, invitations made from templates / AI, and the three ways to ask for a new one. */
export default function DesignTab({ event }: { event: EventT }) {
  const s = useStore();
  const { t } = useT();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"request" | "template" | "ai" | null>(null);
  const [view, setView] = useState<Invitation | null>(null);
  const all = s.invitations.filter((i) => i.eventId === event.id);
  const staff = all.filter((i) => i.source === "staff").slice(0, 3), mine = all.filter((i) => i.source !== "staff");
  const reqs = s.designRequests.filter((r) => r.eventId === event.id && !r.delivered);
  // only one invitation at a time can go through approval: while one is waiting or approved, the others are blocked
  const busy = s.signoffs.find((x) => x.eventId === event.id && x.scope === "invitations");
  const blockedFor = (i: Invitation) => (busy && busy.subject !== i.name ? t("ins.oneapproval", { name: busy.subject }) : "");
  const deliver = (rid: string) => { // demo: stands in for the A plan designer delivering the designs
    update((st) => {
      const r = st.designRequests.find((x) => x.id === rid); if (!r) return;
      r.delivered = true;
      const ev = st.events.find((e) => e.id === event.id)!, now = Date.now();
      const x: TplText = { title: ev.name, message: t("design.msg.default"), date: new Date(ev.date + "T12:00").toLocaleDateString(st.lang === "en" ? "en" : st.lang, { dateStyle: "full" }), typeName: ev.type, venue: ev.venue };
      (["classic", "floral", "gold"] as const).forEach((tp, n) => {
        const color = n === 0 && r.colors.match(/#[0-9a-f]{6}/i)?.[0] || ev.design.color;
        st.invitations.push({ id: uid(), eventId: event.id, name: `${t("ins.design")} ${n + 1}`, html: templateHtml(tp, { ...ev, design: { ...ev.design, color } }, x), css: "", createdAt: now, modifiedAt: now, versions: [], source: "staff", comments: [], likes: [], requestId: rid });
      });
    });
  };
  const created = (i: Invitation) => { update((st) => { st.invitations.unshift(i); }); setModal(null); setView(i); };
  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{t("ins.desc")}</p>
        <span style={{ position: "relative" }}>
          <button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Plus size={16} /> {t("ins.newinv")} <ChevronDown size={14} /></button>
          {menu && (
            <>
              <div className="menu-bg" onClick={() => setMenu(false)} />
              <div className="menu" role="menu" style={{ zIndex: 25, minWidth: 260 }}>
                <button role="menuitem" onClick={() => { setMenu(false); setModal("request"); }}><Send size={15} /> {t("ins.request")}</button>
                <button role="menuitem" onClick={() => { setMenu(false); setModal("template"); }}><LayoutTemplate size={15} /> {t("ins.fromtpl")}</button>
                <button role="menuitem" onClick={() => { setMenu(false); setModal("ai"); }}><Sparkles size={15} /> {t("ins.ai")}</button>
              </div>
            </>
          )}
        </span>
      </div>

      {reqs.map((r) => (
        <div key={r.id} className="card row between" style={{ marginBottom: 14, boxShadow: "none", borderColor: "var(--gold)" }}>
          <span><b>{t("ins.req.pending")}</b><br /><span className="muted small">{t("ins.req.pending.desc")}</span></span>
          <button className="ghost sm" title={t("ins.req.demo.hint")} onClick={() => deliver(r.id)}>{t("ins.req.demo")}</button>
        </div>
      ))}

      {staff.length > 0 && (<>
        <h3 style={{ margin: "0 0 8px" }}>{t("ins.staff")}</h3>
        <p className="muted small" style={{ marginTop: -4 }}>{t("ins.staff.desc")}</p>
        <div className="invgrid wide" style={{ marginBottom: 22 }}>{staff.map((i) => <InvCard key={i.id} inv={i} event={event} blocked={blockedFor(i)} onOpen={() => setView(i)} />)}</div>
      </>)}
      {mine.length > 0 && (<>
        <h3 style={{ margin: "0 0 8px" }}>{t("ins.mine")}</h3>
        <div className="invgrid wide" style={{ marginBottom: 22 }}>{mine.map((i) => <InvCard key={i.id} inv={i} event={event} blocked={blockedFor(i)} onOpen={() => setView(i)} />)}</div>
      </>)}
      {all.length === 0 && reqs.length === 0 && <div className="card muted">{t("ins.empty")}</div>}

      {modal === "request" && <RequestModal event={event} onClose={() => setModal(null)} />}
      {(modal === "template" || modal === "ai") && <CreateModal event={event} mode={modal} onClose={() => setModal(null)} onCreated={created} />}
      {view && <PreviewModal inv={view} onClose={() => setView(null)} />}
    </>
  );
}
