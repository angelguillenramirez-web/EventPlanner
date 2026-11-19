import type { EventT, TplFields } from "./store";
import { BUILTIN_TEMPLATES } from "./templates";
import { usePublic } from "./bridge";


export interface TplText { title: string; message: string; date: string; typeName: string; venue: string; /** event date as YYYY-MM-DD (full-page templates need the real date) */ iso?: string; time?: string; /** every customized value (full-page templates use them) */ extra?: TplFields }

/** Invitation document for a ready-made template (every template is a full page; unknown ids fall back to the first). */
export function templateHtml(id: string, ev: EventT, x: TplText): string {
  const list = catalog();
  return fullPageDoc((list.find((t) => t.id === id) ?? list[0]).id, ev, x);
}

/** Full-page templates (own fonts, scripts, music) are stored as a complete HTML document and shown as they are. */
export const isFullDoc = (html: string) => /^\s*<!doctype html/i.test(html);
/** iframe sandbox for an invitation: only full-page templates run scripts (no same-origin, no top navigation). */
export const invSandbox = (html: string) => (isFullDoc(html) ? "allow-scripts allow-popups allow-downloads" : "");

const DATA_RE = /(<script type="application\/json" id="invitation-data">)([\s\S]*?)(<\/script>)/;
function editData(doc: string, fn: (d: any) => void): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  return doc.replace(DATA_RE, (_m, a: string, json: string, b: string) => { const d = JSON.parse(json); fn(d); return a + "\n" + JSON.stringify(d, null, 2).replace(/</g, "\\u003c") + "\n" + b; });
}
/** Shows a full-page invitation for one guest (name and number of seats). */
export const personalizeDoc = (doc: string, name: string, people: number) => !isFullDoc(doc) ? doc : editData(doc, (d) => { d.guest = { ...d.guest, name, people, maxPeople: people, description: {}, status: {}, message: {} }; });

/** A full-page template as the app lists it. */
export interface CatalogEntry { id: string; name: string; category: string; suits: string[]; html: string; builtin: boolean }
const bundled: CatalogEntry[] = BUILTIN_TEMPLATES.map((b) => ({ ...b, builtin: true }));
let live: CatalogEntry[] | null = null;
/** Full-page templates published from the 643 staff console. Nothing published (or bridge offline) = the built-in set. */
export function setLiveTemplates(list: { id: string; name: string; category: string; html: string; full?: boolean; suits?: string[] }[] | null) {
  const f = (list ?? []).filter((t) => t.full && isFullDoc(t.html));
  live = f.length ? f.map((t) => ({ id: t.id, name: t.name, category: t.category, suits: t.suits?.length ? t.suits : [t.category], html: t.html, builtin: bundled.some((b) => b.id === t.id) })) : null;
}
const catalog = (): CatalogEntry[] => live ?? bundled;
/** Keeps the template list in step with 643. Call it in any component that lists templates. */
export function useCatalog() { const pub = usePublic(); setLiveTemplates(pub?.templates ?? null); return pub; }
/** Name for templates that are not built in (staff-added ones); built-in ones use the translated labels. */
export const catalogName = (id: string): string | null => { const e = catalog().find((t) => t.id === id); return e && !e.builtin ? e.name : null; };
/** Template ids for an event type: the ones that suit it first, then the rest. */
export function templatesFor(type: string): string[] {
  const all = catalog(), first = all.filter((t) => t.suits.includes(type) || t.category === type);
  return [...first, ...all.filter((t) => !first.includes(t))].map((t) => t.id);
}

/** Builds the invitation HTML from the user's customized values. */
export function buildInvitation(tpl: string, ev: EventT, f: TplFields, locale: string, typeName: string): string {
  return templateHtml(tpl, ev, { title: f.title, message: f.message, date: new Date(f.iso + "T12:00").toLocaleDateString(locale, { dateStyle: "full" }), typeName, venue: f.venue, iso: f.iso, time: f.time, extra: f });
}

function fullPageDoc(id: string, ev: EventT, x: TplText): string {
  const X = x.extra, iso = x.iso || ev.date, time = x.time || ev.time || "17:00";
  const start = new Date(`${iso}T${time}`); if (isNaN(+start)) start.setTime(Date.now() + 30 * 864e5);
  const names = x.title.replace(/^\s*(boda|wedding|casamiento|cumplea[ñn]os|cumple|birthday|fiesta|party)\s+(de|of)\s+/i, "").split(/\s+(?:&|y|and)\s+/i).map((n) => n.trim()).filter(Boolean).slice(0, 2);
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const mins = (t: string) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const deadline = new Date(+start - 30 * 864e5);
  const music = new URL(`${import.meta.env.BASE_URL}invitations/demo-music.wav`, location.href).href;
  const classicLook = id === "botanica"; // the first full-page template keeps its own sample guest text and sections
  return editData((catalog().find((t) => t.id === id) ?? catalog()[0]).html, (d) => {
    // dates and times are shown in the zone the planner entered them in
    d.event = { ...d.event, names: names.length ? names : [x.title], milestone: "", start: start.toISOString(), end: new Date(+start + 7 * 36e5).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    d.venue = { name: x.venue, address: X?.address ?? "", mapUrl: X?.mapUrl ?? "" };
    d.lodging = { url: X?.lodging ?? "" }; d.contact = { whatsapp: X?.whatsapp ?? "" };
    const dl = X?.deadline ? new Date(`${X.deadline}T12:00`) : deadline;
    d.rsvp = { deadline: dl > new Date() ? dl.toISOString() : "" };
    d.photos = { cover: X?.cover ?? "", story: X?.story ?? "" };
    const cp: Record<string, string> = {}; if (X?.dress) cp.dc = X.dress; if (X?.gifts) cp.gifts1 = X.gifts;
    if (Object.keys(cp).length) d.copy = { es: cp, en: cp };
    d.music = { ...d.music, src: music };
    d.guest = { ...d.guest, name: "Invitado / Guest", people: 1, maxPeople: 1, ...(classicLook ? {} : { description: {}, status: {}, message: {} }) };
    if (!classicLook) d.sections = { ...d.sections, lodging: !!X?.lodging, contact: !!X?.whatsapp }; // no hotel link or WhatsApp number yet
    // keep the template's own rhythm: same gaps between moments, starting at the event time
    const t0 = d.itinerary[0] ? mins(d.itinerary[0].time) : 0;
    d.itinerary = d.itinerary.map((it: { time: string }) => ({ ...it, time: hhmm(new Date(+start + (((mins(it.time) - t0) % 1440 + 1440) % 1440) * 6e4)) }));
    if (X?.itinerary?.length) d.itinerary = X.itinerary.slice(0, 8).map((it, i) => ({ icon: d.itinerary[i]?.icon ?? d.itinerary[d.itinerary.length - 1]?.icon, time: it.time, title: { es: it.title, en: it.title } }));
  });
}

/** Full document, used for thumbnails and the HTML export. */
export const invitationDoc = (html: string, css: string) => isFullDoc(html) ? html : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;500;700&family=Dancing+Script:wght@500;700&family=Cormorant+Garamond:wght@400;600&family=Lobster&family=Pacifico&family=Lora:wght@400;600&display=swap"><style>body{margin:0;background:#F5EFE4;}${css}</style></head><body>${html}</body></html>`;
