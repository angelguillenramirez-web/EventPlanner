import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { FIGURE_KINDS, PLANS, getState, go, guestDefaults, openUpsell, uid, update, useStore, type EventT, type Figure, type Guest, type Seat, type SeatShape, type SeatTable, type Seating } from "../store";
import { Archive, ArchiveRestore, ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardPaste, Copy, Lock, LockOpen, LockI, Maximize2, Minus, Palette, PanelLeft, PanelRight, Pencil, Plus, Printer, Redo2, RotateCcw, RotateCw, Save, Search, Trash2, Undo2, X, ZoomIn, ZoomOut } from "../icons";
import ApprovalButton from "./Approval";
import { useMedia } from "../shared";
import { Modal } from "./ui";

const SHAPES: SeatShape[] = ["round", "square", "rect", "oval", "serpent", "head", "rows"];
const FIGURES: Figure["kind"][] = [...FIGURE_KINDS];
/** Outline of the clipped figures, in percent of their box (shared by the canvas and the palette icons). */
const POLY: Record<string, [number, number][]> = {
  triangle: [[50, 0], [100, 100], [0, 100]], diamond: [[50, 0], [100, 50], [50, 100], [0, 50]], hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]], pentagon: [[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]],
  star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]], cross: [[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]],
  arrow: [[0, 30], [60, 30], [60, 0], [100, 50], [60, 100], [60, 70], [0, 70]], arrowdouble: [[0, 50], [20, 0], [20, 30], [80, 30], [80, 0], [100, 50], [80, 100], [80, 70], [20, 70], [20, 100]], chevron: [[0, 0], [60, 0], [100, 50], [60, 100], [0, 100], [40, 50]], line: [[0, 35], [100, 35], [100, 65], [0, 65]],
};
const clipOf = (k: string) => (POLY[k] ? `polygon(${POLY[k].map(([x, y]) => `${x}% ${y}%`).join(",")})` : undefined);
const figCls = (f: Figure) => `seatfig ${f.kind}${POLY[f.kind] ? " clip" : ""}${f.color ? "" : " nocolor"}`;
const figSize = (k: string) => (k === "circle" ? { w: 100, h: 100 } : k === "line" ? { w: 180, h: 30 } : k === "arrow" || k === "arrowdouble" ? { w: 150, h: 70 } : { w: 120, h: 90 });
const PALETTE = ["#46C8B2", "#F0B429", "#6FA8FF", "#FF7A59", "#FF9C7F", "#9B87F5", "#2E9E5B", "#B8A98A"];
const SEAT = 24;
/** Arrangement types; the ones suggested for the event type come first. */
const KINDS = ["ceremony", "dinner", "cocktail", "bar", "panel", "conference", "classroom", "other"];
const SUGGEST: Record<string, string[]> = {
  wedding: ["ceremony", "dinner", "cocktail", "bar"], birthday: ["dinner", "cocktail", "bar"], babyshower: ["dinner", "cocktail"], graduation: ["ceremony", "dinner", "bar"], anniversary: ["dinner", "cocktail", "bar"], corporate: ["conference", "panel", "classroom", "cocktail", "dinner", "bar"],
};
const KIND_SHAPE: Record<string, { shape: SeatShape; seats: number }> = {
  ceremony: { shape: "rows", seats: 20 }, dinner: { shape: "round", seats: 8 }, cocktail: { shape: "round", seats: 4 }, bar: { shape: "head", seats: 8 }, panel: { shape: "head", seats: 6 }, conference: { shape: "rect", seats: 10 }, classroom: { shape: "rect", seats: 6 }, other: { shape: "round", seats: 8 },
};

const mkSeats = (n: number, old: Seat[] = []): Seat[] => Array.from({ length: n }, (_, i) => old[i] ?? { id: uid(), label: "", color: "", guestId: "", party: 0 });

/** Size of a table (with its seats around it) and the position of every seat, by shape. */
function geom(shape: SeatShape, n: number, colsIn?: number) {
  const pts: { x: number; y: number }[] = [];
  const spread = (count: number, from: number, to: number) => Array.from({ length: count }, (_, i) => from + ((i + 0.5) * (to - from)) / Math.max(1, count));
  let w = 0, h = 0, body = "none";
  if (shape === "round") {
    w = h = Math.max(110, 40 + n * 12);
    const R = w / 2 - SEAT / 2 - 1;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts.push({ x: w / 2 + R * Math.cos(a), y: h / 2 + R * Math.sin(a) }); }
    body = `circle:${w / 2}:${h / 2}:${R - SEAT}`;
  } else if (shape === "oval") {
    w = Math.max(160, 40 + n * 14); h = Math.round(w * 0.6);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts.push({ x: w / 2 + (w / 2 - SEAT / 2 - 1) * Math.cos(a), y: h / 2 + (h / 2 - SEAT / 2 - 1) * Math.sin(a) }); }
    body = `ellipse:${w / 2}:${h / 2}:${w / 2 - SEAT - 6}:${h / 2 - SEAT - 6}`;
  } else if (shape === "square") {
    const per = [0, 0, 0, 0]; for (let i = 0; i < n; i++) per[i % 4]++;
    w = h = Math.max(110, 40 + Math.max(...per) * 34);
    spread(per[0], 20, w - 20).forEach((x) => pts.push({ x, y: SEAT / 2 + 1 }));
    spread(per[1], 20, h - 20).forEach((y) => pts.push({ x: w - SEAT / 2 - 1, y }));
    spread(per[2], 20, w - 20).reverse().forEach((x) => pts.push({ x, y: h - SEAT / 2 - 1 }));
    spread(per[3], 20, h - 20).reverse().forEach((y) => pts.push({ x: SEAT / 2 + 1, y }));
    body = `rect:${SEAT + 4}:${SEAT + 4}:${w - 2 * (SEAT + 4)}:${h - 2 * (SEAT + 4)}`;
  } else if (shape === "rect") {
    const top = Math.ceil(n / 2), bot = n - top;
    w = Math.max(130, 40 + top * 34); h = 110;
    spread(top, 16, w - 16).forEach((x) => pts.push({ x, y: SEAT / 2 + 1 }));
    spread(bot, 16, w - 16).forEach((x) => pts.push({ x, y: h - SEAT / 2 - 1 }));
    body = `rect:12:${SEAT + 5}:${w - 24}:${h - 2 * (SEAT + 5)}`;
  } else if (shape === "head") { // head / panel table: seats on one side only
    w = Math.max(130, 40 + n * 34); h = 80;
    spread(n, 16, w - 16).forEach((x) => pts.push({ x, y: SEAT / 2 + 1 }));
    body = `rect:12:${SEAT + 5}:${w - 24}:${h - SEAT - 14}`;
  } else if (shape === "rows") { // rows of chairs (ceremony, theatre)
    const cols = Math.max(1, Math.min(n, colsIn || 10)), rows = Math.ceil(n / cols);
    w = cols * 30 + 14; h = rows * 30 + 14;
    for (let i = 0; i < n; i++) pts.push({ x: 7 + 15 + (i % cols) * 30, y: 7 + 15 + Math.floor(i / cols) * 30 });
  } else { // serpent: one S-shaped curve with seats on both sides
    const top = Math.ceil(n / 2), bot = n - top;
    w = Math.max(150, 44 + top * 36); h = 130;
    const wave = (x: number) => h / 2 + 20 * Math.sin((x / w) * Math.PI * 2);
    spread(top, 22, w - 22).forEach((x) => pts.push({ x, y: wave(x) - 27 }));
    spread(bot, 22, w - 22).forEach((x) => pts.push({ x, y: wave(x) + 27 }));
    const line = Array.from({ length: 41 }, (_, i) => { const x = 12 + (i / 40) * (w - 24); return `${x},${wave(x)}`; }).join(" ");
    body = `wave:${line}`;
  }
  return { w, h, pts, body };
}

function TableBody({ body, color, w, h }: { body: string; color: string; w: number; h: number }) {
  const [k, ...a] = body.split(":");
  const n = a.map(Number);
  const col = color || "#EDE6D8"; // no colour chosen yet: white with a light outline
  const fill = color ? `color-mix(in srgb, ${col} 55%, transparent)` : "#ffffff";
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {k === "circle" && <circle cx={n[0]} cy={n[1]} r={n[2]} fill={fill} stroke={col} strokeWidth={2} />}
      {k === "ellipse" && <ellipse cx={n[0]} cy={n[1]} rx={n[2]} ry={n[3]} fill={fill} stroke={col} strokeWidth={2} />}
      {k === "rect" && <rect x={n[0]} y={n[1]} width={n[2]} height={n[3]} rx={8} fill={fill} stroke={col} strokeWidth={2} />}
      {k === "wave" && !color && <polyline points={a.join(":")} fill="none" stroke="#EDE6D8" strokeWidth={33} strokeLinecap="round" strokeLinejoin="round" />}
      {k === "wave" && <polyline points={a.join(":")} fill="none" stroke={color ? col : "#ffffff"} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" opacity={color ? 0.6 : 1} />}
    </svg>
  );
}

/** Small outline icons for the shapes palette. */
function ShapeIcon({ kind }: { kind: SeatShape | Figure["kind"] }) {
  const dots = (pts: [number, number][]) => pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4} fill="currentColor" stroke="none" />);
  const ring = (n: number, r: number) => Array.from({ length: n }, (_, i) => [20 + r * Math.cos((i / n) * Math.PI * 2), 20 + r * Math.sin((i / n) * Math.PI * 2)] as [number, number]);
  return (
    <svg viewBox="0 0 40 40" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      {kind === "round" && <><circle cx={20} cy={20} r={8} />{dots(ring(8, 14))}</>}
      {kind === "oval" && <><ellipse cx={20} cy={20} rx={11} ry={7} />{dots(Array.from({ length: 8 }, (_, i) => [20 + 16 * Math.cos((i / 8) * Math.PI * 2), 20 + 12 * Math.sin((i / 8) * Math.PI * 2)] as [number, number]))}</>}
      {kind === "square" && <><rect x={12} y={12} width={16} height={16} rx={2} />{dots([[14, 7], [26, 7], [33, 14], [33, 26], [26, 33], [14, 33], [7, 26], [7, 14]])}</>}
      {kind === "rect" && <><rect x={7} y={14} width={26} height={12} rx={2} />{dots([[11, 8], [20, 8], [29, 8], [11, 32], [20, 32], [29, 32]])}</>}
      {kind === "head" && <><rect x={7} y={18} width={26} height={11} rx={2} />{dots([[11, 11], [20, 11], [29, 11]])}</>}
      {kind === "rows" && dots([[9, 10], [20, 10], [31, 10], [9, 20], [20, 20], [31, 20], [9, 30], [20, 30], [31, 30]])}
      {kind === "serpent" && <><path d="M6 22 C 14 10, 22 34, 34 18" strokeWidth={4} opacity={0.5} />{dots([[10, 12], [20, 18], [30, 10], [12, 30], [22, 30], [31, 26]])}</>}
    </svg>
  );
}
/** Figure icons (kept separate because "square" is both a table shape and a figure). */
function FigIcon({ kind }: { kind: Figure["kind"] }) {
  const poly = POLY[kind]?.map(([x, y]) => `${(6 + x * 0.28).toFixed(1)},${(6 + y * 0.28).toFixed(1)}`).join(" ");
  return <svg viewBox="0 0 40 40" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">{kind === "square" ? <rect x={8} y={8} width={24} height={24} rx={3} /> : kind === "circle" ? <circle cx={20} cy={20} r={12} /> : <polygon points={poly} />}</svg>;
}

