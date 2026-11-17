import { useState } from "react";
import { useT } from "../i18n";
import { isCloudId, goCheckout } from "../cloud";
import { PLANS, PRICES, yearlySaving, TRIAL_DAYS, go, uid, update, useStore, type Card, type Invoice, type Plan } from "../store";
import { Check, CreditCard, Download, Printer } from "../icons";
import { Modal } from "./ui";
import { usePublic } from "../bridge";

/** Promo / referral codes accepted by the prototype (percent off the first payment). */
export const PROMOS: Record<string, number> = { WELCOME26: 20, REFER10: 10, PLANNERPRO: 30 };
/** Test cards (the prototype never accepts real card numbers). */
const TEST_OK = "4242424242424242", TEST_DECLINE = "4000000000000002";

export const usePrices = () => (p: Plan, cycle: "monthly" | "yearly") => PRICES[p][cycle];
export const money = (n: number, locale: string) => n.toLocaleString(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" });
const addDays = (d: number) => Date.now() + d * 86400000;

/** Printable / downloadable invoice. */
export function InvoiceModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const when = new Date(inv.at).toLocaleDateString(locale, { dateStyle: "long" });
  const download = () => {
    const html = `<!doctype html><meta charset="utf-8"><title>${inv.number}</title><body style="font-family:system-ui;max-width:640px;margin:40px auto"><h1>1Plan</h1><h2>${t("bill.invoice")} ${inv.number}</h2><p>${when}</p><p><b>${inv.billTo}</b><br>${inv.address}</p><table style="width:100%;border-collapse:collapse"><tr><td>${inv.description}</td><td style="text-align:right">${money(inv.subtotal, locale)}</td></tr>${inv.discount ? `<tr><td>${t("bill.discount")} (${inv.promo})</td><td style="text-align:right">-${money(inv.discount, locale)}</td></tr>` : ""}<tr><td><b>${t("bill.total")}</b></td><td style="text-align:right"><b>${money(inv.total, locale)}</b></td></tr></table><p>${t("bill.paidwith")} •••• ${inv.last4}</p><p style="color:#6B6458">${t("bill.testnote")}</p></body>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `${inv.number}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  void s;
  return (
    <Modal title={`${t("bill.invoice")} ${inv.number}`} onClose={onClose}>
      <div className="invoicebox">
        <div className="row between"><b>1Plan</b><span className="muted small">{when}</span></div>
        <p style={{ margin: "10px 0" }}><b>{inv.billTo}</b><br /><span className="muted small">{inv.address}</span></p>
        <div className="row between"><span>{inv.description}</span><span>{money(inv.subtotal, locale)}</span></div>
        {inv.discount > 0 && <div className="row between muted"><span>{t("bill.discount")} ({inv.promo})</span><span>−{money(inv.discount, locale)}</span></div>}
        <div className="row between" style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}><b>{t("bill.total")}</b><b>{money(inv.total, locale)}</b></div>
        <p className="muted small" style={{ marginBottom: 0 }}><span className="badge ok">{t("bill.paid")}</span> {t("bill.paidwith")} •••• {inv.last4}</p>
      </div>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
        <button className="ghost" onClick={download}><Download size={15} /> {t("docs.download")}</button>
        <button className="ghost" onClick={() => window.print()}><Printer size={15} /> {t("seat.print")}</button>
      </div>
    </Modal>
  );
}

