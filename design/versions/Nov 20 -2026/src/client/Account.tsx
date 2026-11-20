import { useState } from "react";
import { useT } from "../i18n";
import { Checkout, CardModal, InvoiceModal, money, planBullets, usePrices } from "./Billing";
import { yearlySaving, RESET_MINUTES, TRIAL_DAYS, askLogout, go, logout, eventLimit, queueReset, eventsLast30, resetDemo, uid, update, useStore, type Invoice, type Plan } from "../store";
import CancelSurvey from "./CancelSurvey";
import { authErrorKey, cloudChangeEmail, cloudResetRequest, cloudVerifyPassword, goCheckout, goPortal, isCloudId } from "../cloud";
import { Modal } from "./ui";
import { ResetMail } from "../Reset";
import { Check, CreditCard, Pencil, ImageIcon } from "../icons";
import { ask } from "./Ask";

const TABS = ["basic", "identity", "billing", "subscription"] as const;

/** Notice the platform "sends" when the email or phone of the account changes (shown in the demo). */
function Notices({ list }: { list: import("../store").Mail[] }) {
  const { t } = useT();
  return <>{list.map((m) => <div className="mail" key={m.id} style={{ marginBottom: 8 }}><div className="small muted">{m.chan === "whatsapp" ? "WhatsApp" : "Email"} → {m.to}</div><div>{t(m.key ?? "", m.vars ?? {})}</div></div>)}</>;
}

/** Change the email or phone: saved on confirmation, and everyone concerned is notified (email for the email, WhatsApp for the phone). */
function ContactModal({ kind, onClose }: { kind: "email" | "phone"; onClose: () => void }) {
  const { t } = useT();
  const s = useStore();
  const old = kind === "email" ? s.userEmail : s.userPhone;
  const [v, setV] = useState(old);
  const [pw, setPw] = useState(""); // sensitive details: the current password is always asked
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(""); // new e-mail waiting for the confirmation link
  const [sent, setSent] = useState<import("../store").Mail[] | null>(null);
  const cloud = isCloudId(s.sessionId);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const nv = v.trim();
    if (nv === old) return onClose();
    if (kind === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nv)) return setErr(t("join.err.email"));
      if (s.accounts.some((a) => a.id !== s.sessionId && a.email.toLowerCase() === nv.toLowerCase()) || s.team.some((m) => m.email.toLowerCase() === nv.toLowerCase())) return setErr(t("team.taken"));
    } else if (nv.replace(/\D/g, "").length < 7) return setErr(t("acct.err.phone"));
    if (!pw) return setErr(t("acct.err.pwneeded"));
    setBusy(true); setErr("");
    const acct = s.accounts.find((x) => x.id === s.sessionId);
    const pwOk = cloud ? !(await cloudVerifyPassword(s.userEmail, pw)).error : !acct?.password || acct.password === pw;
    if (!pwOk) { setBusy(false); return setErr(t("acct.err.pw")); }
    if (kind === "email" && cloud) { // the login e-mail changes only when the link sent to the new address is opened
      const { error } = await cloudChangeEmail(nv);
      setBusy(false);
      if (error) return setErr(t(authErrorKey(error)));
      setPending(nv); return;
    }
    setBusy(false);
    const msgs = [old, nv].filter(Boolean).map((to) => ({ id: uid(), to, subject: "notice", token: "", at: Date.now(), kind: "notice" as const, chan: kind === "email" ? "email" as const : "whatsapp" as const, key: to === nv ? `notice.${kind}.new` : `notice.${kind}.old`, vars: { name: s.userName, old: old || "—", new: nv } }));
    update((st) => {
      if (kind === "email") { st.userEmail = nv; const a = st.accounts.find((x) => x.id === st.sessionId); if (a) a.email = nv; } else st.userPhone = nv;
      st.outbox.push(...msgs);
    });
    setSent(msgs);
  };
  if (pending) return (
    <Modal title={t("acct.email.check")} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{t("acct.email.pending", { email: pending })}</p>
      <p className="muted small">{t("acct.email.pending2", { old: s.userEmail })}</p>
      <div className="row" style={{ justifyContent: "flex-end" }}><button onClick={onClose}>{t("done")}</button></div>
    </Modal>
  );
  if (sent) return (
    <Modal title={t("acct.notified")} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>{t("team.invite.demo")}</p><Notices list={sent} />
      <div className="row" style={{ justifyContent: "flex-end" }}><button onClick={onClose}>{t("done")}</button></div>
    </Modal>
  );
  return (
    <Modal title={t(kind === "email" ? "acct.change.email" : "acct.change.phone")} onClose={onClose}>
      <form onSubmit={save} className="form">
        <div className="full"><label htmlFor="cv">{t(kind === "email" ? "acct.newemail" : "acct.newphone")}</label><input id="cv" autoFocus type={kind === "email" ? "email" : "tel"} value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} />
          <div className="muted small">{t(kind === "email" && cloud ? "acct.email.confirmnote" : kind === "email" ? "acct.notify.email" : "acct.notify.phone")}</div></div>
        <div className="full"><label htmlFor="cp">{t("acct.curpw")}</label><input id="cp" type="password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} /><div className="muted small">{t("acct.curpw.why")}</div>{err && <div className="small" role="alert" style={{ color: "var(--danger)" }}>{err}</div>}</div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={busy}>{busy ? "…" : t("save")}</button></div>
      </form>
    </Modal>
  );
}

