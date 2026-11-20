/**
 * 1Plan motion layer ("balanced"): button ripple, sliding sidebar highlight, sliding segmented switch,
 * a lifted drag image, page entrances and a small confetti burst when a task is completed.
 * It only decorates the DOM, so no screen logic changes. Everything is skipped when the user
 * asks the system for reduced motion.
 */
const EASE = "cubic-bezier(.22, 1, .36, 1)";
const SPRING = "cubic-bezier(.34, 1.35, .64, 1)";
/* "Animations" switch in the account menu: remembered on this device, also respects the system setting */
const KEY = "1plan.motion";
let off = false;
try { off = localStorage.getItem(KEY) === "off"; } catch { /* storage blocked: keep animations on */ }
export const motionOn = () => !off;
export function setMotion(on: boolean) {
  off = !on;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
  document.documentElement.dataset.motion = on ? "on" : "off";
}
export const reduce = () => off || matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- confetti ---------- */
export function confetti(x: number, y: number) {
  if (reduce()) return;
  const c = document.createElement("canvas");
  c.width = innerWidth; c.height = innerHeight;
  c.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:300";
  document.body.appendChild(c);
  const g = c.getContext("2d");
  if (!g) { c.remove(); return; }
  const colors = ["#46C8B2", "#FF7A59", "#F0B429", "#B9A6FF", "#FF9C7F"];
  const bits = Array.from({ length: 48 }, () => {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 3 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1 };
  });
  let n = 0;
  const frame = () => {
    n++;
    g.clearRect(0, 0, c.width, c.height);
    for (const p of bits) {
      p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.011;
      g.save(); g.globalAlpha = Math.max(p.life, 0); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore();
    }
    if (n < 90) requestAnimationFrame(frame); else c.remove();
  };
  frame();
}

/* ---------- toast: a small message that slides up from the bottom ---------- */
let toastEl: HTMLElement | null = null, toastTimer: number | undefined;
export function toast(msg: string) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast2"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
  toastEl.textContent = msg;
  const el = toastEl;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2000);
}

/* ---------- button ripple ---------- */
function ripple(e: PointerEvent) {
  if (reduce() || e.button !== 0) return;
  const b = (e.target as Element | null)?.closest<HTMLElement>("button:not(:disabled)");
  if (!b || !b.matches("button:not([class]), button.ghost, button.danger, button.sm")) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement("span");
  s.className = "rip";
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.classList.add("rip-host");
  b.appendChild(s);
  setTimeout(() => { s.remove(); b.classList.remove("rip-host"); }, 650);
}

/* ---------- icon reaction: the icon inside a pressed button spins, rings or pops ---------- */
function iconReact(e: PointerEvent) {
  if (reduce() || e.button !== 0) return;
  const b = (e.target as Element | null)?.closest<HTMLElement>("button:not(:disabled), a.btn, a.bellbtn");
  const ic = b?.querySelector<SVGElement>("svg");
  if (!b || !ic || b.classList.contains("fab")) return;
  const kind = ic.dataset.i ?? ic.getAttribute("class") ?? "";
  if (/plus/.test(kind)) ic.animate([{ transform: "rotate(0deg) scale(1)" }, { transform: "rotate(180deg) scale(1.25)", offset: .5 }, { transform: "rotate(360deg) scale(1)" }], { duration: 520, easing: SPRING });
  else if (/bell/.test(kind)) ic.animate([{ transform: "rotate(0)" }, { transform: "rotate(18deg)" }, { transform: "rotate(-16deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(0)" }], { duration: 560, easing: "ease-in-out" });
  else ic.animate([{ transform: "scale(1)" }, { transform: "scale(1.3) rotate(-8deg)" }, { transform: "scale(1)" }], { duration: 340, easing: SPRING });
}

/* ---------- window submit buttons: spinner, then a green check, then the real submit ---------- */
function onSubmit(e: SubmitEvent) {
  const form = e.target as HTMLFormElement, btn = e.submitter as HTMLButtonElement | null;
  if (reduce() || form.dataset.fx || !form.closest(".modal") || !btn || btn.classList.contains("ghost") || !form.checkValidity()) return;
  e.preventDefault(); e.stopImmediatePropagation(); // the submit is replayed after the animation
  btn.style.minWidth = btn.offsetWidth + "px";
  btn.classList.add("fx-busy");
  setTimeout(() => {
    btn.classList.replace("fx-busy", "fx-done");
    setTimeout(() => {
      btn.classList.remove("fx-done"); btn.style.minWidth = "";
      if (!form.isConnected) return;
      form.dataset.fx = "1"; form.requestSubmit(btn); delete form.dataset.fx;
    }, 400);
  }, 650);
}

/* ---------- sliding highlights (sidebar item, segmented switch) ---------- */
let pillTop: number | null = null;
function syncPill() {
  const side = document.querySelector<HTMLElement>(".side");
  if (!side) { pillTop = null; return; }
  let pill = side.querySelector<HTMLElement>(":scope > .navpill");
  const on = side.querySelector<HTMLElement>('a.nav[aria-current="page"]');
  if (!on) { pill?.remove(); pillTop = null; return; }
  if (!pill) { pill = document.createElement("span"); pill.className = "navpill"; pill.setAttribute("aria-hidden", "true"); side.prepend(pill); }
  const t = on.offsetTop;
  Object.assign(pill.style, { top: t + "px", height: on.offsetHeight + "px", left: on.offsetLeft + "px", width: on.offsetWidth + "px" });
  if (pillTop !== null && pillTop !== t && !reduce()) pill.animate([{ top: pillTop + "px" }, { top: t + "px" }], { duration: 420, easing: SPRING });
  pillTop = t;
}

