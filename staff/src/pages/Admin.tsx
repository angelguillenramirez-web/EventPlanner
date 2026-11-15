import { useState } from "react";
import { hashPassword, newTotpSecret, passwordIssues, randomPassword } from "../crypto";
import { createTask, log, ROLE_LABEL, ROLES, uid, update, useStore, type ApiKey, type Config, type Role, type Staff } from "../store";
import { Copy, fmtDate, Tabs } from "../ui";

const TABS: [string, string][] = [["/admin/users", "Staff & roles"], ["/admin/pricing", "Plans & prices"], ["/admin/apis", "API keys"], ["/admin/webmaster", "Web master"], ["/admin/webdesign", "Web design"], ["/admin/intake", "Request intake"], ["/admin/audit", "Audit log"]];

/** Super admin only: controls everything about the Event Planner platform. */
export default function Admin({ me, route }: { me: Staff; route: string }) {
  if (me.role !== "super_admin") return <div className="card"><h2>No access</h2></div>;
  const cur = TABS.find(([h]) => route.startsWith(h))?.[0] ?? "/admin/users";
  return (
    <>
      <h1>Platform control</h1>
      <Tabs items={TABS} cur={cur} />
      {cur === "/admin/users" && <Users me={me} />}
      {cur === "/admin/pricing" && <Pricing me={me} />}
      {cur === "/admin/apis" && <Apis me={me} />}
      {cur === "/admin/webmaster" && <WebMaster me={me} />}
      {cur === "/admin/webdesign" && <WebDesign me={me} />}
      {cur === "/admin/intake" && <Intake />}
      {cur === "/admin/audit" && <AuditLog />}
    </>
  );
}

const saveConfig = (me: Staff, what: string, fn: (c: Config) => void) => { update((s) => fn(s.config)); log(me.name, "Changed " + what); };

