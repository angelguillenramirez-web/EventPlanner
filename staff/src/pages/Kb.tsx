import { useMemo, useState } from "react";
import { log, uid, update, useStore, type Article, type Staff } from "../store";
import { fmtDate, Modal } from "../ui";

/** Knowledge base: 1Plan features and "how to" articles. Everyone with access can search; only a super admin edits. */
export default function Kb({ me }: { me: Staff }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<string>(s.kb[0]?.id ?? "");
  const [edit, setEdit] = useState<Article | "new" | null>(null);
  const cats = [...new Set(s.kb.map((a) => a.category))];
  const rows = useMemo(() => s.kb.filter((a) => (!cat || a.category === cat) && (!q || (a.title + a.body + a.tags.join(" ")).toLowerCase().includes(q.toLowerCase()))), [s, q, cat]);
  const art = s.kb.find((a) => a.id === sel) ?? rows[0];
  const admin = me.role === "super_admin";
  const bold = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
  return (
    <>
      <div className="row between"><h1>Knowledge base</h1>{admin && <button onClick={() => setEdit("new")}>+ New article</button>}</div>
      <p className="muted" style={{ marginTop: -4 }}>1Plan features and how-to guides for helping customers. First version written {fmtDate(s.kbSeededAt)}; it does not update by itself — report anything outdated to a super admin.</p>
      <div className="kb">
        <div className="card">
          <input aria-label="Search articles" placeholder="Search guides…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="tagrow" style={{ margin: "8px 0" }}>{cats.map((c) => <button key={c} className="tagbtn" aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c}</button>)}</div>
          <div className="grid" style={{ gap: 2 }}>
            {rows.map((a) => <button key={a.id} className="ghost" style={{ justifyContent: "flex-start", textAlign: "left", background: art?.id === a.id ? "var(--soft)" : undefined }} onClick={() => setSel(a.id)}>{a.title}</button>)}
            {!rows.length && <p className="muted">No articles match.</p>}
          </div>
        </div>
        {art ? (
          <div className="card">
            <div className="row between"><div><span className="badge">{art.category}</span><h2 style={{ margin: "6px 0 2px" }}>{art.title}</h2></div>
              <div className="row"><CopyBtn text={`${art.title}\n\n${art.body.replace(/\*\*/g, "")}`} />{admin && <><button className="ghost sm" onClick={() => setEdit(art)}>Edit</button><button className="danger sm" onClick={() => { if (confirm(`Delete "${art.title}"?`)) { update((x) => { x.kb = x.kb.filter((y) => y.id !== art.id); }); log(me.name, "Deleted KB article", art.title); } }}>Delete</button></>}</div></div>
            <div className="art">{art.body.split("\n").map((l, i) => <div key={i}>{l ? bold(l) : <br />}</div>)}</div>
            <div className="tagrow" style={{ marginTop: 10 }}>{art.tags.map((t) => <span key={t} className="badge">#{t}</span>)}</div>
            <div className="muted small" style={{ marginTop: 8 }}>Updated {fmtDate(art.updatedAt)} · {art.by}</div>
          </div>
        ) : <div className="card muted">Select an article.</div>}
      </div>
      {edit && <Editor me={me} a={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(id) => { setSel(id); setEdit(null); }} />}
    </>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button className="ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { prompt("Copy this guide:", text); } }}>{ok ? "Copied" : "Copy to reply"}</button>;
}

function Editor({ me, a, onClose, onSaved }: { me: Staff; a: Article | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ title: a?.title ?? "", category: a?.category ?? "Planning", tags: a?.tags.join(", ") ?? "", body: a?.body ?? "" });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const id = a?.id ?? uid();
    const art: Article = { id, title: f.title.trim(), category: f.category.trim() || "General", tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), body: f.body, updatedAt: Date.now(), by: me.name };
    update((x) => { const i = x.kb.findIndex((y) => y.id === id); if (i >= 0) x.kb[i] = art; else x.kb.unshift(art); });
    log(me.name, a ? "Edited KB article" : "Created KB article", art.title); onSaved(id);
  };
  return (
    <Modal title={a ? "Edit article" : "New article"} onClose={onClose} wide>
      <form className="grid" style={{ gap: 12 }} onSubmit={save}>
        <div className="form"><div><label htmlFor="kt">Title *</label><input id="kt" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div><div><label htmlFor="kc">Category</label><input id="kc" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div><div><label htmlFor="kg">Tags (comma separated)</label><input id="kg" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></div></div>
        <div><label htmlFor="kb">Content — use **bold** for emphasis</label><textarea id="kb" rows={12} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>Cancel</button><button disabled={!f.title.trim()}>Save</button></div>
      </form>
    </Modal>
  );
}