/** Card fields. Test mode: only the published test numbers are accepted, so no real card data is ever typed in or stored. */
function CardFields({ f, setF }: { f: { number: string; exp: string; cvc: string; holder: string }; setF: (v: { number: string; exp: string; cvc: string; holder: string }) => void }) {
  const { t } = useT();
  const fmt = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <div className="form">
      <p className="full small" style={{ margin: 0, padding: "8px 10px", borderRadius: 12, background: "var(--soft)" }}>{t("bill.testnote")} <code>4242 4242 4242 4242</code></p>
      <div className="full"><label htmlFor="cn">{t("bill.cardnumber")}</label><input id="cn" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={f.number} onChange={(e) => setF({ ...f, number: fmt(e.target.value) })} /></div>
      <div><label htmlFor="cx">{t("bill.exp")}</label><input id="cx" placeholder="MM/YY" autoComplete="off" value={f.exp} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setF({ ...f, exp: d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d }); }} /></div>
      <div><label htmlFor="cv">CVC</label><input id="cv" inputMode="numeric" autoComplete="off" placeholder="123" value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
      <div className="full"><label htmlFor="ch">{t("bill.holder")}</label><input id="ch" autoComplete="off" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></div>
    </div>
  );
}
/** Checks the card and returns it, or an error message. */
function checkCard(f: { number: string; exp: string; cvc: string; holder: string }, t: (k: string) => string): { card?: Card; err?: string } {
  const num = f.number.replace(/\s/g, "");
  if (num !== TEST_OK && num !== TEST_DECLINE) return { err: t("bill.err.testonly") };
  const m = /^(\d{2})\/(\d{2})$/.exec(f.exp);
  if (!m || +m[1] < 1 || +m[1] > 12 || +("20" + m[2]) * 12 + +m[1] < new Date().getFullYear() * 12 + new Date().getMonth() + 1) return { err: t("bill.err.exp") };
  if (f.cvc.length < 3 || !f.holder.trim()) return { err: t("bill.err.fields") };
  if (num === TEST_DECLINE) return { err: t("bill.err.declined") };
  return { card: { brand: "Visa", last4: num.slice(-4), exp: f.exp, holder: f.holder.trim() } };
}

/** Add or replace the payment method. */
export function CardModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ number: "", exp: "", cvc: "", holder: "" });
  const [err, setErr] = useState("");
  const save = () => { const r = checkCard(f, t); if (r.err) return setErr(r.err); update((st) => { st.card = r.card!; }); onClose(); };
  return (
    <Modal title={t("account.addcard")} onClose={onClose}>
      <CardFields f={f} setF={setF} />
      {err && <p role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button onClick={save}>{t("save")}</button></div>
    </Modal>
  );
}

