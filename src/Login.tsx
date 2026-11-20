import { useState } from "react";
import { useT } from "./i18n";
import { enterWorkspace, getState, go, isLocalHost, TEST_USERS, testPlannerId, update, useStore } from "./store";
import { authErrorKey, cloudResend, cloudSignIn } from "./cloud";
import { LangSwitch, Logo, ThemeToggle } from "./shared";
import { sendRequest } from "./bridge";

/** Log in with e-mail (planners, suppliers) or the user ID created by the planner . No social sign-in. */
export default function Login() {
  const { t } = useT();
  const s = useStore();
  const [f, setF] = useState({ id: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resend, setResend] = useState<"" | "ok" | "err">("");
  const [help, setHelp] = useState<{ open: boolean; name: string; msg: string; state: "" | "busy" | "need" | "fail"; ref: string }>({ open: false, name: "", msg: "", state: "", ref: "" });
  const sendHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = f.id.trim().toLowerCase();
    if (!help.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !help.msg.trim()) return setHelp({ ...help, state: "need" });
    setHelp({ ...help, state: "busy" });
    const ref = await sendRequest({ kind: "support", title: "Cannot sign in", description: help.msg.trim().slice(0, 2000) + "\n\n(Sent from the sign-in screen; the person is not signed in. Sign-in message: " + err + ")", customerName: help.name.trim().slice(0, 120), customerEmail: email });
    setHelp(ref ? { ...help, state: "", ref } : { ...help, state: "fail" });
  };
  const blocked = err === t("login.err.blocked"); // the contact form is only for blocked accounts
  const unconfirmed = err === t("login.err.unconfirmed") && !!f.id.trim();
  const sendAgain = async () => { const { error } = await cloudResend(f.id.trim().toLowerCase()); setResend(error ? "err" : "ok"); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = f.id.trim().toLowerCase();
    if (!id || !f.pw) return setErr(t("login.err"));
    const acct = isLocalHost ? s.accounts.find((a) => a.email.toLowerCase() === id && !a.id.startsWith("sb:")) : undefined; // built-in test accounts: developer machines only
    const member = isLocalHost ? s.team.find((x) => x.email.toLowerCase() === id) : undefined; // collaborators and clients: prototype logins, real accounts come next
    if (!acct && !member) { // real account (Supabase)
      setBusy(true); setErr(""); setResend("");
      const { error } = await cloudSignIn(id, f.pw);
      setBusy(false);
      if (error) setErr(t(authErrorKey(error)));
      return; // on success the app signs in by itself and moves on
    }
    if (acct) {
      if (acct.password !== f.pw) return setErr(t("login.err.bad"));
      if (!acct.confirmed) return setErr(t("login.err.unconfirmed"));
      enterWorkspace(acct.id);
      update((st) => { st.loggedIn = true; st.sessionId = acct.id; st.viewAs = ""; st.userName = acct.name; st.userEmail = acct.email; st.accountType = acct.accountType; });
      return go(!acct.profile ? "/welcome" : !acct.accountType ? "/choose-type" : "/app");
    }
    enterWorkspace(testPlannerId()); // team members and clients live inside their planner's data
    const team = getState().team;
    const pending = team.find((x) => x.email.toLowerCase() === id && !x.password);
    if (pending) return setErr(t("login.err.pending"));
    const m = team.find((x) => x.password && x.email.toLowerCase() === id && x.password === f.pw);
    if (!m) return setErr(t("login.err.bad"));
    if (m.mustChange) { try { sessionStorage.setItem("aplan-tp", f.pw); } catch { /* ignore */ } return go("/access/" + m.token); } // temporary password: choose a new one first
    update((st) => { st.loggedIn = true; st.sessionId = "member:" + m.id; st.viewAs = m.id; st.accountType = "planner"; m.lastLogin = Date.now(); });
    go("/app");
  };
  const users: [keyof typeof TEST_USERS, string][] = [["planner", "test.planner"], ["supplier", "test.supplier"], ["client", "test.client"], ["collaborator", "test.collaborator"]];
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: 440, maxWidth: "100%" }}>
        <div className="row between"><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        <h2 style={{ marginTop: 16 }}>{t("login.title")}</h2>
        <form onSubmit={submit} className="grid" style={{ gap: 12 }}>
          <div><label htmlFor="li">{t("login.id")}</label><input id="li" autoFocus value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} autoComplete="username" autoCapitalize="none" /></div>
          <div><label htmlFor="lp">{t("password")}</label><input id="lp" type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} autoComplete="current-password" /></div>
          {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
          {unconfirmed && resend !== "ok" && <p style={{ margin: 0 }}><a href="#/login" onClick={(e) => { e.preventDefault(); void sendAgain(); }}>{t("login.resend")}</a></p>}
          {resend === "ok" && <p role="status" className="small" style={{ color: "var(--teal)", margin: 0 }}>{t("login.resent")}</p>}
          {resend === "err" && <p role="alert" className="small" style={{ color: "var(--danger)", margin: 0 }}>{t("auth.err.rate")}</p>}
          <button type="submit" disabled={busy}>{busy ? "…" : t("login")}</button>
        </form>
        {blocked && !help.open && <p style={{ textAlign: "center", margin: "0 0 8px" }}><a href="#/login" onClick={(e) => { e.preventDefault(); setHelp({ ...help, open: true }); }}>{t("login.help.link")}</a></p>}
        {blocked && help.open && (help.ref
          ? <p role="status" className="small" style={{ color: "var(--teal)" }}>{t("login.help.sent").replace("{ref}", help.ref)}</p>
          : <form onSubmit={sendHelp} className="grid" style={{ gap: 10, margin: "4px 0 12px" }}>
              <h3 style={{ margin: 0 }}>{t("login.help.title")}</h3>
              <div><label htmlFor="hn">{t("login.help.name")}</label><input id="hn" value={help.name} onChange={(e) => setHelp({ ...help, name: e.target.value })} autoComplete="name" /></div>
              <div><label htmlFor="he">{t("login.help.email")}</label><input id="he" type="email" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} autoComplete="email" /></div>
              <div><label htmlFor="hm">{t("login.help.msg")}</label><textarea id="hm" rows={3} maxLength={2000} value={help.msg} onChange={(e) => setHelp({ ...help, msg: e.target.value })} /></div>
              {help.state === "need" && <p role="alert" className="small" style={{ color: "var(--danger)", margin: 0 }}>{t("login.help.need")}</p>}
              {help.state === "fail" && <p role="alert" className="small" style={{ color: "var(--danger)", margin: 0 }}>{t("login.help.fail")}</p>}
              <button type="submit" disabled={help.state === "busy"}>{help.state === "busy" ? "…" : t("login.help.send")}</button>
            </form>)}
        <p style={{ textAlign: "center", margin: "0 0 8px" }}><a href="#/forgot">{t("forgot.link")}</a></p>
        <p style={{ textAlign: "center", marginBottom: 0 }}><span className="muted">{t("auth.new")}</span> <a href="#/join">{t("signup")}</a></p>
        {isLocalHost && <><hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
        <div className="muted small" style={{ marginBottom: 6 }}>{t("login.test")}</div>
        {users.map(([k, label]) => (
          <div key={k} className="row between testuser" style={{ flexWrap: "nowrap" }}>
            <span style={{ minWidth: 0 }}><b>{t(label)}</b><br /><code className="small">{TEST_USERS[k].login}</code> · <code className="small">{TEST_USERS[k].password}</code></span>
            <button type="button" className="ghost sm" onClick={() => { setF({ id: TEST_USERS[k].login, pw: TEST_USERS[k].password }); setErr(""); }}>{t("login.use")}</button>
          </div>
        ))}
        <p className="muted small" style={{ marginBottom: 0 }}>{t("login.note")}</p></>}
      </div>
    </div>
  );
}
