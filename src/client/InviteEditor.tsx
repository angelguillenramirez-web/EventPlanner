import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { invitationDoc, isFullDoc } from "../invitationTemplates";
import { getState, uid, update, useStore, type EventT, type Invitation } from "../store";
import { Download, Save, X } from "../icons";
import { ask } from "./Ask";
import { Modal } from "./ui";

type Prop = { addOption?: (o: Record<string, string>) => void };
type Editor = {
  Panels: { getButton: (p: string, b: string) => { set: (k: string, v: unknown) => void } | null };
  Blocks: { add: (id: string, b: Record<string, unknown>) => void };
  StyleManager: { getProperty: (sector: string, prop: string) => Prop | undefined };
  getHtml: () => string; getCss: () => string; setComponents: (h: string) => void; setStyle: (c: string) => void; destroy: () => void; on: (e: string, f: () => void) => void;
};

/** Free Google Fonts offered in the editor (also loaded in the preview and the exported HTML). */
const FONTS = ["Great Vibes", "Playfair Display", "Montserrat", "Dancing Script", "Cormorant Garamond", "Lobster", "Pacifico", "Lora"];
const FONT_URL = "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;500;700&family=Dancing+Script:wght@500;700&family=Cormorant+Garamond:wght@400;600&family=Lobster&family=Pacifico&family=Lora:wght@400;600&display=swap";
const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#EDE6D8"/><text x="200" y="160" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#6B6458">Double-click to add a photo</text></svg>');

