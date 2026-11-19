import { useDeferredValue, useRef, useState } from "react";
import { BUILTIN_TEMPLATES } from "../../../src/templates";
import { EVENT_TYPES, readData, validateFull, writeData } from "../fullDoc";
import { hashDoc, log, update, useStore, type Staff } from "../store";
import { go } from "../ui";
import { Download, Save, X } from "../icons";

/** Editor for full-page templates (complete HTML pages with a data block). They have their own design, so they are not edited with the visual studio. */
export default function FullTemplate({ me, id }: { me: Staff; id: string }) {
  const s = useStore();
  const tpl = s.templates.find((t) => t.id === id);
  const [name, setName] = useState(tpl?.name ?? "");
  const [category, setCategory] = useState(tpl?.category ?? "wedding");
  const [suits, setSuits] = useState<string[]>(tpl?.suits ?? []);
  const [doc, setDoc] = useState(tpl?.html ?? "");
  const [json, setJson] = useState(() => JSON.stringify(readData(tpl?.html ?? "") ?? {}, null, 2));
  const [tab, setTab] = useState<"details" | "content" | "code">("details");
  const [wide, setWide] = useState(false);
  const [flash, setFlash] = useState("");
  const [dirty, setDirty] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const preview = useDeferredValue(doc);
  const versions = tpl?.versions ?? [];
  const jsonErr = (() => { try { JSON.parse(json); return ""; } catch (e) { return (e as Error).message; } })();
  const docErr = validateFull(doc);
  const bad = jsonErr || docErr;

  if (!tpl) return <div className="card"><h2>Template not found</h2><a className="btn" href="#/templates">Back</a></div>;

  const touch = () => setDirty(true);
  const editJson = (v: string) => {
    setJson(v); touch();
    try { setDoc(writeData(doc, JSON.parse(v))); } catch { /* keep the last valid page until the JSON is valid again */ }
  };
  const editCode = (v: string) => {
    setDoc(v); touch();
    const d = readData(v); if (d) setJson(JSON.stringify(d, null, 2));
  };
  const toggleSuit = (k: string) => { setSuits((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k])); touch(); };
  const upload = async (f?: File) => { if (!f) return; editCode(await f.text()); setTab("code"); };
  const reset = () => {
    const b = BUILTIN_TEMPLATES.find((x) => x.id === tpl.builtin);
    if (b && confirm("Go back to the original design? Your changes to this page will be replaced.")) editCode(b.html);
  };

  const persist = (opts: { status?: "draft" | "published"; version?: boolean } = {}) => {
    if (bad) return false;
    update((st) => {
      const x = st.templates.find((y) => y.id === id)!;
      x.name = name.trim() || x.name; x.category = category; x.suits = suits.length ? suits : [category];
      x.html = doc; x.version += 1; x.updatedAt = Date.now(); x.by = me.name;
      x.edited = x.builtin ? hashDoc(doc) !== x.baseHash : true;
      if (opts.version) { x.versions = x.versions ?? []; x.versions.push({ id: Math.random().toString(36).slice(2), at: Date.now(), name: `v${x.versions.length + 1}`, html: doc, css: "" }); }
      if (opts.status) { x.status = opts.status; x.publishedAt = opts.status === "published" ? Date.now() : 0; }
    });
    log(me.name, opts.status === "published" ? "Published template" : opts.status === "draft" ? "Unpublished template" : opts.version ? "Saved template version" : "Saved template", name);
    setDirty(false);
    return true;
  };
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 1800); };
  const save = () => { if (persist()) go("/templates"); };
  const saveVersion = () => { if (persist({ version: true })) say("Version saved"); };
  const setStatus = (st: "draft" | "published") => { if (persist({ status: st })) say(st === "published" ? "Published: customers can use it" : "Unpublished: hidden from customers"); };
  const close = () => { if (dirty && !confirm("Discard your changes?")) return; go("/templates"); };
  const restore = (vid: string) => {
    const v = versions.find((x) => x.id === vid);
    if (v && (!dirty || confirm("Discard your changes?"))) editCode(v.html);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([doc], { type: "text/html;charset=utf-8" }));
    a.download = `${(name || "template").replace(/[^\w-]+/g, "_")}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="editor-full" role="dialog" aria-modal="true" aria-label="Full-page template editor">
      <div className="editor-bar compact">
        <input aria-label="Template name" value={name} onChange={(e) => { setName(e.target.value); touch(); }} style={{ maxWidth: 240 }} />
        <span className="badge">{tpl.status} · v{tpl.version}</span><span className="badge">Full page</span>{tpl.builtin && <span className="badge">Built in</span>}
        <span className="muted small grow">{flash || (bad ? <span style={{ color: "var(--danger, #c0392b)" }}>{jsonErr ? "Data: " + jsonErr : docErr}</span> : "Customers see this template with their event's name, date and venue filled in.")}</span>
        <select aria-label="Open version" value="" disabled={versions.length === 0} style={{ width: "auto" }} onChange={(e) => e.target.value && restore(e.target.value)}>
          <option value="">Open version… {versions.length > 0 && `(${versions.length})`}</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.name} · {new Date(v.at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</option>)}
        </select>
        <button className="ghost icon" onClick={saveVersion} disabled={!!bad} aria-label="Save version" title="Save version"><Save size={17} /></button>
        <button className="ghost icon" onClick={download} aria-label="Download HTML" title="Download HTML"><Download size={17} /></button>
        {tpl.status === "published"
          ? <button className="ghost sm" onClick={() => setStatus("draft")} disabled={!!bad}>Unpublish</button>
          : <button className="ghost sm" onClick={() => setStatus("published")} disabled={!!bad}>Save & publish</button>}
        <button className="ghost sm" onClick={close}>Cancel</button>
        <button className="sm" onClick={save} disabled={!!bad}>Save</button>
        <button className="ghost icon" aria-label="Close" title="Close" onClick={close}><X size={17} /></button>
      </div>

      <div className="editor-host" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) 1fr", gap: 14, padding: 14, overflow: "auto", alignItems: "start" }}>
        <div className="card" style={{ display: "grid", gap: 12, height: "auto", alignContent: "start" }}>
          <div className="seg" role="group" aria-label="Section" style={{ justifySelf: "start" }}>
            {([["details", "Details"], ["content", "Default content"], ["code", "Page code"]] as const).map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === "details" && (
            <div className="form" style={{ gridTemplateColumns: "1fr" }}>
              <div><label htmlFor="ft-c">Main event type</label><select id="ft-c" value={category} onChange={(e) => { setCategory(e.target.value); touch(); }}>{[...new Set([...EVENT_TYPES, "custom", category])].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div>
                <label>Also suits (listed first for these events)</label>
                <div className="tagrow">{EVENT_TYPES.map((k) => <button type="button" key={k} className="tagbtn" aria-pressed={suits.includes(k)} onClick={() => toggleSuit(k)}>{k}</button>)}</div>
              </div>
              <p className="muted small" style={{ margin: 0 }}>Only <b>published</b> templates are offered to customers. Built-in templates can be unpublished but not deleted. The customer app uses whatever is published here; if nothing is published it shows the built-in set.</p>
            </div>
          )}

          {tab === "content" && (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="muted small" style={{ margin: 0 }}>Sample content stored inside the page: texts for each language (<code>copy</code>), sections shown (<code>sections</code>), itinerary, photos. Customers' own event data (names, date, venue) replaces the event fields.</p>
              <textarea aria-label="Default content (JSON)" spellCheck={false} value={json} onChange={(e) => editJson(e.target.value)} rows={22} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, whiteSpace: "pre", overflow: "auto" }} />
              <div className="row"><button className="ghost sm" disabled={!!jsonErr} onClick={() => { try { setJson(JSON.stringify(JSON.parse(json), null, 2)); } catch { /* invalid */ } }}>Format</button>{jsonErr && <span className="muted small">{jsonErr}</span>}</div>
            </div>
          )}

          {tab === "code" && (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="muted small" style={{ margin: 0 }}>The complete page (HTML, CSS and script). Upload a new version of the file or edit it here.</p>
              <textarea aria-label="Page code (HTML)" spellCheck={false} value={doc} onChange={(e) => editCode(e.target.value)} rows={22} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, whiteSpace: "pre", overflow: "auto" }} />
              <div className="row">
                <input ref={file} type="file" accept=".html,text/html" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
                <button className="ghost sm" onClick={() => file.current?.click()}>Upload .html</button>
                {tpl.builtin && <button className="ghost sm" onClick={reset}>Back to original</button>}
                {docErr && <span className="muted small">{docErr}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: "grid", gap: 8, justifyItems: "center", height: "auto", alignContent: "start" }}>
          <div className="row between" style={{ width: "100%" }}>
            <b>Preview</b>
            <div className="seg" role="group" aria-label="Preview size"><button aria-pressed={!wide} onClick={() => setWide(false)}>Phone</button><button aria-pressed={wide} onClick={() => setWide(true)}>Desktop</button></div>
          </div>
          <iframe title="Template preview" sandbox="allow-scripts allow-popups allow-downloads" srcDoc={docErr ? "<p style='font:14px system-ui;padding:20px'>Fix the page to see the preview.</p>" : preview}
            style={{ border: "1px solid var(--line)", borderRadius: 14, background: "#fff", width: wide ? "100%" : 390, maxWidth: "100%", height: "74vh" }} />
        </div>
      </div>
    </div>
  );
}

