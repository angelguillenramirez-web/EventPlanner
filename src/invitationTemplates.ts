import { COLORS, type EventT } from "./store";

export const TEMPLATE_IDS = ["classic", "party", "minimal", "floral", "modern", "gold"] as const;
const FONTS: Record<string, string> = { serif: "Georgia, serif", sans: "system-ui, sans-serif", script: "'Brush Script MT', cursive", mono: "'Courier New', monospace" };

export interface TplText { title: string; message: string; date: string; typeName: string; venue: string }

/** HTML (inline-styled, so the visual editor can edit every piece) for a ready-made invitation template. */
export function templateHtml(id: string, ev: EventT, x: TplText): string {
  const c = ev.design.color, font = FONTS[ev.design.font] ?? FONTS.serif;
  const base = `font-family:${font};text-align:center;padding:40px 28px;max-width:560px;margin:24px auto;border-radius:16px;`;
  const sty: Record<string, string> = {
    classic: `background:#fffdf8;color:#2a2326;border:6px double ${c};`,
    party: `background:${c};color:#14110a;`,
    minimal: `background:#fff;color:#222;border:1px solid #ddd;border-top:6px solid ${c};`,
    floral: `background:color-mix(in srgb, ${c} 18%, #fff);color:#2a2326;border:2px solid ${c};`,
    modern: `background:#fff;color:#222;border-left:20px solid ${c};text-align:left;`,
    gold: `background:#17130a;color:${COLORS.gold};border:2px solid ${COLORS.gold};`,
  };
  const deco = id === "party" ? "🎉 🎈 🎊" : id === "floral" ? "🌸 🌿 🌸" : id === "gold" ? "✦ ✦ ✦" : "";
  return `<div style="${base}${sty[id] ?? sty.classic}">
${deco ? `<div style="font-size:28px;margin-bottom:8px;">${deco}</div>` : ""}<div style="opacity:.7;font-size:13px;letter-spacing:.15em;text-transform:uppercase;">${esc(x.typeName)}</div>
<h1 style="font-size:38px;line-height:1.1;margin:10px 0;">${esc(x.title)}</h1>
<p style="font-size:16px;line-height:1.5;">${esc(x.message)}</p>
<p style="font-weight:600;margin-top:20px;">${esc(x.date)}</p>${x.venue ? `\n<p>${esc(x.venue)}</p>` : ""}
</div>`;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Full document, used for thumbnails and the HTML export. */
export const invitationDoc = (html: string, css: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;500;700&family=Dancing+Script:wght@500;700&family=Cormorant+Garamond:wght@400;600&family=Lobster&family=Pacifico&family=Lora:wght@400;600&display=swap"><style>body{margin:0;background:#f4f1ea;}${css}</style></head><body>${html}</body></html>`;
