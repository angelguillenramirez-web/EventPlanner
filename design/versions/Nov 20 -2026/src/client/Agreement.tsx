import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { MENU_CATEGORIES, defaultPaper, me, newTask, uid, update, useStore, type AgKind, type AgPaper, type AgSection, type Agreement, type Comment, type EventT } from "../store";
import { SeatStatic } from "./Tables";
import { invitationDoc } from "../invitationTemplates";
import { useMedia } from "../shared";
import { Pipette, ArrowLeft, Bold, ChevronDown, ChevronUp, Download, FileText, Image as ImageIcon, Italic, List, ListTodo, MessageCircle, Palette, Plus, Printer, RefreshCw, Save, Send, Trash2, Upload, X } from "../icons";
import { PAPER_COLORS, TEXTURES, cleanDoc, cleanVis, docHtml, esc, fullDoc, logoHtml, paperBg } from "./agDoc";
import ApprovalButton from "./Approval";
import { money } from "./Billing";
import { ask } from "./Ask";

const KINDS: AgKind[] = ["parties", "event", "itinerary", "menu", "talent", "seating", "invitation", "fees", "payment", "terms"];

/** One editable block of text. The HTML is written into the page once (and again when `nonce` changes) so typing never loses the cursor. */
function Editable({ html, editable, nonce, onSave }: { html: string; editable: boolean; nonce: string; onSave: (h: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  useEffect(() => { if (ref.current) ref.current.innerHTML = cleanDoc(html); }, [nonce]); // eslint-disable-line
  const save = () => { window.clearTimeout(timer.current); if (ref.current) onSave(cleanDoc(ref.current.innerHTML)); };
  return <div ref={ref} className="agbody" contentEditable={editable} suppressContentEditableWarning onInput={() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 600); }} onBlur={save} />;
}

/** Reads a picture, shrinks it so it fits comfortably in browser storage and returns it as a data URL. */
const readPic = (file: File, max: number, type: "image/jpeg" | "image/png"): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error("read"));
  r.onload = () => { const img = new Image(); img.onerror = () => reject(new Error("img")); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL(type, 0.8)); }; img.src = String(r.result); };
  r.readAsDataURL(file);
});

