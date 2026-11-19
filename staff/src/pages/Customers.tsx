import { useState } from "react";
import { randomPassword } from "../crypto";
import { createTask, log, PLAN_LABEL, update, useStore, type Customer, type Staff } from "../store";
import { Copy, fmtDate, go, money } from "../ui";
import { SUPABASE_AUTH } from "../supabase";
import { staffAdmin } from "../auth";
import { refreshCustomers } from "../cloud";

/** Support tools: account lookup, reset, unblock, payment history and payment issues, usage guides. */
export default function Customers({ me, route }: { me: Staff; route: string }) {
  const parts = route.split("/");
  const id = parts[2];
  const from = parts[3] === "from" ? parts[4] : ""; // "#/customers/<id>/from/<request>": opened from a request, so we can go back to it
  return id ? <Account me={me} id={id} from={from} /> : <List />;
}

const stBadge = (st: Customer["status"]) => <span className="badge" style={st === "active" ? { background: "#dcf3e8", color: "#1f7a52" } : { background: "#fde3e8", color: "#a3304a" }}>{st}</span>;

function List() {
  const s = useStore();
  const [q, setQ] = useState("");
  const rows = s.customers.filter((c) => !q || (c.name + c.email).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h1>Customers</h1>
      <p className="muted" style={{ marginTop: -4 }}>Find a customer to help with their account, access or payments.</p>
      <div className="card">
        <input placeholder="Search by name or email…" aria-label="Search customers" style={{ maxWidth: 320, marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)} />
        <table>
          <thead><tr><th>Customer</th><th>Plan</th><th>Account</th><th>{SUPABASE_AUTH ? "Subscription" : "Payments"}</th><th>Last login</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const bad = c.payments.filter((p) => p.status === "failed" || p.status === "pending").length;
              return <tr key={c.id} className="click" onClick={() => go("/customers/" + c.id)}><td><a href={"#/customers/" + c.id}><b>{c.name}</b></a><div className="muted small">{c.email}</div></td><td>{PLAN_LABEL[c.plan]}</td><td>{stBadge(c.status)}</td><td>{SUPABASE_AUTH ? <span className="small">{c.sub?.status === "trialing" ? "Free trial" : c.sub?.status && c.sub.status !== "none" ? c.sub.status.replace("_", " ") : "—"}</span> : c.payments.length}{!SUPABASE_AUTH && bad > 0 && <span className="badge b-late" style={{ marginLeft: 6 }}>{bad} issue{bad > 1 ? "s" : ""}</span>}</td><td className="small">{fmtDate(c.lastLogin)}</td></tr>;
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted">No customers match.</p>}
      </div>
    </>
  );
}

const GUIDES: [string, string][] = [
  ["Send invitations by WhatsApp", "Open the event → RSVP → choose the guests → pick WhatsApp as the channel → Send (Essential allows 25 invitations per event, Premier 50). Each guest gets a personal RSVP link."],
  ["Seat guests at tables", "Open the event → Table arrangement. Create an arrangement, add tables, then drag each guest onto a seat. Save a new version before big changes (Essential 1 arrangement per event, Premier 2)."],
  ["Design an invitation", "Open the event → Invitation. Pick a template, edit text and colours, then Save. Custom designs by the team start at Premier."],
  ["Upgrade or change plan", "Account → My subscription. Choose Essential, Premier or Unlimited and confirm. Features outside the new plan lock; the customer's data is kept."],
  ["Reset my password", "On the sign-in page choose 'Forgot password'. If you no longer have access to your email, contact support so we can verify you and issue a temporary password."],
];