/** Checkout: order summary (plan, billing cycle, promo code), billing details and payment, then a receipt. */
export function Checkout({ plan, cycle: cycle0, onClose }: { plan: Plan; cycle?: "monthly" | "yearly"; onClose: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const price = usePrices();
  const pub = usePublic();
  const acct = s.accounts.find((a) => a.id === s.sessionId);
  const [cycle, setCycle] = useState<"monthly" | "yearly">(cycle0 ?? s.sub.cycle);
  const [promo, setPromo] = useState(s.sub.promo || acct?.promo || "");
  const [bill, setBill] = useState({ name: s.billing.name || acct?.company || s.userName, address: s.billing.address, city: s.billing.city, country: s.billing.country });
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", holder: s.userName });
  const useSaved = !!s.card && card.number === "";
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Invoice | null>(null);
  const code = promo.trim().toUpperCase(), pct = PROMOS[code] ?? pub?.coupons?.[code] ?? 0;
  const subtotal = price(plan, cycle), discount = Math.round(subtotal * pct) / 100, total = subtotal - discount;
  const desc = `1Plan ${t("plan." + plan)} · ${t("bill." + cycle)}`;
  const pay = () => {
    setErr("");
    if (!bill.name.trim() || !bill.country.trim()) return setErr(t("bill.err.billing"));
    if (promo.trim() && !pct) return setErr(t("bill.err.promo"));
    let c = s.card;
    if (!useSaved) { const r = checkCard(card, t); if (r.err) return setErr(r.err); c = r.card!; }
    if (!c) return setErr(t("bill.err.fields"));
    setBusy(true);
    setTimeout(() => { // simulated payment processor
      const inv: Invoice = { id: uid(), number: `INV-${new Date().getFullYear()}-${String(s.invoices.length + 1).padStart(4, "0")}`, at: Date.now(), description: desc, plan, cycle, subtotal, discount, total, promo: pct ? code : "", last4: c!.last4, billTo: bill.name.trim(), address: [bill.address, bill.city, bill.country].filter(Boolean).join(", ") };
      update((st) => {
        st.card = c!; st.billing = { ...st.billing, name: bill.name.trim(), address: bill.address, city: bill.city, country: bill.country };
        st.plan = plan; st.sub = { plan, cycle, status: "active", startedAt: Date.now(), renewsAt: addDays(cycle === "monthly" ? 30 : 365), trialEndsAt: 0, cancelAtEnd: false, promo: pct ? code : "" };
        st.invoices.unshift(inv);
      });
      setBusy(false); setDone(inv);
    }, 1200);
  };
  if (done) return (
    <Modal title={t("bill.thanks")} onClose={onClose}>
      <p style={{ marginTop: 0 }}><Check size={18} style={{ color: "var(--teal)", verticalAlign: -3 }} /> {t("bill.success", { plan: t("plan." + plan) })}</p>
      <div className="invoicebox"><div className="row between"><span>{done.description}</span><b>{money(done.total, locale)}</b></div><div className="muted small">{done.number} · •••• {done.last4}</div></div>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button onClick={onClose}>{t("done")}</button></div>
    </Modal>
  );
  return (
    <Modal title={t("bill.checkout")} onClose={onClose} wide>
      <div className="checkgrid">
        <div>
          <h3 style={{ marginTop: 0 }}>{t("account.billing")}</h3>
          <div className="form">
            <div className="full"><label htmlFor="kn">{t("account.billname")} *</label><input id="kn" value={bill.name} onChange={(e) => setBill({ ...bill, name: e.target.value })} /></div>
            <div className="full"><label htmlFor="ka">{t("account.address")}</label><input id="ka" value={bill.address} onChange={(e) => setBill({ ...bill, address: e.target.value })} /></div>
            <div><label htmlFor="kc">{t("account.city")}</label><input id="kc" value={bill.city} onChange={(e) => setBill({ ...bill, city: e.target.value })} /></div>
            <div><label htmlFor="kk">{t("account.country")} *</label><input id="kk" value={bill.country} onChange={(e) => setBill({ ...bill, country: e.target.value })} /></div>
          </div>
          <h3>{t("account.payment")}</h3>
          {s.card && useSaved ? (
            <div className="row between"><span className="row" style={{ gap: 8 }}><CreditCard size={18} /> {s.card.brand} •••• {s.card.last4} <span className="muted small">{s.card.exp}</span></span><button className="ghost sm" onClick={() => setCard({ ...card, number: " " })}>{t("bill.usenew")}</button></div>
          ) : <CardFields f={{ ...card, number: card.number.trim() }} setF={setCard} />}
        </div>
        <aside className="card ordersum" style={{ boxShadow: "none" }}>
          <h3 style={{ marginTop: 0 }}>{t("bill.summary")}</h3>
          <b>1Plan {t("plan." + plan)}</b>
          <div className="seg" role="group" aria-label={t("bill.cycle")} style={{ margin: "8px 0" }}>
            {(["monthly", "yearly"] as const).map((c) => <button key={c} aria-pressed={cycle === c} onClick={() => setCycle(c)}>{t("bill." + c)}</button>)}
          </div>
          {cycle === "yearly" && <p className="small" style={{ color: "var(--teal)", margin: "0 0 8px" }}>{t("bill.yearsave", { save: money(yearlySaving(plan), locale) })}</p>}
          <label htmlFor="kp">{t("bill.promo")}</label>
          <input id="kp" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
          {promo.trim() && <p className="small" style={{ margin: "4px 0 0", color: pct ? "var(--teal)" : "var(--danger)" }}>{pct ? t("bill.promo.ok", { pct }) : t("bill.err.promo")}</p>}
          <div className="row between" style={{ marginTop: 12 }}><span>{t("bill.subtotal")}</span><span>{money(subtotal, locale)}</span></div>
          {discount > 0 && <div className="row between" style={{ color: "var(--teal)" }}><span>{t("bill.discount")}</span><span>−{money(discount, locale)}</span></div>}
          <div className="row between" style={{ fontWeight: 700, fontSize: "1.1rem", borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}><span>{t("bill.total")}</span><span>{money(total, locale)}</span></div>
          <p className="muted small">{t("bill.renews", { when: new Date(addDays(cycle === "monthly" ? 30 : 365)).toLocaleDateString(locale, { dateStyle: "medium" }) })}</p>
          {err && <p role="alert" style={{ color: "var(--danger)", margin: "0 0 8px" }}>{err}</p>}
          <button style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={pay}>{busy ? t("bill.processing") : t("bill.pay", { amount: money(total, locale) })}</button>
        </aside>
      </div>
    </Modal>
  );
}

/** Feature list shared by the landing page and the subscription page. Every plan has every feature; only the event allowance differs. */
export const planBullets = (p: Plan, t: (k: string, v?: Record<string, string | number>) => string): string[] => {
  const r = PLANS[p];
  if (p === "pro") return [t("plan.ev.unl"), t("pb.unl"), t("plan.f.invunl"), t("pb.docs"), t("plan.f.collab")];
  return [
    t("plan.ev.n", { n: r.events }), t("plan.f.inv", { n: r.invites }),
    r.designRequest ? t("pb.design.n", { n: r.designEdits }) : t("pb.tplonly"),
    t("pb.tables.n", { n: r.tables }), r.itineraries === 1 ? t("pb.itin1") : "",
    r.customStatuses ? "" : t("pb.statuses3"), r.documents ? t("pb.docs") : "", t("pb.collab.n", { n: r.collabs }),
  ].filter(Boolean);
};

/** Start of the free trial: choose a plan and add a card. Nothing is charged until the trial ends. */
export function TrialPage() {
  const { t, locale } = useT();
  const s = useStore();
  const plan: Plan = "basic"; // the free trial is only available on the Essential plan, and it renews on Essential after the trial
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", holder: s.userName });
  const [err, setErr] = useState("");
  const ends = new Date(Date.now() + TRIAL_DAYS * 86400000).toLocaleDateString(locale, { dateStyle: "long" });
  const cloud = isCloudId(s.sessionId); // real accounts pay on Stripe's secure page; the demo accounts keep the simulated card
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (cloud) { setBusy(true); setErr(""); const e = await goCheckout(plan, cycle); if (e) { setErr(t("bill.err.stripe")); setBusy(false); } return; }
    const r = checkCard(card, t); if (r.err) return setErr(r.err);
    update((st) => { st.card = r.card!; st.plan = plan; st.sub = { plan, cycle, status: "trialing", startedAt: Date.now(), renewsAt: 0, trialEndsAt: Date.now() + TRIAL_DAYS * 86400000, cancelAtEnd: false, promo: "" }; });
    go("/app");
  };
  return (
    <div style={{ minHeight: "100vh", padding: "28px 20px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "start center" }}>
      <div style={{ width: 920, maxWidth: "100%" }}>
        <h1>{t("trial.title", { n: TRIAL_DAYS })}</h1>
        <p className="muted">{t("trial.sub", { n: TRIAL_DAYS })} {t("trial.essential")}</p>
        <div className="seg" role="group" aria-label={t("bill.cycle")} style={{ margin: "8px 0 14px" }}>
          {(["monthly", "yearly"] as const).map((c) => <button key={c} aria-pressed={cycle === c} onClick={() => setCycle(c)}>{t("bill." + c)}{c === "yearly" ? " · −10%" : ""}</button>)}
        </div>
        <div style={{ maxWidth: 420 }}>
          {(["basic"] as Plan[]).map((p) => (
            <div key={p} className="card" style={{ textAlign: "left", borderColor: "var(--teal)", borderWidth: 2 }}>
              <h3 style={{ margin: 0 }}>{t("plan." + p)}</h3>
              <div className="price" style={{ margin: "6px 0 0" }}>{money(PRICES[p][cycle], locale)}<span className="muted small"> / {t("bill." + (cycle === "monthly" ? "mo" : "yr"))}</span></div>{cycle === "yearly" && <p className="small" style={{ color: "var(--teal)", margin: "0 0 6px" }}>{t("bill.yearsave", { save: money(yearlySaving(p), locale) })}</p>}
              <ul style={{ paddingLeft: 18, margin: 0 }}>{planBullets(p, t).map((i) => <li key={i} className="small">{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 16, maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>{t("account.payment")}</h3>
          {cloud ? <p className="muted small" style={{ margin: 0 }}>{t("bill.stripe.note")}</p> : <CardFields f={card} setF={setCard} />}
          <p className="small" style={{ margin: "12px 0 4px" }}><b>{t("trial.today")}: {money(0, locale)}</b></p>
          <p className="muted small" style={{ margin: 0 }}>{t("trial.then", { amount: money(PRICES[plan][cycle], locale), when: ends, plan: t("plan." + plan) })}</p>
          {err && <p role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
          <button style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={busy} onClick={start}>{t("trial.start", { n: TRIAL_DAYS })}</button>
        </div>
      </div>
    </div>
  );
}
