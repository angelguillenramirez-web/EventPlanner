import { useState } from "react";
import { useT } from "../i18n";
import { uid, update, useStore, type Budget, type BudgetRow, type LedgerRow, type ListTable } from "../store";
import { Lock, Plus, Trash2 } from "../icons";
import { Bar, Modal } from "./ui";
import { ask } from "./Ask";

const CURRENCIES = ["MXN", "USD", "EUR"];
const STATUSES = ["paid", "pending", "partial", "deposit", "cancelled"];
const SUGGEST = ["venue", "catering", "decor", "photo", "music", "attire", "other"];
const COLORS = ["var(--teal)", "var(--gold)", "var(--blue)", "#9B87F5", "var(--coral, #FF7A59)", "#6B6458", "#46C8B2"];
const fmt = (n: number, cur: string, locale: string) => n.toLocaleString(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 });
/** Amounts accept a minus sign: negative = expense / money going out, positive = income. */
const num = (v: string) => { const neg = v.trim().startsWith("-") || /^\(.*\)$/.test(v.trim()); const n = parseFloat(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? (neg ? -n : n) : 0; };
const sumOf = (b: Budget, k: "estimated" | "actual" | "paid") => b.items.reduce((a, r) => a + r[k], 0);
/** Items grouped by category (for the charts). */
const byCat = (b: Budget, fallback: string) => { const m = new Map<string, { name: string; v: number; e: number; a: number }>(); b.items.forEach((r) => { const k = r.category.trim() || fallback, x = m.get(k) ?? { name: k, v: 0, e: 0, a: 0 }; x.v += Math.abs(r.actual || r.estimated); x.e += r.estimated; x.a += r.actual; m.set(k, x); }); return [...m.values()].filter((x) => x.v > 0); };
const income = (b: Budget) => b.ledger.reduce((a, r) => a + (r.amount > 0 ? r.amount : 0), 0);
const expenses = (b: Budget) => b.ledger.reduce((a, r) => a + (r.amount < 0 ? r.amount : 0), 0);
const tone = (n: number) => (n < 0 ? "var(--danger)" : n > 0 ? "var(--teal)" : undefined);

/** Simple donut chart (share of each slice). */
function Pie({ data, cur, locale }: { data: { name: string; v: number }[]; cur: string; locale: string }) {
  const total = data.reduce((a, x) => a + x.v, 0), R = 42, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "nowrap" }}>
      <svg viewBox="0 0 120 120" width="72" height="72" role="img" aria-label={data.map((x) => x.name).join(", ")}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
        {total > 0 && data.map((x, i) => { const len = (x.v / total) * C, el = <circle key={x.name} cx="60" cy="60" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />; off += len; return el; })}
      </svg>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: ".85rem" }}>
        {data.map((x, i) => <li key={x.name} className="row" style={{ gap: 6, flexWrap: "nowrap", margin: "3px 0" }}><i style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: "inline-block" }} />{x.name} <span className="muted">{total ? Math.round((x.v / total) * 100) : 0}% · {fmt(x.v, cur, locale)}</span></li>)}
      </ul>
    </div>
  );
}

/** Simple grouped bar chart; every group has one bar per series. */
function Bars({ groups, series, cur, locale }: { groups: { name: string; v: number[] }[]; series: { name: string; color: string }[]; cur: string; locale: string }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.v.map(Math.abs))), W = 100 / Math.max(1, groups.length);
  return (
    <div>
      <div style={{ maxWidth: Math.max(2, groups.length) * 70 }}>
      <svg viewBox="0 0 100 52" width="100%" height="64" preserveAspectRatio="none" role="img" aria-label={series.map((x) => x.name).join(", ")}>
        <line x1="0" x2="100" y1="46" y2="46" stroke="var(--line)" strokeWidth=".4" />
        {groups.map((g, gi) => g.v.map((v, si) => { const h = (Math.abs(v) / max) * 40, bw = (W * 0.8) / series.length, x = gi * W + W * 0.1 + si * bw; return <rect key={gi + "-" + si} x={x} y={46 - h} width={bw * 0.9} height={h} rx=".6" fill={series[si].color}><title>{`${g.name} · ${series[si].name}: ${fmt(v, cur, locale)}`}</title></rect>; }))}
      </svg>
      <div className="muted" style={{ display: "flex", gap: 4, fontSize: ".72rem", lineHeight: 1.3 }}>{groups.map((g) => <span key={g.name} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>)}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 6, fontSize: ".72rem", lineHeight: 1.3 }}>{series.map((x) => <span key={x.name} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: x.color, display: "inline-block", flex: "none" }} />{x.name}</span>)}</div>
    </div>
  );
}