// ───────── Users ─────────
function Users({ me }: { me: Staff }) {
  const s = useStore();
  const [f, setF] = useState({ name: "", email: "", role: "support" as Role });
  const [err, setErr] = useState("");
  const [shown, setShown] = useState<{ email: string; pw: string; what: string } | null>(null);
  const activeAdmins = s.staff.filter((m) => m.active && m.role === "super_admin").length;

  const withTemp = async (id: string, what: string, extra?: (m: Staff) => void) => {
    const pw = randomPassword();
    const { salt, hash } = await hashPassword(pw);
    update((st) => { const m = st.staff.find((x) => x.id === id)!; m.salt = salt; m.hash = hash; m.mustChangePassword = true; m.failed = 0; m.lockedUntil = 0; extra?.(m); });
    const m = s.staff.find((x) => x.id === id)!;
    log(me.name, what, m.email);
    setShown({ email: m.email, pw, what });
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const email = f.email.trim().toLowerCase();
    if (s.staff.some((m) => m.email === email)) return setErr("That email already has an account.");
    const pw = randomPassword();
    const { salt, hash } = await hashPassword(pw);
    update((st) => { st.staff.push({ id: uid(), name: f.name.trim(), email, role: f.role, active: true, salt, hash, avatar: "", title: "", presence: "offline", presenceNote: "", presenceAt: Date.now(), mustChangePassword: true, totpSecret: newTotpSecret(), totpEnrolled: false, lastTotpStep: 0, failed: 0, lockedUntil: 0, lastLogin: 0, createdAt: Date.now() }); });
    log(me.name, `Created ${ROLE_LABEL[f.role]} account`, email);
    setShown({ email, pw, what: "Account created" });
    setF({ name: "", email: "", role: "support" });
  };
  const setRole = (m: Staff, role: Role) => {
    if (m.role === "super_admin" && role !== "super_admin" && activeAdmins <= 1) return alert("There must be at least one active super admin.");
    update((st) => { st.staff.find((x) => x.id === m.id)!.role = role; }); log(me.name, `Changed role to ${ROLE_LABEL[role]}`, m.email);
  };
  const toggle = (m: Staff) => {
    if (m.id === me.id) return alert("You cannot deactivate your own account.");
    if (m.active && m.role === "super_admin" && activeAdmins <= 1) return alert("There must be at least one active super admin.");
    update((st) => { const x = st.staff.find((y) => y.id === m.id)!; x.active = !x.active; }); log(me.name, m.active ? "Deactivated account" : "Reactivated account", m.email);
  };
  const reset2fa = (m: Staff) => { if (!confirm(`Reset the authenticator for ${m.email}? They will have to enroll a new one at next sign-in.`)) return; update((st) => { const x = st.staff.find((y) => y.id === m.id)!; x.totpSecret = newTotpSecret(); x.totpEnrolled = false; x.lastTotpStep = 0; }); log(me.name, "Reset authenticator (2FA)", m.email); };
  const unlock = (m: Staff) => { update((st) => { const x = st.staff.find((y) => y.id === m.id)!; x.lockedUntil = 0; x.failed = 0; }); log(me.name, "Unlocked staff account", m.email); };

  return (
    <div className="grid">
      {shown && <div className="warn" role="status"><b>{shown.what}:</b> {shown.email}<br />Temporary password <b className="mono">{shown.pw}</b> <Copy text={shown.pw} /> — shown only once. They must change it at first sign-in{shown.what === "Account created" ? " and set up their authenticator app" : ""}. Send it over a secure channel. <button className="ghost sm" onClick={() => setShown(null)}>Done</button></div>}
      <form className="card form" onSubmit={create}>
        <div><label htmlFor="un">Full name</label><input id="un" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="ue">Work email</label><input id="ue" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label htmlFor="ur">Profile</label><select id="ur" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
        <div><button>Create account</button></div>
        {err && <div className="full alert">{err}</div>}
      </form>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Employee</th><th>Profile</th><th>2FA</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
          <tbody>
            {s.staff.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b><div className="muted small">{m.email}</div></td>
                <td><select aria-label={`Profile of ${m.name}`} style={{ width: "auto" }} value={m.role} disabled={m.id === me.id} onChange={(e) => setRole(m, e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                <td>{m.totpEnrolled ? "enrolled" : <span className="badge b-in_progress">pending</span>}</td>
                <td className="small">{fmtDate(m.lastLogin)}</td>
                <td>{!m.active ? <span className="badge b-waiting">inactive</span> : m.lockedUntil > Date.now() ? <span className="badge b-late">locked</span> : <span className="badge b-done">active</span>}{m.mustChangePassword && <span className="badge" style={{ marginLeft: 4 }}>temp password</span>}</td>
                <td><div className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="ghost sm" onClick={() => withTemp(m.id, "Password reset")}>Reset password</button>
                  <button className="ghost sm" onClick={() => reset2fa(m)}>Reset 2FA</button>
                  {m.lockedUntil > Date.now() && <button className="ghost sm" onClick={() => unlock(m)}>Unlock</button>}
                  <button className={`sm ${m.active ? "danger" : "ghost"}`} onClick={() => toggle(m)}>{m.active ? "Deactivate" : "Reactivate"}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginBottom: 0 }}>Password rules for personal passwords: {passwordIssues("").join(", ")}.</p>
      </div>
    </div>
  );
}

// ───────── Pricing ─────────
function Pricing({ me }: { me: Staff }) {
  const s = useStore();
  const [d, setD] = useState(() => structuredClone(s.config.plans));
  const [ok, setOk] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(s.config.plans);
  const save = () => { if (Object.values(d).some((p) => !(p.monthly >= 0) || !(p.yearly >= 0))) return; saveConfig(me, "plan prices", (c) => { c.plans = structuredClone(d); }); setOk(true); setTimeout(() => setOk(false), 2000); };
  return (
    <div className="card">
      <h3>Plans & prices (USD)</h3>
      <p className="muted small">These prices are published to the Event Planner platform and its landing page.</p>
      <table>
        <thead><tr><th>Plan</th><th>Monthly</th><th>Yearly</th><th>Yearly saving</th></tr></thead>
        <tbody>{Object.entries(d).map(([k, p]) => (
          <tr key={k}><td><b>{p.name}</b></td>
            <td><input type="number" min={0} step="0.01" aria-label={`${p.name} monthly`} style={{ width: 110 }} value={p.monthly} onChange={(e) => setD({ ...d, [k]: { ...p, monthly: Number(e.target.value) } })} /></td>
            <td><input type="number" min={0} step="0.01" aria-label={`${p.name} yearly`} style={{ width: 110 }} value={p.yearly} onChange={(e) => setD({ ...d, [k]: { ...p, yearly: Number(e.target.value) } })} /></td>
            <td className="muted">{p.monthly > 0 ? `${Math.round((1 - p.yearly / (p.monthly * 12)) * 100)}%` : "—"}</td></tr>
        ))}</tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}><button disabled={!dirty} onClick={save}>Save prices</button>{ok && <span role="status" style={{ color: "var(--green)" }}>Saved</span>}</div>
    </div>
  );
}

