import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n";
import { PLANS, notify, openUpsell, uid, update, useStore, me, type Comment, type EventT, type Invitation, type TplFields } from "../store";
import { ChevronDown, Heart, Pencil, LayoutTemplate, LockI, MessageCircle, Plus, Send, Sparkles, X } from "../icons";
import { buildInvitation, catalogKey, catalogName, invSandbox, invitationDoc, templateHtml, templatesFor, useCatalog, type TplText } from "../invitationTemplates";
import { sendRequest } from "../bridge";
import { Modal } from "./ui";
import ApprovalButton from "./Approval";
import Thumb from "./InvThumb";
import { readImage } from "./MenuTab";

/** "Design with AI" (demo): picks a template that suits the event type, guided by the words in the prompt. */
const IDEAS: Record<string, { template: string }[]> = {
  wedding: [{ template: "botanica" }, { template: "deco" }, { template: "costa" }, { template: "lino" }],
  birthday: [{ template: "mono" }, { template: "dino" }, { template: "cosmos" }, { template: "eras" }],
  default: [{ template: "lino" }, { template: "mono" }],
};
const IDEA_WORDS: [string[], string][] = [
  [["gold", "dorad", "gala", "glam"], "deco"], [["flor", "flower", "bot"], "botanica"], [["dino"], "dino"], [["space", "espacio", "astro", "cosm"], "cosmos"],
  [["sea", "mar", "beach", "playa", "costa"], "costa"], [["minimal", "simple", "sencill"], "lino"], [["glitter", "brillo", "sparkle"], "eras"],
];

const SECTION_KEYS = ["quote", "countdown", "itinerary", "lodging", "dresscode", "gifts", "adultsOnly", "contact"] as const;
const PALETTE = ["#FF7A59", "#F0B429", "#46C8B2", "#6FA8FF", "#1F2937", "#F5EFE4", "#7C5CFF", "#FF9C7F"];

/** Read-only view of an invitation. Nobody except 1Plan staff can edit the HTML. */
function PreviewModal({ inv, onClose }: { inv: Invitation; onClose: () => void }) {
  return (
    <Modal title={inv.name} onClose={onClose} wide>
      <iframe title={inv.name} sandbox={invSandbox(inv.html)} srcDoc={invitationDoc(inv.html, inv.css)} style={{ width: "100%", height: "68vh", border: "1px solid var(--line)", borderRadius: 12, marginTop: 10, background: "#fff" }} />
    </Modal>
  );
}

