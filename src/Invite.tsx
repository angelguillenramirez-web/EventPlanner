import { useState } from "react";
import { useT } from "./i18n";
import { Shell } from "./Join";
import { go, notify, update, useStore, type Member } from "./store";

/** Signs the collaborator in (the planner's workspace, limited to the access and events they were given). */
const enter = (id: string) => update((st) => { const m = st.team.find((x) => x.id === id)!; st.loggedIn = true; st.sessionId = "member:" + m.id; st.viewAs = m.id; st.accountType = "planner"; m.lastLogin = Date.now(); });

function PasswordFields({ f, setF, temp }: { f: { temp: string; pw: string; pw2: string }; setF: (v: { temp: string; pw: string; pw2: string }) => void; temp?: boolean }) {
  const { t } = useT();
  return (
    <>
      {temp && <div><label htmlFor="ap0">{t("mail.temp")}</label><input id="ap0" type="text" autoComplete="off" value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value })} /></div>}
      <div><label htmlFor="ap1">{t("pw.new")}</label><input id="ap1" type="password" autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
      <div><label htmlFor="ap2">{t("pw.confirm")}</label><input id="ap2" type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></div>
    </>
  );
}

/** Team member / supplier: the link in the invitation e-mail. Creates the password and confirms the account. */
export function Invite({ token }: { token: string }) {
  const { t } = useT();
  const s = useStore();
  const m: Member | undefined = token ? s.team.find((x) => x.token === token && x.kind !== "client") : undefined;
  const [f, setF] = useState({ temp: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  if (!m) return <Shell><div className="card"><p>{t("invite.invalid")}</p><a href="#/login">{t("login")}</a></div></Shell>;
  if (m.status === "accepted" && m.password) return <Shell><div className="card"><p>{t("invite.done")}</p><a href="#/login">{t("login")}</a></div></Shell>;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.pw.length < 8) return setErr(t("auth.pwshort"));
    if (f.pw !== f.pw2) return setErr(t("pw.nomatch"));
    update((st) => { const x = st.team.find((y) => y.id === m.id)!; x.password = f.pw; x.status = "accepted"; x.mustChange = false; x.tempExpires = 0; notify(st, "collab", "inb.n.joined", { name: x.name }, "/app/team"); });
    enter(m.id); go("/app");
  };
  return (
    <Shell>
      <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{t("invite.title")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{t("invite.sub", { name: m.name, email: m.email })}</p></div>
        <PasswordFields f={f} setF={setF} />
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
        <button type="submit">{t("invite.go")}</button>
      </form>
    </Shell>
  );
}

/** Client (and anyone given a temporary password): the access link. First visit = temporary password + a new password; later visits = the password. */
export function Access({ token }: { token: string }) {
  const { t } = useT();
  const s = useStore();
  const m = token ? s.team.find((x) => x.token === token) : undefined;
  const [f, setF] = useState(() => { let temp = ""; try { temp = sessionStorage.getItem("aplan-tp") ?? ""; sessionStorage.removeItem("aplan-tp"); } catch { /* ignore */ } return { temp, pw: "", pw2: "" }; });
  const [err, setErr] = useState("");
  if (!m) return <Shell><div className="card"><p>{t("invite.invalid")}</p><a href="#/login">{t("login")}</a></div></Shell>;
  const first = m.mustChange;
  const expired = first && m.tempExpires > 0 && m.tempExpires < Date.now();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (first) {
      if (expired) return setErr(t("access.expired"));
      if (f.temp.trim() !== m.password) return setErr(t("access.err.temp"));
      if (f.pw.length < 8) return setErr(t("auth.pwshort"));
      if (f.pw !== f.pw2) return setErr(t("pw.nomatch"));
      if (f.pw === m.password) return setErr(t("pw.same"));
      update((st) => { const x = st.team.find((y) => y.id === m.id)!; x.password = f.pw; x.mustChange = false; x.tempExpires = 0; x.status = "accepted"; notify(st, "collab", "inb.n.joined", { name: x.name }, "/app/team"); });
    } else if (f.pw !== m.password) return setErr(t("login.err.bad"));
    enter(m.id); go("/app");
  };
  return (
    <Shell>
      <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{t(first ? "access.title" : "access.again")}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{t(first ? "access.sub" : "access.sub2", { name: m.name, email: m.email })}</p></div>
        {first ? <PasswordFields f={f} setF={setF} temp /> : <div><label htmlFor="ap1">{t("password")}</label><input id="ap1" type="password" autoComplete="current-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>}
        {err && <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
        <button type="submit">{t(first ? "access.go" : "login")}</button>
      </form>
    </Shell>
  );
}
