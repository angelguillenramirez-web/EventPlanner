import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { COLORS, uid, update, useStore, type Doc, type EventT } from "../store";
import { ChevronLeft, Download, Folder, LayoutGrid, List, Plus, Trash2 } from "../icons";
import { Modal } from "./ui";
import DocViewer from "./DocViewer";
import DocThumb from "./DocThumb";
import { delBlob, getBlob, putBlob } from "../blobstore";
import { ask } from "./Ask";

const MAX = 1.5 * 1024 * 1024; // prototype keeps files in the browser (localStorage)
const KINDS: Record<string, { label: string; color: string }> = { pdf: { label: "PDF", color: COLORS.rose }, doc: { label: "DOC", color: COLORS.blue }, docx: { label: "DOC", color: COLORS.blue }, ppt: { label: "PPT", color: "#FF9C7F" }, pptx: { label: "PPT", color: "#FF9C7F" } };
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
const kind = (name: string) => KINDS[ext(name)] ?? { label: (ext(name) || "FILE").slice(0, 4).toUpperCase(), color: "#6B6458" }; // any document type is accepted
const IMG = ["png", "jpg", "jpeg", "gif", "webp"];
const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

function Mini({ d, onOpen, onDelete, label }: { d: Doc; onOpen: () => void; onDelete: () => void; label: string }) {
  const k = kind(d.name);
  return (
    <div className="mini" tabIndex={0} role="button" title={d.name} onDoubleClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <DocThumb id={d.id} name={d.name} data={d.data} fallback={<b className="kind" style={{ background: k.color }}>{k.label}</b>} />
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{d.name}</div>
      <div className="muted small">{fmtSize(d.size)}</div>
      <button className="ghost icon x" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={14} /></button>
    </div>
  );
}

function Preview({ d, onClose }: { d: Doc; onClose: () => void }) {
  const { t } = useT();
  const [src, setSrc] = useState(d.data.startsWith("idb:") ? "" : d.data); // big PDFs are kept in IndexedDB
  useEffect(() => {
    if (!d.data.startsWith("idb:")) return;
    let u = "", dead = false;
    getBlob(d.id).then((b) => { if (b && !dead) { u = URL.createObjectURL(b); setSrc(u); } });
    return () => { dead = true; if (u) URL.revokeObjectURL(u); };
  }, [d.id, d.data]);
  const download = () => { if (!src) return; const a = document.createElement("a"); a.href = src; a.download = d.name; a.click(); };
  return (
    <Modal title={d.name} onClose={onClose} wide>
      {src ? <DocViewer name={d.name} data={src} /> : <p className="muted">…</p>}
      <div className="row between" style={{ marginTop: 12 }}><span className="muted small">{fmtSize(d.size)} · {t("docs.viewonly")}</span><button className="ghost" onClick={download}><Download size={15} /> {t("docs.download")}</button></div>
    </Modal>
  );
}