/** "Create from template" / "Design with AI" / edit: pick a template (the list folds away once one is chosen), then customize it with a live preview. */
function CreateModal({ event, mode, edit, onClose, onCreated }: { event: EventT; mode: "template" | "ai"; edit?: Invitation; onClose: () => void; onCreated: (i: Invitation) => void }) {
  const { t, tn, locale } = useT();
  const s = useStore();
  useCatalog(); // the template list follows what 643 publishes
  const [tpl, setTpl] = useState<string | null>(edit?.tpl ?? null);
  const [changing, setChanging] = useState(false); // template list open again
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState(edit?.name ?? new Date().toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }));
  const [F, setF] = useState<TplFields>(() => edit?.fields ?? { title: event.name, message: t("design.msg.default"), iso: event.date, time: event.time || "17:00", venue: [event.venue, event.location].filter(Boolean).join(" · "), color: event.design.color, font: event.design.font });
  const [err, setErr] = useState("");
  const set = (p: Partial<TplFields>) => setF((x) => ({ ...x, ...p }));
  const build = (id: string) => buildInvitation(id, event, F, locale, tn(event.type));
  const html = tpl ? build(tpl) : "";
  const [shown, setShown] = useState(html); // the preview follows the form a moment after typing stops
  useEffect(() => { const id = setTimeout(() => setShown(html), 500); return () => clearTimeout(id); }, [html]);
  const ids = templatesFor(event.type);
  const thumbs = useMemo(() => Object.fromEntries(ids.map((id) => [id, buildInvitation(id, event, F, locale, tn(event.type))])), [ids.join(), catalogKey(), F.title, F.iso, F.time, F.venue, locale]); // eslint-disable-line
  const generate = () => {
    const list = IDEAS[event.type] ?? IDEAS.default, w = prompt.toLowerCase();
    const hit = IDEA_WORDS.find(([words, id]) => words.some((k) => w.includes(k)) && list.some((i) => i.template === id));
    setTpl(hit ? hit[1] : list[Math.floor(Math.random() * list.length)].template);
  };
  const pending = edit ? s.signoffs.some((x) => x.eventId === event.id && x.scope === "invitations" && x.subject === edit.name && x.approvers.some((a) => !a.at)) : false;
  const photo = async (k: "cover" | "story", files: FileList | null) => { if (!files?.[0]) return; try { set({ [k]: await readImage(files[0]) }); setErr(""); } catch { setErr(t("menu.imgerr")); } };
  const save = () => {
    if (!tpl) return;
    const now = Date.now(), nm = name.trim() || t("ins.newname");
    if (!edit) { onCreated({ id: uid(), eventId: event.id, name: nm, html, css: "", tpl, fields: F, createdAt: now, modifiedAt: now, versions: [], source: mode, comments: [], likes: [] }); return; }
    update((st) => {
      const i = st.invitations.find((x) => x.id === edit.id); if (!i) return;
      const old = i.name;
      i.versions = [...(i.versions ?? []), { id: uid(), at: now, name: `v${(i.versions ?? []).length + 1}`, html: i.html, css: i.css }];
      i.name = nm; i.html = html; i.tpl = tpl; i.fields = F; i.modifiedAt = now;
      // an edit while it is in approval restarts the approval: the same people must approve the new version
      const k = st.signoffs.findIndex((x) => x.eventId === event.id && x.scope === "invitations" && x.subject === old && x.approvers.some((a) => !a.at));
      if (k >= 0) {
        const so = st.signoffs[k];
        st.signoffs[k] = { ...so, subject: nm, summary: [nm, t("ins.src." + (i.source ?? "template")), `${(i.likes ?? []).length} ♥ · ${(i.comments ?? []).length} ${t("tl.comments").toLowerCase()}`], snap: { k: "invitation", html, css: "" }, startedBy: me(st).name, startedAt: now, approvers: so.approvers.map((a) => ({ ...a, id: uid(), at: 0, by: "" })) };
        notify(st, "approval", "inb.n.restarted", { name: me(st).name, subject: nm }, `/app/event/${event.id}`);
      }
    });
    onClose();
  };
  const designing = mode === "ai" && !tpl;
  const picking = !edit && mode === "template" && (!tpl || changing);
  const tname = (id: string) => catalogName(id) ?? t("tpl." + id);
  const L = (id: string, label: string, el: React.ReactNode, full = true) => <div className={full ? "full" : undefined}><label htmlFor={id}>{label}</label>{el}</div>;
  const moments = F.itinerary ?? [];
  const on = (k: string) => (F.sections ?? {})[k] ?? (k === "lodging" ? !!F.lodging : k === "contact" ? !!F.whatsapp : true);
  /** a piece of text the user can reword (empty = the template's own wording) */
  const TX = (k: string) => <div className="full" key={k}><label htmlFor={"tx-" + k}>{t("ins.t." + k)}</label><textarea id={"tx-" + k} rows={2} placeholder={t("ins.t.default")} value={F.copy?.[k] ?? ""} onChange={(e) => set({ copy: { ...(F.copy ?? {}), [k]: e.target.value } })} /></div>;
  return (
    <Modal title={edit ? t("ins.edit.title") : mode === "ai" ? t("ins.ai") : t("ins.fromtpl")} onClose={onClose} xl>
      {designing ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>{t("ins.ai.desc")}</p>
          <label htmlFor="aip">{t("ins.ai.prompt")}</label>
          <textarea id="aip" rows={3} autoFocus value={prompt} placeholder={t("ins.ai.ph")} onChange={(e) => setPrompt(e.target.value)} />
          <p className="muted small">{t("ins.ai.example")}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button onClick={generate}><Sparkles size={15} /> {t("ins.ai.go")}</button></div>
        </>
      ) : (
        <>
          {picking ? (
            <div className="invgrid mini" style={{ marginBottom: 12 }}>
              {ids.length === 0 && <p className="muted">{t("ins.notpl")}</p>}
              {ids.map((id) => (
                <button type="button" key={id} className={`tplcard${tpl === id ? " selected" : ""}`} aria-pressed={tpl === id} onClick={() => { setTpl(id); setChanging(false); }}>
                  <Thumb html={thumbs[id]} css="" title={tname(id)} /><b className="small">{tname(id)}</b>
                </button>
              ))}
            </div>
          ) : tpl && (
            <div className="row between" style={{ marginBottom: 10 }}>
              <span><span className="muted small">{t("ins.template")}: </span><b>{tname(tpl)}</b></span>
              {mode === "ai" && !edit ? <button className="ghost sm" onClick={() => setTpl(null)}><Sparkles size={13} /> {t("ins.ai.again")}</button> : !edit && <button className="ghost sm" onClick={() => setChanging(true)}><LayoutTemplate size={13} /> {t("ins.changetpl")}</button>}
            </div>
          )}
          {tpl && !picking && (
            <div className="invmake edit">
              <div className="form" style={{ alignContent: "start" }}>
                {pending && <p role="status" className="small full" style={{ margin: 0, padding: "8px 10px", borderRadius: 8, background: "var(--soft)", border: "1px solid var(--gold)" }}>{t("ins.edit.restart")}</p>}
                {L("in", t("ins.name"), <input id="in" value={name} onChange={(e) => setName(e.target.value)} />)}
                {L("it", t("ins.f.title"), <input id="it" value={F.title} onChange={(e) => set({ title: e.target.value })} />)}
                {L("id", t("date"), <input id="id" type="date" value={F.iso} onChange={(e) => set({ iso: e.target.value })} />, false)}
                {L("ih", t("ins.f.time"), <input id="ih" type="time" value={F.time} onChange={(e) => set({ time: e.target.value })} />, false)}
                {L("iv", t("location"), <input id="iv" value={F.venue} onChange={(e) => set({ venue: e.target.value })} />)}
                {L("ia", t("ins.f.address"), <input id="ia" value={F.address ?? ""} onChange={(e) => set({ address: e.target.value })} />)}
                {L("im", t("ins.f.map"), <input id="im" placeholder={t("ins.f.map.ph")} value={F.mapUrl ?? ""} onChange={(e) => set({ mapUrl: e.target.value })} />)}
                {TX("gate")}{TX("tagline")}
                <div className="full"><label>{t("ins.sections")}</label>
                  <div className="secgrid">
                    {SECTION_KEYS.map((k) => <label key={k} className="row" style={{ gap: 6, flexWrap: "nowrap", margin: 0, fontWeight: 400 }}><input type="checkbox" style={{ width: "auto" }} checked={on(k)} onChange={(e) => set({ sections: { ...(F.sections ?? {}), [k]: e.target.checked } })} /> {t("ins.sec." + k)}</label>)}
                  </div>
                </div>
                {on("quote") && <>{TX("q1")}{TX("q2")}</>}
                {on("itinerary") && TX("details_t")}
                {on("lodging") && <>{L("il", t("ins.f.lodging"), <input id="il" placeholder="https://…" value={F.lodging ?? ""} onChange={(e) => set({ lodging: e.target.value })} />)}{TX("lodging_t")}</>}
                {on("dresscode") && <>{L("ids", t("ins.f.dress"), <input id="ids" value={F.dress ?? ""} onChange={(e) => set({ dress: e.target.value })} />)}{TX("dc_w_t")}{TX("dc_note")}</>}
                {on("gifts") && <>{L("ig", t("ins.f.gifts"), <textarea id="ig" rows={2} value={F.gifts ?? ""} onChange={(e) => set({ gifts: e.target.value })} />)}{TX("gifts2")}{TX("gifts3")}</>}
                {on("adultsOnly") && TX("adults_t")}
                {TX("count_t")}
                {L("ir", t("ins.f.deadline"), <input id="ir" type="date" value={F.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value })} />, false)}
                {on("contact") && <>{L("iw", t("ins.f.wa"), <input id="iw" inputMode="tel" placeholder="5215512345678" value={F.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value.replace(/[^\d+]/g, "") })} />, false)}{TX("contact_t")}</>}
                {on("itinerary") && <div className="full"><label>{t("ins.f.itin")}</label>
                  {moments.map((m, i) => (
                    <div className="row" key={i} style={{ flexWrap: "nowrap", marginBottom: 6 }}>
                      <input type="time" aria-label={t("ins.f.time")} style={{ width: 120 }} value={m.time} onChange={(e) => set({ itinerary: moments.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
                      <input aria-label={t("ins.f.moment")} value={m.title} onChange={(e) => set({ itinerary: moments.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                      <button type="button" className="ghost sm icon" aria-label={t("delete")} onClick={() => set({ itinerary: moments.filter((_, j) => j !== i) })}><X size={14} /></button>
                    </div>
                  ))}
                  {moments.length < 8 && <button type="button" className="ghost sm" onClick={() => set({ itinerary: [...moments, { time: F.time, title: "" }] })}><Plus size={13} /> {t("ins.f.addmoment")}</button>}
                </div>}
                {(["cover", "story"] as const).map((k) => (
                  <div key={k}><label>{t("ins.f." + k)}</label>
                    <div className="row" style={{ gap: 8 }}>
                      {F[k] && <img src={F[k]} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} />}
                      <label className="addimg">{F[k] ? "↻" : "+"}<input type="file" accept="image/*" hidden onChange={(e) => { void photo(k, e.target.files); e.target.value = ""; }} /></label>
                      {F[k] && <button type="button" className="ghost sm" onClick={() => set({ [k]: "" })}>{t("delete")}</button>}
                    </div>
                  </div>
                ))}
                {err && <p role="alert" className="full" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
              </div>
              <div>
                <div className="muted small" style={{ marginBottom: 4 }}>{t("ins.preview")}</div>
                <iframe title="preview" sandbox={invSandbox(shown)} srcDoc={invitationDoc(shown, "")} style={{ width: "100%", height: "66vh", border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />
              </div>
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={!tpl || picking} onClick={save}>{edit ? t("save") : t("ins.use")}</button></div>
        </>
      )}
    </Modal>
  );
}

/** "Request design": tell the 1Plan design team what you want; they deliver up to 3 designs. */
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
            {images.map((src, i) => <span key={i} style={{ position: "relative" }}><img src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} /><button type="button" className="ghost icon" style={{ position: "absolute", top: -6, right: -6 }} aria-label={t("delete")} onClick={() => setImages(images.filter((_, j) => j !== i))}><X size={12} /></button></span>)}
            {images.length < 10 && <label className="addimg">+<input type="file" accept="image/*" multiple hidden onChange={(e) => { addImgs(e.target.files); e.target.value = ""; }} /></label>}
          </div>
          {err && <p role="alert" style={{ color: "var(--danger)", margin: "6px 0 0" }}>{err}</p>}</div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button><Send size={15} /> {t("ins.req.send")}</button></div>
      </form>
    </Modal>
  );
}

function InvCard({ inv, event, blocked, approved, onOpen, onEdit }: { inv: Invitation; event: EventT; blocked: string; approved: boolean; onOpen: () => void; onEdit?: () => void }) {
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
          {onEdit && (approved ? <span className="row" title={t("ins.locked")} style={{ padding: "0 8px" }}><LockI /></span> : <button className="ghost sm invact" aria-label={t("ins.edit")} title={t("ins.edit")} onClick={onEdit}><Pencil size={20} /></button>)}
          <button className={`ghost sm invact likebtn${liked ? " on" : ""}`} aria-pressed={liked} aria-label={liked ? t("task.unlike") : t("task.like")} title={liked ? t("task.unlike") : t("task.like")} onClick={() => patch((i) => { const l = i.likes ?? []; i.likes = liked ? l.filter((x) => x !== who) : [...l, who]; })}><Heart size={20} fill={liked ? "currentColor" : "none"} /> {(inv.likes ?? []).length || ""}</button>
          <button className="ghost sm invact" aria-expanded={open} aria-label={t("tl.comments")} title={t("tl.comments")} onClick={() => setOpen(!open)}><MessageCircle size={20} /> {(inv.comments ?? []).length || ""}</button>
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

/** Invitation tab: 1Plan designs, invitations made from templates / AI, and the three ways to ask for a new one. */
export default function DesignTab({ event }: { event: EventT }) {
  const s = useStore();
  const { t } = useT();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"request" | "template" | "ai" | null>(null);
  const [view, setView] = useState<Invitation | null>(null);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const all = s.invitations.filter((i) => i.eventId === event.id);
  const staff = all.filter((i) => i.source === "staff").slice(0, 3), mine = all.filter((i) => i.source !== "staff");
  const reqs = s.designRequests.filter((r) => r.eventId === event.id && !r.delivered);
  // only one invitation at a time can go through approval: while one is waiting or approved, the others are blocked
  const busy = s.signoffs.find((x) => x.eventId === event.id && x.scope === "invitations");
  // once one invitation is fully approved it is the one used on RSVP: no new ones, and the others cannot be approved
  const approvedSo = s.signoffs.find((x) => x.eventId === event.id && x.scope === "invitations" && x.approvers.every((a) => a.at));
  const isApproved = (i: Invitation) => !!approvedSo && approvedSo.subject === i.name;
  const blockedFor = (i: Invitation) => (approvedSo && approvedSo.subject !== i.name ? t("ins.approved.blocked", { name: approvedSo.subject }) : busy && busy.subject !== i.name ? t("ins.oneapproval", { name: busy.subject }) : "");
  const deliver = (rid: string) => { // demo: stands in for the 1Plan designer delivering the designs
    update((st) => {
      const r = st.designRequests.find((x) => x.id === rid); if (!r) return;
      r.delivered = true;
      const ev = st.events.find((e) => e.id === event.id)!, now = Date.now();
      const x: TplText = { title: ev.name, message: t("design.msg.default"), date: new Date(ev.date + "T12:00").toLocaleDateString(st.lang === "en" ? "en" : st.lang, { dateStyle: "full" }), typeName: ev.type, venue: ev.venue };
      templatesFor(ev.type).slice(0, 3).forEach((tp, n) => {
        st.invitations.push({ id: uid(), eventId: event.id, name: `${t("ins.design")} ${n + 1}`, html: templateHtml(tp, ev, x), css: "", createdAt: now, modifiedAt: now, versions: [], source: "staff", comments: [], likes: [], requestId: rid });
      });
    });
  };
  const created = (i: Invitation) => { update((st) => { st.invitations.unshift(i); }); setModal(null); setView(i); };
  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{t("ins.desc")}</p>
        <span style={{ position: "relative" }}>
          <button aria-haspopup="menu" aria-expanded={menu} disabled={!!approvedSo} title={approvedSo ? t("ins.approved.new") : undefined} onClick={() => setMenu(!menu)}><Plus size={16} /> {t("ins.newinv")} <ChevronDown size={14} /></button>
          {menu && (
            <>
              <div className="menu-bg" onClick={() => setMenu(false)} />
              <div className="menu" role="menu" style={{ zIndex: 25, minWidth: 260 }}>
                <button role="menuitem" onClick={() => { setMenu(false); if (!PLANS[s.plan].designRequest) { openUpsell("design"); return; } if (s.designRequests.filter((r) => r.eventId === event.id).length >= PLANS[s.plan].designEdits) { openUpsell("edits"); return; } setModal("request"); }}><Send size={15} /> {t("ins.request")}</button>
                <button role="menuitem" onClick={() => { setMenu(false); setModal("template"); }}><LayoutTemplate size={15} /> {t("ins.fromtpl")}</button>
              </div>
            </>
          )}
        </span>
      </div>

      {approvedSo && <div role="status" className="card small" style={{ marginBottom: 14, boxShadow: "none", borderColor: "var(--teal)" }}>{t("ins.approved.note", { name: approvedSo.subject })}</div>}

      {reqs.map((r) => (
        <div key={r.id} className="card row between" style={{ marginBottom: 14, boxShadow: "none", borderColor: "var(--gold)" }}>
          <span><b>{t("ins.req.pending")}</b><br /><span className="muted small">{t("ins.req.pending.desc")}</span></span>
          <button className="ghost sm" title={t("ins.req.demo.hint")} onClick={() => deliver(r.id)}>{t("ins.req.demo")}</button>
        </div>
      ))}

      {staff.length > 0 && (<>
        <h3 style={{ margin: "0 0 8px" }}>{t("ins.staff")}</h3>
        <p className="muted small" style={{ marginTop: -4 }}>{t("ins.staff.desc")}</p>
        <div className="invgrid wide" style={{ marginBottom: 22 }}>{staff.map((i) => <InvCard key={i.id} inv={i} event={event} blocked={blockedFor(i)} approved={isApproved(i)} onOpen={() => setView(i)} onEdit={i.tpl && i.source !== "staff" ? () => setEditing(i) : undefined} />)}</div>
      </>)}
      {mine.length > 0 && (<>
        <h3 style={{ margin: "0 0 8px" }}>{t("ins.mine")}</h3>
        <div className="invgrid wide" style={{ marginBottom: 22 }}>{mine.map((i) => <InvCard key={i.id} inv={i} event={event} blocked={blockedFor(i)} approved={isApproved(i)} onOpen={() => setView(i)} onEdit={i.tpl && i.source !== "staff" ? () => setEditing(i) : undefined} />)}</div>
      </>)}
      {all.length === 0 && reqs.length === 0 && <div className="card muted">{t("ins.empty")}</div>}

      {modal === "request" && <RequestModal event={event} onClose={() => setModal(null)} />}
      {(modal === "template" || modal === "ai") && <CreateModal event={event} mode={modal} onClose={() => setModal(null)} onCreated={created} />}
      {editing && <CreateModal event={event} mode="template" edit={editing} onClose={() => setEditing(null)} onCreated={() => setEditing(null)} />}
      {view && <PreviewModal inv={view} onClose={() => setView(null)} />}
    </>
  );
}