type Live = { id: string; p: Record<string, number> } | null;
type Op =
  | { type: "move"; id: string; dx: number; dy: number }
  | { type: "scale"; id: string; cx: number; cy: number; d0: number; s0: number; w: number; h: number }
  | { type: "rotate"; id: string; cx: number; cy: number }
  | { type: "fresize"; id: string; handle: string; sx: number; sy: number; r: { x: number; y: number; w: number; h: number; rot: number } }
  | { type: "canvas"; sx: number; sy: number; w0: number; h0: number };
const HANDLES: [string, string, string][] = [["nw", "0%", "0%"], ["n", "50%", "0%"], ["ne", "100%", "0%"], ["e", "100%", "50%"], ["se", "100%", "100%"], ["s", "50%", "100%"], ["sw", "0%", "100%"], ["w", "0%", "50%"]];
const CURSOR: Record<string, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
const r2 = (n: number) => Math.round(n * 100) / 100;


/** Static (read-only) rendering of one version of an arrangement, scaled to fit its box. */
/** Lines frozen into an approval record: what exactly was approved. */
/** Copy of an arrangement with the guest names written into the seats, so an approval keeps what was approved. */
const seatSnap = (rec: Seating, guests: Guest[]): Seating => { const c = structuredClone(rec); c.tables.forEach((tb) => tb.seats.forEach((st) => { st.label = st.label || guests.find((g) => g.id === st.guestId)?.name || ""; st.guestId = ""; })); return c; };
const seatSummary = (t: (k: string, v?: Record<string, string | number>) => string, rec: Seating, guests: Guest[]) => {
  const seats = rec.tables.reduce((n, x) => n + x.seats.length, 0), seated = new Set(rec.tables.flatMap((x) => x.seats.filter((y) => y.guestId).map((y) => y.guestId))).size;
  return [`${rec.arrName} · ${rec.name}`, `${rec.tables.filter((x) => !x.chair).length} ${t("seat.count.tables")} · ${seats} ${t("seat.count.seats")}`, `${seated} / ${guests.length} ${t("seat.guests").toLowerCase()}`, ...rec.tables.map((x) => `${x.name}: ${x.seats.filter((y) => y.guestId || y.label).map((y) => y.label || guests.find((g) => g.id === y.guestId)?.name || "").join(", ") || "—"}`)];
};

