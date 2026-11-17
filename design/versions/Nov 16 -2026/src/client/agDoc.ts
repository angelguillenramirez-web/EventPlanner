import type { AgPaper, AgSection } from "../store";

export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Keeps agreement text to a safe set of tags (headings, lists, tables, basic formatting); attributes are dropped. */
export function cleanDoc(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ALLOW = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "DIV", "P", "BR", "UL", "OL", "LI", "H2", "H3", "H4", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "HR", "SMALL"]);
  const walk = (n: Element) => Array.from(n.children).forEach((c) => {
    if (!ALLOW.has(c.tagName)) { c.replaceWith(...Array.from(c.childNodes)); return; }
    Array.from(c.attributes).forEach((a) => c.removeAttribute(a.name));
    walk(c);
  });
  walk(doc.body);
  return doc.body.innerHTML;
}

/** Cleans a whole generated document (text plus pictures and the seating plan): no scripts, event handlers or script URLs; frames stay sandboxed. */
export function cleanVis(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,object,embed,link,meta,base,form").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    Array.from(n.attributes).forEach((a) => { if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); });
    if (n.tagName === "IFRAME") n.setAttribute("sandbox", "");
  });
  return doc.body.innerHTML;
}

/* ───── paper: colours and textures ───── */
export const PAPER_COLORS = ["#ffffff", "#FFFBF5", "#F5EFE4", "#E3F0FF", "#E6F7F4", "#FFE9E2", "#F5EFE4"];
const svg = (s: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;
/** Preset textures; each is a CSS background layer drawn over the paper colour. */
export const TEXTURES: Record<string, string> = {
  linen: "repeating-linear-gradient(0deg, rgba(0,0,0,.035) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.03) 0 1px, transparent 1px 3px)",
  grain: svg("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .16 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>"),
  parchment: "radial-gradient(ellipse at 20% 10%, rgba(240,180,41,.12), transparent 55%), radial-gradient(ellipse at 90% 90%, rgba(184,169,138,.14), transparent 50%)",
  dots: "radial-gradient(rgba(0,0,0,.09) 1px, transparent 1.2px) 0 0 / 14px 14px",
  grid: "linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px) 0 0 / 22px 22px",
};
/** CSS `background` value for a paper. */
export const paperBg = (p?: AgPaper): string => {
  const c = p?.color || "#ffffff";
  if (p?.texture === "custom" && p.image) return `url("${p.image}") center / cover, ${c}`;
  const t = p?.texture ? TEXTURES[p.texture] : "";
  return t ? `${t}, ${c}` : c;
};
const LOGO_PX = { s: 56, m: 90, l: 130 };
/** The logo block at the top of the document (empty when no logo is chosen). */
export const logoHtml = (p: AgPaper | undefined, accountLogo: string): string => {
  const src = p?.logo === "account" ? accountLogo : p?.logo === "upload" ? p.logoImg : "";
  if (!src || !/^(data:image\/|https?:)/.test(src)) return "";
  return `<div class="aglogo" style="text-align:${p?.logoAlign ?? "center"}"><img src="${esc(src)}" alt="" style="max-height:${LOGO_PX[p?.logoSize ?? "m"]}px;max-width:60%"></div>`;
};

const CSS = "body{font-family:Georgia,'Times New Roman',serif;color:#14203A;line-height:1.55}.agprint{max-width:760px;margin:0 auto;padding:40px 32px}h1{font-size:1.7rem;text-align:center;margin:0 0 4px}h2{font-size:1.15rem;border-bottom:1px solid #EDE6D8;padding-bottom:4px;margin-top:28px}h3{font-size:1rem;margin:14px 0 4px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #EDE6D8;padding:5px 8px;text-align:left;vertical-align:top}.muted{color:#6B6458}.sig{display:flex;gap:40px;margin-top:60px}.sig div{flex:1;border-top:1px solid #1F2937;padding-top:6px}.agvis{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0}.agfig{margin:0;width:150px;break-inside:avoid}.agfig img{width:100%;height:110px;object-fit:cover;border-radius:4px;border:1px solid #EDE6D8}.agfig figcaption{font-size:.78rem;text-align:center;margin-top:3px}.agfig.wide{width:100%}.agfig.wide .seatview{width:100%}.agfig.inv{width:300px}.aglogo{margin:0 0 14px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";
/** The complete agreement as one HTML document (print, download, approval snapshot). */
export const docHtml = (title: string, sub: string, sections: AgSection[], footer = "", logo = "") =>
  `${logo}<h1>${esc(title)}</h1><p class="muted" style="text-align:center">${esc(sub)}</p>${sections.filter((s) => s.included).map((s, i) => `<h2>${i + 1}. ${esc(s.title)}</h2>${cleanDoc(s.html)}${s.showVis !== false && s.vis ? cleanVis(s.vis) : ""}`).join("")}${footer}`;
/** All the app's style rules, so the seating plan looks the same in a printed or downloaded copy. */
const appCss = () => { try { return Array.from(document.styleSheets).flatMap((ss) => { try { return Array.from(ss.cssRules); } catch { return []; } }).map((r) => r.cssText).join("\n"); } catch { return ""; } };
export const fullDoc = (title: string, body: string, paper?: AgPaper) => `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${appCss()}</style><style>html,body{background:${paperBg(paper)};margin:0;color:#14203A}${CSS}</style></head><body><div class="agprint">${body}</div></body></html>`;