const segPrev = new WeakMap<HTMLElement, { l: number; w: number }>();
function syncSeg() {
  document.querySelectorAll<HTMLElement>(".seg").forEach((seg) => {
    const on = seg.querySelector<HTMLElement>('button[aria-pressed="true"], button[aria-selected="true"]');
    let th = seg.querySelector<HTMLElement>(":scope > .segthumb");
    if (!on) { th?.remove(); segPrev.delete(seg); return; }
    if (!th) { th = document.createElement("span"); th.className = "segthumb"; th.setAttribute("aria-hidden", "true"); seg.prepend(th); }
    const l = on.offsetLeft, w = on.offsetWidth;
    th.style.left = l + "px"; th.style.width = w + "px";
    const p = segPrev.get(seg);
    if (p && (p.l !== l || p.w !== w) && !reduce()) th.animate([{ left: p.l + "px", width: p.w + "px" }, { left: l + "px", width: w + "px" }], { duration: 340, easing: SPRING });
    segPrev.set(seg, { l, w });
  });
}

/* ---------- page entrance ---------- */
function enter(root: Element | null) {
  if (!root || reduce()) return;
  root.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE });
  root.querySelectorAll<HTMLElement>(".grid > .card, .bcol").forEach((el, i) => {
    el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: Math.min(i, 9) * 45 + 60, easing: EASE, fill: "backwards" });
  });
}
function onRoute() {
  requestAnimationFrame(() => requestAnimationFrame(() => enter(document.querySelector(".evbody") || document.querySelector(".content"))));
}

/* ---------- drag: lifted, tilted drag image and a dimmed source ---------- */
const DRAGGABLE = ".tcard, .listrow, .gchip, .chip, .tabitem";
let dragTid: string | null = null; // id of the task being dragged (cards and list rows carry data-tid)
function onDragStart(e: DragEvent) {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(DRAGGABLE);
  if (!el || !e.dataTransfer || reduce()) return;
  el.dataset.dragging = "1";
  dragTid = el.dataset.tid ?? null;
  const r = el.getBoundingClientRect();
  const g = el.cloneNode(true) as HTMLElement;
  g.classList.add("dragghost");
  g.style.width = r.width + "px";
  document.body.appendChild(g);
  e.dataTransfer.setDragImage(g, e.clientX - r.left, e.clientY - r.top);
  setTimeout(() => g.remove(), 0);
}
/* seating: the table or seat under a dragged guest lights up, and shows a ring where it was dropped */
let dropEl: Element | null = null;
function onDragOver(e: DragEvent) {
  const el = (e.target as Element | null)?.closest?.(".seatdot, .seattable") ?? null;
  if (el === dropEl) return;
  dropEl?.classList.remove("drop-over");
  dropEl = el; el?.classList.add("drop-over");
}
function onDrop() {
  const tid = dragTid; dragTid = null;
  if (tid && !reduce()) setTimeout(() => { // the dropped task lands with a small bounce
    const n = document.querySelector<HTMLElement>(`[data-tid="${tid}"]`);
    n?.animate([{ transform: "scale(.92)" }, { transform: "scale(1.04)", offset: .6 }, { transform: "none" }], { duration: 440, easing: SPRING });
  }, 90);
  const el = dropEl;
  dropEl?.classList.remove("drop-over"); dropEl = null;
  if (!el || reduce() || !el.classList.contains("seatdot")) return;
  setTimeout(() => { if (el.isConnected) (el as HTMLElement).animate([{ boxShadow: "0 0 0 0 rgba(70,200,178,.8)" }, { boxShadow: "0 0 0 16px rgba(70,200,178,0)" }], { duration: 650, easing: EASE }); }, 80);
}
function onDragEnd() {
  dragTid = null;
  dropEl?.classList.remove("drop-over"); dropEl = null;
  document.querySelectorAll<HTMLElement>("[data-dragging]").forEach((x) => { delete x.dataset.dragging; });
}

/* ---------- checkbox pop (and confetti for finished tasks) ---------- */
function onChange(e: Event) {
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || t.type !== "checkbox" || !t.checked || reduce()) return;
  t.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 350, easing: SPRING });
  if (t.classList.contains("tcheck")) { const r = t.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2); }
}

/* ---------- count-up for numbers marked with data-count ---------- */
function syncCounts() {
  document.querySelectorAll<HTMLElement>("[data-count]:not([data-counted])").forEach((el) => {
    el.dataset.counted = "1";
    const n = Number(el.dataset.count), node = el.firstChild;
    if (reduce() || !isFinite(n) || n === 0 || !node) return;
    const t0 = performance.now();
    const f = (t: number) => {
      const k = Math.min((t - t0) / 800, 1), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = String(Math.round(n * e)); // same text node React owns, so later updates still work
      if (k < 1) requestAnimationFrame(f); else node.nodeValue = String(n);
    };
    requestAnimationFrame(f);
  });
}

export function initMotion() {
  document.documentElement.dataset.motion = off ? "off" : "on";
  document.addEventListener("pointerdown", ripple);
  document.addEventListener("pointerdown", iconReact);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("dragstart", onDragStart, true);
  document.addEventListener("dragend", onDragEnd, true);
  document.addEventListener("dragover", onDragOver, true);
  document.addEventListener("drop", onDrop, true);
  document.addEventListener("change", onChange);
  addEventListener("hashchange", onRoute);
  let queued = false;
  const sync = () => { queued = false; syncPill(); syncSeg(); syncCounts(); };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected", "aria-current", "class"] });
  addEventListener("resize", schedule);
  document.fonts?.ready.then(schedule);
  schedule();
  setTimeout(() => enter(document.querySelector(".content")), 250);
}