/** Dashboard of a budget: totals, what is left, charts. Read-only, used by the owner and by the planner (when shared). */
function Dashboard({ b, locale }: { b: Budget; locale: string }) {
  const { t } = useT();
  const est = sumOf(b, "estimated"), act = sumOf(b, "actual"), paid = sumOf(b, "paid");
  const spent = act || est, left = b.total - spent, over = b.total > 0 && spent > b.total;
  const inc = income(b), exp = expenses(b);
  const cards: [string, number, string?][] = [[t("bud.total"), b.total], [t("bud.estimated"), est], [t("bud.actual"), act], [t("bud.paid"), paid], [t("bud.pending"), Math.max(0, act - paid)], [t("bud.left"), left, over ? "var(--danger)" : "var(--teal)"], [t("bud.income"), inc, "var(--teal)"], [t("bud.expense"), exp, "var(--danger)"], [t("bud.balance"), inc + exp, tone(inc + exp)]];
  const per = byCat(b, t("bud.nocat"));
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="budstats" style={{ marginBottom: 12 }}>
        {cards.map(([label, v, color]) => <div className="card" key={label}><div className="muted small">{label}</div><b style={{ color, fontSize: "1.05rem" }}>{fmt(v, b.currency, locale)}</b></div>)}
      </div>
      <div className="budcharts">
        <div className="card">
          <b>{t("bud.progress")}</b>
          <div className="muted small" style={{ margin: "6px 0 4px" }}>{t("bud.spentof", { spent: fmt(spent, b.currency, locale), total: fmt(b.total, b.currency, locale) })}</div>
          <Bar value={Math.max(0, Math.min(spent, b.total || spent))} max={b.total || spent || 1} />
          {over && <p className="small" role="alert" style={{ color: "var(--danger)", margin: "6px 0 0" }}>{t("bud.over", { n: fmt(spent - b.total, b.currency, locale) })}</p>}
          <div className="muted small" style={{ margin: "12px 0 4px" }}>{t("bud.paidof", { paid: fmt(paid, b.currency, locale), act: fmt(act, b.currency, locale) })}</div>
          <Bar value={Math.max(0, paid)} max={act || 1} />
        </div>
        <div className="card"><b>{t("bud.chart.pie")}</b><div style={{ marginTop: 8 }}>{per.length ? <Pie data={per.map((x) => ({ name: x.name, v: x.v }))} cur={b.currency} locale={locale} /> : <p className="muted small">{t("none")}</p>}</div></div>
        <div className="card"><b>{t("bud.chart.compare")}</b><div style={{ marginTop: 8 }}>{per.length ? <Bars groups={per.map((x) => ({ name: x.name, v: [x.e, x.a] }))} series={[{ name: t("bud.estimated"), color: "var(--gold)" }, { name: t("bud.actual"), color: "var(--teal)" }]} cur={b.currency} locale={locale} /> : <p className="muted small">{t("none")}</p>}</div></div>
        <div className="card"><b>{t("bud.chart.flow")}</b><div style={{ marginTop: 8 }}>{b.ledger.length ? <Bars groups={[{ name: "", v: [inc, -exp] }]} series={[{ name: t("bud.income"), color: "var(--teal)" }, { name: t("bud.expense"), color: "var(--danger)" }]} cur={b.currency} locale={locale} /> : <p className="muted small">{t("none")}</p>}</div></div>
      </div>
    </div>
  );
}