export function SeatStatic({ rec, guests }: { rec: Seating; guests: Guest[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => { const el = box.current; if (!el) return; const set = () => setWidth(el.clientWidth || 600); set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect(); }, []);
  const gs = (tb: SeatTable) => geom(tb.shape, tb.seats.length, tb.cols);
  const right = Math.max(0, ...rec.tables.map((tb) => tb.x + gs(tb).w * tb.scale), ...rec.figures.map((f) => f.x + f.w)) + 30;
  const bottom = Math.max(0, ...rec.tables.map((tb) => tb.y + gs(tb).h * tb.scale), ...rec.figures.map((f) => f.y + f.h)) + 30;
  const empty = rec.tables.length === 0 && rec.figures.length === 0;
  const sc = empty ? 1 : Math.min(1, (width - 2) / right);
  const height = empty ? 220 : Math.max(220, Math.round(bottom * sc));
  return (
    <div ref={box} className="seatview static" style={{ height }}>
      <div className="seatcanvas" style={{ width: "100%", height }}>
        <div className="seatstage" style={{ width: right, height: bottom, transform: `scale(${sc})` }}>
          {rec.figures.map((f) => (
            <div key={f.id} className={figCls(f)} style={{ left: f.x, top: f.y, width: f.w, height: f.h, transform: `rotate(${f.rot ?? 0}deg)`, ["--fc" as string]: f.color || "var(--muted)", cursor: "default" }}>
              <div className="fshape" style={{ clipPath: clipOf(f.kind) }} /><span className="fname" style={{ transform: `rotate(${-(f.rot ?? 0)}deg)` }}>{f.name}</span>
            </div>
          ))}
          {rec.tables.map((tb) => {
            const g = gs(tb);
            return (
              <div key={tb.id} className="seattable" style={{ left: tb.x, top: tb.y, width: g.w * tb.scale, height: g.h * tb.scale, cursor: "default" }}>
                <div className="tinner" style={{ width: g.w, height: g.h, marginLeft: -g.w / 2, marginTop: -g.h / 2, transform: `rotate(${tb.rot}deg) scale(${tb.scale})` }}>
                  <TableBody body={g.body} color={tb.color} w={g.w} h={g.h} />
                  <div className={`tname${g.body === "none" ? " above" : ""}`} style={{ transform: `rotate(${-tb.rot}deg)` }}>{tb.name}</div>
                  {tb.seats.map((seat, i) => {
                    const gu = guests.find((x) => x.id === seat.guestId);
                    const text = seat.label || (gu ? (seat.party === 0 ? gu.name : `${gu.name} +${seat.party}`) : "");
                    const p = g.pts[i];
                    return <span key={seat.id} className="seatdot" style={{ ["--inv" as string]: 1 / tb.scale, left: p.x - SEAT / 2, top: p.y - SEAT / 2, background: seat.color || (gu ? "var(--ink)" : "var(--surface)"), color: seat.color || gu ? "#14203A" : "var(--muted)" }}><span style={{ transform: `rotate(${-tb.rot}deg)`, display: "block" }}>{(text || String(i + 1)).slice(0, 2).toUpperCase()}{text && <i className="stip">{text}</i>}</span></span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Snapshot taken when the editor opens, so the changes can be cancelled ("Discard") when the user leaves. */
let baseline: Seating[] = [];
let baselineArr = "";
export function discardSeatEdits() {
  if (!baselineArr) return;
  update((st) => { st.seatings = [...st.seatings.filter((x) => x.arrId !== baselineArr), ...structuredClone(baseline)]; st.seatDirty = false; });
}

/** Clipboard shared by all editors: a table or a figure copied with Ctrl/Cmd+C. */
let clip: { kind: "table" | "figure"; data: SeatTable | Figure } | null = null;

type Snap = Pick<Seating, "tables" | "figures" | "w" | "h" | "legend">;

/** Full-page editor of one arrangement: every tool, undo/redo, versions, lock, approvals, legend and print. */
function SeatEditor({ event, arrId, startVer, onClose }: { event: EventT; arrId: string; startVer: string; onClose: () => void }) {
  const s = useStore();
  const doPrint = () => { if (!PLANS[s.plan].printTables) { openUpsell("print"); return; } window.print(); };
  const { t } = useT();
  const [verId, setVerId] = useState(startVer);
  const [leave, setLeave] = useState(false);
  const prevSide = useRef(s.sidebarCollapsed);
  useEffect(() => { // while editing, the app sidebar folds away (it can be reopened) and unsaved changes are tracked
    baseline = structuredClone(getState().seatings.filter((x) => x.eventId === event.id && x.arrId === arrId)); baselineArr = arrId;
    update((st) => { st.sidebarCollapsed = true; st.seatEditor = true; st.seatDirty = false; });
    return () => { update((st) => { st.seatEditor = false; st.seatDirty = false; st.sidebarCollapsed = prevSide.current; }); };
  }, []); // eslint-disable-line
  const [saved, setSaved] = useState(false);
  const saveChanges = () => { // keeps the edits and makes this the point "Cancel changes" returns to
    baseline = structuredClone(getState().seatings.filter((x) => x.eventId === event.id && x.arrId === arrId));
    update((st) => { st.seatDirty = false; });
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  const saveRef = useRef(saveChanges); saveRef.current = saveChanges;
  const requestClose = () => { if (getState().seatDirty) setLeave(true); else onClose(); };
  const closeRef = useRef(requestClose); closeRef.current = requestClose;
  const [sel, setSel] = useState<{ kind: "table" | "figure"; id: string; seat?: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [op, setOp] = useState<Op | null>(null);
  const [live, setLive] = useState<Live>(null);
  const [openMenu, setOpenMenu] = useState<"" | "file" | "edit" | "view" | "arrange" | "extras" | "help">("");
  const small = matchMedia("(max-width: 1024px)").matches, phone = matchMedia("(max-width: 700px)").matches;
  const [showLeft, setShowLeft] = useState(!small); // tablets and phones start with the side panels closed
  const [showRight, setShowRight] = useState(!small);
  const [rightTab, setRightTab] = useState<"diagram" | "style">("diagram");
  const [grid, setGrid] = useState(true);
  const [search, setSearch] = useState("");
  const [secs, setSecs] = useState({ guests: true, tables: true, figures: true });
  const [fillPop, setFillPop] = useState(false);
  const [pageMenu, setPageMenu] = useState<{ left: number; bottom: number } | null>(null);
  const [renaming, setRenaming] = useState("");
  const [help, setHelp] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: "", invitees: 1 });
  const [, bump] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const recs = s.seatings.filter((x) => x.eventId === event.id && x.arrId === arrId).sort((a, b) => a.createdAt - b.createdAt);
  const v = recs.find((x) => x.id === verId) ?? recs[recs.length - 1];
  const guests = s.guests.filter((g) => g.eventId === event.id && g.status !== "declined");
  const edit = !!v && !v.locked;
  const canEdit = edit; const setEditing = (_: boolean) => {}; // (the editor is always in edit mode)

  // undo / redo: snapshots of the version being edited (rapid edits are merged into one step)
  const hist = useRef<{ past: Snap[]; future: Snap[]; at: number; id: string }>({ past: [], future: [], at: 0, id: "" });
  if (v && hist.current.id !== v.id) hist.current = { past: [], future: [], at: 0, id: v.id };
  const snap = (x: Seating): Snap => structuredClone({ tables: x.tables, figures: x.figures, w: x.w, h: x.h, legend: x.legend });
  const patch = (fn: (x: Seating) => void) => {
    if (!v || v.locked) return;
    const h = hist.current, now = Date.now();
    if (now - h.at > 350) { h.past.push(snap(v)); if (h.past.length > 100) h.past.shift(); }
    h.at = now; h.future = [];
    update((st) => { fn(st.seatings.find((x) => x.id === v.id)!); st.seatDirty = true; });
    bump((n) => n + 1);
  };
  const undo = () => { const h = hist.current, p = h.past.pop(); if (!p || !v || v.locked) return; h.future.push(snap(v)); h.at = 0; update((st) => { Object.assign(st.seatings.find((x) => x.id === v.id)!, structuredClone(p)); st.seatDirty = true; }); bump((n) => n + 1); };
  const redo = () => { const h = hist.current, p = h.future.pop(); if (!p || !v || v.locked) return; h.past.push(snap(v)); h.at = 0; update((st) => { Object.assign(st.seatings.find((x) => x.id === v.id)!, structuredClone(p)); st.seatDirty = true; }); bump((n) => n + 1); };
  const copySel = () => { const e = sel?.kind === "table" ? v?.tables.find((x) => x.id === sel.id) : sel?.kind === "figure" ? v?.figures.find((x) => x.id === sel.id) : undefined; if (e && sel) clip = { kind: sel.kind, data: structuredClone(e) }; };
  const paste = () => {
    if (!clip || !v || v.locked) return;
    const id = uid(), c = structuredClone(clip.data) as SeatTable & Figure;
    const named = t("seat.copyname", { name: c.name });
    if (clip.kind === "table") patch((x) => { x.tables.push({ ...c, id, name: named, x: c.x + 30, y: c.y + 30, seats: c.seats.map((z) => ({ ...z, id: uid(), guestId: "", party: 0 })) }); });
    else patch((x) => { x.figures.push({ ...c, id, name: named, x: c.x + 30, y: c.y + 30 }); });
    clip = { ...clip, data: { ...c, x: c.x + 30, y: c.y + 30 } as SeatTable | Figure }; // next paste lands a little further
    setSel({ kind: clip.kind, id });
  };
  const saveVerRef = useRef(() => undefined as unknown);
  const copyRef = useRef(copySel); copyRef.current = copySel;
  const delRef = useRef<() => void>(() => undefined);
  const pasteRef = useRef(paste); pasteRef.current = paste;
  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (e.shiftKey) saveVerRef.current(); else saveRef.current(); return; }
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) redoRef.current(); else undoRef.current(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); redoRef.current(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !typing) { copyRef.current(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && !typing) { e.preventDefault(); delRef.current(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && !typing) { e.preventDefault(); pasteRef.current(); }
      else if (e.key === "Escape" && !typing && !document.querySelector(".modal-bg")) closeRef.current();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []); // eslint-disable-line

  const patchRef = useRef(patch); patchRef.current = patch;
  const joinRef = useRef<(l: Seating, c: string, t: string) => void>(() => undefined);
  const liveRef = useRef<Live>(null); liveRef.current = live;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const extRef = useRef({ w: 0, h: 0 });
  const toCanvas = (cx: number, cy: number) => { const r = content.current!.getBoundingClientRect(); return { x: (cx - r.left) / zoomRef.current, y: (cy - r.top) / zoomRef.current }; };
  useEffect(() => { // pointer gestures: move, resize, rotate, canvas resize
    if (!op) return;
    const move = (e: PointerEvent) => {
      const p = toCanvas(e.clientX, e.clientY);
      if (op.type === "move") setLive({ id: op.id, p: { x: Math.max(0, Math.round(p.x - op.dx)), y: Math.max(0, Math.round(p.y - op.dy)) } });
      else if (op.type === "scale") { const sc = r2(Math.max(0.4, Math.min(4, op.s0 * Math.hypot(p.x - op.cx, p.y - op.cy) / op.d0))); setLive({ id: op.id, p: { scale: sc, x: Math.round(op.cx - (op.w * sc) / 2), y: Math.round(op.cy - (op.h * sc) / 2) } }); }
      else if (op.type === "rotate") { let a = (Math.atan2(p.y - op.cy, p.x - op.cx) * 180) / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; if (a > 180) a -= 360; setLive({ id: op.id, p: { rot: Math.round(a) } }); }
      else if (op.type === "fresize") {
        // resize along the figure's own (rotated) axes, keeping the opposite side in place
        const hd = op.handle, r = op.r, th = (r.rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
        const dx = p.x - op.sx, dy = p.y - op.sy;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        let w = r.w, h = r.h;
        if (hd.includes("e")) w = Math.max(30, r.w + lx); if (hd.includes("w")) w = Math.max(30, r.w - lx);
        if (hd.includes("s")) h = Math.max(30, r.h + ly); if (hd.includes("n")) h = Math.max(30, r.h - ly);
        const sx = hd.includes("e") ? (w - r.w) / 2 : hd.includes("w") ? -(w - r.w) / 2 : 0, sy = hd.includes("s") ? (h - r.h) / 2 : hd.includes("n") ? -(h - r.h) / 2 : 0;
        const cx = r.x + r.w / 2 + sx * cs - sy * sn, cy = r.y + r.h / 2 + sx * sn + sy * cs;
        setLive({ id: op.id, p: { x: Math.max(0, Math.round(cx - w / 2)), y: Math.max(0, Math.round(cy - h / 2)), w: Math.round(w), h: Math.round(h) } });
      } else setLive({ id: "canvas", p: { w: Math.max(extRef.current.w, Math.round(op.w0 + p.x - op.sx)), h: Math.max(extRef.current.h, Math.round(op.h0 + p.y - op.sy)) } });
    };
    const up = () => {
      const lv = liveRef.current;
      if (lv) patchRef.current((l) => { if (lv.id === "canvas") { l.w = lv.p.w; l.h = lv.p.h; } else { const e = l.tables.find((x) => x.id === lv.id) ?? l.figures.find((x) => x.id === lv.id); if (e) Object.assign(e, lv.p);
        const ch = l.tables.find((x) => x.id === lv.id && x.chair);
        if (ch) { // a loose chair dropped onto a table joins it
          const cx = ch.x + 22, cy = ch.y + 22;
          const to = l.tables.find((x) => !x.chair && x.id !== ch.id && (() => { const g = geom(x.shape, x.seats.length, x.cols); return cx >= x.x && cx <= x.x + g.w * x.scale && cy >= x.y && cy <= x.y + g.h * x.scale; })());
          if (to) joinRef.current(l, ch.id, to.id);
        } } });
      setLive(null); setOp(null);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [op]); // eslint-disable-line

  const seated = useMemo(() => { const m: Record<string, number> = {}; v?.tables.forEach((tb) => tb.seats.forEach((st) => { if (st.guestId) m[st.guestId] = (m[st.guestId] ?? 0) + 1; })); return m; }, [v]);
  if (!v) return null;
  const E = <T extends { id: string }>(e: T): T => (live && live.id === e.id ? ({ ...e, ...live.p } as T) : e);
  const gname = (g: Guest | undefined, party: number) => (g ? (party === 0 ? g.name : `${g.name} +${party}`) : "");
  const tables = v.tables.map(E), figures = v.figures.map(E);
  // the panel grows with its content (and can be enlarged by hand with the corner handle)
  const need = (pad: number) => ({
    w: Math.max(0, ...tables.map((tb) => tb.x + geom(tb.shape, tb.seats.length, tb.cols).w * tb.scale), ...figures.map((f) => f.x + f.w)) + pad,
    h: Math.max(0, ...tables.map((tb) => tb.y + geom(tb.shape, tb.seats.length, tb.cols).h * tb.scale), ...figures.map((f) => f.y + f.h)) + pad,
  });
  const ext = need(60);
  extRef.current = ext;
  const cv = live?.id === "canvas" ? live.p : { w: v.w, h: v.h };
  const CW = Math.max(cv.w, ext.w), CH = Math.max(cv.h, ext.h);
  const fit = () => { const el = view.current; if (!el) return; const b = need(30); setZoom(r2(Math.max(0.25, Math.min(1, (el.clientWidth - 8) / b.w, (el.clientHeight - 8) / b.h)))); el.scrollTo(0, 0); };
  const setZ = (z: number) => setZoom(r2(Math.max(0.25, Math.min(2.5, z))));

  const addTable = (shape: SeatShape, at?: { x: number; y: number }) => {
    const i = v.tables.length;
    const d = KIND_SHAPE[v.kind] ?? KIND_SHAPE.other;
    const seats = shape === d.shape ? d.seats : shape === "serpent" ? 6 : shape === "rows" ? 20 : shape === "head" ? 6 : shape === "rect" ? 10 : 8;
    const tb: SeatTable = { id: uid(), name: `${t("tables.table")} ${i + 1}`, shape, x: at ? Math.max(0, Math.round(at.x)) : 20 + (i % 3) * 240, y: at ? Math.max(0, Math.round(at.y)) : 20 + Math.floor(i / 3) * 230, color: "", seats: mkSeats(seats), rot: 0, scale: 1 };
    patch((l) => { l.tables.push(tb); }); setSel({ kind: "table", id: tb.id });
  };
  const addFigure = (kind: Figure["kind"], at?: { x: number; y: number }) => {
    const i = v.figures.length;
    const f: Figure = { id: uid(), kind, name: t("fig." + kind), x: at ? Math.max(0, Math.round(at.x)) : 640, y: at ? Math.max(0, Math.round(at.y)) : 30 + (i % 5) * 110, ...figSize(kind), color: "", rot: 0 };
    patch((l) => { l.figures.push(f); }); setSel({ kind: "figure", id: f.id });
  };
  const addChair = (at?: { x: number; y: number }) => {
    const i = v.tables.filter((x) => x.chair).length;
    const tb: SeatTable = { id: uid(), name: `${t("seat.seat")} ${i + 1}`, shape: "rows", cols: 1, chair: true, x: at ? Math.max(0, Math.round(at.x)) : 20 + (i % 6) * 60, y: at ? Math.max(0, Math.round(at.y)) : 560, color: "", seats: mkSeats(1), rot: 0, scale: 1 };
    patch((l) => { l.tables.push(tb); }); setSel({ kind: "table", id: tb.id });
  };
  /** Moves the seat of a loose chair into a table (the table gets one more seat) and removes the chair. */
  const joinTable = (l: Seating, chairId: string, tableId: string) => {
    const c = l.tables.find((y) => y.id === chairId), tb = l.tables.find((y) => y.id === tableId);
    if (!c || !tb || c === tb || tb.chair) return;
    tb.seats.push(...c.seats.map((z) => ({ ...z })));
    l.tables = l.tables.filter((y) => y.id !== chairId);
  };
  joinRef.current = joinTable;
  const assign = (guestId: string, tableId: string, from = 0) => {
    const g = guests.find((x) => x.id === guestId);
    if (!g || !edit) return;
    patch((l) => {
      const tb = l.tables.find((y) => y.id === tableId); if (!tb) return;
      let have = l.tables.reduce((n, y) => n + y.seats.filter((z) => z.guestId === guestId).length, 0);
      const order = [...tb.seats.keys()].map((i) => (i + from) % tb.seats.length);
      for (const i of order) { if (have >= g.invitees) break; const seat = tb.seats[i]; if (!seat.guestId) { seat.guestId = guestId; seat.party = have; have++; } }
    });
  };
  const unseat = (tableId: string, seatId: string) => patch((l) => { const seat = l.tables.find((y) => y.id === tableId)?.seats.find((z) => z.id === seatId); if (seat) { seat.guestId = ""; seat.party = 0; } });
  const saveVersion = () => {
    const copy: Seating = { ...structuredClone(v), id: uid(), name: `${t("seat.version")} ${recs.length + 1}`, createdAt: Date.now(), locked: false, approvals: [] };
    update((st) => { st.seatings.push(copy); st.seatDirty = true; }); setVerId(copy.id); setSel(null);
  };
  const idx = recs.findIndex((x) => x.id === v.id);
  const go2 = (d: number) => { const n = recs[idx + d]; if (n) { setVerId(n.id); setSel(null); } };
  const selTable = sel?.kind === "table" ? tables.find((x) => x.id === sel.id) : undefined;
  const selFig = sel?.kind === "figure" ? figures.find((x) => x.id === sel.id) : undefined;
  const selSeat = selTable && sel?.seat ? selTable.seats.find((x) => x.id === sel.seat) : undefined;
  const usedColors = new Set(v.legend.map((l) => l.color));
  const setTableProp = (id: string, fn: (tb: SeatTable) => void) => patch((l) => { const tb = l.tables.find((y) => y.id === id); if (tb) fn(tb); });
  const setScale = (tb: SeatTable, ns: number) => setTableProp(tb.id, (x) => { const g = geom(x.shape, x.seats.length, x.cols); const cx = x.x + (g.w * x.scale) / 2, cy = x.y + (g.h * x.scale) / 2; x.scale = r2(ns); x.x = Math.round(cx - (g.w * ns) / 2); x.y = Math.round(cy - (g.h * ns) / 2); });
  const recent = (s.events.find((e) => e.id === event.id)?.recentColors ?? []).filter((c) => !PALETTE.includes(c));
  const remember = (c: string) => { if (c) update((st) => { const e = st.events.find((x) => x.id === event.id); if (e) e.recentColors = [c, ...(e.recentColors ?? []).filter((x) => x !== c)].slice(0, 10); }); };
  const swatches = (cur: string, set: (c: string) => void, none = false) => (
    <div>
      <div className="row" style={{ gap: 6 }}>
        {none && <button type="button" className={`sw none${cur === "" ? " on" : ""}`} aria-label={t("seat.nocolor")} title={t("seat.nocolor")} disabled={!edit} onClick={() => set("")}>×</button>}
        {PALETTE.map((c) => <button type="button" key={c} className={`sw${cur === c ? " on" : ""}`} style={{ background: c }} aria-label={c} title={v.legend.find((l) => l.color === c)?.meaning || c} disabled={!edit} onClick={() => { set(c); remember(c); }} />)}
        <label className="sw more" title={t("seat.morecolors")} aria-label={t("seat.morecolors")}><input type="color" value={/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#46C8B2"} disabled={!edit} onChange={(e) => set(e.target.value)} onBlur={(e) => remember(e.target.value)} /></label>
      </div>
      {recent.length > 0 && <div className="row" style={{ gap: 6, marginTop: 6 }}><span className="muted small">{t("seat.recent")}</span>{recent.map((c) => <button type="button" key={c} className={`sw${cur === c ? " on" : ""}`} style={{ background: c }} aria-label={c} title={c} disabled={!edit} onClick={() => { set(c); remember(c); }} />)}</div>}
    </div>
  );
  const startOp = (e: React.PointerEvent, o: Op) => { e.stopPropagation(); e.preventDefault(); if (edit) setOp(o); };

  const tableNode = (tb: SeatTable) => {
    const g = geom(tb.shape, tb.seats.length, tb.cols);
    const isSel = sel?.kind === "table" && sel.id === tb.id;
    const cx = tb.x + (g.w * tb.scale) / 2, cy = tb.y + (g.h * tb.scale) / 2;
    const inv = 1 / tb.scale;
    return (
      <div key={tb.id} className={`seattable${isSel && !sel?.seat ? " sel" : ""}`} style={{ left: tb.x, top: tb.y, width: g.w * tb.scale, height: g.h * tb.scale }}
        onPointerDown={(e) => { if (e.button !== 0 || !edit) return; e.stopPropagation(); setSel({ kind: "table", id: tb.id }); const p = toCanvas(e.clientX, e.clientY); setOp({ type: "move", id: tb.id, dx: p.x - tb.x, dy: p.y - tb.y }); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) { setEditing(true); setSel({ kind: "table", id: tb.id }); } }}
        onDragOver={(e) => { if (edit) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); assign(e.dataTransfer.getData("text/plain"), tb.id); }}>
        <div className="tinner" style={{ width: g.w, height: g.h, marginLeft: -g.w / 2, marginTop: -g.h / 2, transform: `rotate(${tb.rot}deg) scale(${tb.scale})` }}>
          <TableBody body={g.body} color={tb.color} w={g.w} h={g.h} />
          <div className={`tname${g.body === "none" ? " above" : ""}`} style={{ transform: `rotate(${-tb.rot}deg)` }}>{tb.name}</div>
          {tb.seats.map((seat, i) => {
            const gu = guests.find((x) => x.id === seat.guestId);
            const text = seat.label || gname(gu, seat.party);
            const p = g.pts[i];
            const bg = seat.color || (gu ? "var(--ink)" : "var(--surface)");
            return (
              <button key={seat.id} className={`seatdot${sel?.seat === seat.id ? " sel" : ""}`} style={{ ["--inv" as string]: 1 / tb.scale, left: p.x - SEAT / 2, top: p.y - SEAT / 2, background: bg, color: seat.color || gu ? "#14203A" : "var(--muted)" }}
                aria-label={text || `${t("seat.seat")} ${i + 1}`}
                onPointerDown={(e) => { if (edit) e.stopPropagation(); }} onClick={(e) => { if (!edit) return; e.stopPropagation(); setSel({ kind: "table", id: tb.id, seat: tb.chair ? undefined : seat.id }); }}
                onDragOver={(e) => { if (edit) { e.preventDefault(); e.stopPropagation(); } }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); assign(e.dataTransfer.getData("text/plain"), tb.id, i); }}>
                <span style={{ transform: `rotate(${-tb.rot}deg)`, display: "block" }}>{(text || String(i + 1)).slice(0, 2).toUpperCase()}{text && <i className="stip">{text}</i>}</span>
              </button>
            );
          })}
          {isSel && edit && !sel?.seat && (
            <>
              {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([hx, hy]) => (
                <span key={`${hx}${hy}`} className="handle" title={t("seat.resize")} style={{ left: `${hx * 100}%`, top: `${hy * 100}%`, cursor: "nwse-resize", transform: `translate(-50%, -50%) scale(${inv})` }}
                  onPointerDown={(e) => startOp(e, { type: "scale", id: tb.id, cx, cy, d0: Math.max(10, Math.hypot(toCanvas(e.clientX, e.clientY).x - cx, toCanvas(e.clientX, e.clientY).y - cy)), s0: tb.scale, w: g.w, h: g.h })} />
              ))}
              <span className="handle rot" title={t("seat.rotate")} style={{ left: "50%", top: -26 * inv, cursor: "grab", transform: `translate(-50%, -50%) scale(${inv})` }}
                onPointerDown={(e) => startOp(e, { type: "rotate", id: tb.id, cx, cy })}><RotateCw size={10} /></span>
            </>
          )}
        </div>
      </div>
    );
  };

  const figureNode = (f: Figure) => {
    const isSel = sel?.kind === "figure" && sel.id === f.id;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    return (
      <div key={f.id} className={`${figCls(f)}${isSel ? " sel" : ""}`} style={{ left: f.x, top: f.y, width: f.w, height: f.h, transform: `rotate(${f.rot ?? 0}deg)`, ["--fc" as string]: f.color }}
        onPointerDown={(e) => { if (e.button !== 0 || !edit) return; e.stopPropagation(); setSel({ kind: "figure", id: f.id }); const p = toCanvas(e.clientX, e.clientY); setOp({ type: "move", id: f.id, dx: p.x - f.x, dy: p.y - f.y }); }}
        onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) { setEditing(true); setSel({ kind: "figure", id: f.id }); } }}>
        <div className="fshape" style={{ clipPath: clipOf(f.kind) }} /><span className="fname" style={{ transform: `rotate(${-(f.rot ?? 0)}deg)` }}>{f.name}</span>
        {isSel && edit && (
          <>
            {HANDLES.map(([hd, left, top]) => (
              <span key={hd} className="handle sq" title={t("seat.resize")} style={{ left, top, cursor: CURSOR[hd] }}
                onPointerDown={(e) => startOp(e, { type: "fresize", id: f.id, handle: hd, sx: toCanvas(e.clientX, e.clientY).x, sy: toCanvas(e.clientX, e.clientY).y, r: { x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot ?? 0 } })} />
            ))}
            <span className="handle rot" title={t("seat.rotate")} style={{ left: "50%", top: -26, cursor: "grab", transform: "translate(-50%, -50%)" }} onPointerDown={(e) => startOp(e, { type: "rotate", id: f.id, cx, cy })}><RotateCw size={10} /></span>
          </>
        )}
      </div>
    );
  };

  const h = hist.current;
  const dropShape = (e: React.DragEvent) => {
    const sh = e.dataTransfer.getData("text/shape");
    if (!sh || !edit) return;
    e.preventDefault();
    const p = toCanvas(e.clientX, e.clientY), [k, val] = sh.split(":");
    if (k === "table" && val === "chair") addChair({ x: p.x - 22, y: p.y - 22 }); else if (k === "table") addTable(val as SeatShape, { x: p.x - 60, y: p.y - 60 }); else addFigure(val as Figure["kind"], { x: p.x - 60, y: p.y - 40 });
  };
  const toggleLock = () => { setSel(null); update((st) => { const x = st.seatings.find((y) => y.id === v.id)!; x.locked = !x.locked; st.seatDirty = true; }); };
  const delVersion = () => { // go to another existing version; if this was the only one, start a new blank one (the editor stays open)
    if (!confirm(t("confirm.delete"))) return;
    const others = recs.filter((x) => x.id !== v.id), next = others[Math.max(0, idx - 1)];
    const blank: Seating = { id: uid(), eventId: v.eventId, arrId: v.arrId, arrName: v.arrName, kind: v.kind, name: `${t("seat.version")} 1`, createdAt: Date.now(), locked: false, tables: [], figures: [], w: v.w, h: v.h, legend: [], approvals: [], pos: v.pos, archived: v.archived };
    update((st) => { st.seatings = st.seatings.filter((x) => x.id !== v.id); if (!next) st.seatings.push(blank); st.seatDirty = true; });
    setVerId((next ?? blank).id); setSel(null);
  };
  const deleteSel = () => {
    if (!sel) return;
    if (sel.seat) unseat(sel.id, sel.seat);
    else if (sel.kind === "table") patch((l) => { l.tables = l.tables.filter((y) => y.id !== sel.id); });
    else patch((l) => { l.figures = l.figures.filter((y) => y.id !== sel.id); });
    if (!sel.seat) setSel(null);
  };
  delRef.current = deleteSel;
  const duplicateSel = () => { copySel(); paste(); };
  const rotateSel = (d: number) => {
    if (selTable && !sel?.seat) setTableProp(selTable.id, (x) => { x.rot = ((((x.rot + d) % 360) + 540) % 360) - 180; });
    else if (selFig) patch((l) => { const f = l.figures.find((y) => y.id === selFig.id)!; f.rot = ((((f.rot ?? 0) + d) % 360 + 540) % 360) - 180; });
  };
  const resizeSel = (k: number) => {
    if (selTable && !sel?.seat) setScale(selTable, Math.max(0.4, Math.min(4, selTable.scale * k)));
    else if (selFig) patch((l) => { const f = l.figures.find((y) => y.id === selFig.id)!; f.w = Math.max(30, Math.round(f.w * k)); f.h = Math.max(30, Math.round(f.h * k)); });
  };
  const colorSel = (c: string) => {
    if (selSeat && selTable) setTableProp(selTable.id, (x) => { x.seats.find((z) => z.id === selSeat.id)!.color = c; });
    else if (selTable?.chair) setTableProp(selTable.id, (x) => { x.seats[0].color = c; });
    else if (selTable) setTableProp(selTable.id, (x) => { x.color = c; });
    else if (selFig) patch((l) => { l.figures.find((y) => y.id === selFig.id)!.color = c; });
  };
  useEffect(() => { if (sel) setRightTab("style"); }, [sel?.id, sel?.seat]); // eslint-disable-line
  saveVerRef.current = saveVersion;
  type MI = { label: string; hint?: string; disabled?: boolean; checked?: boolean; run: () => void } | "sep";
  const hasSel = !!sel, canRot = !!(selTable && !sel?.seat) || !!selFig;
  const menus: Record<string, { label: string; items: MI[] }> = {
    file: { label: t("dio.file"), items: [
      { label: t("dio.savechanges"), hint: "Ctrl+S", disabled: !s.seatDirty, run: saveChanges }, { label: t("seat.save"), hint: "Ctrl+Shift+S", run: saveVersion }, { label: v.locked ? t("seat.unlock") : t("seat.lock"), run: toggleLock }, "sep",
      { label: t("seat.print"), run: () => doPrint() }, { label: t("seat.deleteversion"), disabled: !edit, run: delVersion }, "sep",
      { label: t("back"), run: requestClose }] },
    edit: { label: t("dio.edit"), items: [
      { label: t("seat.undo"), hint: "Ctrl+Z", disabled: !edit || h.past.length === 0, run: undo }, { label: t("seat.redo"), hint: "Ctrl+Shift+Z", disabled: !edit || h.future.length === 0, run: redo }, "sep",
      { label: t("seat.copysel"), hint: "Ctrl+C", disabled: !edit || !hasSel, run: copySel }, { label: t("seat.paste"), hint: "Ctrl+V", disabled: !edit || !clip, run: paste }, { label: t("seat.duplicate"), disabled: !edit || !hasSel, run: duplicateSel }, "sep",
      { label: t("delete"), hint: "Del", disabled: !edit || !hasSel, run: deleteSel }, { label: t("dio.selectnone"), disabled: !hasSel, run: () => setSel(null) }] },
    view: { label: t("dio.view"), items: [
      { label: t("seat.zoomin"), run: () => setZ(zoom + 0.1) }, { label: t("seat.zoomout"), run: () => setZ(zoom - 0.1) }, { label: t("dio.zoom100"), run: () => setZ(1) }, { label: t("seat.zoomfit"), run: fit }, "sep",
      { label: t("dio.grid"), checked: grid, run: () => setGrid(!grid) }, { label: t("dio.leftpanel"), checked: showLeft, run: () => setShowLeft(!showLeft) }, { label: t("dio.rightpanel"), checked: showRight, run: () => setShowRight(!showRight) }] },
    arrange: { label: t("dio.arrange"), items: [
      { label: t("seat.rotl"), disabled: !edit || !canRot, run: () => rotateSel(-15) }, { label: t("seat.rotr"), disabled: !edit || !canRot, run: () => rotateSel(15) }, "sep",
      { label: t("dio.bigger"), disabled: !edit || !canRot, run: () => resizeSel(1.15) }, { label: t("dio.smaller"), disabled: !edit || !canRot, run: () => resizeSel(1 / 1.15) }] },
    extras: { label: t("dio.extras"), items: [
      { label: t("dio.enlarge"), disabled: !edit, run: () => patch((l) => { l.w += 200; l.h += 140; }) }, { label: t("dio.fitpanel"), disabled: !edit, run: () => patch((l) => { l.w = Math.round(ext.w); l.h = Math.round(ext.h); }) }] },
    help: { label: t("dio.help"), items: [{ label: t("dio.shortcuts"), run: () => setHelp(true) }] },
  };
  const q = search.trim().toLowerCase();
  const shapeMatch = (label: string) => !q || label.toLowerCase().includes(q);
  return (
    <div className="seat-full dio" role="dialog" aria-modal="true" aria-label={t("seat.editor")}>
      <div className="dio-head noprint">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input className="dio-title" aria-label={t("arr.name")} title={t("arr.name")} value={v.arrName} onChange={(e) => { const val = e.target.value; update((st) => { st.seatings.filter((x) => x.arrId === arrId).forEach((x) => { x.arrName = val; }); st.seatDirty = true; }); }} />
          <div className="dio-menubar" onMouseLeave={() => undefined}>
            {(Object.keys(menus) as (keyof typeof menus)[]).map((k) => (
              <span key={k} style={{ position: "relative" }}>
                <button className="dio-menu" aria-haspopup="menu" aria-expanded={openMenu === k} onClick={() => setOpenMenu(openMenu === k ? "" : (k as typeof openMenu))} onMouseEnter={() => { if (openMenu) setOpenMenu(k as typeof openMenu); }}>{menus[k].label}</button>
                {openMenu === k && (
                  <>
                    <div className="menu-bg" style={{ zIndex: 70 }} onClick={() => setOpenMenu("")} />
                    <div className="menu seatmenu" role="menu" style={{ left: 0, right: "auto", zIndex: 75, minWidth: 230 }}>
                      {menus[k].items.map((it, i) => it === "sep" ? <hr key={i} style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} /> : (
                        <button key={i} role="menuitem" disabled={it.disabled} onClick={() => { setOpenMenu(""); it.run(); }}>
                          <span style={{ width: 16 }}>{it.checked ? <Check size={14} /> : null}</span><span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>{it.hint && <span className="muted small">{it.hint}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
        <button onClick={requestClose}><ArrowLeft size={16} /> {t("back")}</button>
      </div>
      <div className="dio-toolbar noprint">
        <button className="ghost icon" aria-label={t("dio.leftpanel")} title={t("dio.leftpanel")} onClick={() => setShowLeft(!showLeft)}><PanelLeft size={17} /></button>
        <span className="dio-sep" />
        <select aria-label={t("dio.zoom")} value={String(Math.round(zoom * 100))} onChange={(e) => setZ(Number(e.target.value) / 100)} style={{ width: 84 }}>
          {[...new Set([25, 50, 75, 100, 125, 150, 200, 250, Math.round(zoom * 100)])].sort((a, b) => a - b).map((z) => <option key={z} value={z}>{z}%</option>)}
        </select>
        <button className="ghost icon" aria-label={t("seat.zoomin")} title={t("seat.zoomin")} onClick={() => setZ(zoom + 0.1)}><ZoomIn size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.zoomout")} title={t("seat.zoomout")} onClick={() => setZ(zoom - 0.1)}><ZoomOut size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.zoomfit")} title={t("seat.zoomfit")} onClick={fit}><Maximize2 size={16} /></button>
        <span className="dio-sep" />
        <button className="ghost icon" aria-label={t("dio.savechanges")} title={`${t("dio.savechanges")} (Ctrl+S)`} disabled={!s.seatDirty && !saved} onClick={saveChanges}>{saved ? <Check size={17} style={{ color: "var(--teal)" }} /> : <Save size={17} />}</button>
        <button className="ghost icon" aria-label={t("seat.undo")} title={`${t("seat.undo")} (Ctrl+Z)`} disabled={!edit || h.past.length === 0} onClick={undo}><Undo2 size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.redo")} title={`${t("seat.redo")} (Ctrl+Shift+Z)`} disabled={!edit || h.future.length === 0} onClick={redo}><Redo2 size={17} /></button>
        <span className="dio-sep" />
        <button className="ghost icon" aria-label={t("delete")} title={`${t("delete")} (Del)`} disabled={!edit || !hasSel} onClick={deleteSel}><Trash2 size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.copysel")} title={`${t("seat.copysel")} (Ctrl+C)`} disabled={!edit || !hasSel} onClick={copySel}><Copy size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.paste")} title={`${t("seat.paste")} (Ctrl+V)`} disabled={!edit || !clip} onClick={paste}><ClipboardPaste size={17} /></button>
        <span className="dio-sep" />
        <span style={{ position: "relative" }}>
          <button className="ghost icon" aria-label={t("dio.fill")} title={t("dio.fill")} disabled={!edit || !hasSel} onClick={() => setFillPop(!fillPop)}><Palette size={17} /></button>
          {fillPop && (
            <>
              <div className="menu-bg" style={{ zIndex: 70 }} onClick={() => setFillPop(false)} />
              <div className="menu seatmenu" style={{ left: 0, right: "auto", zIndex: 75, minWidth: 0, padding: 10 }}>
                <div style={{ maxWidth: 230 }}>{swatches(selSeat ? selSeat.color : selTable ? selTable.color : selFig?.color ?? "", (c) => colorSel(c), true)}</div>
              </div>
            </>
          )}
        </span>
        <button className="ghost icon" aria-label={t("seat.rotl")} title={t("seat.rotl")} disabled={!edit || !canRot} onClick={() => rotateSel(-15)}><RotateCcw size={17} /></button>
        <button className="ghost icon" aria-label={t("seat.rotr")} title={t("seat.rotr")} disabled={!edit || !canRot} onClick={() => rotateSel(15)}><RotateCw size={17} /></button>
        <span className="dio-sep" />
        <button className="ghost icon" aria-label={v.locked ? t("seat.unlock") : t("seat.lock")} title={v.locked ? t("seat.unlock") : t("seat.lock")} onClick={toggleLock}>{v.locked ? <LockOpen size={17} /> : <Lock size={17} />}</button>
        <button className="ghost icon" aria-label={t("seat.print")} title={t("seat.print")} onClick={() => doPrint()}><Printer size={17} /></button>
        <span className="dio-count" title={`$${v.tables.filter((x) => !x.chair).length} ${t("seat.count.tables")} · ${v.tables.reduce((n, x) => n + x.seats.length, 0)} ${t("seat.count.seats")}`}><span><b>{v.tables.filter((x) => !x.chair).length}</b> {t("seat.count.tables")}</span><span><b>{v.tables.reduce((n, x) => n + x.seats.length, 0)}</b> {t("seat.count.seats")}</span></span>
        <span className="grow" />
        <button className="ghost icon" aria-label={t("dio.rightpanel")} title={t("dio.rightpanel")} onClick={() => setShowRight(!showRight)}><PanelRight size={17} /></button>
      </div>
      {phone && <p className="small noprint muted" style={{ margin: "4px 14px 0" }}>{t("seat.phone")}</p>}
      {v.locked && <p className="small noprint" style={{ color: "var(--gold)", margin: "4px 14px 0" }}><LockI /> {t("seat.locked")}</p>}
      <div className="dio-body" style={{ gridTemplateColumns: `${showLeft ? "250px " : ""}minmax(0, 1fr)${showRight ? " 280px" : ""}` }}>
        {showLeft && <aside className="dio-left noprint">
          <div className="dio-search"><input value={search} placeholder={t("dio.search")} aria-label={t("dio.search")} onChange={(e) => setSearch(e.target.value)} /><Search size={15} className="muted" /></div>
          <button className="dio-sec" onClick={() => setSecs({ ...secs, guests: !secs.guests })}><span className="caret" data-open={secs.guests}>▸</span> {t("seat.guests")}</button>
          {secs.guests && (
            <div style={{ marginBottom: 8 }}>
              <p className="muted small" style={{ margin: "0 0 6px" }}>{t("seat.guests.hint")}</p>
              <form className="row" style={{ flexWrap: "nowrap", gap: 4, marginBottom: 8 }} onSubmit={(e) => { e.preventDefault(); const n = newGuest.name.trim(); if (!n) return; update((st) => { st.guests.push(guestDefaults({ id: uid(), eventId: event.id, name: n, invitees: Math.max(1, newGuest.invitees || 1) })); }); setNewGuest({ name: "", invitees: 1 }); }}>
                <input style={{ minWidth: 0 }} value={newGuest.name} placeholder={t("seat.addguest")} aria-label={t("seat.addguest")} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} />
                <input type="number" min={1} style={{ width: 48 }} value={newGuest.invitees} aria-label={t("gst.invitees")} title={t("gst.invitees")} onChange={(e) => setNewGuest({ ...newGuest, invitees: Number(e.target.value) })} />
                <button className="ghost icon" aria-label={t("add")} title={t("add")} disabled={!newGuest.name.trim()}><Plus size={16} /></button>
              </form>
              {guests.length === 0 && <p className="muted small">{t("none")}</p>}
              {guests.filter((g) => shapeMatch(g.name)).map((g) => {
                const left = g.invitees - (seated[g.id] ?? 0);
                return (
                  <div key={g.id} className={`gchip${left <= 0 ? " done" : ""}`} draggable={edit && left > 0} onDragStart={(e) => { e.dataTransfer.setData("text/plain", g.id); e.dataTransfer.effectAllowed = "copy"; }} title={left > 0 ? t("seat.dragme") : ""}>
                    <span>{g.name}</span><span className="muted small">{left > 0 ? `${left}/${g.invitees}` : "✓"}</span>
                  </div>
                );
              })}
            </div>
          )}
          <button className="dio-sec" onClick={() => setSecs({ ...secs, tables: !secs.tables })}><span className="caret" data-open={secs.tables}>▸</span> {t("dio.tables")}</button>
          {secs.tables && <div className="shapegrid">{SHAPES.filter((x) => shapeMatch(t("seat.shape." + x))).map((x) => (
            <button key={x} className="shapetile" disabled={!edit} draggable={edit} title={t("seat.shape." + x)} aria-label={t("seat.shape." + x)} onDragStart={(e) => { e.dataTransfer.setData("text/shape", `table:${x}`); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addTable(x)}><ShapeIcon kind={x} /></button>
          ))}{shapeMatch(t("seat.chair")) && <button className="shapetile" disabled={!edit} draggable={edit} title={t("seat.chair")} aria-label={t("seat.chair")} onDragStart={(e) => { e.dataTransfer.setData("text/shape", "table:chair"); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addChair()}><svg viewBox="0 0 40 40" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx={20} cy={20} r={8} /><path d="M14 13 Q20 8 26 13" /></svg></button>}</div>}
          <button className="dio-sec" onClick={() => setSecs({ ...secs, figures: !secs.figures })}><span className="caret" data-open={secs.figures}>▸</span> {t("dio.figures")}</button>
          {secs.figures && <div className="shapegrid">{FIGURES.filter((x) => shapeMatch(t("fig." + x))).map((x) => (
            <button key={x} className="shapetile" disabled={!edit} draggable={edit} title={t("fig." + x)} aria-label={t("fig." + x)} onDragStart={(e) => { e.dataTransfer.setData("text/shape", `fig:${x}`); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addFigure(x)}><FigIcon kind={x} /></button>
          ))}</div>}
        </aside>}
        <div className="seat-print seatfullcanvas dio-center">
          <div className="printhead">{event.name} · {v.arrName} · {v.name}</div>
          <div className="seatwrap" style={{ height: "100%" }}>
            <div ref={view} className="seatview" style={{ height: "100%" }}>
              <div className={`seatcanvas editing${grid ? " gridlines" : ""}`} style={{ width: CW * zoom, height: CH * zoom, backgroundSize: `${20 * zoom}px ${20 * zoom}px` }} onPointerDown={() => setSel(null)} onDragOver={(e) => { if (edit && e.dataTransfer.types.includes("text/shape")) e.preventDefault(); }} onDrop={dropShape}>
                <div ref={content} className="seatstage" style={{ width: CW, height: CH, transform: `scale(${zoom})` }}>
                  {tables.length === 0 && figures.length === 0 && <div className="muted" style={{ padding: 20 }}>{t("seat.empty")}</div>}
                  {figures.map(figureNode)}
                  {tables.map(tableNode)}
                </div>
                {edit && <span className="canvasgrip noprint" title={t("seat.canvassize")} onPointerDown={(e) => startOp(e, { type: "canvas", sx: toCanvas(e.clientX, e.clientY).x, sy: toCanvas(e.clientX, e.clientY).y, w0: CW, h0: CH })} />}
              </div>
            </div>
          </div>
        </div>
        {showRight && <aside className="dio-right noprint">
          <div className="dio-tabs"><button aria-pressed={rightTab === "diagram"} onClick={() => setRightTab("diagram")}>{t("dio.diagram")}</button><button aria-pressed={rightTab === "style"} onClick={() => setRightTab("style")}>{t("dio.style")}</button></div>
          {rightTab === "diagram" ? (
            <div className="fieldcol" style={{ padding: 12 }}>
              <b>{t("dio.view")}</b>
              <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 8 }}><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />{t("dio.grid")}</label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <div><label htmlFor="cw">{t("fig.w")}</label><input id="cw" type="number" min={400} disabled={!edit} value={Math.round(CW)} onChange={(e) => patch((l) => { l.w = Math.max(400, Number(e.target.value) || 400); })} /></div>
                <div><label htmlFor="ch">{t("fig.h")}</label><input id="ch" type="number" min={300} disabled={!edit} value={Math.round(CH)} onChange={(e) => patch((l) => { l.h = Math.max(300, Number(e.target.value) || 300); })} /></div>
              </div>
              <div className="muted small">{t("dio.panelsize")}</div>
            <div className="seatlegend">
              <b>{t("seat.legend")}</b>
              {v.legend.map((l) => (
                <div key={l.id} className="row" style={{ gap: 6, flexWrap: "nowrap", marginTop: 6 }}>
                  <select aria-label={t("seat.legend.color")} value={l.color} disabled={!edit} style={{ width: 62, background: l.color, color: "#14203A" }} onChange={(e) => patch((x) => { x.legend.find((y) => y.id === l.id)!.color = e.target.value; })}>{[...new Set([...PALETTE, l.color])].map((c) => <option key={c} value={c} style={{ background: c }}>■</option>)}</select>
                  <input value={l.meaning} disabled={!edit} placeholder={t("seat.legend.ph")} aria-label={t("seat.legend.meaning")} onChange={(e) => patch((x) => { x.legend.find((y) => y.id === l.id)!.meaning = e.target.value; })} />
                  <button className="ghost icon" aria-label={t("delete")} title={t("delete")} disabled={!edit} onClick={() => patch((x) => { x.legend = x.legend.filter((y) => y.id !== l.id); })}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="ghost sm" style={{ marginTop: 8 }} disabled={!edit} onClick={() => patch((x) => { x.legend.push({ id: uid(), color: PALETTE.find((c) => !usedColors.has(c)) ?? PALETTE[0], meaning: "" }); })}><Plus size={13} /> {t("seat.legend.add")}</button>
            </div>
            </div>
          ) : (
            <div style={{ padding: 12 }}>
            {!selTable && !selFig && <p className="muted small" style={{ margin: 0 }}>{t("seat.select")}</p>}
            {selTable && !selSeat && (
              <div className="fieldcol">
                <b>{t("seat.table")}</b>
                <div><label htmlFor="stn">{t("name")}</label><input id="stn" value={selTable.name} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { x.name = e.target.value; })} /></div>
                <div><label htmlFor="sts">{t("seat.shape")}</label><select id="sts" value={selTable.shape} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { x.shape = e.target.value as SeatShape; })}>{SHAPES.map((x) => <option key={x} value={x}>{t("seat.shape." + x)}</option>)}</select></div>
                <div><label htmlFor="stc">{t("seat.seats")}</label><input id="stc" type="number" min={1} max={60} value={selTable.seats.length} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { x.seats = mkSeats(Math.max(1, Math.min(60, Number(e.target.value) || 1)), x.seats); })} /></div>
                {selTable.shape === "rows" && !selTable.chair && (() => { const cols = Math.max(1, Math.min(selTable.seats.length, selTable.cols || 10)), rows = Math.ceil(selTable.seats.length / cols); return (
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <div><label htmlFor="str2">{t("seat.rowsn")}</label><input id="str2" type="number" min={1} max={30} value={rows} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { const r = Math.max(1, Math.min(30, Number(e.target.value) || 1)); x.cols = cols; x.seats = mkSeats(Math.min(60, r * cols), x.seats); })} /></div>
                    <div><label htmlFor="stc2">{t("seat.colsn")}</label><input id="stc2" type="number" min={1} max={30} value={cols} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { const c = Math.max(1, Math.min(30, Number(e.target.value) || 1)); x.cols = c; x.seats = mkSeats(Math.min(60, rows * c), x.seats); })} /></div>
                  </div>); })()}
                {selTable.chair ? (
                  <div><label htmlFor="sjt">{t("seat.jointable")}</label><select id="sjt" value="" disabled={!edit || !tables.some((x) => !x.chair)} onChange={(e) => { const to = e.target.value; if (to) { patch((l) => joinTable(l, selTable.id, to)); setSel({ kind: "table", id: to }); } }}><option value="">—</option>{tables.filter((x) => !x.chair).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><p className="muted small" style={{ margin: "4px 0 0" }}>{t("seat.chair.hint")}</p></div>
                ) : <button className="ghost sm" disabled={!edit || selTable.seats.length >= 60} onClick={() => setTableProp(selTable.id, (x) => { x.seats = mkSeats(x.seats.length + 1, x.seats); })}><Plus size={13} /> {t("seat.addseat")}</button>}
                <div><label htmlFor="stz">{t("seat.size")} · {Math.round(selTable.scale * 100)}%</label><input id="stz" type="range" min={40} max={400} step={5} value={Math.round(selTable.scale * 100)} disabled={!edit} onChange={(e) => setScale(selTable, Number(e.target.value) / 100)} /></div>
                <div><label htmlFor="str">{t("seat.rotation")} · {selTable.rot}°</label>
                  <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                    <button className="ghost icon" aria-label={t("seat.rotl")} title={t("seat.rotl")} disabled={!edit} onClick={() => setTableProp(selTable.id, (x) => { x.rot = ((x.rot - 15 + 540) % 360) - 180; })}><RotateCw size={15} style={{ transform: "scaleX(-1)" }} /></button>
                    <input id="str" type="range" min={-180} max={180} step={5} value={selTable.rot} disabled={!edit} onChange={(e) => setTableProp(selTable.id, (x) => { x.rot = Number(e.target.value); })} />
                    <button className="ghost icon" aria-label={t("seat.rotr")} title={t("seat.rotr")} disabled={!edit} onClick={() => setTableProp(selTable.id, (x) => { x.rot = ((x.rot + 15 + 540) % 360) - 180; })}><RotateCw size={15} /></button>
                  </div></div>
                {selTable.chair ? <div><label>{t("seat.seatcolor")}</label>{swatches(selTable.seats[0].color, (c) => setTableProp(selTable.id, (x) => { x.seats[0].color = c; }), true)}</div> : <div><label>{t("seat.tablecolor")}</label>{swatches(selTable.color, (c) => setTableProp(selTable.id, (x) => { x.color = c; }), true)}</div>}
                <div className="row">
                  <button className="ghost sm" disabled={!edit} onClick={() => patch((l) => { const tb = structuredClone(v.tables.find((y) => y.id === selTable.id)!); tb.id = uid(); tb.name = t("seat.copyname", { name: tb.name }); tb.x += 30; tb.y += 30; tb.seats = tb.seats.map((z) => ({ ...z, id: uid(), guestId: "", party: 0 })); l.tables.push(tb); })}><Copy size={13} /> {t("seat.duplicate")}</button>
                  <button className="danger sm" disabled={!edit} onClick={() => { patch((l) => { l.tables = l.tables.filter((y) => y.id !== selTable.id); }); setSel(null); }}><Trash2 size={13} /> {t("delete")}</button>
                </div>
              </div>
            )}
            {selTable && selSeat && (
              <div className="fieldcol">
                <b>{t("seat.seat")} · {selTable.name}</b>
                <div><label htmlFor="ssn">{t("seat.seatname")}</label><input id="ssn" value={selSeat.label} disabled={!edit} placeholder={gname(guests.find((g) => g.id === selSeat.guestId), selSeat.party)} onChange={(e) => setTableProp(selTable.id, (x) => { x.seats.find((z) => z.id === selSeat.id)!.label = e.target.value; })} /></div>
                <div><label>{t("seat.seatcolor")}</label>{swatches(selSeat.color, (c) => setTableProp(selTable.id, (x) => { x.seats.find((z) => z.id === selSeat.id)!.color = c; }), true)}</div>
                <div><label>{t("seat.guest")}</label>
                  {selSeat.guestId ? <div className="row"><span>{gname(guests.find((g) => g.id === selSeat.guestId), selSeat.party) || "—"}</span><button className="ghost sm" disabled={!edit} onClick={() => unseat(selTable.id, selSeat.id)}><X size={13} /> {t("seat.unseat")}</button></div> : <span className="muted small">{t("seat.free")}</span>}
                </div>
                <button className="ghost sm" onClick={() => setSel({ kind: "table", id: selTable.id })}>{t("seat.backtable")}</button>
              </div>
            )}
            {selFig && (
              <div className="fieldcol">
                <b>{t("fig.title")}</b>
                <div><label htmlFor="sfn">{t("name")}</label><input id="sfn" value={selFig.name} disabled={!edit} onChange={(e) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.name = e.target.value; })} /></div>
                <div><label htmlFor="sfk">{t("fig.shape")}</label><select id="sfk" value={selFig.kind} disabled={!edit} onChange={(e) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.kind = e.target.value as Figure["kind"]; })}>{FIGURES.map((x) => <option key={x} value={x}>{t("fig." + x)}</option>)}</select></div>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <div><label htmlFor="sfw">{t("fig.w")}</label><input id="sfw" type="number" min={30} value={selFig.w} disabled={!edit} onChange={(e) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.w = Math.max(30, Number(e.target.value) || 30); })} /></div>
                  <div><label htmlFor="sfh">{t("fig.h")}</label><input id="sfh" type="number" min={30} value={selFig.h} disabled={!edit} onChange={(e) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.h = Math.max(30, Number(e.target.value) || 30); })} /></div>
                </div>
                <div><label htmlFor="sfr">{t("seat.rotation")} · {selFig.rot ?? 0}°</label>
                  <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                    <button className="ghost icon" aria-label={t("seat.rotl")} title={t("seat.rotl")} disabled={!edit} onClick={() => patch((l) => { const f = l.figures.find((y) => y.id === selFig.id)!; f.rot = (((f.rot ?? 0) - 15 + 540) % 360) - 180; })}><RotateCw size={15} style={{ transform: "scaleX(-1)" }} /></button>
                    <input id="sfr" type="range" min={-180} max={180} step={5} value={selFig.rot ?? 0} disabled={!edit} onChange={(e) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.rot = Number(e.target.value); })} />
                    <button className="ghost icon" aria-label={t("seat.rotr")} title={t("seat.rotr")} disabled={!edit} onClick={() => patch((l) => { const f = l.figures.find((y) => y.id === selFig.id)!; f.rot = (((f.rot ?? 0) + 15 + 540) % 360) - 180; })}><RotateCw size={15} /></button>
                  </div></div>
                <div><label>{t("seat.tablecolor")}</label>{swatches(selFig.color, (c) => patch((l) => { l.figures.find((y) => y.id === selFig.id)!.color = c; }), true)}</div>
                <button className="danger sm" disabled={!edit} onClick={() => { patch((l) => { l.figures = l.figures.filter((y) => y.id !== selFig.id); }); setSel(null); }}><Trash2 size={13} /> {t("delete")}</button>
              </div>
            )}
            </div>
          )}
        </aside>}
      </div>
      <div className="dio-pages noprint">
        <button className="ghost icon" aria-label={t("seat.save")} title={t("seat.save")} onClick={saveVersion}><Plus size={17} /></button>
        <span className="dio-sep" />
        {recs.map((r) => (
          <span key={r.id} className={`pagetab${r.id === v.id ? " on" : ""}`}>
            {renaming === r.id
              ? <input autoFocus aria-label={t("seat.versionname")} defaultValue={r.name} style={{ width: 110, padding: "2px 6px" }} onBlur={(e) => { const val = e.target.value.trim(); if (val) update((st) => { st.seatings.find((x) => x.id === r.id)!.name = val; st.seatDirty = true; }); setRenaming(""); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(""); }} />
              : <button onClick={() => { setVerId(r.id); setSel(null); }} onDoubleClick={() => setRenaming(r.id)} title={t("ins.dbl")}>{r.locked ? "🔒 " : ""}{r.name}</button>}
            {r.id === v.id && renaming !== r.id && (
              <span style={{ position: "relative" }}>
                <button className="ghost icon" aria-label={t("arr.options")} aria-haspopup="menu" aria-expanded={!!pageMenu} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPageMenu(pageMenu ? null : { left: r.left, bottom: window.innerHeight - r.top + 4 }); }}><ChevronDown size={14} /></button>
                {pageMenu && (
                  <>
                    <div className="menu-bg" style={{ zIndex: 70 }} onClick={() => setPageMenu(null)} />
                    <div className="menu seatmenu" role="menu" style={{ position: "fixed", left: pageMenu.left, right: "auto", bottom: pageMenu.bottom, top: "auto", zIndex: 75, minWidth: 190 }}>
                      <button role="menuitem" onClick={() => { setPageMenu(null); setRenaming(r.id); }}><Pencil size={14} /> {t("dio.rename")}</button>
                      <button role="menuitem" onClick={() => { setPageMenu(null); saveVersion(); }}><Copy size={14} /> {t("seat.save")}</button>
                      <button role="menuitem" onClick={() => { setPageMenu(null); toggleLock(); }}>{v.locked ? <><LockOpen size={14} /> {t("seat.unlock")}</> : <><Lock size={14} /> {t("seat.lock")}</>}</button>
                      <button role="menuitem" style={{ color: "var(--danger)" }} disabled={!edit} onClick={() => { setPageMenu(null); delVersion(); }}><Trash2 size={14} /> {t("seat.deleteversion")}</button>
                    </div>
                  </>
                )}
              </span>
            )}
          </span>
        ))}
      </div>
      {help && (
        <Modal title={t("dio.shortcuts")} onClose={() => setHelp(false)}>
          {[["Ctrl/Cmd + S", t("dio.savechanges")], ["Ctrl/Cmd + Shift + S", t("seat.save")], ["Ctrl/Cmd + Z", t("seat.undo")], ["Ctrl/Cmd + Shift + Z", t("seat.redo")], ["Ctrl/Cmd + C / V", `${t("seat.copysel")} / ${t("seat.paste")}`], ["Del", t("delete")], ["Esc", t("back")], ["Shift", t("seat.rotate")]].map(([k, d]) => <div key={k} className="row between" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}><code>{k}</code><span className="small">{d}</span></div>)}
        </Modal>
      )}
      {leave && (
        <Modal title={t("seat.leave.title")} onClose={() => setLeave(false)}>
          <p style={{ marginTop: 0 }}>{t("seat.leave.desc")}</p>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button className="ghost" onClick={() => setLeave(false)}>{t("seat.leave.keep")}</button>
            <button className="danger" onClick={() => { discardSeatEdits(); setLeave(false); onClose(); }}>{t("seat.leave.discard")}</button>
            <button onClick={() => { update((st) => { st.seatDirty = false; }); setLeave(false); onClose(); }}>{t("seat.leave.save")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Table arrangement (Pro): arrangement tabs on the left, a preview of the selected one, and a full-page editor (double-click a tab or press Edit). */
export default function Tables({ event }: { event: EventT }) {
  const s = useStore();
  const doPrint = () => { if (!PLANS[s.plan].printTables) { openUpsell("print"); return; } window.print(); };
  const { t } = useT();
  const [arrId, setArrId] = useState("");
  const [verByArr, setVerByArr] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const desktop = useMedia("(min-width: 1025px) and (hover: hover)"); // the editor needs a computer (mouse and a large screen)
  const openEdit = (id: string) => { if (desktop) setEditing(id); };
  const [menu, setMenu] = useState(false);
  const [tabMenu, setTabMenu] = useState(false);
  const [showArch, setShowArch] = useState(false);
  const suggested = SUGGEST[event.type] ?? ["dinner", "ceremony", "cocktail"];
  const recs = s.seatings.filter((x) => x.eventId === event.id).sort((a, b) => a.createdAt - b.createdAt);
  const all = [...new Set(recs.map((x) => x.arrId))].map((id) => { const vs = recs.filter((x) => x.arrId === id); const last = vs[vs.length - 1]; return { id, name: last.arrName, kind: vs[0].kind, versions: vs, pos: vs[0].pos ?? vs[0].createdAt, archived: !!last.archived }; }).sort((a, b) => a.pos - b.pos);
  const arrs = all.filter((a) => !a.archived), archived = all.filter((a) => a.archived);
  const arr = arrs.find((a) => a.id === arrId) ?? arrs[0];
  const ver = arr ? arr.versions.find((x) => x.id === verByArr[arr.id]) ?? arr.versions[arr.versions.length - 1] : undefined;
  const guests = s.guests.filter((g) => g.eventId === event.id && g.status !== "declined");
  const pos = arr ? arrs.findIndex((a) => a.id === arr.id) : -1;

  const maxPos = Math.max(0, ...all.map((a) => a.pos));
  const create = (kind: string) => {
    if (all.length >= PLANS[s.plan].tables) { setMenu(false); openUpsell("tables"); return; }
    const same = all.filter((a) => a.kind === kind).length;
    const rec: Seating = { id: uid(), eventId: event.id, arrId: uid(), arrName: same ? `${t("arrn." + kind)} ${same + 1}` : t("arrn." + kind), kind, name: `${t("seat.version")} 1`, createdAt: Date.now(), locked: false, tables: [], figures: [], w: 1000, h: 640, legend: [], approvals: [], pos: maxPos + 1 };
    update((st) => { st.seatings.push(rec); }); setArrId(rec.arrId); setMenu(false);
  };
  const setArr = (id: string, fn: (x: Seating) => void) => update((st) => { st.seatings.filter((x) => x.arrId === id).forEach(fn); });
  const move = (dir: -1 | 1) => {
    if (!arr) return;
    const order = arrs.map((a) => a.id), i = order.indexOf(arr.id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    update((st) => { order.forEach((id, n) => st.seatings.filter((x) => x.arrId === id).forEach((x) => { x.pos = n + 1; })); });
  };
  const copy = () => {
    if (!arr || !ver) return;
    if (all.length >= PLANS[s.plan].tables) { openUpsell("tables"); return; }
    const c: Seating = { ...structuredClone(ver), id: uid(), arrId: uid(), arrName: t("seat.copyname", { name: arr.name }), name: `${t("seat.version")} 1`, createdAt: Date.now(), locked: false, approvals: [], pos: maxPos + 1, archived: false };
    c.tables = c.tables.map((tb) => ({ ...tb, id: uid(), seats: tb.seats.map((z) => ({ ...z, id: uid() })) })); c.figures = c.figures.map((f) => ({ ...f, id: uid() }));
    update((st) => { st.seatings.push(c); }); setArrId(c.arrId);
  };
  const remove = (id: string, name: string) => { if (confirm(`${t("arr.delete")}: ${name}?`)) { update((st) => { st.seatings = st.seatings.filter((x) => x.arrId !== id); }); setArrId(""); } };
  const createMenu = (
    <span style={{ position: "relative", display: "block", marginBottom: 8 }}>
      <button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Plus size={16} /> {t("seat.createnew")}</button>
      {menu && (
        <>
          <div className="menu-bg" onClick={() => setMenu(false)} />
          <div className="menu" role="menu" style={{ left: 0, right: "auto", zIndex: 25, minWidth: 220 }}>
            <div className="muted small" style={{ padding: "6px 10px" }}>{t("arr.suggested")}</div>
            {suggested.map((k) => <button key={k} role="menuitem" onClick={() => create(k)}>{t("arr." + k)}</button>)}
            <div className="muted small" style={{ padding: "6px 10px" }}>{t("arr.more")}</div>
            {KINDS.filter((k) => !suggested.includes(k)).map((k) => <button key={k} role="menuitem" onClick={() => create(k)}>{t("arr." + k)}</button>)}
          </div>
        </>
      )}
    </span>
  );
  return (
    <>
      <div className="arrwrap">
        <nav className="arrtabs arrtabs-wide noprint" aria-label={t("arr.title")}>
          {desktop && createMenu}
          {arrs.map((a) => (
            <span key={a.id} className="arrtab">
              <button aria-current={a.id === arr?.id ? "page" : undefined} title={t("ins.dbl")} onClick={() => setArrId(a.id)} onDoubleClick={() => { setArrId(a.id); openEdit(a.id); }}>{a.name}</button>
              {a.id === arr?.id && (
                <span style={{ position: "relative" }}>
                  <button className="ghost icon" aria-label={t("arr.options")} title={t("arr.options")} aria-haspopup="menu" aria-expanded={tabMenu} onClick={() => setTabMenu(!tabMenu)}><ChevronDown size={15} /></button>
                  {tabMenu && (
                    <>
                      <div className="menu-bg" onClick={() => setTabMenu(false)} />
                      <div className="menu" role="menu" style={{ left: 0, right: "auto", zIndex: 25, minWidth: 190 }}>
                        <button role="menuitem" disabled={!desktop} onClick={() => { setTabMenu(false); openEdit(a.id); }}><Pencil size={14} /> {t("seat.edit")}</button>
                        <button role="menuitem" disabled={pos <= 0} onClick={() => { setTabMenu(false); move(-1); }}><ChevronUp size={14} /> {t("tl.moveup")}</button>
                        <button role="menuitem" disabled={pos >= arrs.length - 1} onClick={() => { setTabMenu(false); move(1); }}><ChevronDown size={14} /> {t("tl.movedown")}</button>
                        <button role="menuitem" onClick={() => { setTabMenu(false); setTimeout(() => doPrint(), 50); }}><Printer size={14} /> {t("seat.print")}</button>
                        <button role="menuitem" onClick={() => { setTabMenu(false); copy(); }}><Copy size={14} /> {t("seat.copysel")}</button>
                        <button role="menuitem" onClick={() => { setTabMenu(false); setArr(a.id, (x) => { x.archived = true; }); setArrId(""); }}><Archive size={14} /> {t("arr.archive")}</button>
                        <button role="menuitem" style={{ color: "var(--danger)" }} onClick={() => { setTabMenu(false); remove(a.id, a.name); }}><Trash2 size={14} /> {t("delete")}</button>
                      </div>
                    </>
                  )}
                </span>
              )}
            </span>
          ))}
          {archived.length > 0 && (
            <>
              <button className="arradd" onClick={() => setShowArch(!showArch)}><Archive size={13} /> {t("arr.archived")} ({archived.length})</button>
              {showArch && archived.map((a) => (
                <span key={a.id} className="arrtab">
                  <span className="small muted" style={{ flex: 1, padding: "4px 10px" }}>{a.name}</span>
                  <button className="ghost icon" aria-label={t("board.restore")} title={t("board.restore")} onClick={() => setArr(a.id, (x) => { x.archived = false; })}><ArchiveRestore size={14} /></button>
                  <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => remove(a.id, a.name)}><Trash2 size={14} /></button>
                </span>
              ))}
            </>
          )}
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!arr || !ver ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <h3 style={{ marginTop: 0 }}>{t("seat.none.title")}</h3>
              <p className="muted">{t("seat.none.desc")}</p>
            </div>
          ) : (
            <>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <h3 style={{ margin: 0 }}>{arr.name}</h3>
                  <select aria-label={t("seat.versions")} value={ver.id} onChange={(e) => setVerByArr({ ...verByArr, [arr.id]: e.target.value })} style={{ width: "auto" }}>{arr.versions.map((x) => <option key={x.id} value={x.id}>{x.locked ? "🔒 " : ""}{x.name}</option>)}</select>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="dio-count" style={{ margin: 0 }}><span><b>{ver.tables.filter((x) => !x.chair).length}</b> {t("seat.count.tables")}</span><span><b>{ver.tables.reduce((n, x) => n + x.seats.length, 0)}</b> {t("seat.count.seats")}</span></span>
                  <ApprovalButton event={event} scope="tables" subject={`${arr.name} · ${ver.name}`} summary={() => seatSummary(t, ver, guests)} snap={() => ({ k: "tables", rec: seatSnap(ver, guests) })} />
                </div>
              </div>
              {!desktop && <p className="muted small" style={{ margin: "0 0 8px" }}>{t("seat.desktoponly")}</p>}
              {desktop && ver.tables.length === 0 && ver.figures.length === 0 && <p className="muted small" style={{ margin: "0 0 8px" }}>{t("seat.empty.edit")}</p>}
              <div className={editing ? "" : "seat-print"}>
                <div className="printhead">{event.name} · {arr.name} · {ver.name}</div>
                <div onDoubleClick={() => openEdit(arr.id)} title={t("ins.dbl")}><SeatStatic rec={ver} guests={guests} /></div>
                {ver.legend.length > 0 && <div className="seatlegend">{ver.legend.map((l) => <div key={l.id} className="row" style={{ gap: 8, marginTop: 4 }}><span className="sw" style={{ background: l.color }} /><span>{l.meaning || "—"}</span></div>)}</div>}
              </div>
            </>
          )}
        </div>
      </div>
      {editing && arr && desktop && <SeatEditor key={editing} event={event} arrId={editing} startVer={ver?.id ?? ""} onClose={() => setEditing(null)} />}
    </>
  );
}
