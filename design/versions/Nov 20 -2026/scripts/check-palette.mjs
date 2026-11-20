// Palette checker for 1Plan: lists every color written in src/ that is not part of the approved palette.
// Run: node scripts/check-palette.mjs        (add --all to also list the allowed ones)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

// Approved palette: Paper + Coral Spark. Names are only for the report.
const PALETTE = {
  "#46C8B2": "teal", "#3BB9A4": "teal hover", "#17695B": "teal ink", "#E6F7F4": "teal soft", "#2FB09B": "teal dark", "#16322E": "teal soft (dark)", "#7FE0CF": "teal ink (dark)",
  "#FF7A59": "coral", "#C2461F": "coral ink", "#FFE9E2": "coral soft", "#FF9C7F": "coral ink (dark)", "#3A221B": "coral soft (dark)",
  "#F0B429": "sun", "#FFC93C": "sun bright", "#FFF3C4": "butter", "#7A5B00": "butter ink", "#FFD96B": "butter ink (dark)", "#3A3418": "butter (dark)",
  "#6FA8FF": "sky blue", "#E3F0FF": "sky", "#1B2A3D": "sky (dark)",
  "#9B87F5": "lilac", "#B9A6FF": "lilac light", "#EEE8FF": "lilac soft", "#5B3FC0": "lilac ink", "#C4B3FF": "lilac ink (dark)", "#26223D": "lilac (dark)", "#7C5CFF": "violet",
  "#B8A98A": "sand dark",
  "#1F2937": "ink", "#14203A": "navy", "#6B6458": "muted", "#EDE6D8": "line", "#F5EFE4": "sand", "#FFFBF5": "paper", "#FFFFFF": "white",
  "#14171C": "dark bg", "#1C2027": "dark surface", "#F3F1EC": "dark ink", "#A39D90": "dark muted", "#2B303A": "dark line", "#222730": "dark soft",
  "#2E9E5B": "success",
};
// rgb() triples allowed: black/white (shadows, overlays) and palette colors
const RGB_OK = new Set(["0,0,0", "255,255,255", "31,41,55", "20,32,58", "70,200,178", "255,122,89", "240,180,41", "111,168,255", "155,135,245", "184,169,138"]);
const OK_NAMES = new Set(["transparent", "currentcolor", "inherit", "white", "black"]);
const root = process.argv.find((a) => a.startsWith("--root="))?.slice(7) ?? "src";
const showAll = process.argv.includes("--all");
const norm = (h) => { h = h.toUpperCase(); if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join(""); if (h.length === 5) h = "#" + [...h.slice(1, 4)].map((c) => c + c).join(""); return h.length === 9 ? h.slice(0, 7) : h; };
const files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if ([".css", ".tsx", ".ts"].includes(extname(p))) files.push(p); } })(root);
const found = new Map(); // color -> {count, files:Set, sample}
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/(?<![\w&])(?:#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b)/g)) { const c = norm(m[0]); const e = found.get(c) ?? { count: 0, files: new Set(), sample: "" }; e.count++; e.files.add(relative(".", f) + ":" + (i + 1)); e.sample ||= line.trim().slice(0, 90); found.set(c, e); }
    for (const m of line.matchAll(/\brgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) { const k = m[1] + "," + m[2] + "," + m[3]; if (RGB_OK.has(k)) continue; const c = "rgb(" + k + ")"; const e = found.get(c) ?? { count: 0, files: new Set(), sample: "" }; e.count++; e.files.add(relative(".", f) + ":" + (i + 1)); e.sample ||= line.trim().slice(0, 90); found.set(c, e); }
    for (const m of line.matchAll(/var\(--(?:rose|red)\b[^)]*\)/g)) { const c = m[0]; const e = found.get(c) ?? { count: 0, files: new Set(), sample: "" }; e.count++; e.files.add(relative(".", f) + ":" + (i + 1)); e.sample ||= line.trim().slice(0, 90); found.set(c, e); }
    for (const m of line.matchAll(/\b(?:hsl|hsla|oklch)\([^)]*\)/g)) { const c = m[0]; const e = found.get(c) ?? { count: 0, files: new Set(), sample: "" }; e.count++; e.files.add(relative(".", f) + ":" + (i + 1)); e.sample ||= line.trim().slice(0, 90); found.set(c, e); }
  });
}
const off = [...found].filter(([c]) => !PALETTE[c] && !OK_NAMES.has(c.toLowerCase())).sort((a, b) => b[1].count - a[1].count);
if (showAll) for (const [c, e] of found) if (PALETTE[c]) console.log("ok  ", c, PALETTE[c], "x" + e.count);
console.log(`\nOFF-PALETTE colors: ${off.length}\n`);
for (const [c, e] of off) console.log(c.padEnd(22), "x" + String(e.count).padEnd(4), [...e.files].slice(0, 3).join(" "), "\n      ", e.sample);
process.exitCode = off.length ? 1 : 0;