function NumCell({ value, cur, locale, on, label, signed }: { value: number; cur: string; locale: string; on: (n: number) => void; label: string; signed?: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  return <input aria-label={label} inputMode="decimal" style={{ textAlign: "right", color: signed || value < 0 ? tone(value) : undefined }} value={edit ?? (value ? fmt(value, cur, locale) : "")} placeholder="0" onFocus={() => setEdit(value ? String(value) : "")} onChange={(e) => setEdit(e.target.value)} onBlur={() => { if (edit !== null) on(num(edit)); setEdit(null); }} />;
}

/** Category / status field: pick from the list or type a new one (shown as "Add ..."). The list is drawn in a fixed layer so table cells do not clip it. */
function CategoryPicker({ value, options, on, label, addLabel }: { value: string; options: string[]; on: (v: string) => void; label: string; addLabel: (v: string) => string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 0 });
  const [q, setQ] = useState<string | null>(null);
  const text = q ?? value, typed = text.trim();
  const list = options.filter((o) => o.toLowerCase().includes((q ?? "").toLowerCase()));
  const exact = options.some((o) => o.toLowerCase() === typed.toLowerCase());
  const close = () => { setOpen(false); setQ(null); };
  const pick = (v: string) => { on(v); close(); };
  return (
    <>
      <input aria-label={label} aria-expanded={open} role="combobox" value={text} placeholder="—"
        onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: r.left, y: r.bottom + 2, w: Math.max(r.width, 190) }); setQ(""); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && typed) { e.preventDefault(); pick(typed); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { close(); (e.target as HTMLInputElement).blur(); } }} />
      {open && (
        <>
          <div className="menu-bg" style={{ position: "fixed", inset: 0, zIndex: 90 }} onMouseDown={close} />
          <div className="menu" role="listbox" style={{ position: "fixed", left: pos.x, top: pos.y, width: pos.w, zIndex: 91, maxHeight: 240, overflowY: "auto" }}>
            {list.map((o) => <button key={o} role="option" aria-selected={o === value} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>{o}</button>)}
            {typed && !exact && <button role="option" onMouseDown={(e) => { e.preventDefault(); pick(typed); }}><Plus size={13} /> {addLabel(typed)}</button>}
            {!list.length && !typed && <div className="muted small" style={{ padding: "6px 10px" }}>—</div>}
          </div>
        </>
      )}
    </>
  );
}

