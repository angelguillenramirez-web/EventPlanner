import { useState } from "react";
import { useT } from "./i18n";
import { TRIAL_DAYS, go, newTrial, uid, update, useStore } from "./store";
import { Check } from "./icons";
import { LangSwitch, Logo, ThemeToggle } from "./shared";

export const Shell = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
    <div style={{ width: wide ? 920 : 520, maxWidth: "100%" }}>
      <div className="row between" style={{ marginBottom: 20 }}><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
      {children}
    </div>
  </div>
);

/** Step 1 and 2: free trial page with the registration form (name and email are required). */
export function Join() {
  const { t } = useT();
  const s = useStore();
  const [f, setF] = useState(() => { let p = { name: "", email: "" }; try { p = JSON.parse(sessionStorage.getItem("aplan-join") ?? "") ?? p; sessionStorage.removeItem("aplan-join"); } catch { /* ignore */ } return { name: p.name ?? "", email: p.email ?? "", company: "", pw: "", promo: "" }; });
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = f.email.trim().toLowerCase(), name = f.name.trim();
    if (!name || !email || !f.pw) return setErr(t("join.err.required"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr(t("join.err.email"));
    if (f.pw.length < 8) return setErr(t("auth.pwshort"));
    if (s.accounts.some((a) => a.email.toLowerCase() === email)) return setErr(t("join.err.exists"));
    const id = uid(), token = uid() + uid() + uid();
    update((st) => {
      st.accounts.push({ id, name, email, company: f.company.trim(), password: f.pw, promo: f.promo.trim(), token, confirmed: false, confirmedAt: 0, createdAt: Date.now(), profile: null, accountType: null });
      st.outbox.push({ id: uid(), to: email, subject: "confirm", token, at: Date.now() });
    });
    go(`/join/sent/${id}`);
  };
  return (
    <Shell wide>
      <div className="joingrid">
        <div>
          <span className="kicker">{t("plan.trialnote", { n: TRIAL_DAYS })}</span>
          <h1 style={{ marginTop: 6 }}>{t("join.title")}</h1>
          <p className="muted">{t("join.sub")}</p>
          <ul className="joinlist">{[1, 2, 3, 4].map((n) => <li key={n}><Check size={16} /> {t("join.b" + n)}</li>)}</ul>
        </div>
        <form className="card grid" style={{ gap: 12 }} onSubmit={submit} noValidate>
          <div><label htmlFor="jn">{t("auth.name")} *</label><input id="jn" autoFocus value={f.name} autoComplete="name" onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label htmlFor="je">{t("email")} *</label><input id="je" type="email" value={f.email} autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label htmlFor="jc">{t("join.company")}</label><input id="jc" value={f.company} autoComplete="organization" onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
          <div><label htmlFor="jp">{t("password")} *</label><input id="jp" type="password" value={f.pw} autoComplete="new-password" onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
          <div><label htmlFor="jr">{t("join.promo")}</label><input id="jr" value={f.promo} onChange={(e) => setF({ ...f, promo: e.target.value.toUpperCase() })} />{f.promo.trim() && <span className="small" style={{ color: "var(--teal)" }}>{t("join.promo.ok", { code: f.promo.trim() })}</span>}</div>
          {err && <p role="alert" style={{ color: "var(--rose)", margin: 0 }}>{err} {err === t("join.err.exists") && <a href="#/login">{t("login")}</a>}</p>}
          <button type="submit">{t("join.submit")}</button>
          <p className="muted small" style={{ margin: 0 }}>{t("join.terms")}</p>
          <p style={{ margin: 0, textAlign: "center" }}><span className="muted">{t("join.have")}</span> <a href="#/login">{t("login")}</a></p>
        </form>
      </div>
    </Shell>
  );
}

/** Step 3: "check your email". The prototype shows the message it would send, with the unique confirmation link. */
export function Sent({ id }: { id: string }) {
  const { t } = useT();
  const s = useStore();
  const acct = s.accounts.find((a) => a.id === id);
  const [again, setAgain] = useState(false);
  if (!acct) return <Shell><div className="card"><p>{t("conf.invalid")}</p><a href="#/join">{t("conf.signup")}</a></div></Shell>;
  return (
    <Shell>
      <div className="card" style={{ textAlign: "center" }}>
        <h2 style={{ marginTop: 0 }}>{t("sent.title")}</h2>
        <p>{t("sent.desc", { email: acct.email })}</p>
        <button className="ghost" onClick={() => { update((st) => { st.outbox.push({ id: uid(), to: acct.email, subject: "confirm", token: acct.token, at: Date.now() }); }); setAgain(true); }}>{t("sent.resend")}</button>
        {again && <p className="small" style={{ color: "var(--teal)", marginBottom: 0 }}>{t("sent.resent")}</p>}
      </div>
      <div className="card inbox" style={{ marginTop: 16 }}>
        <div className="muted small" style={{ marginBottom: 8 }}>{t("sent.demo")}</div>
        <div className="mail">
          <div className="small muted">To: {acct.email}</div>
          <b style={{ display: "block", margin: "2px 0 10px" }}>{t("sent.subject")}</b>
          <p style={{ margin: "0 0 14px" }}>{t("sent.body", { name: acct.name })}</p>
          <a className="mailbtn" href={`#/confirm/${acct.token}`}>{t("sent.btn")}</a>
          <div className="small muted" style={{ marginTop: 10, wordBreak: "break-all" }}>{location.origin}/#/confirm/{acct.token}</div>
        </div>
      </div>
    </Shell>
  );
}

/** The unique link from the email: confirms the address, signs the user in and starts the profile questions. */
export function Confirm({ token }: { token: string }) {
  const { t } = useT();
  const s = useStore();
  const acct = s.accounts.find((a) => a.token === token && token);
  const [done, setDone] = useState(false);
  if (acct && !done) {
    setDone(true);
    setTimeout(() => {
      update((st) => { const a = st.accounts.find((x) => x.id === acct.id)!; if (!a.confirmed) { a.confirmed = true; a.confirmedAt = Date.now(); st.sub = { ...newTrial("planner"), status: "none" }; st.card = null; } st.loggedIn = true; st.sessionId = a.id; st.viewAs = ""; st.userName = a.name; st.userEmail = a.email; st.accountType = a.accountType; });
      go(acct.profile ? (acct.accountType ? "/app" : "/choose-type") : "/welcome");
    }, 0);
  }
  return <Shell><div className="card" style={{ textAlign: "center" }}>{acct ? <p>…</p> : <><p>{t("conf.invalid")}</p><a href="#/join">{t("conf.signup")}</a></>}</div></Shell>;
}