/** Paper colour, texture (preset or uploaded) and company logo. */
function PaperPanel({ paper, onChange, onClose }: { paper: AgPaper; onChange: (p: AgPaper) => void; onClose: () => void }) {
  const { t } = useT();
  const s = useStore();
  const [err, setErr] = useState("");
  const set = (p: Partial<AgPaper>) => onChange({ ...paper, ...p });
  const pick = async (file: File | undefined, kind: "texture" | "logo") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr(t("menu.imgerr"));
    try { const data = await readPic(file, kind === "texture" ? 1000 : 500, kind === "texture" ? "image/jpeg" : "image/png"); setErr(""); if (kind === "texture") set({ image: data, texture: "custom" }); else set({ logoImg: data, logo: "upload" }); } catch { setErr(t("menu.imgerr")); }
  };
  const [branch, setBranch] = useState<"color" | "texture" | "logo" | "">("color"); // one branch open at a time keeps the menu short
  const Branch = ({ id, label, summary, children }: { id: "color" | "texture" | "logo"; label: string; summary: React.ReactNode; children: React.ReactNode }) => (
    <div className="agbranch">
      <button type="button" className="agbhead" aria-expanded={branch === id} onClick={() => setBranch(branch === id ? "" : id)}>
        <ChevronDown size={14} style={{ transform: branch === id ? undefined : "rotate(-90deg)", transition: "transform .15s" }} /><b>{label}</b><span className="agbsum">{summary}</span>
      </button>
      {branch === id && <div className="agbbody">{children}</div>}
    </div>
  );
  const logoSrc = paper.logo === "account" ? s.businessLogo : paper.logo === "upload" ? paper.logoImg : "";
  const choose = (v: AgPaper["logo"]) => { if (v === "account" && !s.businessLogo) { setErr(t("ag.logo.noaccount")); return; } setErr(""); set({ logo: v }); };
  const seg = <T extends string>(label: string, value: T, opts: [T, string][], on: (v: T) => void) => (
    <div className="row" style={{ gap: 8, justifyContent: "space-between" }}><span className="muted small">{label}</span><div className="seg" role="group" aria-label={label}>{opts.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => on(v)}>{l}</button>)}</div></div>
  );
  return (
    <>
    <div className="menu-bg" style={{ zIndex: 29 }} onClick={onClose} />
    <div className="card agpaper noprint" role="region" aria-label={t("ag.paper")}>
      <div className="row between"><b>{t("ag.paper")}</b><button className="ghost icon" aria-label={t("close")} onClick={onClose}><X size={15} /></button></div>
      <Branch id="color" label={t("ag.paper.color")} summary={<i className="swatch sm" style={{ background: paper.color, display: "inline-block" }} />}>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "center" }}>
          {PAPER_COLORS.map((c) => <button key={c} type="button" className="swatch sm" aria-label={c} aria-pressed={paper.color === c} style={{ background: c }} onClick={() => set({ color: c })} />)}
          <label className="pickbtn" title={t("ag.paper.custom")} aria-label={t("ag.paper.custom")}><Pipette size={15} /><input type="color" value={paper.color} onChange={(e) => set({ color: e.target.value })} /></label>
        </div>
      </Branch>
      <Branch id="texture" label={t("ag.paper.texture")} summary={<span>{paper.texture === "" ? t("ag.tx.none") : paper.texture === "custom" ? t("ag.tx.custom") : t("ag.tx." + paper.texture)}</span>}>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="textile" aria-pressed={paper.texture === ""} style={{ background: paper.color }} onClick={() => set({ texture: "" })}>{t("ag.tx.none")}</button>
          {Object.keys(TEXTURES).map((k) => <button key={k} type="button" className="textile" aria-pressed={paper.texture === k} style={{ background: paperBg({ ...paper, texture: k }) }} onClick={() => set({ texture: k })}>{t("ag.tx." + k)}</button>)}
          {paper.image && <button type="button" className="textile" aria-pressed={paper.texture === "custom"} style={{ background: paperBg({ ...paper, texture: "custom" }) }} onClick={() => set({ texture: "custom" })}>{t("ag.tx.custom")}</button>}
        </div>
        <label className="filebtn sm" style={{ marginTop: 8 }}><Upload size={14} /> {t("ag.tx.upload")}<input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0], "texture"); e.target.value = ""; }} /></label>
      </Branch>
      <Branch id="logo" label={t("ag.logo")} summary={logoSrc ? <img src={logoSrc} alt="" style={{ height: 18, maxWidth: 40, objectFit: "contain" }} /> : <span>{t("ag.logo.none")}</span>}>
        <div className="row" style={{ gap: 6, alignItems: "stretch" }}>
          <button type="button" className="textile logotile" aria-pressed={paper.logo === ""} onClick={() => choose("")}>{t("ag.logo.none")}</button>
          <button type="button" className="textile logotile" aria-pressed={paper.logo === "account"} disabled={!s.businessLogo} title={s.businessLogo ? "" : t("ag.logo.noaccount")} onClick={() => choose("account")}>{s.businessLogo ? <img src={s.businessLogo} alt="" /> : null}<span>{t("ag.logo.account")}</span></button>
          {paper.logoImg && <button type="button" className="textile logotile" aria-pressed={paper.logo === "upload"} onClick={() => choose("upload")}><img src={paper.logoImg} alt="" /><span>{t("ag.logo.upload")}</span></button>}
        </div>
        <label className="filebtn sm" style={{ marginTop: 8 }}><Upload size={14} /> {t("ag.logo.pick")}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { pick(e.target.files?.[0], "logo"); e.target.value = ""; }} /></label>
        {paper.logo && <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {seg(t("ag.logo.size"), paper.logoSize, [["s", "S"], ["m", "M"], ["l", "L"]], (v) => set({ logoSize: v }))}
          {seg(t("ag.logo.pos"), paper.logoPos ?? "top", [["top", t("ag.logo.top")], ["bottom", t("ag.logo.bottom")]], (v) => set({ logoPos: v }))}
          {seg(t("ag.logo.align"), paper.logoAlign, [["left", t("ag.logo.left")], ["center", t("ag.logo.center")], ["right", t("ag.logo.right")]], (v) => set({ logoAlign: v }))}
        </div>}
      </Branch>
      {err && <p role="alert" style={{ color: "var(--danger)", margin: "6px 0 0", fontSize: ".85rem" }}>{err}</p>}
    </div>
    </>
  );
}

