import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { changePassword, checkCode, checkCredentials, setSupabasePassword, signInSupabase } from "./auth";
import { SUPABASE_AUTH, supabase } from "./supabase";
import { otpauthUri, totpAt, totpStep } from "./crypto";
import { DEMO_PASSWORD, getState, resetAll, ROLE_LABEL, type Staff } from "./store";
import { Copy, Logo } from "./ui";
import { Lock } from "./icons";

type Step = "creds" | "change" | "enroll" | "code";

export default function Login({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("creds");
  const [who, setWho] = useState<Staff | null>(null);
  const [f, setF] = useState({ email: "", pw: "", code: "", np: "", np2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const next = (m: Staff) => setStep(m.mustChangePassword ? "change" : m.totpEnrolled ? "code" : "enroll");

  const creds = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    if (SUPABASE_AUTH) {
      const r = await signInSupabase(f.email, f.pw);
      setBusy(false);
      if (typeof r === "object") { set("pw", ""); return setErr(r.error); }
      if (r === "change") return setStep("change");
      return onDone();
    }
    const r = await checkCredentials(f.email, f.pw);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setWho(r.staff); next(r.staff);
  };
  const change = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (f.np !== f.np2) return setErr("The two passwords do not match.");
    setBusy(true);
    if (SUPABASE_AUTH) {
      const bad = await setSupabasePassword(f.np);
      setBusy(false);
      if (bad) return setErr(bad);
      return onDone();
    }
    const r = await changePassword(who!.id, f.pw, f.np);
    setBusy(false);
    if (r) return setErr(r);
    const fresh = getState().staff.find((m) => m.id === who!.id)!;
    setWho(fresh); setF((x) => ({ ...x, pw: x.np })); next(fresh);
  };
  const code = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await checkCode(who!.id, f.code, step === "enroll");
    setBusy(false);
    if (r) { set("code", ""); return setErr(r); }
    onDone();
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "min(440px, 100%)", display: "grid", gap: 14 }}>
        <div className="card">
          <div className="row" style={{ marginBottom: 6 }}><Logo height={30} /><b style={{ fontSize: "1.1rem" }}>· Staff</b></div>
          <p className="muted small" style={{ marginTop: 0 }}>Authorized employees only. Access is logged.</p>

          {step === "creds" && (
            <form onSubmit={creds} className="grid" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>Sign in</h2>
              <div><label htmlFor="em">Work email</label><input id="em" type="email" autoComplete="username" required value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required value={f.pw} onChange={(e) => set("pw", e.target.value)} /></div>
              {err && <div className="alert" role="alert">{err}</div>}
              <button disabled={busy}><Lock size={15} /> {busy ? "Checking…" : "Continue"}</button>
            </form>
          )}

          {step === "change" && (
            <form onSubmit={change} className="grid" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>Choose a new password</h2>
              <p className="muted small" style={{ margin: 0 }}>Your account was created or reset by an administrator. Set a personal password: 12+ characters with upper and lower case, a number and a symbol.</p>
              <div><label htmlFor="np">New password</label><input id="np" type="password" autoComplete="new-password" required value={f.np} onChange={(e) => set("np", e.target.value)} /></div>
              <div><label htmlFor="np2">Repeat new password</label><input id="np2" type="password" autoComplete="new-password" required value={f.np2} onChange={(e) => set("np2", e.target.value)} /></div>
              {err && <div className="alert" role="alert">{err}</div>}
              <button disabled={busy}>Save password</button>
            </form>
          )}

          {(step === "enroll" || step === "code") && who && (
            <form onSubmit={code} className="grid" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>{step === "enroll" ? "Set up your authenticator" : "Two-step verification"}</h2>
              {step === "enroll" ? <Enroll staff={who} /> : <p className="muted small" style={{ margin: 0 }}>Open your authenticator app and enter the 6-digit code for <b>{who.email}</b>.</p>}
              <div><label htmlFor="cd">6-digit code</label><input id="cd" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus required value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
              {err && <div className="alert" role="alert">{err}</div>}
              <button disabled={busy}>{step === "enroll" ? "Verify and sign in" : "Verify"}</button>
            </form>
          )}
          {step !== "creds" && <p style={{ marginBottom: 0 }}><a href="#/" onClick={(e) => { e.preventDefault(); if (SUPABASE_AUTH) void supabase.auth.signOut(); setStep("creds"); setWho(null); setErr(""); setF({ email: "", pw: "", code: "", np: "", np2: "" }); }}>← Use a different account</a></p>}
        </div>
        {import.meta.env.DEV && !SUPABASE_AUTH && <DevBox onPick={(email) => { set("email", email); set("pw", DEMO_PASSWORD); }} />}
      </div>
    </div>
  );
}

function Enroll({ staff }: { staff: Staff }) {
  const [qr, setQr] = useState("");
  const uri = otpauthUri(staff.email, staff.totpSecret);
  useEffect(() => { QRCode.toDataURL(uri, { margin: 1, width: 180 }).then(setQr); }, [uri]);
  return (
    <div className="grid" style={{ gap: 8 }}>
      <p className="muted small" style={{ margin: 0 }}>Scan this QR with Google Authenticator, Authy, 1Password or Microsoft Authenticator, then enter the code it shows.</p>
      <div className="row" style={{ alignItems: "flex-start" }}>
        {qr && <img src={qr} width={180} height={180} alt="Authenticator QR code" style={{ background: "#fff", borderRadius: 8 }} />}
        <div className="grow"><label>Or enter this key manually</label><div className="mono" style={{ wordBreak: "break-all" }}>{staff.totpSecret}</div><Copy text={staff.totpSecret} label="Copy key" /></div>
      </div>
    </div>
  );
}

/** Development-only helper (stripped from production builds): demo accounts and the live authenticator code, so the prototype can be tried without a phone. */
function DevBox({ onPick }: { onPick: (email: string) => void }) {
  const staff = getState().staff;
  const [id, setId] = useState(staff[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const m = staff.find((x) => x.id === id);
    const tick = () => { if (m) totpAt(m.totpSecret, totpStep()).then(setCode); setLeft(30 - Math.floor((Date.now() / 1000) % 30)); };
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [id, staff]);
  return (
    <div className="devbox">
      <b>Prototype demo only</b> <span className="muted">(hidden in production builds)</span>
      <div className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}>
        <select aria-label="Demo account" value={id} onChange={(e) => { setId(e.target.value); const m = staff.find((x) => x.id === e.target.value); if (m) onPick(m.email); }}>
          {staff.map((m) => <option key={m.id} value={m.id}>{ROLE_LABEL[m.role]} — {m.email}</option>)}
        </select>
        <button className="ghost sm" type="button" onClick={() => onPick(staff.find((x) => x.id === id)!.email)}>Fill</button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>Authenticator code now: <b className="mono">{code}</b> <span className="muted">({left}s)</span><span className="grow" /><button className="ghost sm" type="button" onClick={() => { if (confirm("Reset all demo data?")) resetAll(); }}>Reset data</button></div>
    </div>
  );
}