/** The single cost table: every row has a category, an item, a vendor, estimated / actual / paid amounts and a status note. */
function CostTable({ b, locale, edit }: { b: Budget; locale: string; edit: boolean }) {
  const { t } = useT();
  const patch = (fn: (x: Budget) => void) => update((st) => { const x = st.budgets.find((y) => y.id === b.id)!; fn(x); x.updatedAt = Date.now(); });
  const setRow = (id: string, p: Partial<BudgetRow>) => patch((x) => { Object.assign(x.items.find((r) => r.id === id)!, p); });
  const totals = { e: sumOf(b, "estimated"), a: sumOf(b, "actual"), p: sumOf(b, "paid") };
  const stats = [...new Set([...STATUSES.map((k) => t("bud.st." + k)), ...b.items.map((r) => r.notes.trim()).filter(Boolean)])];
  const cats = [...new Set([...SUGGEST.map((k) => t("bud.s." + k)), ...b.items.map((r) => r.category.trim()).filter(Boolean)])];
  return (
    <div className="card budcard">
      <b>{t("bud.costs")}</b>
      <table className="budtbl" style={{ marginTop: 8 }}>
        <colgroup><col style={{ width: "15%" }} /><col style={{ width: "20%" }} /><col style={{ width: "14%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col /><col style={{ width: 40 }} /></colgroup>
        <thead><tr><th>{t("bud.category")}</th><th>{t("bud.item")}</th><th>{t("bud.vendor")}</th><th className="r">{t("bud.estimated")}</th><th className="r">{t("bud.actual")}</th><th className="r">{t("bud.paid")}</th><th>{t("bud.status")}</th>{edit && <th />}</tr></thead>
        <tbody>
          {b.items.length === 0 && <tr><td colSpan={8} className="muted">{t("bud.norows")}</td></tr>}
          {b.items.map((r) => (
            <tr key={r.id}>
              {edit ? <>
                <td><CategoryPicker label={t("bud.category")} value={r.category} options={cats} on={(v) => setRow(r.id, { category: v })} addLabel={(v) => t("bud.addcat", { name: v })} /></td>
                <td><input aria-label={t("bud.item")} value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} /></td>
                <td><input aria-label={t("bud.vendor")} value={r.vendor} onChange={(e) => setRow(r.id, { vendor: e.target.value })} /></td>
                <td><NumCell label={t("bud.estimated")} value={r.estimated} cur={b.currency} locale={locale} on={(n) => setRow(r.id, { estimated: n })} /></td>
                <td><NumCell label={t("bud.actual")} value={r.actual} cur={b.currency} locale={locale} on={(n) => setRow(r.id, { actual: n })} /></td>
                <td><NumCell label={t("bud.paid")} value={r.paid} cur={b.currency} locale={locale} on={(n) => setRow(r.id, { paid: n })} /></td>
                <td><CategoryPicker label={t("bud.status")} value={r.notes} options={stats} on={(v) => setRow(r.id, { notes: v })} addLabel={(v) => t("bud.addstatus", { name: v })} /></td>
                <td><button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => patch((x) => { x.items = x.items.filter((y) => y.id !== r.id); })}><Trash2 size={14} /></button></td>
              </> : <>
                <td>{r.category}</td><td>{r.name}</td><td>{r.vendor}</td><td className="r">{fmt(r.estimated, b.currency, locale)}</td><td className="r">{fmt(r.actual, b.currency, locale)}</td><td className="r">{fmt(r.paid, b.currency, locale)}</td><td>{r.notes}</td>
              </>}
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3}>{edit && <button className="ghost sm" onClick={() => patch((x) => { x.items.push({ id: uid(), category: x.items[x.items.length - 1]?.category ?? "", name: "", vendor: "", estimated: 0, actual: 0, paid: 0, notes: "" }); })}><Plus size={14} /> {t("bud.addrow")}</button>}</td>
          <td className="r"><b>{fmt(totals.e, b.currency, locale)}</b></td><td className="r"><b>{fmt(totals.a, b.currency, locale)}</b></td><td className="r"><b>{fmt(totals.p, b.currency, locale)}</b></td><td colSpan={edit ? 2 : 1} /></tr></tfoot>
      </table>
    </div>
  );
}

/** Income and expenses ledger: one line per movement; negative numbers are expenses, positive numbers are income. */
function Ledger({ b, locale, edit }: { b: Budget; locale: string; edit: boolean }) {
  const { t } = useT();
  const patch = (fn: (x: Budget) => void) => update((st) => { const x = st.budgets.find((y) => y.id === b.id)!; fn(x); x.updatedAt = Date.now(); });
  const setRow = (id: string, p: Partial<LedgerRow>) => patch((x) => { Object.assign(x.ledger.find((r) => r.id === id)!, p); });
  const inc = income(b), exp = expenses(b);
  return (
    <div className="card budcard">
      <div className="row between"><b>{t("bud.ledger")}</b>{edit && <span className="muted small">{t("bud.ledger.hint")}</span>}</div>
      <table className="budtbl" style={{ marginTop: 8 }}>
        <colgroup><col style={{ width: 90 }} /><col style={{ width: "32%" }} /><col style={{ width: 150 }} /><col style={{ width: 150 }} /><col />{edit && <col style={{ width: 40 }} />}</colgroup>
        <thead><tr><th>{t("bud.type")}</th><th>{t("bud.concept")}</th><th>{t("bud.date")}</th><th className="r">{t("bud.amount")}</th><th>{t("bud.notes")}</th>{edit && <th />}</tr></thead>
        <tbody>
          {b.ledger.length === 0 && <tr><td colSpan={6} className="muted">{t("bud.norows")}</td></tr>}
          {b.ledger.map((r) => (
            <tr key={r.id}>
              <td><span className="pill" style={{ background: r.amount < 0 ? "color-mix(in srgb, var(--danger) 18%, transparent)" : "color-mix(in srgb, var(--teal) 22%, transparent)" }}>{r.amount < 0 ? t("bud.expense1") : t("bud.income1")}</span></td>
              {edit ? <>
                <td><input aria-label={t("bud.concept")} value={r.concept} onChange={(e) => setRow(r.id, { concept: e.target.value })} /></td>
                <td><input type="date" aria-label={t("bud.date")} value={r.date} onChange={(e) => setRow(r.id, { date: e.target.value })} /></td>
                <td><NumCell signed label={t("bud.amount")} value={r.amount} cur={b.currency} locale={locale} on={(n) => setRow(r.id, { amount: n })} /></td>
                <td><input aria-label={t("bud.notes")} value={r.notes} onChange={(e) => setRow(r.id, { notes: e.target.value })} /></td>
                <td><button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => patch((x) => { x.ledger = x.ledger.filter((y) => y.id !== r.id); })}><Trash2 size={14} /></button></td>
              </> : <>
                <td>{r.concept}</td><td>{r.date}</td><td className="r" style={{ color: tone(r.amount) }}>{fmt(r.amount, b.currency, locale)}</td><td>{r.notes}</td>
              </>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>{edit && <button className="ghost sm" onClick={() => patch((x) => { x.ledger.push({ id: uid(), date: new Date().toISOString().slice(0, 10), concept: "", amount: 0, notes: "" }); })}><Plus size={14} /> {t("bud.addmove")}</button>}</td><td className="r"><b style={{ color: tone(inc + exp) }}>{t("bud.balance")}: {fmt(inc + exp, b.currency, locale)}</b></td><td colSpan={edit ? 2 : 1} /></tr>
          <tr><td colSpan={3} className="muted small">{t("bud.totals")}</td><td className="r small" style={{ color: "var(--teal)" }}>{t("bud.income")}: {fmt(inc, b.currency, locale)}</td><td className="small" style={{ color: "var(--danger)" }} colSpan={edit ? 2 : 1}>{t("bud.expense")}: {fmt(exp, b.currency, locale)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

/** A free list (for example the alcohol list): the client names the columns and fills in the rows. */
function ListCard({ b, l, edit }: { b: Budget; l: ListTable; edit: boolean }) {
  const { t } = useT();
  const patch = (fn: (x: ListTable) => void) => update((st) => { const bb = st.budgets.find((y) => y.id === b.id)!; fn(bb.lists.find((y) => y.id === l.id)!); bb.updatedAt = Date.now(); });
  return (
    <div className="card budcard">
      <div className="row between" style={{ marginBottom: 8 }}>
        {edit ? <input aria-label={t("bud.tablename")} style={{ fontWeight: 700, maxWidth: 260 }} value={l.name} onChange={(e) => patch((x) => { x.name = e.target.value; })} /> : <b>{l.name}</b>}
        {edit && <span className="row" style={{ gap: 4 }}>
          <button className="ghost sm" onClick={() => patch((x) => { x.cols.push(t("bud.col") + " " + (x.cols.length + 1)); x.rows.forEach((r) => r.cells.push("")); })}><Plus size={13} /> {t("bud.addcol")}</button>
          <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => ask(t("bud.deltable", { name: l.name }), () => update((st) => { const bb = st.budgets.find((y) => y.id === b.id)!; bb.lists = bb.lists.filter((y) => y.id !== l.id); }), { danger: true })}><Trash2 size={15} /></button>
        </span>}
      </div>
      <table className="budtbl">
        <thead><tr>{l.cols.map((c, i) => <th key={i}>{edit ? <input aria-label={t("bud.col")} value={c} onChange={(e) => patch((x) => { x.cols[i] = e.target.value; })} style={{ textTransform: "none", fontWeight: 700 }} /> : c}</th>)}{edit && <th style={{ width: 40 }} />}</tr></thead>
        <tbody>
          {l.rows.map((r) => <tr key={r.id}>{l.cols.map((_, i) => <td key={i}>{edit ? <input aria-label={l.cols[i]} value={r.cells[i] ?? ""} onChange={(e) => patch((x) => { x.rows.find((y) => y.id === r.id)!.cells[i] = e.target.value; })} /> : r.cells[i]}</td>)}{edit && <td><button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => patch((x) => { x.rows = x.rows.filter((y) => y.id !== r.id); })}><Trash2 size={14} /></button></td>}</tr>)}
        </tbody>
        {edit && <tfoot><tr><td colSpan={l.cols.length + 1}><button className="ghost sm" onClick={() => patch((x) => { x.rows.push({ id: uid(), cells: x.cols.map(() => "") }); })}><Plus size={14} /> {t("bud.addrow")}</button></td></tr></tfoot>}
      </table>
    </div>
  );
}

/** The client's own budget screen. Private by default; the client decides whether the planner can see it. */
function Owner({ ownerId }: { ownerId: string }) {
  const s = useStore();
  const { t, locale } = useT();
  const mem = s.team.find((m) => m.id === ownerId)!;
  const events = s.events.filter((e) => mem.eventIds.includes(e.id));
  const [evId, setEvId] = useState(events[0]?.id ?? "");
  const [sharing, setSharing] = useState(false);
  const b = s.budgets.find((x) => x.ownerId === ownerId && x.eventId === evId);
  const create = () => update((st) => { st.budgets.push({ id: uid(), ownerId, eventId: evId, currency: "MXN", total: 0, items: [], ledger: [], lists: [], shared: false, sharedAt: 0, updatedAt: Date.now() }); });
  const patch = (fn: (x: Budget) => void) => update((st) => { const x = st.budgets.find((y) => y.id === b!.id)!; fn(x); x.updatedAt = Date.now(); });
  if (events.length === 0) return <div className="card muted">{t("bud.noevents")}</div>;
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>{t("bud.title")}</h1>
        {events.length > 1 && <select aria-label={t("bud.event")} style={{ width: "auto" }} value={evId} onChange={(e) => setEvId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
      </div>
      {!b ? (
        <div className="card"><p style={{ marginTop: 0 }}>{t("bud.intro")}</p><button onClick={create}><Plus size={15} /> {t("bud.create")}</button></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14, borderColor: b.shared ? "var(--gold)" : "var(--teal)", boxShadow: "none" }}>
            <div className="row between">
              <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}><Lock size={16} /><span>{b.shared ? <><b>{t("bud.shared.on")}</b> {t("bud.shared.on.d")}</> : <><b>{t("bud.private")}</b> {t("bud.private.d")}</>}</span></span>
              <button className={b.shared ? "ghost" : ""} onClick={() => (b.shared ? patch((x) => { x.shared = false; x.sharedAt = 0; }) : setSharing(true))}>{b.shared ? t("bud.stop") : t("bud.share")}</button>
            </div>
          </div>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <label className="row" style={{ gap: 6 }}><span className="muted small">{t("bud.target")}</span><input aria-label={t("bud.target")} inputMode="decimal" style={{ width: 150 }} value={b.total ? String(b.total) : ""} placeholder="0" onChange={(e) => patch((x) => { x.total = num(e.target.value); })} /></label>
            <select aria-label={t("bud.currency")} style={{ width: "auto" }} value={b.currency} onChange={(e) => patch((x) => { x.currency = e.target.value; })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <Dashboard b={b} locale={locale} />
          <CostTable b={b} locale={locale} edit />
          <Ledger b={b} locale={locale} edit />
          {b.lists.map((l) => <ListCard key={l.id} b={b} l={l} edit />)}
          <div className="card" style={{ boxShadow: "none" }}>
            <button className="ghost sm" onClick={() => patch((x) => { x.lists.push({ id: uid(), name: t("bud.newlist"), cols: [t("bud.col") + " 1", t("bud.col") + " 2", t("bud.col") + " 3"], rows: [] }); })}><Plus size={13} /> {t("bud.newlist")}</button>
            <span className="muted small" style={{ marginLeft: 8 }}>{t("bud.newlist.d")}</span>
          </div>
          {sharing && (
            <Modal title={t("bud.share")} onClose={() => setSharing(false)}>
              <p style={{ marginTop: 0 }}>{t("bud.share.q")}</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button className="ghost" onClick={() => setSharing(false)}>{t("cancel")}</button>
                <button onClick={() => { patch((x) => { x.shared = true; x.sharedAt = Date.now(); }); setSharing(false); }}>{t("bud.share.yes")}</button>
              </div>
            </Modal>
          )}
        </>
      )}
    </>
  );
}

/** What the planner sees: only the budgets clients chose to share, read-only. */
export function PlannerBudgets({ eventId }: { eventId: string }) {
  const s = useStore();
  const { t, locale } = useT();
  const list = s.budgets.filter((b) => b.shared && b.eventId === eventId);
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>{t("bud.planner.d")}</p>
      {list.length === 0 && <div className="card muted">{t("bud.planner.none")}</div>}
      {list.map((b) => {
        const who = s.team.find((m) => m.id === b.ownerId);
        return (
          <div key={b.id} style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px" }}>{who ? `${who.name} ${who.lastName}`.trim() : ""}</h3>
            <Dashboard b={b} locale={locale} />
            <CostTable b={b} locale={locale} edit={false} />
            <Ledger b={b} locale={locale} edit={false} />
            {b.lists.map((l) => <ListCard key={l.id} b={b} l={l} edit={false} />)}
          </div>
        );
      })}
    </>
  );
}

/** Budget module. A client sees and edits their own budget; the planner sees only what a client shared. Preview ("view as") never shows a client's private budget. */
export default function BudgetPage() {
  const s = useStore();
  const { t } = useT();
  const mem = s.viewAs ? s.team.find((m) => m.id === s.viewAs) : undefined;
  if (mem?.kind === "client") return s.sessionId.startsWith("member:") ? <Owner ownerId={mem.id} /> : <div className="card"><Lock size={15} /> {t("bud.preview")}</div>;
  if (mem) return <div className="card muted">{t("bud.clientsonly")}</div>;
  return <div className="card muted">{t("bud.planner.where")}</div>;
}
