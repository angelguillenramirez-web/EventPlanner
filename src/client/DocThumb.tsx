import { useEffect, useRef, useState } from "react";
import { getBlob } from "../blobstore";

const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
const IMG = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const TEXT = ["txt", "md", "log", "json", "xml", "csv", "tsv", "html", "htm", "yml", "yaml", "ini"];
const BASE_W = 420, BASE_H = 525; // the page is rendered at this size and scaled down to the tile
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const CSS = "body{font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;margin:0;padding:20px;overflow:hidden}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:3px 8px;white-space:nowrap}pre{white-space:pre-wrap;font-size:13px;margin:0}";
const frame = (body: string) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`;

/** A small first-page preview of a document (PDF, image, Word, Excel/CSV, PowerPoint, text). Rendered lazily, only when the tile is on screen. */
export default function DocThumb({ id, name, data, fallback }: { id: string; name: string; data: string; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const slides = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [view, setView] = useState<{ t: "img" | "pdf" | "html" | "pptx" | "none"; src: string }>({ t: "none", src: "" });
  const e = ext(name);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / BASE_W));
    ro.observe(el);
    const io = new IntersectionObserver((r) => { if (r.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "120px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  useEffect(() => {
    if (!seen) return;
    let dead = false, blobUrl = "", destroy: (() => void) | undefined;
    (async () => {
      try {
        const blob = data.startsWith("idb:") ? await getBlob(id) : await (await fetch(data)).blob();
        if (!blob || dead) return;
        if (IMG.includes(e)) { blobUrl = URL.createObjectURL(blob); return setView({ t: "img", src: blobUrl }); }
        if (e === "pdf") { blobUrl = URL.createObjectURL(blob); return setView({ t: "pdf", src: blobUrl + "#toolbar=0&navpanes=0&scrollbar=0&view=FitH" }); }
        if (TEXT.includes(e)) {
          const txt = (await blob.text()).slice(0, 4000);
          if (e === "csv" || e === "tsv") { const sep = e === "tsv" ? "\t" : txt.split("\n")[0].includes(";") && !txt.split("\n")[0].includes(",") ? ";" : ","; return setView({ t: "html", src: frame(`<table>${txt.split("\n").slice(0, 25).map((l) => `<tr>${l.split(sep).slice(0, 8).map((c) => `<td>${esc(c.replace(/"/g, ""))}</td>`).join("")}</tr>`).join("")}</table>`) }); }
          if (e === "html" || e === "htm") return setView({ t: "html", src: frame(txt.replace(/<script[\s\S]*?<\/script>/gi, "")) });
          return setView({ t: "html", src: frame(`<pre>${esc(txt)}</pre>`) });
        }
        const buf = await blob.arrayBuffer();
        if (e === "docx") { const mammoth = await import("mammoth"); const r = await mammoth.convertToHtml({ arrayBuffer: buf }); return setView({ t: "html", src: frame(r.value || "<p></p>") }); }
        if (e === "xlsx") {
          const { default: readXlsxFile } = await import("read-excel-file/browser");
          const sheets = (await readXlsxFile(buf)) as { data: unknown[][] }[];
          const rows = (sheets[0]?.data ?? []).slice(0, 25);
          return setView({ t: "html", src: frame(`<table>${rows.map((r) => `<tr>${r.slice(0, 8).map((c) => `<td>${esc(c instanceof Date ? c.toLocaleDateString() : c == null ? "" : String(c))}</td>`).join("")}</tr>`).join("")}</table>`) });
        }
        if (e === "pptx") {
          setView({ t: "pptx", src: "" });
          await new Promise((r) => setTimeout(r, 0));
          const { init } = await import("pptx-preview");
          const host = slides.current; if (!host || dead) return;
          host.innerHTML = "";
          const p = init(host, { width: BASE_W, height: Math.round(BASE_W * 0.5625), mode: "slide" });
          destroy = () => { try { p.destroy(); } catch { /* gone */ } };
          await p.preview(buf);
        }
      } catch { if (!dead) setView({ t: "none", src: "" }); }
    })();
    return () => { dead = true; if (blobUrl) URL.revokeObjectURL(blobUrl); destroy?.(); };
  }, [seen, id, data, e]);

  const place: React.CSSProperties = { width: BASE_W, height: BASE_H, transform: `scale(${scale})` };
  return (
    <div className="minithumb" ref={box}>
      {view.t === "img" && <img src={view.src} alt="" />}
      {view.t === "pdf" && <iframe title={name} src={view.src} tabIndex={-1} style={place} />}
      {view.t === "html" && <iframe title={name} sandbox="" srcDoc={view.src} tabIndex={-1} style={{ ...place, background: "#fff" }} />}
      {view.t === "pptx" && <div ref={slides} style={{ width: BASE_W, height: Math.round(BASE_W * 0.5625), transform: `scale(${scale})`, top: "20%" }} />}
      {view.t === "none" && <div className="ph" style={{ position: "absolute", inset: 0 }}>{fallback}</div>}
    </div>
  );
}
