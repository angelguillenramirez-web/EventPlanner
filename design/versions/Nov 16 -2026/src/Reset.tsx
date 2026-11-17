import { useState } from "react";
import { useT } from "./i18n";
import { Shell } from "./Join";
import { RESET_MINUTES, isLocalHost, queueReset, update, useStore, type Mail } from "./store";
import { authErrorKey, cloudResetRequest, cloudSetPassword, isCloudId } from "./cloud";

/** The reset e-mail as the prototype "sends" it. */
export function ResetMail({ mail }: { mail: Mail }) {
  const { t, locale } = useT();
  const link = `${location.origin}${location.pathname}#/reset/${mail.token}`;
  return (
    <div className="mail" style={{ marginBottom: 12 }}>
      <div className="small muted">To: {mail.to} · {new Date(mail.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</div>
      <b style={{ display: "block", margin: "2px 0 10px" }}>{t("reset.mail.subject")}</b>
      <p style={{ margin: "0 0 12px" }}>{t("reset.mail.body", { name: mail.name ?? "", min: RESET_MINUTES })}</p>
      <a className="mailbtn" href={link}>{t("reset.mail.btn")}</a>
      <div className="small muted" style={{ marginTop: 10, wordBreak: "break-all" }}>{link}</div>
    </div>
  );
}

/** Whoever owns this e-mail (account owner or collaborator with an active password). */
const ownerOf = (s: ReturnType<typeof useStore>, email: string) => {
  const e = email.trim().toLowerCase();
  const a = s.accounts.find((x) => x.email.toLowerCase() === e && x.confirmed && !x.id.startsWith("sb:"));
  if (a) return a.name;
  const m = s.team.find((x) => x.email.toLowerCase() === e && x.password && x.status === "accepted");
  return m?.name ?? "";
};

/** "Forgot your password?": asks for the e-mail and sends a link. Nothing reveals whether the address exists. */
export function Forgot() {
  const { t } = useT();
  const s = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase(); if (!v) return;
    const name = isLocalHost ? ownerOf(s, v) : ""; // built-in test accounts and prototype collaborators (developer machines only)
    if (name) update((st) => { queueReset(st, v, name); });
    else await cloudResetRequest(v); // real accounts: Supabase e-mails the link (it never reveals whether the address exists)
    setSent(v);
  };
  const mail = sent ? [...s.outbox].reverse().find((m) => m.kind === "reset" && m.to === sent) : undefined;
  return (
    <Shell>
      {!sent ? (
        <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
          <div><h2 style={{ margin: 0 }}>{t("forgot.title")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{t("forgot.sub")}</p></div>
          <div><label htmlFor="fe">{t("email")}</label><input id="fe" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button type="submit">{t("forgot.send")}</button>
          <p className="muted small" style={{ margin: 0 }}>{t("reset.nomail")} <a href="#/login">{t("login")}</a></p>
        </form>
      ) : (
        <>
          <div className="card"><h2 style={{ marginTop: 0 }}>{t("forgot.sent")}</h2><p>{t("forgot.sent.sub", { email: sent, min: RESET_MINUTES })}</p><p className="muted small">{t("reset.nomail")}</p><a href="#/login">{t("login")}</a></div>
          {mail && <div className="card inbox" style={{ marginTop: 16 }}><div className="muted small" style={{ marginBottom: 8 }}>{t("sent.demo")}</div><ResetMail mail={mail} /></div>}
        </>
      )}
    </Shell>
  );
}

/** The link in the reset e-mail: choose a new password (valid one hour, used once). */
export function ResetPage({ token }: { token: string }) {
  const { t } = useT();
  const s = useStore();
  const mail = token ? s.outbox.find((m) => m.kind === "reset" && m.token === token) : undefined;
  const valid = !!mail && !mail.used && Date.now() - mail.at < RESET_MINUTES * 60000;
  const [f, setF] = useState({ pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <Shell><div className="card"><h2 style={{ marginTop: 0 }}>{t("reset.done")}</h2><a className="mailbtn" href="#/login">{t("login")}</a></div></Shell>;
  if (!mail || !valid) return <Shell><div className="card"><h2 style={{ marginTop: 0 }}>{t("reset.invalid")}</h2><p className="muted">{t("reset.invalid.sub")}</p><a href="#/forgot">{t("forgot.title")}</a></div></Shell>;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.pw.length < 8) return setErr(t("auth.pwshort"));
    if (f.pw !== f.pw2) return setErr(t("pw.nomatch"));
    update((st) => {
      const em = mail.to.toLowerCase();
      const a = st.accounts.find((x) => x.email.toLowerCase() === em), m = st.team.find((x) => x.email.toLowerCase() === em);
      if (a) a.password = f.pw; else if (m) { m.password = f.pw; m.mustChange = false; m.tempExpires = 0; }
      const o = st.outbox.find((x) => x.id === mail.id); if (o) o.used = true;
    });
    setDone(true);
  };
  return (
    <Shell>
      <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{t("reset.title")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{mail.to}</p></div>
        <div><label htmlFor="r1">{t("pw.new")}</label><input id="r1" type="password" autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
        <div><label htmlFor="r2">{t("pw.confirm")}</label><input id="r2" type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></div>
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
        <button type="submit">{t("reset.go")}</button>
      </form>
    </Shell>
  );
}

/** Opened by the link in the real reset e-mail: Supabase has signed the person in for this one step, so they choose a new password. */
export function SetPassword() {
  const { t } = useT();
  const s = useStore();
  const [f, setF] = useState({ pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Shell><div className="card"><h2 style={{ marginTop: 0 }}>{t("reset.done")}</h2><a className="mailbtn" href="#/app">{t("setpw.continue")}</a></div></Shell>;
  if (!s.loggedIn || !isCloudId(s.sessionId)) return <Shell><div className="card"><h2 style={{ marginTop: 0 }}>{t("reset.invalid")}</h2><p className="muted">{t("setpw.expired")}</p><a href="#/forgot">{t("forgot.title")}</a></div></Shell>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.pw.length < 8) return setErr(t("auth.pwshort"));
    if (f.pw !== f.pw2) return setErr(t("pw.nomatch"));
    setBusy(true); setErr("");
    const { error } = await cloudSetPassword(f.pw);
    setBusy(false);
    if (error) return setErr(t(authErrorKey(error)));
    setDone(true);
  };
  return (
    <Shell>
      <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{t("reset.title")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{s.userEmail}</p></div>
        <div><label htmlFor="s1">{t("pw.new")}</label><input id="s1" type="password" autoFocus autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
        <div><label htmlFor="s2">{t("pw.confirm")}</label><input id="s2" type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></div>
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
        <button type="submit" disabled={busy}>{busy ? "…" : t("reset.go")}</button>
      </form>
    </Shell>
  );
}
