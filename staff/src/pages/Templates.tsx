import { useEffect, useRef, useState } from "react";
import { addTemplate, getState, log, patchTask, setStatus, SOURCE_LABEL, uid, update, useStore, type Staff, type Template, type TplSource } from "../store";
import { fmtDate, go } from "../ui";
import { Download, Save, X } from "../icons";

type Prop = { addOption?: (o: Record<string, string>) => void };
type Ed = {
  Panels: { getButton: (p: string, b: string) => { set: (k: string, v: unknown) => void } | null };
  Blocks: { add: (id: string, b: Record<string, unknown>) => void };
  StyleManager: { getProperty: (sector: string, prop: string) => Prop | undefined };
  getHtml: () => string; getCss: () => string; setComponents: (h: string) => void; setStyle: (c: string) => void; destroy: () => void; on: (e: string, f: () => void) => void;
};

/** Same fonts, blocks and exported document as the 1Plan app's invitation editor. */
const FONTS = ["Great Vibes", "Playfair Display", "Montserrat", "Dancing Script", "Cormorant Garamond", "Lobster", "Pacifico", "Lora"];
const FONT_URL = "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;500;700&family=Dancing+Script:wght@500;700&family=Cormorant+Garamond:wght@400;600&family=Lobster&family=Pacifico&family=Lora:wght@400;600&display=swap";
const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e8e4dc"/><text x="200" y="160" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#8a8478">Double-click to add a photo</text></svg>');
const invitationDoc = (html: string, css: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${FONT_URL}"><style>body{margin:0;background:#f4f1ea;}${css}</style></head><body>${html}</body></html>`;

/** Designer area: template library (draft / published) and the HTML design studio. */
export default function Templates({ me, route }: { me: Staff; route: string }) {
  const parts = route.split("/");
  if (parts[1] === "studio") return <Studio me={me} id={parts[2]} />;
  return <Library me={me} />;
}

function Library({ me }: { me: Staff }) {
  const s = useStore();
  const [name, setName] = useState("");
  const [cat, setCat] = useState("wedding");
  const [kind, setKind] = useState<TplSource>("template");
  const [src, setSrc] = useState<"all" | TplSource>("all");
  const [pub, setPub] = useState<"all" | "published" | "draft">("all");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [openC, setOpenC] = useState<string | null>(null);
  const [text, setText] = useState("");
  const create = (e: React.FormEvent) => { e.preventDefault(); const t = addTemplate(me.name, name.trim(), cat, undefined, kind); log(me.name, "Created design", t.name); setName(""); go("/studio/" + t.id); };
  const toggle = (t: Template) => { update((st) => { const x = st.templates.find((y) => y.id === t.id)!; x.status = x.status === "published" ? "draft" : "published"; x.publishedAt = x.status === "published" ? Date.now() : 0; x.updatedAt = Date.now(); }); log(me.name, t.status === "published" ? "Unpublished template" : "Published template", t.name); };
  const del = (t: Template) => { if (confirm(`Delete "${t.name}"?`)) { update((st) => { st.templates = st.templates.filter((y) => y.id !== t.id); }); log(me.name, "Deleted template", t.name); } };
  const edit = (id: string, fn: (t: Template) => void) => update((st) => { const x = st.templates.find((y) => y.id === id); if (x) fn(x); });
  const addTag = (t: Template) => { const v = prompt("Tag name", "")?.trim().slice(0, 30); if (v && !t.tags.includes(v)) edit(t.id, (x) => { x.tags = [...(x.tags ?? []), v]; }); };
  const comment = (t: Template) => { const v = text.trim(); if (!v) return; edit(t.id, (x) => { x.comments = [...(x.comments ?? []), { id: uid(), by: me.name, at: Date.now(), text: v }]; }); setText(""); };
  const all = s.templates;
  const tags = [...new Set(all.flatMap((t) => t.tags ?? []))].sort();
  const rows = all.filter((t) => (src === "all" || (t.source ?? "template") === src) && (pub === "all" || t.status === pub) && (!tag || (t.tags ?? []).includes(tag)) && (!q || (t.name + " " + t.category + " " + (t.tags ?? []).join(" ")).toLowerCase().includes(q.toLowerCase())));
  const count = (k: TplSource) => all.filter((t) => (t.source ?? "template") === k).length;
  return (
    <>
      <h1>Templates & designs</h1>
      <p className="muted" style={{ marginTop: -4 }}>Edit and publish catalogue <b>templates</b>, designs made for <b>event requests</b> from customers or handed over by support, and personal <b>drafts</b>. Published templates are what customers see in the 1Plan platform.</p>
      <form className="card form" style={{ marginBottom: 14 }} onSubmit={create}>
        <div><label htmlFor="tn">New design name</label><input id="tn" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="tk">Type</label><select id="tk" value={kind} onChange={(e) => setKind(e.target.value as TplSource)}><option value="template">Template (for the catalogue)</option><option value="draft">Draft (work in progress)</option></select></div>
        <div><label htmlFor="tc">Category</label><select id="tc" value={cat} onChange={(e) => setCat(e.target.value)}>{["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate", "custom"].map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><button>Create and open studio</button></div>
      </form>
      <div className="card" style={{ marginBottom: 14, display: "grid", gap: 10 }}>
        <div className="row between">
          <div className="seg" role="group" aria-label="Design type">
            {([["all", `All (${all.length})`], ["template", `Templates (${count("template")})`], ["request", `Event requests (${count("request")})`], ["draft", `Drafts (${count("draft")})`]] as const).map(([k, l]) => <button key={k} aria-pressed={src === k} onClick={() => setSrc(k)}>{l}</button>)}
          </div>
          <div className="row"><select aria-label="Publication status" style={{ width: "auto" }} value={pub} onChange={(e) => setPub(e.target.value as typeof pub)}><option value="all">Any status</option><option value="draft">Not published</option><option value="published">Published</option></select>
            <input style={{ width: 200 }} placeholder="Search name, tag, category…" aria-label="Search designs" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {tags.length > 0 && <div className="tagrow"><span className="muted small">Tags:</span>{tags.map((g) => <button key={g} className="tagbtn" aria-pressed={tag === g} onClick={() => setTag(tag === g ? "" : g)}>{g}</button>)}</div>}
      </div>
      {!rows.length && <p className="muted">No designs match these filters.</p>}
      <div className="grid g3">
        {rows.map((t) => {
          const task = t.taskId ? s.tasks.find((x) => x.id === t.taskId) : undefined;
          const cm = t.comments ?? [];
          return (
            <div key={t.id} className="card" style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <div style={{ height: 180, overflow: "hidden", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", position: "relative" }}>
                <iframe title={t.name} sandbox="" srcDoc={`<style>${t.css}</style>${t.html}`} style={{ border: 0, width: "200%", height: "200%", transform: "scale(.5)", transformOrigin: "0 0", pointerEvents: "none" }} />
              </div>
              <div className="row between"><b>{t.name}</b><span className="badge" style={t.status === "published" ? { background: "#dcf3e8", color: "#1f7a52" } : undefined}>{t.status}</span></div>
              <div className="row" style={{ gap: 6 }}><span className="badge">{SOURCE_LABEL[t.source ?? "template"]}</span>{task && <a className="badge mono" href={"#/tasks/" + task.id}>{task.id}</a>}<span className="muted small">{t.category} · v{t.version}</span></div>
              <div className="muted small">Updated {fmtDate(t.updatedAt)} by {t.by}</div>
              <div className="tagrow">{(t.tags ?? []).map((g) => <span key={g} className="tagchip on">{g}<button type="button" className="ghost icon" style={{ padding: 0, border: 0 }} aria-label={`Remove tag ${g}`} onClick={() => edit(t.id, (x) => { x.tags = x.tags.filter((y) => y !== g); })}><X size={12} /></button></span>)}<button className="ghost sm" onClick={() => addTag(t)}>+ Tag</button></div>
              <div className="row"><button className="sm" onClick={() => go("/studio/" + t.id)}>Edit</button><button className="ghost sm" onClick={() => toggle(t)}>{t.status === "published" ? "Unpublish" : "Publish"}</button>
                <select aria-label="Change type" className="sm" style={{ width: "auto", padding: "3px 6px" }} value={t.source ?? "template"} onChange={(e) => edit(t.id, (x) => { x.source = e.target.value as TplSource; })}>{(Object.keys(SOURCE_LABEL) as TplSource[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}</select>
                <button className="ghost sm" aria-expanded={openC === t.id} onClick={() => { setOpenC(openC === t.id ? null : t.id); setText(""); }}>Comments ({cm.length})</button><button className="danger sm" onClick={() => del(t)}>Delete</button></div>
              {openC === t.id && (
                <div className="grid" style={{ gap: 6 }}>
                  {cm.map((c) => <div key={c.id} className="note"><div className="muted small">{c.by} · {fmtDate(c.at)}</div>{c.text}</div>)}
                  <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); comment(t); }}><input aria-label="Add a comment" placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} /><button disabled={!text.trim()}>Post</button></form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Studio({ me, id }: { me: Staff; id: string }) {
  const s = useStore();
  const tpl = s.templates.find((t) => t.id === id);
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<Ed | null>(null);
  const [name, setName] = useState(tpl?.name ?? "");
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState("");
  const task = s.tasks.find((t) => t.templateId === id);
  const versions = tpl?.versions ?? [];

  useEffect(() => {
    let dead = false;
    (async () => {
      // the same free, open-source GrapesJS plugins as the customer app: basic blocks, forms, navbar, countdown, tabs, custom code, gradients/backgrounds, tooltips, typing effect, filters, touch support, web-page preset
      const mods = await Promise.all([import("grapesjs"), import("grapesjs-blocks-basic"), import("grapesjs-plugin-forms"), import("grapesjs-navbar"), import("grapesjs-component-countdown"), import("grapesjs-tabs"), import("grapesjs-custom-code"), import("grapesjs-style-bg"), import("grapesjs-tooltip"), import("grapesjs-typed"), import("grapesjs-style-filter"), import("grapesjs-touch"), import("grapesjs-preset-webpage"), import("grapesjs/dist/css/grapes.min.css")]);
      if (dead || !host.current || !tpl) return;
      const e = mods[0].default.init({
        container: host.current, height: "100%", width: "auto", fromElement: false, storageManager: false,
        plugins: mods.slice(1, 13).map((m) => (m as { default: unknown }).default) as never[], pluginsOpts: {},
        components: tpl.html, style: tpl.css,
        canvas: { styles: [FONT_URL] },
        assetManager: { embedAsBase64: true, upload: false } as Record<string, unknown>,
      }) as unknown as Ed;
      try { const fam = e.StyleManager.getProperty("typography", "font-family"); FONTS.forEach((f) => fam?.addOption?.({ value: `'${f}', serif`, id: `'${f}', serif`, name: f, label: f })); } catch { /* optional */ }
      // blocks made for invitations (sample content: the designer replaces it)
      const B = (bid: string, label: string, content: string) => e.Blocks.add(bid, { label, category: "Invitation", content, select: true });
      B("inv-title", "Script title", `<h1 style="font-family:'Great Vibes',cursive;font-size:56px;text-align:center;margin:20px 0;font-weight:400">Event name</h1>`);
      B("inv-details", "Date & place", `<div style="text-align:center;font-family:'Lora',serif;line-height:1.7"><div style="letter-spacing:.2em;text-transform:uppercase;font-size:13px;opacity:.7">Save the date</div><div style="font-size:20px;font-weight:600">Saturday, 14 June 2027</div><div style="margin-top:10px">Venue · City</div></div>`);
      B("inv-ornament", "Ornament", `<div style="text-align:center;font-size:24px;letter-spacing:.6em;margin:18px 0;opacity:.7">✦ ✦ ✦</div>`);
      B("inv-photo", "Photo frame", `<div style="text-align:center;margin:16px 0"><img src="${PHOTO}" style="max-width:80%;border-radius:16px;border:6px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.18)"/></div>`);
      B("inv-rsvp", "RSVP button", `<div style="text-align:center;margin:24px 0"><a href="#rsvp" style="display:inline-block;padding:14px 34px;border-radius:999px;background:#46C8B2;color:#0c1a18;font-family:'Montserrat',sans-serif;font-weight:700;text-decoration:none">Confirm attendance</a></div>`);
      B("inv-notes", "Notes card", `<div style="max-width:420px;margin:16px auto;padding:18px 22px;border:1px dashed #b9b2a3;border-radius:12px;font-family:'Lora',serif;text-align:center"><b>Dress code</b><div>—</div></div>`);
      B("inv-schedule", "Itinerary", `<div style="max-width:420px;margin:16px auto;font-family:'Montserrat',sans-serif"><h3 style="text-align:center;letter-spacing:.15em;text-transform:uppercase;font-weight:500">Itinerary</h3>${[["17:00", "Ceremony"], ["18:30", "Cocktail"], ["20:00", "Dinner"]].map(([t, n]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd"><span>${t}</span><span>${n}</span></div>`).join("")}</div>`);
      e.on("update", () => setDirty(true));
      e.Panels.getButton("views", "open-blocks")?.set("active", true);
      ed.current = e; setReady(true);
    })();
    return () => { dead = true; ed.current?.destroy(); ed.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const snapshot = () => ({ html: (ed.current?.getHtml() ?? "").replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "").trim(), css: ed.current?.getCss() ?? "" });
  const close = () => { if (dirty && !confirm("Discard your changes?")) return; go(task ? "/tasks/" + task.id : "/templates"); };
  const persist = (publish?: boolean, asVersion?: boolean) => {
    if (!ed.current) return;
    const { html, css } = snapshot();
    update((st) => {
      const x = st.templates.find((y) => y.id === id)!;
      x.name = name.trim() || x.name; x.html = html; x.css = css; x.version += 1; x.updatedAt = Date.now(); x.by = me.name;
      if (asVersion) { x.versions = x.versions ?? []; x.versions.push({ id: Math.random().toString(36).slice(2), at: Date.now(), name: `v${x.versions.length + 1}`, html, css }); }
      if (publish) { x.status = "published"; x.publishedAt = Date.now(); }
    });
    log(me.name, publish ? "Published template" : asVersion ? "Saved template version" : "Saved template", name);
    setDirty(false);
  };
  const save = () => { persist(); go(task ? "/tasks/" + task.id : "/templates"); };
  const saveVersion = () => { persist(false, true); setFlash("Saved"); setTimeout(() => setFlash(""), 1800); };
  const publish = () => { persist(true); setFlash("Published"); setTimeout(() => setFlash(""), 1800); };
  const restore = (vid: string) => {
    const v = versions.find((x) => x.id === vid);
    if (!v || !ed.current) return;
    if (dirty && !confirm("Discard your changes?")) return;
    ed.current.setComponents(v.html); ed.current.setStyle(v.css); setDirty(true);
  };
  const exportHtml = () => {
    const { html, css } = snapshot();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([invitationDoc(html, css)], { type: "text/html;charset=utf-8" }));
    a.download = `${(name || "template").replace(/[^\w-]+/g, "_")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  /** Delivers the finished design to the request that asked for it and closes it. */
  const deliver = () => {
    if (!task) return;
    persist();
    const v = getState().templates.find((x) => x.id === id)?.version ?? 1;
    patchTask(task.id, me.name, (t) => { t.notes.push({ id: Math.random().toString(36).slice(2), by: me.name, at: Date.now(), text: `Design delivered: "${name}" (v${v}).`, internal: false }); return "Design delivered to the customer"; });
    setStatus(task.id, me.name, "done");
    go("/tasks/" + task.id);
  };
  useEffect(() => { // Esc closes; Ctrl/Cmd+S saves and closes; Ctrl/Cmd+Shift+S saves a version
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".gjs-mdl-container, .gjs-pn-views-container .gjs-pn-active")) close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && ready) { e.preventDefault(); if (e.shiftKey) saveVersion(); else save(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!tpl) return <div className="card"><h2>Template not found</h2><a className="btn" href="#/templates">Back</a></div>;
  const mod = /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";
  return (
    <div className="editor-full" role="dialog" aria-modal="true" aria-label="Template editor">
      <div className="editor-bar compact">
        <input aria-label="Template name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} style={{ maxWidth: 240 }} />
        <span className="badge">{tpl.status} · v{tpl.version}</span>{task && <span className="badge b-assigned mono">{task.id}</span>}
        <span className="muted small grow">{flash || (ready ? "Drag blocks from the left panel (+ icon) and click any element to style it." : "Loading editor…")}</span>
        <select aria-label="Open version" value="" disabled={!ready || versions.length === 0} style={{ width: "auto" }} onChange={(e) => e.target.value && restore(e.target.value)}>
          <option value="">Open version… {versions.length > 0 && `(${versions.length})`}</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.name} · {new Date(v.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</option>)}
        </select>
        <button className="ghost icon" onClick={saveVersion} disabled={!ready} aria-label="Save version" title={`Save version (${mod}⇧S)`}><Save size={17} /></button>
        <button className="ghost icon" onClick={exportHtml} disabled={!ready} aria-label="Download HTML" title="Download HTML"><Download size={17} /></button>
        {tpl.status !== "published" && <button className="ghost sm" onClick={publish} disabled={!ready}>Save & publish</button>}
        {task && task.status !== "done" && <button className="sm" onClick={deliver} disabled={!ready}>Deliver & complete {task.id}</button>}
        <button className="ghost sm" onClick={close}>Cancel</button>
        <button className="sm" onClick={save} disabled={!ready} title={`Save (${mod}S)`}>Save</button>
        <button className="ghost icon" aria-label="Close" title="Close" onClick={close}><X size={17} /></button>
      </div>
      <div className="editor-host"><div ref={host} /></div>
    </div>
  );
}