/** Names of the details edited but not saved yet. */
export const unsavedList = (s: ReturnType<typeof useStore>, t: (k: string) => string): string[] => {
  const d = s.accDraft; if (!d) return [];
  return [d.name !== undefined && d.name !== s.userName ? t("name") : "", d.last !== undefined && d.last !== s.userLastName ? t("team.lastname") : "", d.avatar !== undefined && d.avatar !== s.avatar ? t("account.photo") : "", d.logo !== undefined && d.logo !== s.businessLogo ? t("account.logo") : ""].filter(Boolean);
};

export function BasicInfo() {
  const s = useStore();
  const { t } = useT();
  const [msg, setMsg] = useState("");
  const [contact, setContact] = useState<"email" | "phone" | null>(null);
  const [saved, setSaved] = useState(false);
  const d = s.accDraft ?? {};
  const name = d.name ?? s.userName, last = d.last ?? s.userLastName, avatar = d.avatar ?? s.avatar, logo = d.logo ?? s.businessLogo;
  const setDraft = (p: Partial<import("../store").AccDraft>) => { setSaved(false); update((st) => { st.accDraft = { ...(st.accDraft ?? {}), ...p }; }); };
  const dirty = unsavedList(s, t).length > 0;
  const read = (f: File | undefined, apply: (data: string) => void) => {
    if (!f || !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 1024 * 1024) { setMsg(t("account.imgerr")); return; }
    setMsg("");
    const r = new FileReader();
    r.onload = () => apply(String(r.result));
    r.readAsDataURL(f);
  };
  const save = () => { update((st) => { const d2 = st.accDraft; if (d2?.name !== undefined && d2.name.trim()) { st.userName = d2.name.trim(); const a = st.accounts.find((x) => x.id === st.sessionId); if (a) a.name = d2.name.trim(); } if (d2?.last !== undefined) st.userLastName = d2.last.trim(); if (d2?.avatar !== undefined) st.avatar = d2.avatar; if (d2?.logo !== undefined) st.businessLogo = d2.logo; st.accDraft = null; }); setSaved(true); };
  const row = (label: string, value: string, edit: () => void, ariaEdit: string) => (
    <div><label>{label}</label><div className="row between acctrow"><span>{value || <span className="muted">—</span>}</span><button className="ghost icon" aria-label={ariaEdit} title={ariaEdit} onClick={edit}><Pencil size={15} /></button></div></div>
  );
  return (
    <div className="card acctcol">
      <div><label>{t("account.photo")}</label>
        <label className="avatar-edit" title={t("account.photo")} aria-label={t("account.photo")}>
          {avatar ? <img src={avatar} alt="" /> : <span className="big">{name[0]}</span>}
          <span className="ov"><Pencil size={26} /></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { read(e.target.files?.[0], (v) => setDraft({ avatar: v })); e.target.value = ""; }} />
        </label>
        <div className="muted small" style={{ marginTop: 4 }}>{t("account.photo.hint")}</div>
      </div>
      <div><label htmlFor="nm">{t("name")}</label><input id="nm" value={name} onChange={(e) => setDraft({ name: e.target.value })} /></div>
      <div><label htmlFor="ln">{t("team.lastname")}</label><input id="ln" value={last} onChange={(e) => setDraft({ last: e.target.value })} /></div>
      {row(t("email"), s.userEmail, () => setContact("email"), t("acct.change.email"))}
      {row(t("account.phone"), s.userPhone, () => setContact("phone"), t("acct.change.phone"))}
      <div><label>{t("account.logo")}</label>
        <label className="avatar-edit logo" title={t("account.logo")} aria-label={t("account.logo")}>
          {logo ? <img src={logo} alt="" /> : <span className="big logo-ph"><ImageIcon size={28} /><small>{t("account.logo.add")}</small></span>}
          <span className="ov"><Pencil size={26} /></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { read(e.target.files?.[0], (v) => setDraft({ logo: v })); e.target.value = ""; }} />
        </label>
      </div>
      {msg && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{msg}</p>}
      <div className="row"><button disabled={!dirty} onClick={save}>{t("save")}</button><button className="ghost" disabled={!dirty} onClick={() => update((st) => { st.accDraft = null; })}>{t("acct.discard")}</button>{saved && !dirty && <span role="status" className="row" style={{ color: "var(--teal)", gap: 4 }}><Check size={15} />{t("saved")}</span>}</div>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
      <div><button className="ghost" onClick={askLogout}>{t("logout")}</button></div>
      {contact && <ContactModal kind={contact} onClose={() => setContact(null)} />}
    </div>
  );
}