// ───────── API keys ─────────
function Apis({ me }: { me: Staff }) {
  const s = useStore();
  const [f, setF] = useState({ name: "", service: "", secret: "" });
  const [rot, setRot] = useState<{ id: string; secret: string } | null>(null);
  const last4 = (v: string) => v.trim().slice(-4);
  const add = (e: React.FormEvent) => { e.preventDefault(); saveConfig(me, "API keys (added " + f.name + ")", (c) => { c.apiKeys.push({ id: uid(), name: f.name.trim(), service: f.service.trim(), last4: last4(f.secret), status: "active", createdAt: Date.now(), rotatedAt: 0 }); }); setF({ name: "", service: "", secret: "" }); };
  const doRotate = (k: ApiKey) => { if (!rot || rot.secret.trim().length < 8) return; saveConfig(me, "API keys (rotated " + k.name + ")", (c) => { const x = c.apiKeys.find((y) => y.id === k.id)!; x.last4 = last4(rot.secret); x.rotatedAt = Date.now(); x.status = "active"; }); setRot(null); };
  const revoke = (k: ApiKey) => { if (confirm(`Revoke "${k.name}"? Features that use it stop working.`)) saveConfig(me, "API keys (revoked " + k.name + ")", (c) => { c.apiKeys.find((y) => y.id === k.id)!.status = "revoked"; }); };
  return (
    <div className="grid">
      <div className="warn">This prototype keeps only a label and the last 4 characters of each key. Never store the full secret in the browser: in production the keys live in a server-side secret manager and this screen only rotates and revokes them.</div>
      <form className="card form" onSubmit={add}>
        <div><label htmlFor="kn">Name</label><input id="kn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="ks">Service</label><input id="ks" required placeholder="Email provider, WhatsApp, payments…" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} /></div>
        <div><label htmlFor="kv">Key (only last 4 kept)</label><input id="kv" type="password" autoComplete="off" required minLength={8} value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} /></div>
        <div><button>Add key</button></div>
      </form>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Name</th><th>Service</th><th>Key</th><th>Created</th><th>Last rotated</th><th>Status</th><th /></tr></thead>
          <tbody>{s.config.apiKeys.map((k) => (
            <tr key={k.id}><td><b>{k.name}</b></td><td>{k.service}</td><td className="mono">••••••••{k.last4}</td><td className="small">{fmtDate(k.createdAt)}</td><td className="small">{fmtDate(k.rotatedAt)}</td>
              <td><span className={`badge ${k.status === "active" ? "b-done" : "b-waiting"}`}>{k.status}</span></td>
              <td>{rot?.id === k.id
                ? <div className="row" style={{ flexWrap: "nowrap" }}><input type="password" autoComplete="off" aria-label="New key" style={{ width: 160 }} value={rot.secret} onChange={(e) => setRot({ id: k.id, secret: e.target.value })} /><button className="sm" onClick={() => doRotate(k)}>Save</button><button className="ghost sm" onClick={() => setRot(null)}>Cancel</button></div>
                : <div className="row" style={{ flexWrap: "nowrap" }}><button className="ghost sm" onClick={() => setRot({ id: k.id, secret: "" })}>Rotate</button>{k.status === "active" && <button className="danger sm" onClick={() => revoke(k)}>Revoke</button>}</div>}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ───────── Web master ─────────
function WebMaster({ me }: { me: Staff }) {
  const s = useStore();
  const [d, setD] = useState(s.config.web);
  const dirty = JSON.stringify(d) !== JSON.stringify(s.config.web);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });
  const save = () => { if (d.maintenance !== s.config.web.maintenance && d.maintenance && !confirm("Turn on maintenance mode? Customers will see a maintenance page.")) return; saveConfig(me, "web master settings", (c) => { c.web = { ...d }; }); };
  return (
    <div className="card form">
      <div className="full row"><label className="row" style={{ margin: 0, fontSize: ".9rem", color: "var(--ink)" }}><input type="checkbox" checked={d.maintenance} onChange={(e) => set("maintenance", e.target.checked)} /> Maintenance mode (the public site and customer app show a maintenance page)</label></div>
      <div className="full"><label htmlFor="wb">Site-wide announcement banner (empty = none)</label><input id="wb" value={d.banner} onChange={(e) => set("banner", e.target.value)} /></div>
      <div className="full"><label htmlFor="wt">SEO title</label><input id="wt" value={d.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></div>
      <div className="full"><label htmlFor="wd">SEO description</label><textarea id="wd" rows={2} value={d.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></div>
      <div><label htmlFor="wa">Analytics ID</label><input id="wa" value={d.analyticsId} onChange={(e) => set("analyticsId", e.target.value)} /></div>
      <div className="full"><button disabled={!dirty} onClick={save}>Save web settings</button></div>
    </div>
  );
}

// ───────── Web design ─────────
function WebDesign({ me }: { me: Staff }) {
  const s = useStore();
  const [d, setD] = useState(s.config.design);
  const dirty = JSON.stringify(d) !== JSON.stringify(s.config.design);
  const set = (k: keyof typeof d, v: string) => setD({ ...d, [k]: v });
  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <div className="card form">
        <div><label htmlFor="dp">Primary colour</label><input id="dp" type="color" value={d.primary} onChange={(e) => set("primary", e.target.value)} /></div>
        <div><label htmlFor="da">Accent colour</label><input id="da" type="color" value={d.accent} onChange={(e) => set("accent", e.target.value)} /></div>
        <div className="full"><label htmlFor="dh">Hero title</label><input id="dh" value={d.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} /></div>
        <div className="full"><label htmlFor="ds">Hero subtitle</label><textarea id="ds" rows={2} value={d.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} /></div>
        <div><label htmlFor="dc">Button label</label><input id="dc" value={d.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} /></div>
        <div className="full"><button disabled={!dirty} onClick={() => saveConfig(me, "web design", (c) => { c.design = { ...d }; })}>Publish design</button></div>
      </div>
      <div className="card" style={{ textAlign: "center", padding: 36 }}>
        <div className="muted small" style={{ marginBottom: 10 }}>Live preview of the landing hero</div>
        <h1 style={{ fontSize: "2rem", color: d.primary }}>{d.heroTitle}</h1>
        <p className="muted">{d.heroSubtitle}</p>
        <span className="btn" style={{ background: d.primary, borderColor: d.primary, color: "#0c2a25" }}>{d.ctaLabel}</span>
        <div style={{ height: 6, width: 80, background: d.accent, margin: "22px auto 0", borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ───────── Intake simulator ─────────
/** Stand-in for the connection with the Event Planner platform: customer requests arrive here as tasks. */
function Intake() {
  const s = useStore();
  const [last, setLast] = useState("");
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const sup = ["I can't sign in", "Where is my invoice?", "How do I add guests from Excel?", "Payment declined on renewal", "Change the email of my account"];
  const des = ["Custom invitation for my birthday", "Update names on my invitation", "Matching save-the-date", "Invitation in Portuguese"];
  const send = (kind: "support" | "design") => {
    const c = pick(s.customers);
    const t = createTask({ kind, title: pick(kind === "support" ? sup : des), description: "Submitted from the Event Planner platform (simulated).", requester: `${c.name} <${c.email}>`, customerId: c.id, priority: pick(["low", "normal", "normal", "high"] as const) });
    const who = s.staff.find((m) => m.id === t.assigneeId)?.name;
    setLast(`${t.id} created and ${who ? "assigned to " + who : "left in the team queue"}.`);
  };
  return (
    <div className="card">
      <h3>Request intake (prototype)</h3>
      <p className="muted">When a customer uses the support widget or orders a custom design in the Event Planner platform, a request arrives here, gets a unique task ID and is auto-assigned by team scope. Until the two platforms are connected through an API, use these buttons to simulate that.</p>
      <div className="row"><button onClick={() => send("support")}>Simulate support request</button><button onClick={() => send("design")}>Simulate design request</button></div>
      {last && <div className="okbox" role="status" style={{ marginTop: 10 }}>{last}</div>}
    </div>
  );
}

function AuditLog() {
  const s = useStore();
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <h3>Audit log (latest 500)</h3>
      <table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr></thead>
        <tbody>{s.audit.map((a) => <tr key={a.id}><td className="small">{fmtDate(a.at)}</td><td>{a.by}</td><td>{a.action}</td><td className="small">{a.target}</td></tr>)}</tbody></table>
    </div>
  );
}
