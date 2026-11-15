import { useState } from "react";
import { useT } from "./i18n";
import { go, TEST_USERS, update, useStore } from "./store";
import { LangSwitch, Logo, ThemeToggle } from "./shared";

/** Log in with e-mail (planners, suppliers) or the user ID created by the planner . No social sign-in. */
export default function Login() {
  const { t } = useT();
  const s = useStore();
  const [f, setF] = useState({ id: "", pw: "" });
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = f.id.trim().toLowerCase();
    if (!id || !f.pw) return setErr(t("login.err"));
    const acct = s.accounts.find((a) => a.email.toLowerCase() === id);
    if (acct) {
      if (acct.password !== f.pw) return setErr(t("login.err.bad"));
      if (!acct.confirmed) return setErr(t("login.err.unconfirmed"));
      update((st) => { st.loggedIn = true; st.sessionId = acct.id; st.viewAs = ""; st.userName = acct.name; st.userEmail = acct.email; st.accountType = acct.accountType; });
      return go(!acct.profile ? "/welcome" : !acct.accountType ? "/choose-type" : "/app");
    }
    const pending = s.team.find((x) => x.email.toLowerCase() === id && !x.password);
    if (pending) return setErr(t("login.err.pending"));
    const m = s.team.find((x) => x.password && x.email.toLowerCase() === id && x.password === f.pw);
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
          {err && <p role="alert" style={{ color: "var(--rose)", margin: 0 }}>{err}</p>}
          <button type="submit">{t("login")}</button>
        </form>
        <p style={{ textAlign: "center", margin: "0 0 8px" }}><a href="#/forgot">{t("forgot.link")}</a></p>
        <p style={{ textAlign: "center", marginBottom: 0 }}><span className="muted">{t("auth.new")}</span> <a href="#/join">{t("signup")}</a></p>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
        <div className="muted small" style={{ marginBottom: 6 }}>{t("login.test")}</div>
        {users.map(([k, label]) => (
          <div key={k} className="row between testuser" style={{ flexWrap: "nowrap" }}>
            <span style={{ minWidth: 0 }}><b>{t(label)}</b><br /><code className="small">{TEST_USERS[k].login}</code> · <code className="small">{TEST_USERS[k].password}</code></span>
            <button type="button" className="ghost sm" onClick={() => { setF({ id: TEST_USERS[k].login, pw: TEST_USERS[k].password }); setErr(""); }}>{t("login.use")}</button>
          </div>
        ))}
        <p className="muted small" style={{ marginBottom: 0 }}>{t("login.note")}</p>
      </div>
    </div>
  );
}