/** Access and security: the password is reset on request through a link sent to the account e-mail. */
function Identity() {
  const { t } = useT();
  const s = useStore();
  const [sent, setSent] = useState(false);
  const mail = sent ? [...s.outbox].reverse().find((m) => m.kind === "reset" && m.to === s.userEmail) : undefined;
  return (
    <div className="grid" style={{ maxWidth: 720 }}>
      <div className="card">
        <h3>{t("account.signin")}</h3>
        <div className="row between" style={{ padding: "8px 0" }}><span>{t("email")}: <b>{s.userEmail}</b></span><span className="badge" style={{ background: "var(--teal)", color: "#14203A" }}>{t("account.on")}</span></div>
      </div>
      <div className="card">
        <h3>{t("account.resetpw")}</h3>
        <p className="muted" style={{ marginTop: 0 }}>{t("reset.req.sub", { email: s.userEmail })}</p>
        <button onClick={() => { if (isCloudId(s.sessionId)) void cloudResetRequest(s.userEmail); else update((st) => { queueReset(st, st.userEmail, st.userName); }); setSent(true); }}>{t("reset.req.btn")}</button>
        {sent && <p role="status" style={{ color: "var(--teal)" }}>{t("forgot.sent.sub", { email: s.userEmail, min: RESET_MINUTES })}</p>}
        {mail && <><div className="muted small" style={{ margin: "8px 0" }}>{t("sent.demo")}</div><ResetMail mail={mail} /></>}
        <p className="muted small" style={{ marginBottom: 0 }}>{t("reset.nomail")} <button className="ghost sm" onClick={() => update((st) => { st.supportOpen = true; })}>{t("nav.support")}</button></p>
      </div>
    </div>
  );
}

function BillingInfo() {
  const s = useStore();
  const { t, locale } = useT();
  const [cardOpen, setCardOpen] = useState(false);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof s.billing, v: string) => { setSaved(false); update((st) => { st.billing[k] = v; }); };
  return (
    <div className="grid" style={{ maxWidth: 720 }}>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); setSaved(true); }}>
        <h3 className="full">{t("account.billing")}</h3>
        <div><label htmlFor="bn">{t("account.billname")}</label><input id="bn" value={s.billing.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label htmlFor="bt">{t("account.taxid")}</label><input id="bt" value={s.billing.taxId} onChange={(e) => set("taxId", e.target.value)} /></div>
        <div className="full"><label htmlFor="ba">{t("account.address")}</label><input id="ba" value={s.billing.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div><label htmlFor="bc">{t("account.city")}</label><input id="bc" value={s.billing.city} onChange={(e) => set("city", e.target.value)} /></div>
        <div><label htmlFor="bk">{t("account.country")}</label><input id="bk" value={s.billing.country} onChange={(e) => set("country", e.target.value)} /></div>
        <div className="row full"><button>{t("save")}</button>{saved && <span role="status" className="row" style={{ color: "var(--teal)", gap: 4 }}><Check size={15} />{t("saved")}</span>}</div>
      </form>
      <div className="card">
        <h3>{t("account.payment")}</h3>
        <div className="row between"><span className="row" style={{ gap: 8 }}><CreditCard size={18} />{s.card ? <>{s.card.brand} •••• {s.card.last4} <span className="muted small">{s.card.exp}</span></> : <span className="muted">{t("account.nocard")}</span>}</span><button className="ghost" onClick={() => setCardOpen(true)}>{s.card ? t("bill.changecard") : t("account.addcard")}</button></div>
        <p className="muted small" style={{ marginBottom: 0 }}>{t("bill.testnote")}</p>
      </div>
      <div className="card"><h3>{t("account.invoices")}</h3>
        {s.invoices.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t("none")}</p> : (
          <table><thead><tr><th>{t("bill.invoice")}</th><th>{t("date")}</th><th>{t("bill.total")}</th><th /></tr></thead>
            <tbody>{s.invoices.map((i) => <tr key={i.id}><td>{i.number}<br /><span className="muted small">{i.description}</span></td><td>{new Date(i.at).toLocaleDateString(locale, { dateStyle: "medium" })}</td><td>{money(i.total, locale)}</td><td><button className="ghost sm" onClick={() => setInv(i)}>{t("bill.view")}</button></td></tr>)}</tbody></table>
        )}
      </div>
      {cardOpen && <CardModal onClose={() => setCardOpen(false)} />}
      {inv && <InvoiceModal inv={inv} onClose={() => setInv(null)} />}
    </div>
  );
}

