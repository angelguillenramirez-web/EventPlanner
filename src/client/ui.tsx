import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import type { Priority } from "../store";
import { LockI, X } from "../icons";
import { reduce } from "../motion";

export const Bar = ({ value, max }: { value: number; max: number }) => (
  <div className="bar" role="progressbar" aria-valuenow={max ? Math.round((value / max) * 100) : 0} aria-valuemin={0} aria-valuemax={100}><i style={{ width: (max ? (value / max) * 100 : 0) + "%" }} /></div>
);
export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
export function PriBadge({ p }: { p: Priority }) {
  const { t } = useT();
  if (!p) return null;
  return <span className={`pill pri-${p}`}>{t("pri." + p)}</span>;
}
export function Modal({ title, onClose, children, wide, xl, headerExtra }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; /** extra large (side-by-side editors) */ xl?: boolean; headerExtra?: React.ReactNode }) {
  const [out, setOut] = useState(false); // closing: play the exit animation first
  const close = () => { if (out) return; if (reduce()) { onClose(); return; } setOut(true); setTimeout(onClose, 170); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line
  return (
    <div className={`modal-bg${out ? " out" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={xl ? { width: "min(1240px, 96vw)" } : wide ? { width: 860 } : undefined}>
        <div className="row between"><div className="row" style={{ flexWrap: "nowrap" }}><h3 style={{ margin: 0 }}>{title}</h3>{headerExtra}</div><button className="ghost sm icon" aria-label="Close" onClick={close}><X size={14} /></button></div>
        {children}
      </div>
    </div>
  );
}
export function Lock({ on, children }: { on: boolean; children?: React.ReactNode }) {
  return on ? <span className="lock" ><LockI /> {children}</span> : <>{children}</>;
}

const PALETTE = ["#FF7A59", "#FF9C7F", "#F0B429", "#46C8B2", "#6FA8FF", "#9B87F5", "#14203A", "#6B6458", "#ffffff"];
const HL_PALETTE = ["#FFF3C4", "#F0B429", "#FFE9E2", "#E6F7F4", "#E3F0FF", "#FFE9E2", "#EEE8FF"];

/** Keeps note HTML to a small safe set of tags/styles (notes come from a contentEditable). */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ALLOW = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT", "DIV", "P", "BR", "UL", "OL", "LI"]);
  const STYLES = ["color", "background-color", "font-family", "font-size", "font-weight", "text-decoration", "text-decoration-line"];
  const walk = (node: Element) => {
    Array.from(node.children).forEach((c) => {
      if (!ALLOW.has(c.tagName)) { c.replaceWith(...Array.from(c.childNodes)); return; }
      Array.from(c.attributes).forEach((a) => { if (!["style", "color", "face", "size"].includes(a.name)) c.removeAttribute(a.name); });
      const st = (c as HTMLElement).style;
      if (st) Array.from(st).forEach((prop) => { if (!STYLES.includes(prop)) st.removeProperty(prop); });
      walk(c);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
export const isEmptyHtml = (html: string) => !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
export const NoteView = ({ html }: { html: string }) => <div className="noteview" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;

/** Notes editor: font, size, bold, strike-through, text colour (A) and highlight (F). Reports HTML on every edit. */
export const RichText = forwardRef<{ clear: () => void }, { onChange: (html: string) => void }>(function RichText({ onChange }, outer) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState<string | null>(null); // null = theme text colour
  const [hl, setHl] = useState("#F0B429");
  const [pop, setPop] = useState<"color" | "hl" | null>(null);
  useImperativeHandle(outer, () => ({ clear: () => { if (ref.current) ref.current.innerHTML = ""; onChange(""); } }));
  const emit = () => onChange(ref.current!.innerHTML);
  // Buttons keep the editor focused (mousedown is cancelled), so the current selection is what gets formatted.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const cmd = (c: string, v?: string) => { ref.current?.focus(); document.execCommand("styleWithCSS", false, "true"); document.execCommand(c, false, v); emit(); };
  return (
    <div className="rte">
      <div className="tb" role="toolbar" aria-label={t("notes")}>
        <select aria-label={t("rte.font")} title={t("rte.font")} defaultValue="" onMouseDown={() => setPop(null)} onChange={(e) => { if (e.target.value) cmd("fontName", e.target.value); e.target.value = ""; }}>
          <option value="">{t("rte.font")}</option><option>Roboto</option><option>Georgia</option><option>Arial</option><option>Courier New</option><option>Trebuchet MS</option>
        </select>
        <select aria-label={t("rte.size")} title={t("rte.size")} defaultValue="" onMouseDown={() => setPop(null)} onChange={(e) => { if (e.target.value) cmd("fontSize", e.target.value); e.target.value = ""; }}>
          <option value="">{t("rte.size")}</option><option value="2">S</option><option value="3">M</option><option value="5">L</option><option value="6">XL</option>
        </select>
        <button type="button" className="ghost sm" aria-label={t("rte.bold")} title={t("rte.bold")} onMouseDown={keep} onClick={() => cmd("bold")}><b>B</b></button>
        <button type="button" className="ghost sm" aria-label={t("rte.strike")} title={t("rte.strike")} onMouseDown={keep} onClick={() => cmd("strikeThrough")}><s>S</s></button>
        <span style={{ position: "relative" }}>
          <button type="button" className="rtbtn" aria-label={t("rte.textcolor")} title={t("rte.textcolor")} aria-expanded={pop === "color"} onMouseDown={keep} onClick={() => setPop(pop === "color" ? null : "color")}>
            <span style={{ color: color ?? "var(--ink)", fontWeight: 700 }}>A</span>
          </button>
          {pop === "color" && (
            <div className="swatches" role="menu" onMouseDown={keep}>
              {PALETTE.map((c) => <button key={c} type="button" role="menuitem" aria-label={c} className="sw" style={{ background: c }} onClick={() => { setColor(c); cmd("foreColor", c); setPop(null); }} />)}
            </div>
          )}
        </span>
        <span style={{ position: "relative" }}>
          <button type="button" className="rtbtn" aria-label={t("rte.highlightcolor")} title={t("rte.highlightcolor")} aria-expanded={pop === "hl"} onMouseDown={keep} onClick={() => setPop(pop === "hl" ? null : "hl")}>
            <span style={{ background: hl, color: "#14203A", fontWeight: 700, padding: "0 5px", borderRadius: 2 }}>F</span>
          </button>
          {pop === "hl" && (
            <div className="swatches" role="menu" onMouseDown={keep}>
              {HL_PALETTE.map((c) => <button key={c} type="button" role="menuitem" aria-label={c} className="sw" style={{ background: c }} onClick={() => { setHl(c); cmd("hiliteColor", c); setPop(null); }} />)}
              <button type="button" role="menuitem" className="sw none" aria-label={t("rte.nohighlight")} title={t("rte.nohighlight")} onClick={() => { cmd("hiliteColor", "transparent"); setPop(null); }}>×</button>
            </div>
          )}
        </span>
      </div>
      <div ref={ref} className="ed" contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label={t("notes")} onInput={emit} />
    </div>
  );
});

/** Small squared window anchored to a button. It is drawn on top of everything (never clipped by a table), and closes when you click outside it or press Escape. */
export function Popover({ anchor, onClose, width = 260, children, label }: { anchor: DOMRect; onClose: () => void; width?: number; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => { if (ref.current) setH(ref.current.offsetHeight); }, [children]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); window.addEventListener("scroll", onClose, true); window.addEventListener("resize", onClose);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("scroll", onClose, true); window.removeEventListener("resize", onClose); };
  }); // eslint-disable-line
  const w = Math.min(width, window.innerWidth - 16);
  const left = Math.max(8, Math.min(anchor.right - w, window.innerWidth - w - 8));
  const below = anchor.bottom + 6;
  const top = h && below + h > window.innerHeight - 8 ? Math.max(8, anchor.top - h - 6) : below;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-label={label} onMouseDown={(e) => e.stopPropagation()} style={{ position: "fixed", left, top, width: w, padding: 12, boxSizing: "border-box", overflowWrap: "anywhere", background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 4, boxShadow: "0 10px 30px rgba(0,0,0,.22)" }}>{children}</div>
    </div>,
    document.body,
  );
}
