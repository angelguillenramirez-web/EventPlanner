// Helpers for full-page invitation templates: a complete HTML document whose content comes from one JSON block.
const DATA_RE = /(<script type="application\/json" id="invitation-data">)([\s\S]*?)(<\/script>)/;

export const isFullDoc = (html: string) => /^\s*<!doctype html/i.test(html);

/** Reads the data block of a full-page template (null when missing or not valid JSON). */
export function readData(html: string): Record<string, unknown> | null {
  const m = html.match(DATA_RE);
  if (!m) return null;
  try { return JSON.parse(m[2]) as Record<string, unknown>; } catch { return null; }
}

/** Writes new data into the document's data block. */
export function writeData(html: string, data: unknown): string {
  return html.replace(DATA_RE, (_m, a: string, _j: string, b: string) => a + "\n" + JSON.stringify(data, null, 2).replace(/</g, "\\u003c") + "\n" + b);
}

/** Empty string when the document can be used as a template, otherwise the reason it cannot. */
export function validateFull(html: string): string {
  if (!isFullDoc(html)) return "It must be a complete HTML page (starting with <!doctype html>).";
  if (!DATA_RE.test(html)) return "The page has no data block (<script type=\"application/json\" id=\"invitation-data\">).";
  const d = readData(html);
  if (!d) return "The data block is not valid JSON.";
  const ev = d.event as { names?: unknown; start?: unknown } | undefined;
  if (!ev || !Array.isArray(ev.names) || !ev.start) return "The data block needs event.names and event.start.";
  return "";
}

/** For small previews: hides the welcome gate so the cover shows. */
export const thumbDoc = (html: string) => html.replace("</head>", "<style>#gate{display:none!important}</style></head>");

export const EVENT_TYPES = ["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate"];