function Subscription() {
  const s = useStore();
  const { t, locale } = useT();
  const price = usePrices();
  const [co0, setCo0] = useState<Plan | null>(null);
  const cloud = isCloudId(s.sessionId); // real accounts pay and manage billing on Stripe
  const [stripeErr, setStripeErr] = useState("");
  const [stripeBusy, setStripeBusy] = useState(false);
  const toStripe = async (p?: Plan) => { setStripeBusy(true); setStripeErr(""); const e = p ? await goCheckout(p, cyc) : await goPortal(); if (e) { setStripeErr(t("bill.err.stripe")); setStripeBusy(false); } };
  const co = cloud ? null : co0; // demo accounts keep the simulated checkout window
  const setCo = (p: Plan | null) => { if (cloud) { if (p) void toStripe(p); } else setCo0(p); };
  const [cancel, setCancel] = useState(false);
  const [cyc, setCyc] = useState<"monthly" | "yearly">(s.sub.cycle);
  const n = (v: number) => (v === Infinity ? t("unlimited") : String(v));
  const sub = s.sub, date = (ms: number) => new Date(ms).toLocaleDateString(locale, { dateStyle: "long" });
  const days = Math.max(0, Math.ceil((sub.trialEndsAt - Date.now()) / 86400000));
  const status = sub.status === "trialing" ? t("bill.st.trialing", { n: days }) : sub.status === "active" ? (sub.cancelAtEnd ? t("bill.st.ends", { when: date(sub.renewsAt) }) : t("bill.st.active")) : t("bill.st." + sub.status);
  const rank: Record<Plan, number> = { basic: 1, planner: 2, pro: 3 };
  const access = sub.status === "active" || sub.status === "trialing";
  const simulateRenewal = () => update((st) => {
    if (st.sub.status !== "active") return;
    if (st.sub.cancelAtEnd) { st.sub = { ...st.sub, status: "canceled", renewsAt: 0, cancelAtEnd: false }; return; }
    const amount = price(st.sub.plan, st.sub.cycle);
    st.invoices.unshift({ id: Math.random().toString(36).slice(2, 10), number: `INV-${new Date().getFullYear()}-${String(st.invoices.length + 1).padStart(4, "0")}`, at: Date.now(), description: `1Plan ${t("plan." + st.sub.plan)} · ${t("bill." + st.sub.cycle)}`, plan: st.sub.plan, cycle: st.sub.cycle, subtotal: amount, discount: 0, total: amount, promo: "", last4: st.card?.last4 ?? "0000", billTo: st.billing.name || st.userName, address: [st.billing.address, st.billing.city, st.billing.country].filter(Boolean).join(", ") });
    st.sub.renewsAt += (st.sub.cycle === "monthly" ? 30 : 365) * 86400000;
  });
  return (
    <>
      {cancel && <CancelSurvey sub={sub} when={date(sub.renewsAt)} onClose={() => setCancel(false)} onDone={() => setCancel(false)} />}
      {stripeErr && <p role="alert" style={{ color: "var(--danger)" }}>{stripeErr}</p>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div><span className="muted small">{t("account.current")}</span><h2 style={{ margin: "2px 0" }}>{access ? t("plan." + s.plan) : t("plan.inactive")} <span className="badge" style={{ verticalAlign: 3, background: sub.status === "active" && !sub.cancelAtEnd ? "var(--teal)" : undefined, color: sub.status === "active" && !sub.cancelAtEnd ? "#14203A" : undefined }}>{status}</span></h2>
            <span className="muted small">{events(s, t, n)}</span></div>
          <div style={{ textAlign: "right" }}>
            {sub.status === "active" && <><div><b>{money(price(sub.plan, sub.cycle), locale)}</b> <span className="muted small">/ {t("bill." + (sub.cycle === "monthly" ? "mo" : "yr"))}</span></div><div className="muted small">{sub.cancelAtEnd ? t("bill.endson", { when: date(sub.renewsAt) }) : t("bill.nextcharge", { when: date(sub.renewsAt) })}</div></>}
            {sub.status === "trialing" && <div className="muted small">{t("bill.trialends", { when: date(sub.trialEndsAt), amount: money(price(sub.plan, sub.cycle), locale) })}</div>}
            {sub.status === "trialing" && <button className="ghost sm" style={{ marginTop: 8 }} onClick={() => setCancel(true)}>{t("bill.canceltrial")}</button>}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              {sub.status === "active" && !sub.cancelAtEnd && <button className="ghost sm" onClick={() => setCancel(true)}>{t("bill.cancel")}</button>}
              {sub.status === "active" && sub.cancelAtEnd && <button className="sm" onClick={() => { if (cloud) void toStripe(); else update((st) => { st.sub.cancelAtEnd = false; }); }}>{t("bill.resume")}</button>}
              {cloud && sub.status !== "none" && <button className="ghost sm" disabled={stripeBusy} onClick={() => void toStripe()}>{t("bill.manage")}</button>}
              {!cloud && sub.status === "active" && sub.cycle === "monthly" && <button className="ghost sm" onClick={() => setCo(sub.plan)}>{t("bill.toyearly")}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="seg" role="group" aria-label={t("bill.cycle")} style={{ margin: "0 0 12px" }}>{(["monthly", "yearly"] as const).map((c) => <button key={c} aria-pressed={cyc === c} onClick={() => setCyc(c)}>{t("bill." + c)}{c === "yearly" ? " · −10%" : ""}</button>)}</div>
      <div className="grid g3">
        {(["basic", "planner", "pro"] as Plan[]).map((p) => {
          const cur = s.plan === p && (sub.status === "active" || sub.status === "trialing");
          return (
            <div key={p} className="card" style={cur ? { borderColor: "var(--teal)", borderWidth: 2 } : {}}>
              <div className="row between"><h3 style={{ margin: 0 }}>{t("plan." + p)}</h3>{cur && <span className="badge" style={{ background: "var(--teal)", color: "#14203A" }}>{t("account.current")}</span>}</div>
              <p className="muted small" style={{ margin: "2px 0 0" }}>{t("plan.tag." + p)}</p>
              <div className="price" style={{ margin: "6px 0" }}>{money(price(p, cyc), locale)}<span className="muted small"> / {t("bill." + (cyc === "monthly" ? "mo" : "yr"))}</span></div>
              {cyc === "yearly" && <p className="small" style={{ color: "var(--teal)", margin: "0 0 4px" }}>{t("bill.yearsave", { save: money(yearlySaving(p), locale) })}</p>}
              <ul style={{ paddingLeft: 18 }}>{planBullets(p, t).map((i) => <li key={i} className="small">{i}</li>)}</ul>
              <button className={cur ? "ghost" : ""} disabled={cur && sub.status === "active"} onClick={() => setCo(p)}>{cur && sub.status === "active" ? t("account.current") : sub.status === "trialing" && cur ? t("bill.subscribe") : sub.status === "active" ? (rank[p] < rank[s.plan] ? t("bill.changeplan") : t("bill.upgrade")) : t("bill.subscribe")}</button>
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>{t("plan.countnote")}</p>
      <p className="muted small" style={{ marginTop: 16 }}>
        {t("bill.demo")} <button className="ghost sm" disabled={sub.status !== "active"} onClick={simulateRenewal}>{t("bill.simrenew")}</button>{" "}
        <button className="ghost sm" onClick={() => ask(t("account.resetdemo") + "?", () => resetDemo(), { danger: true })}>{t("account.resetdemo")}</button>
      </p>
      {co && <Checkout plan={co} cycle={cyc} onClose={() => setCo(null)} />}
    </>
  );
}
const events = (s: ReturnType<typeof useStore>, t: (k: string, v?: Record<string, string | number>) => string, n: (v: number) => string) => t("plan.usage", { used: eventsLast30(s), max: n(eventLimit(s)) });

/** Account for a collaborator signed in with their own access: their name, e-mail and password only. */
function MemberAccount({ tab }: { tab: string }) {
  const { t } = useT();
  const s = useStore();
  const m = s.team.find((x) => x.id === s.viewAs)!;
  const client = m.kind === "client";
  const [f, setF] = useState({ name: m.name, last: m.lastName });
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const mail = sent ? [...s.outbox].reverse().find((x) => x.kind === "reset" && x.to === m.email) : undefined;
  const tabs = client ? ["basic", "subscription"] : ["basic"];
  const cur = tabs.includes(tab) ? tab : "basic";
  const startAccount = () => { try { sessionStorage.setItem("aplan-join", JSON.stringify({ name: `${m.name} ${m.lastName}`.trim(), email: m.email })); } catch { /* ignore */ } logout(); go("/join"); };
  return (
    <>
      <h1>{t("nav.account")}</h1>
      <nav className="tabs" aria-label={t("nav.account")}>{tabs.map((k) => <a key={k} href={`#/app/account/${k}`} aria-current={cur === k ? "page" : undefined}>{t("account.tab." + k)}</a>)}</nav>
      {cur === "basic" ? (
        <div className="card acctcol">
          <div><label htmlFor="mn">{t("name")}</label><input id="mn" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setSaved(false); }} /></div>
          <div><label htmlFor="ml">{t("team.lastname")}</label><input id="ml" value={f.last} onChange={(e) => { setF({ ...f, last: e.target.value }); setSaved(false); }} /></div>
          <div><label>{t("email")}</label><div className="acctrow">{m.email}</div><div className="muted small">{t("mem.email.note")}</div></div>
          <div className="row"><button disabled={!f.name.trim()} onClick={() => { update((st) => { const x = st.team.find((y) => y.id === m.id)!; x.name = f.name.trim(); x.lastName = f.last.trim(); }); setSaved(true); }}>{t("save")}</button>{saved && <span role="status" className="row" style={{ color: "var(--teal)", gap: 4 }}><Check size={15} />{t("saved")}</span>}</div>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%" }} />
          <div><label>{t("account.resetpw")}</label><p className="muted small" style={{ margin: "0 0 6px" }}>{t("reset.req.sub", { email: m.email })}</p>
            <button className="ghost" onClick={() => { update((st) => { queueReset(st, m.email, m.name); }); setSent(true); }}>{t("reset.req.btn")}</button>
            {sent && <p role="status" style={{ color: "var(--teal)" }}>{t("forgot.sent.sub", { email: m.email, min: RESET_MINUTES })}</p>}
            {mail && <><div className="muted small" style={{ margin: "8px 0" }}>{t("sent.demo")}</div><ResetMail mail={mail} /></>}
          </div>
          <div><button className="ghost" onClick={askLogout}>{t("logout")}</button></div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>{t("mem.sub.title")}</h3>
          <p>{t("mem.sub.body", { planner: s.userName })}</p>
          <p className="muted small">{t("mem.sub.note", { n: TRIAL_DAYS })}</p>
          <button onClick={startAccount}>{t("mem.sub.cta")}</button>
        </div>
      )}
    </>
  );
}

export default function Account({ tab }: { tab: string }) {
  const { t } = useT();
  const s = useStore();
  if (s.viewAs && s.team.some((x) => x.id === s.viewAs)) return <MemberAccount tab={tab} />;
  const cur = (TABS as readonly string[]).includes(tab) ? tab : "basic";
  return (
    <>
      <h1>{t("nav.account")}</h1>
      <nav className="tabs" aria-label={t("nav.account")}>
        {TABS.map((k) => <a key={k} href={`#/app/account/${k}`} aria-current={cur === k ? "page" : undefined}>{t("account.tab." + k)}</a>)}
      </nav>
      {cur === "basic" && <BasicInfo />}
      {cur === "identity" && <Identity />}
      {cur === "billing" && <BillingInfo />}
      {cur === "subscription" && <Subscription />}
    </>
  );
}