export default function Documents({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const folders = s.folders.filter((f) => f.eventId === event.id);
  const docs = s.documents.filter((d) => d.eventId === event.id);

  useEffect(() => { // first visit: create the default folders
    if (folders.length === 0) update((st) => { ["contracts", "invoices", "permits", "inspiration"].forEach((k) => st.folders.push({ id: uid(), eventId: event.id, name: t("folder." + k), createdAt: Date.now(), modifiedAt: Date.now() })); });
  }, [event.id]); // eslint-disable-line

  const addFiles = (files: FileList, folderId: string) => {
    const errs: string[] = [];
    Array.from(files).forEach((f) => {
      const id = uid();
      const base = { id, eventId: event.id, folderId, name: f.name.slice(0, 200), category: "", size: f.size, mime: f.type, createdAt: Date.now() };
      const add = (data: string) => update((st) => { const fo = st.folders.find((x) => x.id === folderId); if (fo) fo.modifiedAt = Date.now(); st.documents.unshift({ ...base, data }); });
      if (ext(f.name) === "pdf" && f.size > MAX) { putBlob(id, f).then(() => add("idb:" + id)).catch(() => setMsg(`${f.name}: ${t("docs.toobig")}`)); return; } // PDFs of any size
      if (f.size > MAX) { errs.push(`${f.name}: ${t("docs.toobig")}`); return; }
      const r = new FileReader();
      r.onload = () => add(String(r.result));
      r.readAsDataURL(f);
    });
    setMsg(errs.join(" · "));
  };
  const dropProps = (key: string, folderId: string) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(key); } },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(null); addFiles(e.dataTransfer.files, folderId); },
  });
  const delDoc = (d: Doc) => ask(`${t("confirm.delete")}\n${d.name}`, () => { if (d.data.startsWith("idb:")) delBlob(d.id); update((st) => { st.documents = st.documents.filter((x) => x.id !== d.id); const fo = st.folders.find((x) => x.id === d.folderId); if (fo) fo.modifiedAt = Date.now(); }); }, { danger: true });
  const when = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const toggle = (
    <div className="seg" role="group" aria-label={t("docs.view")}>
      <button aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={14} /> {t("docs.grid")}</button>
      <button aria-pressed={view === "list"} onClick={() => setView("list")}><List size={14} /> {t("docs.list")}</button>
    </div>
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const createFolder = () => {
    const name = (newFolder ?? "").trim();
    if (name) update((st) => { st.folders.push({ id: uid(), eventId: event.id, name, createdAt: Date.now(), modifiedAt: Date.now() }); });
    setNewFolder(null);
  };
  const cur = folders.find((f) => f.id === open);

  if (cur) {
    const list = docs.filter((d) => d.folderId === cur.id);
    return (
      <>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="ghost icon" aria-label={t("back")} title={t("back")} onClick={() => { setOpen(null); setMsg(""); }}><ChevronLeft size={18} /></button>
          <h2 style={{ margin: 0 }}>{cur.name}</h2><span className="muted" style={{ flex: 1 }}>{list.length}</span>{toggle}
        </div>
        {list.length === 0 && <div className={`dropzone${over === cur.id ? " over" : ""}`} {...dropProps(cur.id, cur.id)}>{t("docs.drop")}</div>}
        {msg && <p role="alert" style={{ color: "var(--danger)" }}>{msg}</p>}
        {list.length === 0 ? <p className="muted">{t("none")}</p> : view === "grid" ? (
          <div className="minis">{list.map((d) => <Mini key={d.id} d={d} label={t("delete")} onOpen={() => setPreview(d)} onDelete={() => delDoc(d)} />)}</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table>
              <thead><tr><th>{t("name")}</th><th>{t("docs.size")}</th><th>{t("docs.created")}</th><th>{t("docs.modified")}</th><th /></tr></thead>
              <tbody>{list.map((d) => (
                <tr key={d.id} tabIndex={0} style={{ cursor: "pointer" }} onDoubleClick={() => setPreview(d)} onKeyDown={(e) => e.key === "Enter" && setPreview(d)}>
                  <td><span className="row" style={{ gap: 8 }}><b className="kind" style={{ background: KINDS[ext(d.name)]?.color }}>{KINDS[ext(d.name)]?.label}</b>{d.name}</span></td>
                  <td className="muted small">{fmtSize(d.size)}</td><td className="muted small">{when(d.createdAt)}</td><td className="muted small">{when(d.createdAt)}</td>
                  <td><button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => delDoc(d)}><Trash2 size={14} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {list.length > 0 && <div className={`dropzone small${over === cur.id ? " over" : ""}`} style={{ marginTop: 14 }} {...dropProps(cur.id, cur.id)}>{t("docs.drop")}</div>}
        {preview && <Preview d={preview} onClose={() => setPreview(null)} />}
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files, cur.id); e.target.value = ""; }} />
        <button className="newfab" onClick={() => fileInput.current?.click()}><Plus size={22} /> {t("docs.uploadfiles")}</button>
      </>
    );
  }
  const folderProps = (f: { id: string; name: string }) => ({ tabIndex: 0, role: "button", "aria-label": f.name, onDoubleClick: () => { setOpen(f.id); setMsg(""); }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") { setOpen(f.id); setMsg(""); } }, ...dropProps(f.id, f.id) });
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{t("docs.intro")}</p>
        <div className="row">
          {toggle}
        </div>
      </div>
      {msg && <p role="alert" style={{ color: "var(--danger)" }}>{msg}</p>}
      {view === "grid" ? (
        <div className="folders">
          {folders.map((f) => (
            <div key={f.id} className={`foldertile${over === f.id ? " over" : ""}`} {...folderProps(f)}>
              <div className="ftab" /><div className="fbody"><span className="fname">{f.name}</span><span className="fcount">{docs.filter((d) => d.folderId === f.id).length}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead><tr><th>{t("name")}</th><th>{t("docs.items")}</th><th>{t("docs.created")}</th><th>{t("docs.modified")}</th></tr></thead>
            <tbody>{folders.map((f) => (
              <tr key={f.id} className={over === f.id ? "dropover" : ""} style={{ cursor: "pointer" }} {...folderProps(f)}>
                <td><span className="row" style={{ gap: 8 }}><Folder size={18} style={{ color: "var(--gold)" }} />{f.name}</span></td>
                <td className="muted small">{docs.filter((d) => d.folderId === f.id).length}</td><td className="muted small">{when(f.createdAt)}</td><td className="muted small">{when(f.modifiedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <button className="newfab" onClick={() => setNewFolder("")}><Plus size={22} /> {t("folder.new")}</button>
      {newFolder !== null && (
        <Modal title={t("folder.new")} onClose={() => setNewFolder(null)}>
          <form onSubmit={(e) => { e.preventDefault(); createFolder(); }}>
            <label htmlFor="fn">{t("folder.name")}</label><input id="fn" autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button type="button" className="ghost" onClick={() => setNewFolder(null)}>{t("cancel")}</button><button disabled={!newFolder.trim()}>{t("add")}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
