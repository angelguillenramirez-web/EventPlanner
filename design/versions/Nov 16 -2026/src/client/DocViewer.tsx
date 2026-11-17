import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
const IMG = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const TEXT = ["txt", "md", "log", "json", "xml", "csv", "tsv", "html", "htm", "yml", "yaml", "ini", "rtf"];
type Sheet = { sheet: string; data: unknown[][] };

const prettyXml = (src: string) => {
  let depth = 0;
  return src.replace(/>\s*</g, ">\n<").split("\n").map((line) => {
    if (/^<\/.+>/.test(line)) depth = Math.max(0, depth - 1);
    const out = "  ".repeat(depth) + line;
    if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/.+>$/.test(line)) depth++;
    return out;
  }).join("\n");
};
const parseCsv = (txt: string, sep: string) => {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
const DOC_CSS = "body{font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.55;color:#14203A;padding:24px 32px;max-width:820px;margin:0 auto}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #EDE6D8;padding:4px 8px}";

/** Read-only viewer for documents: PDF, images, text/XML/JSON/CSV, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx). All rendered in the browser with free, open-source libraries. */
export default function DocViewer({ name, data }: { name: string; data: string }) {
  const { t } = useT();
  const e = ext(name);
  const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [tab, setTab] = useState(0);
  const slides = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false, blobUrl = "", destroy: (() => void) | undefined;
    const ok = () => !dead && setState("ready");
    (async () => {
      try {
        if (IMG.includes(e)) { setUrl(data); return ok(); }
        const blob = await (await fetch(data)).blob();
        if (e === "pdf") { blobUrl = URL.createObjectURL(blob); setUrl(blobUrl); return ok(); }
        if (TEXT.includes(e)) {
          let txt = await blob.text();
          if (e === "xml") txt = prettyXml(txt); else if (e === "json") { try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch { /* show as is */ } }
          if (e === "csv" || e === "tsv") setSheets([{ sheet: name, data: parseCsv(txt, e === "tsv" ? "\t" : txt.split("\n")[0].includes(";") && !txt.split("\n")[0].includes(",") ? ";" : ",") }]);
          else if (e === "html" || e === "htm") setHtml(txt);
          else setText(txt);
          return ok();
        }
        const buf = await blob.arrayBuffer();
        if (e === "docx") {
          const mammoth = await import("mammoth");
          const r = await mammoth.convertToHtml({ arrayBuffer: buf });
          setHtml(r.value || "<p></p>"); return ok();
        }
        if (e === "xlsx") {
          const { default: readXlsxFile } = await import("read-excel-file/browser");
          setSheets((await readXlsxFile(buf)) as Sheet[]); return ok();
        }
        if (e === "pptx") {
          setState("ready");
          await new Promise((r) => setTimeout(r, 0));
          const { init } = await import("pptx-preview");
          const host = slides.current; if (!host || dead) return;
          host.innerHTML = "";
          const p = init(host, { width: Math.min(host.clientWidth || 800, 900), height: Math.round(Math.min(host.clientWidth || 800, 900) * 0.5625), mode: "slide" });
          destroy = () => { try { p.destroy(); } catch { /* already gone */ } };
          await p.preview(buf); return;
        }
        if (!dead) setState("unsupported");
      } catch { if (!dead) setState("error"); }
    })();
    return () => { dead = true; if (blobUrl) URL.revokeObjectURL(blobUrl); destroy?.(); };
  }, [data, e]); // eslint-disable-line

  if (state === "loading") return <p className="muted">…</p>;
  if (state === "unsupported" || state === "error") return <div style={{ textAlign: "center", padding: "30px 0" }}><p className="muted">{state === "error" ? t("docs.viewerr") : t("docs.nopreview")}</p><p className="muted small">{t("docs.legacy")}</p></div>;
  const box: React.CSSProperties = { width: "100%", height: "68vh", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" };
  if (IMG.includes(e)) return <div style={{ textAlign: "center" }}><img src={url} alt={name} style={{ maxWidth: "100%", maxHeight: "68vh", borderRadius: 12 }} /></div>;
  if (e === "pdf") return <iframe title={name} src={url} style={box} />;
  if (e === "pptx") return <div ref={slides} className="pptview" style={{ ...box, overflow: "auto", display: "grid", placeItems: "center" }} />;
  if (html) return <iframe title={name} sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><style>${DOC_CSS}</style>${html}`} style={{ ...box, background: "#fff" }} />;
  if (sheets.length) {
    const cur = sheets[Math.min(tab, sheets.length - 1)];
    const rows = cur.data.slice(0, 500);
    return (
      <div>
        {sheets.length > 1 && <div className="tabs" style={{ margin: "0 0 8px" }}>{sheets.map((s, i) => <a key={i} href="#" aria-current={i === tab ? "page" : undefined} onClick={(ev) => { ev.preventDefault(); setTab(i); }}>{s.sheet}</a>)}</div>}
        <div style={{ ...box, overflow: "auto" }}>
          <table className="sheet"><tbody>{rows.map((r, i) => <tr key={i}>{(r as unknown[]).slice(0, 40).map((c, j) => <td key={j}>{c instanceof Date ? c.toLocaleDateString() : c == null ? "" : String(c)}</td>)}</tr>)}</tbody></table>
        </div>
        {cur.data.length > 500 && <p className="muted small">{t("docs.truncated")}</p>}
      </div>
    );
  }
  return <pre style={{ ...box, overflow: "auto", margin: 0, padding: 14, whiteSpace: "pre-wrap", fontSize: ".82rem" }}>{text}</pre>;
}