function Account({ me, id, from }: { me: Staff; id: string; from: string }) {
  const s = useStore();
  const c = s.customers.find((x) => x.id === id);
  const [msg, setMsg] = useState("");
  if (!c) return <div className="card"><h2>Customer not found</h2><a className="btn" href="#/customers">Back</a></div>;
  const admin = me.role === "super_admin";
  const patch = (fn: (c: Customer) => void, action: string) => { update((st) => { fn(st.customers.find((x) => x.id === id)!); }); log(me.name, action, c.email); };
  const reset = () => {
    if (!confirm(`Issue a temporary password for ${c.email}? Their current password stops working.`)) return;
    const pw = randomPassword();
    patch((x) => { x.tempPassword = pw; x.tempPasswordAt = Date.now(); if (x.status === "locked") x.status = "active"; }, "Reset customer password");
    setMsg("Temporary password created. Share it through a verified channel; it is shown only now and the customer must change it at next sign-in.");
  };
  const unblock = () => { patch((x) => { x.status = "active"; }, "Unblocked customer account"); setMsg("Account is active again."); };
  const block = () => { if (confirm(`Block ${c.email}?`)) patch((x) => { x.status = "blocked"; }, "Blocked customer account"); };
  const retry = (pid: string) => { patch((x) => { const p = x.payments.find((y) => y.id === pid)!; p.status = "paid"; p.issue = "Retried successfully by support"; }, "Retried customer payment"); };
  const refund = (pid: string) => { if (confirm("Refund this payment?")) patch((x) => { const p = x.payments.find((y) => y.id === pid)!; p.status = "refunded"; p.issue = "Refunded by super admin"; }, "Refunded customer payment"); };
  const escalate = (pid: string) => {
    const p = c.payments.find((y) => y.id === pid)!;
    const t = createTask({ kind: "admin", title: `Payment issue: ${c.name}`, description: `${money(p.amount)} ${p.plan} on ${fmtDate(p.at)} — ${p.status}. ${p.issue}`, requester: `${c.name} <${c.email}>`, customerId: c.id, priority: "high", source: "staff", by: me.name });
    log(me.name, "Escalated payment issue to super admin", t.id);
    setMsg(`Escalated as ${t.id}.`);
  };
  const real = async (body: Record<string, unknown>, done: string, audit?: string) => {
    setMsg("Working…");
    const r = await staffAdmin(body);
    if (!r.ok) return setMsg(r.error === "forbidden" ? "Your profile cannot do that." : "Could not complete it (" + r.error + ").");
    setMsg(done); if (audit) log(me.name, audit, c.email); refreshCustomers();
  };
  const tasks = s.tasks.filter((t) => t.customerId === c.id);
  return (
    <>
      <p className="row" style={{ gap: 14 }}>{from && <a className="btn sm" href={"#/tasks/" + from}>← Back to request <span className="mono">{from}</span></a>}<a href="#/customers">{from ? "All customers" : "← Customers"}</a></p>
      <div className="row between"><h1 style={{ margin: 0 }}>{c.name}</h1><div className="row">{stBadge(c.status)}<span className="badge">{PLAN_LABEL[c.plan]}</span></div></div>
      <p className="muted">{c.email} · member since {fmtDate(c.createdAt)} · last login {fmtDate(c.lastLogin)}</p>
      {msg && <div className="okbox" role="status" style={{ marginBottom: 14 }}>{msg}</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="grid">
          {SUPABASE_AUTH && <div className="card">
            <h3>Account actions</h3>
            <div className="row">
              <button onClick={() => { if (confirm(`Send a password-reset email to ${c.email}? They choose their own new password.`)) void real({ action: "customer_reset", userId: c.id }, "Reset email sent to " + c.email + ".", "Sent customer password-reset email"); }}>Send password-reset email</button>
              {c.status === "blocked" && <button className="ghost" onClick={() => void real({ action: "customer_block", userId: c.id, blocked: false }, "Account unblocked.", "Unblocked customer account")}>Unblock account</button>}
              {admin && c.status === "active" && <button className="danger" onClick={() => { if (confirm(`Block ${c.email}? They will not be able to sign in.`)) void real({ action: "customer_block", userId: c.id, blocked: true }, "Account blocked.", "Blocked customer account"); }}>Block account</button>}
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>Verify identity first (registered email plus last invoice or event name). The customer gets the standard reset email; no password is ever shown here.{!admin && " Blocking is done by a super admin."}</p>
          </div>}
          {SUPABASE_AUTH ? <div className="card">
            <h3>Subscription</h3>
            <p style={{ margin: 0 }}>{c.sub?.status === "trialing" ? "Free trial" : c.sub?.status && c.sub.status !== "none" ? c.sub.status.replace("_", " ") : "No plan or trial"}{c.sub?.cycle ? ` · billed ${c.sub.cycle}` : ""}{c.sub?.type === "supplier" ? " · supplier account" : ""}</p>
            {c.sub?.trialEnd ? <p className="muted small" style={{ marginBottom: 0 }}>Trial ends {fmtDate(c.sub.trialEnd)}</p> : null}
            {c.sub?.periodEnd ? <p className="muted small" style={{ marginBottom: 0 }}>Current period ends {fmtDate(c.sub.periodEnd)}</p> : null}
            <p className="muted small" style={{ marginBottom: 0 }}>Payments are handled in Stripe.</p>
          </div> : <div className="card">
            <h3>Account actions</h3>
            <div className="row">
              <button onClick={reset}>Reset password</button>
              {c.status !== "active" && <button className="ghost" onClick={unblock}>Unblock / unlock account</button>}
              {admin && c.status === "active" && <button className="danger" onClick={block}>Block account</button>}
            </div>
            {c.tempPassword && <div className="warn" style={{ marginTop: 10 }}>Temporary password: <b className="mono">{c.tempPassword}</b> <Copy text={c.tempPassword} /><div className="small">Issued {fmtDate(c.tempPasswordAt)}. Clear it once you have shared it.</div><button className="ghost sm" style={{ marginTop: 6 }} onClick={() => patch((x) => { x.tempPassword = ""; }, "Cleared temporary password display")}>Hide it</button></div>}
            {!admin && <p className="muted small" style={{ marginBottom: 0 }}>Blocking accounts and refunds are done by a super admin.</p>}
          </div>}
          <div className="card">
            <h3>Requests from this customer</h3>
            {tasks.length ? tasks.map((t) => <div key={t.id} className="row between" style={{ padding: "3px 0" }}><span><a className="mono" href={"#/tasks/" + t.id}>{t.id}</a> {t.title}</span><span className="badge">{t.status.replace("_", " ")}</span></div>) : <p className="muted" style={{ margin: 0 }}>None.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Guide the customer</h3>
          {GUIDES.map(([t, body]) => <details key={t} style={{ padding: "4px 0" }}><summary><b>{t}</b></summary><p style={{ margin: "6px 0" }}>{body}</p><Copy text={body} label="Copy answer" /></details>)}
        </div>
      </div>
      {!SUPABASE_AUTH && <div className="card" style={{ marginTop: 14 }}>
        <h3>Payment history</h3>
        {c.payments.length === 0 ? <p className="muted">No payments yet (no plan or trial in progress).</p> : (
          <table>
            <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Note</th><th /></tr></thead>
            <tbody>
              {c.payments.map((p) => (
                <tr key={p.id}>
                  <td className="small">{fmtDate(p.at)}</td><td>{p.plan}</td><td>{money(p.amount)}</td><td className="small">{p.method}</td>
                  <td><span className="badge" style={p.status === "paid" ? { background: "#dcf3e8", color: "#1f7a52" } : p.status === "failed" ? { background: "#fde3e8", color: "#a3304a" } : p.status === "pending" ? { background: "#fff1d6", color: "#7a5200" } : undefined}>{p.status}</span></td>
                  <td className="small">{p.issue}</td>
                  <td><div className="row" style={{ flexWrap: "nowrap" }}>
                    {(p.status === "failed" || p.status === "pending") && <><button className="ghost sm" onClick={() => retry(p.id)}>Retry</button><button className="ghost sm" onClick={() => escalate(p.id)}>Escalate</button></>}
                    {admin && p.status === "paid" && <button className="ghost sm" onClick={() => refund(p.id)}>Refund</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}
    </>
  );
}