export default function AgreementTab({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const ag = s.agreements.find((a) => a.eventId === event.id);
  const [viewVer, setViewVer] = useState("");
  const [fmt, setFmt] = useState(0);
  const [openC, setOpenC] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState("");
  const [nonce, setNonce] = useState(0); // bump to rewrite every editable block from the store (refresh, restore)
  const who = me(s).name;
  const wide = useMedia("(min-width: 1180px)"); // side bubbles need room; on narrower screens comments sit under their section
  const [paperOpen, setPaperOpen] = useState(false);
  const [composer, setComposer] = useState<string | null>(null);
  const [taskFor, setTaskFor] = useState<string | null>(null);
  const [tk, setTk] = useState({ name: "", who: "", due: "" });
  const artRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // the header bar stays visible while scrolling; the side list and the format toolbar sit just below it
  useLayoutEffect(() => {
    const el = barRef.current, host = el?.parentElement; if (!el || !host) return;
    const set = () => host.style.setProperty("--agbar-h", el.offsetHeight + "px");
    set(); window.addEventListener("resize", set); return () => window.removeEventListener("resize", set);
  }); // measured after every render: the bar grows when its buttons wrap
  const marRef = useRef<HTMLDivElement>(null);
  /** Places each section's comment bubbles beside the section, pushing later ones down so they never overlap. */
  const layout = () => {
    const art = artRef.current, mar = marRef.current; if (!art || !mar || !wide) return;
    const base = art.getBoundingClientRect().top; let y = 0;
    mar.querySelectorAll<HTMLElement>(".agbubbles").forEach((b) => { const sec = document.getElementById("ag-" + b.dataset.for); if (!sec) return; y = Math.max(sec.getBoundingClientRect().top - base, y); b.style.top = y + "px"; y += b.offsetHeight + 10; });
    mar.style.height = Math.max(y, art.offsetHeight) + "px";
  };
  useLayoutEffect(layout);
  useEffect(() => { const art = artRef.current; if (!art || !wide) return; const ro = new ResizeObserver(layout); ro.observe(art); art.querySelectorAll(".agsec").forEach((x) => ro.observe(x)); window.addEventListener("resize", layout); return () => { ro.disconnect(); window.removeEventListener("resize", layout); }; }); // eslint-disable-line
  const fmtD = (d: string) => new Date(d + "T12:00").toLocaleDateString(locale, { dateStyle: "full" });

  /* ───── content generated from the event ───── */
  const generate = (kind: AgKind): string => {
    const guests = s.guests.filter((g) => g.eventId === event.id && g.status !== "declined").reduce((n, g) => n + g.invitees, 0);
    const sel = s.menu.filter((m) => m.eventId === event.id && m.selected);
    const perPerson = sel.reduce((n, m) => n + m.price, 0), menuTotal = perPerson * guests;
    const tal = s.talents.filter((x) => x.eventId === event.id), talTotal = tal.reduce((n, x) => n + x.fee, 0);
    const planner = [s.userName, s.billing.name].filter(Boolean).join(", ");
    const clients = s.team.filter((m) => m.kind === "client" && (m.scopeAll || m.eventIds.includes(event.id))).map((m) => m.name);
    const table = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    switch (kind) {
      case "parties": return `<p><b>${t("ag.planner")}:</b> ${esc(planner)}</p><p><b>${t("ag.g.client")}:</b> ${esc(clients.join(", ") || t("ag.g.pending"))}</p>`;
      case "event": return `<p><b>${t("name")}:</b> ${esc(event.name)}</p><p><b>${t("ag.g.type")}:</b> ${esc(t("type." + event.type))}</p><p><b>${t("ag.g.date")}:</b> ${esc(fmtD(event.date))}</p><p><b>${t("ag.g.venue")}:</b> ${esc([event.venue, event.location].filter(Boolean).join(", ") || t("ag.g.pending"))}</p><p><b>${t("ag.g.guests")}:</b> ${guests}</p>${event.description ? `<p>${esc(event.description)}</p>` : ""}`;
      case "itinerary": {
        const its = s.itineraries.filter((i) => i.eventId === event.id);
        const blocks = (its.length ? its : [{ id: "", name: "" }]).map((i) => {
          const acts = s.dots.filter((d) => d.eventId === event.id && (i.id ? d.itinId === i.id : true)).flatMap((d) => d.activities).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
          return acts.length ? `${i.name ? `<h3>${esc(i.name)}</h3>` : ""}${table([t("ag.g.when"), t("ag.g.activity"), t("location")], acts.map((a) => [`${a.date} ${a.time}`, a.name, a.location]))}` : "";
        }).join("");
        return blocks || `<p>${t("ag.g.noitems")}</p>`;
      }
      case "menu": return sel.length ? `${MENU_CATEGORIES.filter((c) => sel.some((m) => m.category === c)).map((c) => `<h3>${esc(t("menuc." + c))}</h3>${table([t("ag.g.item"), t("ag.g.price")], sel.filter((m) => m.category === c).map((m) => [m.name + (m.description ? ` — ${m.description}` : ""), money(m.price, locale)]))}`).join("")}<p><b>${t("menu.perperson")}:</b> ${money(perPerson, locale)} · <b>${t("ag.g.guests")}:</b> ${guests} · <b>${t("ag.g.total")}:</b> ${money(menuTotal, locale)}</p>` : `<p>${t("ag.g.noitems")}</p>`;
      case "talent": return tal.length ? table([t("tal.kind"), t("tal.name"), t("tal.start"), t("tal.fee")], tal.map((x) => [t("talk." + x.kind), x.name, x.start, x.fee ? money(x.fee, locale) : "—"])) : `<p>${t("ag.g.noitems")}</p>`;
      case "seating": {
        const arrs = [...new Set(s.seatings.filter((x) => x.eventId === event.id && !x.archived).map((x) => x.arrId))].map((id) => s.seatings.filter((x) => x.arrId === id).slice(-1)[0]);
        return arrs.length ? table([t("ag.g.arr"), t("ag.g.tables"), t("ag.g.seats")], arrs.map((a) => [`${a.arrName} (${a.name})`, String(a.tables.filter((x) => !x.chair).length), String(a.tables.reduce((n, x) => n + x.seats.length, 0))])) : `<p>${t("ag.g.noitems")}</p>`;
      }
      case "invitation": { const ok = s.signoffs.find((x) => x.eventId === event.id && x.scope === "invitations" && x.approvers.every((a) => a.at)); return ok ? `<p><b>${t("ag.g.invapproved")}:</b> ${esc(ok.subject)}</p>` : `<p>${t("ag.g.invnone")}</p>`; }
      case "fees": return `${table([t("ag.g.item"), t("ag.g.price")], [[t("ag.g.menutotal"), money(menuTotal, locale)], [t("ag.g.talenttotal"), money(talTotal, locale)], [t("ag.g.plannerfee"), money(0, locale)]])}<p><b>${t("ag.g.total")}:</b> ${money(menuTotal + talTotal, locale)}</p><p><small>${t("ag.g.fee.note")}</small></p>`;
      case "payment": return `<ul><li>${t("ag.g.pay1")}</li><li>${t("ag.g.pay2")}</li><li>${t("ag.g.pay3")}</li></ul>`;
      case "terms": return `<p><small>${t("ag.template")}</small></p>${[1, 2, 3, 4, 5].map((n) => `<p>${n}. ${esc(t("ag.g.t" + n))}</p>`).join("")}`;
      default: return "<p></p>";
    }
  };
  /** Pictures that belong to a section: dish photos, the seating plan(s) and the invitation. */
  const VIS_KINDS: AgKind[] = ["menu", "seating", "invitation"];
  const genVis = (kind: AgKind): string => {
    if (kind === "menu") {
      const pics = s.menu.filter((m) => m.eventId === event.id && m.selected && m.image && /^data:image\//.test(m.image));
      return pics.length ? `<div class="agvis">${pics.map((m) => `<figure class="agfig"><img src="${esc(m.image)}" alt="${esc(m.name)}"><figcaption>${esc(m.name)}</figcaption></figure>`).join("")}</div>` : "";
    }
    if (kind === "seating") {
      const gl = s.guests.filter((g) => g.eventId === event.id && g.status !== "declined");
      const recs = [...new Set(s.seatings.filter((x) => x.eventId === event.id && !x.archived).map((x) => x.arrId))].map((id) => s.seatings.filter((x) => x.arrId === id).slice(-1)[0]);
      return recs.length ? `<div class="agvis">${recs.map((r) => `<figure class="agfig wide">${renderToStaticMarkup(<SeatStatic rec={r} guests={gl} />)}<figcaption>${esc(r.arrName)} · ${esc(r.name)}</figcaption></figure>`).join("")}</div>` : "";
    }
    if (kind === "invitation") {
      const ok = s.signoffs.find((x) => x.eventId === event.id && x.scope === "invitations" && x.approvers.every((a) => a.at));
      const inv = s.invitations.find((i) => i.eventId === event.id && (!ok || ok.subject.includes(i.name))) ?? s.invitations.find((i) => i.eventId === event.id);
      return inv ? `<div class="agvis"><figure class="agfig inv"><div style="position:relative;width:300px;height:300px;overflow:hidden;border:1px solid #EDE6D8;border-radius:4px"><iframe sandbox="" tabindex="-1" srcdoc="${esc(invitationDoc(inv.html, inv.css))}" style="position:absolute;top:0;left:0;width:640px;height:640px;border:0;transform:scale(.469);transform-origin:top left;pointer-events:none"></iframe></div><figcaption>${esc(inv.name)}</figcaption></figure></div>` : "";
    }
    return "";
  };
  const mk = (kind: AgKind): AgSection => ({ id: uid(), kind, title: t("ag.s." + kind), html: generate(kind), included: true, comments: [], vis: VIS_KINDS.includes(kind) ? genVis(kind) : undefined, showVis: true });

  const backfilled = useRef("");
  useEffect(() => { // agreements made before section pictures existed get them once
    if (!ag || backfilled.current === ag.id || ag.sections.every((x) => x.vis !== undefined || !VIS_KINDS.includes(x.kind))) return;
    backfilled.current = ag.id;
    update((st) => { const a = st.agreements.find((x) => x.id === ag.id); a?.sections.forEach((x) => { if (x.vis === undefined && VIS_KINDS.includes(x.kind)) { x.vis = genVis(x.kind); x.showVis = true; } }); });
  }); // eslint-disable-line

  /* ───── state helpers ───── */
  const patch = (fn: (a: Agreement) => void) => update((st) => { const a = st.agreements.find((x) => x.eventId === event.id); if (a) { fn(a); a.modifiedAt = Date.now(); } });
  const create = () => { update((st) => { st.agreements.push({ id: uid(), eventId: event.id, version: 1, status: "draft", sections: KINDS.map(mk), versions: [], createdAt: Date.now(), modifiedAt: Date.now() }); }); };
  if (!ag) return (
    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
      <FileText size={34} style={{ color: "var(--teal)" }} />
      <h2 style={{ marginBottom: 4 }}>{t("ag.title")}</h2>
      <p className="muted" style={{ maxWidth: 520, margin: "0 auto 8px" }}>{t("ag.intro")}</p>
      <p className="muted small" style={{ maxWidth: 520, margin: "0 auto 16px" }}>{t("ag.create.desc")}</p>
      <button onClick={create}><Plus size={16} /> {t("ag.create")}</button>
    </div>
  );

  const subject = `${t("ag.title")} · v${ag.version}`;
  const so = s.signoffs.find((x) => x.eventId === event.id && x.scope === "agreement" && x.subject === subject);
  const signed = !!so && so.approvers.every((a) => a.at), inApproval = !!so && !signed;
  const old = viewVer ? ag.versions.find((v) => v.id === viewVer) : undefined;
  const sections = old ? old.sections : ag.sections;
  const editable = !signed && !inApproval && !old;
  const status = signed ? "signed" : inApproval ? "approval" : ag.status;
  const title = `${t("ag.title")} — ${event.name}`;
  const sub = `${fmtD(event.date)} · v${ag.version}`;
  const paper = ag.paper ?? defaultPaper();
  const lg = logoHtml(paper, s.businessLogo), lgBottom = paper.logoPos === "bottom";
  const body = () => docHtml(title, sub, sections, (signed && so ? `<h2>${t("ag.sigs")}</h2>${so.approvers.map((a) => `<p>${esc(t("ag.signedby", { name: a.name, when: new Date(a.at).toLocaleString(locale) }))}</p>`).join("")}` : `<div class="sig">${[t("ag.planner"), t("ag.client")].map((x) => `<div>${x}</div>`).join("")}</div>`) + (lgBottom ? lg : ""), lgBottom ? "" : lg);

  const setSec = (id: string, fn: (x: AgSection) => void) => patch((a) => { const x = a.sections.find((y) => y.id === id); if (x) fn(x); });
  const move = (i: number, d: -1 | 1) => patch((a) => { const j = i + d; if (j < 0 || j >= a.sections.length) return; [a.sections[i], a.sections[j]] = [a.sections[j], a.sections[i]]; });
  const refresh = (sec: AgSection) => ask(t("ag.refresh.q"), () => { setSec(sec.id, (x) => { x.html = generate(x.kind); if (VIS_KINDS.includes(x.kind)) x.vis = genVis(x.kind); }); setNonce((n) => n + 1); });
  const refreshAll = () => ask(t("ag.refresh.q"), () => { patch((a) => { a.sections.forEach((x) => { if (x.kind !== "custom") { x.html = generate(x.kind); if (VIS_KINDS.includes(x.kind)) x.vis = genVis(x.kind); } }); }); setNonce((n) => n + 1); });
  const saveVersion = () => { patch((a) => { a.versions.push({ id: uid(), at: Date.now(), by: who, name: `v${a.version}.${a.versions.filter((v) => v.name.startsWith(`v${a.version}.`)).length + 1}`, sections: structuredClone(a.sections) }); }); setFlash(t("saved")); setTimeout(() => setFlash(""), 1600); };
  const restore = () => { if (!old) return; patch((a) => { a.sections = structuredClone(old.sections); }); setViewVer(""); setNonce((n) => n + 1); };
  const amend = () => ask(t("ag.amend.q"), () => { patch((a) => { a.versions.push({ id: uid(), at: Date.now(), by: who, name: `v${a.version} (${t("ag.status.signed").toLowerCase()})`, sections: structuredClone(a.sections) }); a.version += 1; a.status = "draft"; }); setNonce((n) => n + 1); });
  const printDoc = () => { const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0"; document.body.appendChild(f); f.srcdoc = fullDoc(title, body(), paper); f.onload = () => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 2000); }; };
  /** Downloads the agreement as a PDF file (built in the browser from the same page that is printed). */
  const download = async () => {
    setFlash(t("ag.pdf.making"));
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0"; document.body.appendChild(f);
    try {
      await new Promise<void>((res) => { f.onload = () => res(); f.srcdoc = fullDoc(title, body(), paper); });
      await f.contentDocument?.fonts?.ready;
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf().set({ margin: [12, 10, 12, 10], filename: `${event.name.replace(/[^\w-]+/g, "_")}-agreement-v${ag.version}.pdf`, image: { type: "jpeg", quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"], avoid: ["h2", "h3", "tr", "figure"] } } as never).from(f.contentDocument!.body).save();
      setFlash("");
    } catch { setFlash(t("ag.pdf.error")); setTimeout(() => setFlash(""), 4000); } finally { f.remove(); }
  };
  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); setFmt((n) => n + 1); };
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const addComment = (sid: string) => { const v = text.trim(); if (!v) return; setSec(sid, (x) => { x.comments.push({ id: uid(), by: who, at: Date.now(), text: v }); }); setText(""); setComposer(null); };
  const delComment = (sid: string, cid: string) => ask(t("ag.cdel.q"), () => setSec(sid, (x) => { x.comments = x.comments.filter((c) => c.id !== cid); }), { danger: true });
  const openTask = (c: Comment) => { setTaskFor(c.id); setTk({ name: c.text.length > 80 ? c.text.slice(0, 77) + "…" : c.text, who: s.userName, due: "" }); };
  /** Creates a real task in the event's task board from a comment and links it back to the comment. */
  const makeTask = (sec: AgSection, c: Comment) => {
    if (!tk.name.trim()) return;
    const task = newTask({ eventId: event.id, name: tk.name.trim(), statusId: event.statuses[0]?.id ?? "", assignees: tk.who ? [tk.who] : [], due: tk.due || "", description: `${t("ag.title")} · ${sec.title}\n${c.text}`, tags: [] });
    update((st) => { st.tasks.push(task); const a = st.agreements.find((x) => x.eventId === event.id); const cc = a?.sections.find((x) => x.id === sec.id)?.comments.find((x) => x.id === c.id); if (cc) cc.taskId = task.id; });
    setTaskFor(null);
  };
  const people = [...new Set([s.userName, ...s.team.map((m) => m.name)])];
  const bubbles = (x: AgSection) => (
    <div className={`agbubbles${wide ? "" : " inline"} noprint`} data-for={x.id} key={"b" + x.id}>
      {x.comments.map((c) => (
        <div className="agbubble" key={c.id}>
          <div className="who"><b>{c.by}</b> · {new Date(c.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</div>
          <p>{c.text}</p>
          {taskFor === c.id ? (
            <div className="agtask">
              <label className="small" htmlFor={`tkn${c.id}`}>{t("ag.task.name")}</label><input id={`tkn${c.id}`} autoFocus value={tk.name} onChange={(e) => setTk({ ...tk, name: e.target.value })} />
              <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                <div style={{ flex: 1 }}><label className="small" htmlFor={`tkw${c.id}`}>{t("ag.task.who")}</label><select id={`tkw${c.id}`} value={tk.who} onChange={(e) => setTk({ ...tk, who: e.target.value })}><option value="">—</option>{people.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div style={{ flex: 1 }}><label className="small" htmlFor={`tkd${c.id}`}>{t("ag.task.due")}</label><input id={`tkd${c.id}`} type="date" value={tk.due} onChange={(e) => setTk({ ...tk, due: e.target.value })} /></div>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}><button className="ghost sm" onClick={() => setTaskFor(null)}>{t("cancel")}</button><button className="sm" disabled={!tk.name.trim()} onClick={() => makeTask(x, c)}>{t("ag.task.create")}</button></div>
            </div>
          ) : (
            <div className="row agbact" style={{ gap: 4 }}>
              {c.taskId && s.tasks.some((tt) => tt.id === c.taskId) ? <span className="small" style={{ color: "var(--teal)" }}>✓ {t("ag.task.done")}</span> : <button className="ghost sm" onClick={() => openTask(c)}><ListTodo size={13} /> {t("ag.task.make")}</button>}
              <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => delComment(x.id, c.id)}><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      ))}
      {composer === x.id && (
        <div className="agbubble new">
          <textarea autoFocus rows={2} value={text} placeholder={t("tl.comment.ph")} aria-label={t("tl.comments")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(x.id); if (e.key === "Escape") setComposer(null); }} />
          <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}><button className="ghost sm" onClick={() => { setComposer(null); setText(""); }}>{t("cancel")}</button><button className="sm" disabled={!text.trim()} onClick={() => addComment(x.id)}>{t("ag.c.send")}</button></div>
        </div>
      )}
    </div>
  );
  void fmt;

  return (
    <>
      <div className="row between agbar" ref={barRef}>
        <div className="row" style={{ gap: 8 }}>
          <b style={{ fontSize: "1.1rem" }}>{t("ag.title")}</b>
          <span className="badge">{t("ag.version")} {ag.version}</span>
          <span className={`badge${signed ? " ok" : ""}`}>{t("ag.status." + status)}</span>
          {flash && <span className="small" style={{ color: "var(--teal)" }}>{flash}</span>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {ag.versions.length > 0 && <select aria-label={t("ag.versions")} value={viewVer} style={{ width: "auto" }} onChange={(e) => setViewVer(e.target.value)}><option value="">{t("ag.versions")} ({ag.versions.length})</option>{ag.versions.map((v) => <option key={v.id} value={v.id}>{v.name} · {new Date(v.at).toLocaleDateString(locale)}</option>)}</select>}
          {editable && <span style={{ position: "relative" }}><button className="ghost" aria-expanded={paperOpen} onClick={() => setPaperOpen(!paperOpen)}><Palette size={15} /> {t("ag.paper")}</button>{paperOpen && <PaperPanel paper={paper} onChange={(p) => patch((a) => { a.paper = p; })} onClose={() => setPaperOpen(false)} />}</span>}
          {editable && <button className="ghost" onClick={refreshAll}><RefreshCw size={15} /> {t("ag.refreshall")}</button>}
          {editable && <button className="ghost" onClick={saveVersion}><Save size={15} /> {t("ag.saveversion")}</button>}
          <button className="ghost icon" aria-label={t("docs.download")} title={t("docs.download")} onClick={download}><Download size={17} /></button>
          <button className="ghost icon" aria-label={t("ag.print")} title={t("ag.print")} onClick={printDoc}><Printer size={17} /></button>
          {editable && ag.status === "draft" && <button className="ghost" onClick={() => { patch((a) => { a.status = "sent"; }); setFlash(t("ag.sentmsg")); setTimeout(() => setFlash(""), 4000); }}><Send size={15} /> {t("ag.send")}</button>}
          {!old && <ApprovalButton event={event} scope="agreement" subject={subject} summary={() => [subject, ...ag.sections.filter((x) => x.included).map((x, i) => `${i + 1}. ${x.title}`)]} snap={() => ({ k: "agreement", html: body(), paper })} />}
          {signed && <button onClick={amend}>{t("ag.amend")}</button>}
        </div>
      </div>
      {signed && <p className="small" style={{ color: "var(--teal)", margin: "0 0 8px" }}>{t("ag.locked.signed")}</p>}
      {inApproval && <p className="small" style={{ color: "var(--gold)", margin: "0 0 8px" }}>{t("ag.locked.approval")}</p>}
      {old && <p className="row small" style={{ margin: "0 0 8px", color: "var(--gold)" }}>{t("ag.viewing")} <button className="ghost sm" onClick={() => setViewVer("")}><ArrowLeft size={13} /> {t("ag.backcur")}</button>{!signed && !inApproval && <button className="sm" onClick={restore}>{t("ag.restore")}</button>}</p>}

      <div className={`aglayout${wide ? " hasmargin" : ""}`}>
        <aside className="agnav card">
          <b className="small">{t("ag.sections")}</b>
          {sections.map((x, i) => (
            <div key={x.id} className="row agnavrow" style={{ flexWrap: "nowrap", gap: 4 }}>
              <input type="checkbox" style={{ width: "auto" }} aria-label={t("ag.include")} title={t("ag.include")} checked={x.included} disabled={!editable} onChange={(e) => setSec(x.id, (y) => { y.included = e.target.checked; })} />
              <a href={`#ag-${x.id}`} className="grow small" style={{ color: "inherit", textDecoration: "none", opacity: x.included ? 1 : 0.5 }} onClick={(e) => { e.preventDefault(); document.getElementById(`ag-${x.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{x.title}</a>
              {editable && <><button className="ghost icon" aria-label={t("tl.moveup")} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={13} /></button><button className="ghost icon" aria-label={t("tl.movedown")} disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ChevronDown size={13} /></button></>}
            </div>
          ))}
          {editable && <button className="ghost sm" style={{ marginTop: 8 }} onClick={() => patch((a) => { a.sections.push({ id: uid(), kind: "custom", title: t("ag.s.custom"), html: "<p></p>", included: true, comments: [] }); })}><Plus size={13} /> {t("ag.addsection")}</button>}
        </aside>

        <article className="agdoc" ref={artRef} style={{ background: paperBg(paper) }}>
          {editable && (
            <div className="agtools noprint" role="toolbar">
              <button className="ghost icon" onMouseDown={keep} onClick={() => cmd("bold")} aria-label={t("ag.fmt.bold")} title={t("ag.fmt.bold")}><Bold size={15} /></button>
              <button className="ghost icon" onMouseDown={keep} onClick={() => cmd("italic")} aria-label={t("ag.fmt.italic")} title={t("ag.fmt.italic")}><Italic size={15} /></button>
              <button className="ghost icon" onMouseDown={keep} onClick={() => cmd("formatBlock", "H3")} aria-label={t("ag.fmt.h")} title={t("ag.fmt.h")}>H</button>
              <button className="ghost icon" onMouseDown={keep} onClick={() => cmd("insertUnorderedList")} aria-label={t("ag.fmt.list")} title={t("ag.fmt.list")}><List size={15} /></button>
            </div>
          )}
          {!lgBottom && <div dangerouslySetInnerHTML={{ __html: lg }} />}
          <h1>{title}</h1>
          <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>{sub}</p>
          {sections.map((x, i) => x.included && (
            <section key={x.id} id={`ag-${x.id}`} className="agsec">
              <div className="row between" style={{ flexWrap: "nowrap" }}>
                {editable ? <input className="agtitle" value={x.title} aria-label={t("name")} onChange={(e) => setSec(x.id, (y) => { y.title = e.target.value; })} /> : <h2 style={{ margin: 0 }}>{i + 1}. {x.title}</h2>}
                <span className="row noprint" style={{ gap: 0, flexWrap: "nowrap" }}>
                  {editable && x.vis && <button className="ghost icon" aria-pressed={x.showVis !== false} aria-label={t("ag.vis")} title={`${t("ag.vis")}: ${t(x.showVis !== false ? "ag.vis.on" : "ag.vis.off")}`} style={{ opacity: x.showVis !== false ? 1 : 0.45 }} onClick={() => setSec(x.id, (y) => { y.showVis = y.showVis === false; })}><ImageIcon size={14} /></button>}
                  {editable && x.kind !== "custom" && <button className="ghost icon" aria-label={t("ag.refresh")} title={t("ag.refresh")} onClick={() => refresh(x)}><RefreshCw size={14} /></button>}
                  <button className="ghost icon" aria-label={t("ag.c.add")} title={t("ag.c.add")} aria-expanded={composer === x.id} onClick={() => { setComposer(composer === x.id ? null : x.id); setText(""); }}><MessageCircle size={14} />{x.comments.length > 0 && <span className="small">{x.comments.length}</span>}</button>
                  {editable && x.kind === "custom" && <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => ask(t("confirm.delete"), () => patch((a) => { a.sections = a.sections.filter((y) => y.id !== x.id); }), { danger: true })}><Trash2 size={14} /></button>}
                </span>
              </div>
              <Editable html={x.html} editable={editable} nonce={`${x.id}:${nonce}:${viewVer}`} onSave={(h) => { if (h !== x.html) setSec(x.id, (y) => { y.html = h; }); }} />
              {x.showVis !== false && x.vis && <div className="agvisbox" dangerouslySetInnerHTML={{ __html: cleanVis(x.vis) }} />}
              {!wide && (x.comments.length > 0 || composer === x.id) && bubbles(x)}
            </section>
          ))}
          <section className="agsec">
            <h2 style={{ margin: "0 0 8px" }}>{t("ag.sigs")}</h2>
            {signed && so ? so.approvers.map((a) => <p key={a.id} className="small" style={{ margin: "4px 0" }}><b>{a.name}</b> — {t("ag.signedby", { name: a.by, when: new Date(a.at).toLocaleString(locale) })}</p>) : <div className="agsig"><div>{t("ag.planner")}</div><div>{t("ag.client")}</div></div>}
          </section>
          {lgBottom && <div dangerouslySetInnerHTML={{ __html: lg }} />}
        </article>
        {wide && <div className="agmargin" ref={marRef}>{sections.filter((x) => x.included && (x.comments.length > 0 || composer === x.id)).map(bubbles)}</div>}
      </div>
    </>
  );
}