/** Full-screen visual HTML editor (GrapesJS + its free web-page preset: drag & drop blocks, forms, navbar, countdown, gradients, code import/export, responsive preview, undo/redo). */
export default function InviteEditor(p: { event: EventT; invitation: Invitation; onClose: () => void }) {
  const { t } = useT();
  return isFullDoc(p.invitation.html)
    ? <Modal title={p.invitation.name} onClose={p.onClose}><p>{t("ins.nofull")}</p><div className="row" style={{ justifyContent: "flex-end" }}><button onClick={p.onClose}>OK</button></div></Modal>
    : <VisualEditor {...p} />;
}
function VisualEditor({ event, invitation, onClose }: { event: EventT; invitation: Invitation; onClose: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<Editor | null>(null);
  const [name, setName] = useState(invitation.name);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState("");
  const versions = s.invitations.find((x) => x.id === invitation.id)?.versions ?? invitation.versions ?? [];

  useEffect(() => {
    let dead = false;
    (async () => {
      // all free, open-source GrapesJS plugins: basic blocks, forms, navbar, countdown, tabs, custom code, gradients/backgrounds, tooltips, typing effect, filters, touch support, preset
      const mods = await Promise.all([import("grapesjs"), import("grapesjs-blocks-basic"), import("grapesjs-plugin-forms"), import("grapesjs-navbar"), import("grapesjs-component-countdown"), import("grapesjs-tabs"), import("grapesjs-custom-code"), import("grapesjs-style-bg"), import("grapesjs-tooltip"), import("grapesjs-typed"), import("grapesjs-style-filter"), import("grapesjs-touch"), import("grapesjs-preset-webpage"), import("grapesjs/dist/css/grapes.min.css")]);
      if (dead || !host.current) return;
      const grapesjs = mods[0].default;
      const plugins = mods.slice(1, 13).map((m) => (m as { default: unknown }).default);
      const e = grapesjs.init({
        container: host.current, height: "100%", width: "auto", fromElement: false, storageManager: false,
        plugins: plugins as never[], pluginsOpts: {},
        components: invitation.html, style: invitation.css,
        canvas: { styles: [FONT_URL] },
        assetManager: { embedAsBase64: true, upload: false } as Record<string, unknown>,
      }) as unknown as Editor;
      // fonts for the style manager
      try { const fam = e.StyleManager.getProperty("typography", "font-family"); FONTS.forEach((f) => fam?.addOption?.({ value: `'${f}', serif`, id: `'${f}', serif`, name: f, label: f })); } catch { /* optional */ }
      // blocks made for invitations
      const when = new Date(event.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" });
      const place = [event.venue, event.location].filter(Boolean).join(" · ");
      const acts = getState().dots.filter((d) => d.eventId === event.id).flatMap((d) => d.activities).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
      const B = (id: string, label: string, content: string) => e.Blocks.add(id, { label, category: t("ins.blocks"), content, select: true });
      B("inv-title", t("ins.b.title"), `<h1 style="font-family:'Great Vibes',cursive;font-size:56px;text-align:center;margin:20px 0;font-weight:400">${event.name}</h1>`);
      B("inv-details", t("ins.b.details"), `<div style="text-align:center;font-family:'Lora',serif;line-height:1.7"><div style="letter-spacing:.2em;text-transform:uppercase;font-size:13px;opacity:.7">${t("ins.b.when")}</div><div style="font-size:20px;font-weight:600">${when}</div>${place ? `<div style="margin-top:10px">${place}</div>` : ""}</div>`);
      B("inv-ornament", t("ins.b.ornament"), `<div style="text-align:center;font-size:24px;letter-spacing:.6em;margin:18px 0;opacity:.7">✦ ✦ ✦</div>`);
      B("inv-photo", t("ins.b.photo"), `<div style="text-align:center;margin:16px 0"><img src="${PHOTO}" style="max-width:80%;border-radius:16px;border:6px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.18)"/></div>`);
      B("inv-rsvp", t("ins.b.rsvp"), `<div style="text-align:center;margin:24px 0"><a href="#rsvp" style="display:inline-block;padding:14px 34px;border-radius:999px;background:#46C8B2;color:#14203A;font-family:'Montserrat',sans-serif;font-weight:700;text-decoration:none">${t("ins.b.rsvp.label")}</a></div>`);
      B("inv-notes", t("ins.b.notes"), `<div style="max-width:420px;margin:16px auto;padding:18px 22px;border:1px dashed #B8A98A;border-radius:12px;font-family:'Lora',serif;text-align:center"><b>${t("ins.b.dress")}</b><div>—</div></div>`);
      if (acts.length) B("inv-schedule", t("ins.b.schedule"), `<div style="max-width:420px;margin:16px auto;font-family:'Montserrat',sans-serif"><h3 style="text-align:center;letter-spacing:.15em;text-transform:uppercase;font-weight:500">${t("ins.b.schedule")}</h3>${acts.map((a) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EDE6D8"><span>${a.time}</span><span>${a.name}</span></div>`).join("")}</div>`);
      e.on("update", () => setDirty(true));
      e.Panels.getButton("views", "open-blocks")?.set("active", true);
      ed.current = e; setReady(true);
    })();
    return () => { dead = true; ed.current?.destroy(); ed.current = null; };
  }, []); // eslint-disable-line

  const close = () => { if (!dirty) onClose(); else ask(t("ins.discard"), onClose, { danger: true }); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".gjs-mdl-container, .gjs-pn-views-container .gjs-pn-active")) close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const snapshot = () => ({ html: (ed.current?.getHtml() ?? "").replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "").trim(), css: ed.current?.getCss() ?? "" });
  const save = () => {
    const { html, css } = snapshot();
    const now = Date.now();
    update((st) => {
      const i = st.invitations.findIndex((x) => x.id === invitation.id);
      const v: Invitation = { ...invitation, name: name.trim() || invitation.name, html, css, modifiedAt: now, versions: i >= 0 ? st.invitations[i].versions : [] };
      if (i >= 0) st.invitations[i] = v; else st.invitations.unshift(v);
    });
    onClose();
  };
  const saveVersion = () => {
    const { html, css } = snapshot();
    const now = Date.now();
    update((st) => {
      let inv = st.invitations.find((x) => x.id === invitation.id);
      if (!inv) { inv = { ...invitation, name: name.trim() || invitation.name, html, css, modifiedAt: now, versions: [] }; st.invitations.unshift(inv); }
      inv.versions.push({ id: uid(), at: now, name: `v${inv.versions.length + 1}`, html, css });
    });
    setFlash(t("ins.saved")); setTimeout(() => setFlash(""), 1800);
  };
  const restore = (id: string) => {
    const v = versions.find((x) => x.id === id);
    if (!v || !ed.current) return;
    const apply = () => { if (!ed.current) return; ed.current.setComponents(v.html); ed.current.setStyle(v.css); setDirty(true); };
    if (dirty) ask(t("ins.discard"), apply, { danger: true }); else apply();
  };
  const exportHtml = () => {
    const { html, css } = snapshot();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([invitationDoc(html, css)], { type: "text/html;charset=utf-8" }));
    a.download = `${(name || "invitation").replace(/[^\w-]+/g, "_")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  useEffect(() => { // shortcuts: Ctrl/Cmd+S save and close, Ctrl/Cmd+Shift+S save a version
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s" || !ready) return;
      e.preventDefault();
      if (e.shiftKey) saveVersion(); else save();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const mod = /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";
  return (
    <div className="editor-full" role="dialog" aria-modal="true" aria-label={t("ins.editor")}>
      <div className="editor-bar compact">
        <input aria-label={t("ins.name")} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} style={{ maxWidth: 240 }} />
        <span className="muted small grow">{flash || (ready ? t("ins.hint") : t("ins.loading"))}</span>
        <select aria-label={t("ins.restore")} value="" disabled={!ready || versions.length === 0} style={{ width: "auto" }} onChange={(e) => e.target.value && restore(e.target.value)}>
          <option value="">{t("ins.restore")} {versions.length > 0 && `(${versions.length})`}</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.name} · {new Date(v.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</option>)}
        </select>
        <button className="ghost icon" onClick={saveVersion} disabled={!ready} aria-label={t("ins.saveversion")} title={`${t("ins.saveversion")} (${mod}⇧S)`}><Save size={17} /></button>
        <button className="ghost icon" onClick={exportHtml} disabled={!ready} aria-label={t("ins.export")} title={t("ins.export")}><Download size={17} /></button>
        <button className="ghost sm" onClick={close}>{t("cancel")}</button>
        <button className="sm" onClick={save} disabled={!ready} title={`${t("save")} (${mod}S)`}>{t("save")}</button>
        <button className="ghost icon" aria-label={t("close")} title={t("close")} onClick={close}><X size={17} /></button>
      </div>
      <div className="editor-host"><div ref={host} /></div>
    </div>
  );
}
