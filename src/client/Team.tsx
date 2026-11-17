import { useState } from "react";
import { useT } from "../i18n";
import { KIND_PRESET, MEMBER_FEATURES, getState, memberDefaults, PLANS, openUpsell, queueReset, uid, update, useStore, type CollabKind, type Mail as MailT, type Member } from "../store";
import { Check, Copy, Mail, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, Users } from "../icons";
import { Modal } from "./ui";
import { ResetMail } from "../Reset";

export const RESET_LIMIT = 3, DAY_MS = 24 * 3600 * 1000;
const genPw = () => { const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join(""); };

/** Small icon button that copies a text (shows a check for a moment). */
function CopyBtn({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ } setDone(true); setTimeout(() => setDone(false), 1500); };
  return <button type="button" className="ghost icon" aria-label={t("team.pwcopy")} title={done ? t("gst.copied") : t("team.pwcopy")} disabled={!text} onClick={copy}>{done ? <Check size={16} /> : <Copy size={16} />}</button>;
}

export const INVITE_DAYS = 7;
/** Queues the e-mail a new collaborator receives: an invitation (team / supplier) or an access link with a temporary password (client). */
export const queueMail = (st: ReturnType<typeof getState>, m: Member) => {
  st.outbox.push({ id: uid(), to: m.email, subject: m.kind === "client" ? "client" : "invite", kind: m.kind === "client" ? "client" : "invite", token: m.token, at: Date.now(), name: m.name, pw: m.kind === "client" ? m.password : "", role: m.kind, from: st.userName, scope: m.scopeAll ? "" : m.eventIds.map((id) => st.events.find((e) => e.id === id)?.name).filter(Boolean).join(", ") });
};

/** The e-mail as the prototype "sends" it (no real e-mail leaves the browser). */
export function MailView({ mail }: { mail: MailT }) {
  const { t, locale } = useT();
  const client = mail.kind === "client";
  const link = `${location.origin}/#/${client ? "access" : "invite"}/${mail.token}`;
  return (
    <div className="mail" style={{ marginBottom: 12 }}>
      <div className="small muted">To: {mail.to} · {new Date(mail.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</div>
      <b style={{ display: "block", margin: "2px 0 10px" }}>{t(client ? "mail.client.subject" : "mail.invite.subject", { from: mail.from ?? "" })}</b>
      <p style={{ margin: "0 0 10px" }}>{t(client ? "mail.client.body" : "mail.invite.body", { name: mail.name ?? "", from: mail.from ?? "", role: t("collab.kind." + (mail.role ?? "team")), days: INVITE_DAYS })}{mail.scope && ` ${t("mail.scope", { events: mail.scope })}`}</p>
      {client && mail.pw && <p style={{ margin: "0 0 12px" }}>{t("mail.temp")}: <code style={{ fontSize: "1.05rem" }}>{mail.pw}</code></p>}
      <a className="mailbtn" href={link}>{t(client ? "mail.client.btn" : "mail.invite.btn")}</a>
      <div className="small muted" style={{ marginTop: 10, wordBreak: "break-all" }}>{link}</div>
    </div>
  );
}

function MemberModal({ member, kind, onClose, onSent }: { member?: Member; kind?: CollabKind; onClose: () => void; onSent: (m: Member) => void }) {
  const { t } = useT();
  const s = useStore();
  const k0: CollabKind = kind && kind !== "employee" ? kind : "team";
  const [f, setF] = useState<Member>(() => member ?? memberDefaults({ name: "", username: "", password: "", status: "pending", token: uid(), kind: k0, ...KIND_PRESET[k0] }));
  const setKind = (k: CollabKind) => setF({ ...f, kind: k, ...KIND_PRESET[k], eventIds: [] });
  const [err, setErr] = useState("");
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const locked = !!member && member.status === "accepted"; // the e-mail of an active account cannot change
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = f.email.trim().toLowerCase();
    if (!f.name.trim() || !f.lastName.trim() || !email) return;
    if (s.team.some((m) => m.id !== f.id && m.email.toLowerCase() === email) || s.accounts.some((a) => a.email.toLowerCase() === email)) { setErr(t("team.taken")); return; }
    if (f.kind === "client" && f.eventIds.length === 0) return; // clients are always limited to specific events
    if (f.kind !== "client" && !f.scopeAll && f.eventIds.length === 0) { setErr(t("team.scope.none")); return; }
    const base = { ...f, name: f.name.trim(), lastName: f.lastName.trim(), email, username: email, scopeAll: f.kind === "client" ? false : f.scopeAll };
    if (member) { update((st) => { st.team = st.team.map((m) => (m.id === base.id ? base : m)); }); onClose(); return; }
    if (f.kind !== "client" && s.team.filter((m) => m.kind !== "client").length >= PLANS[s.plan].collabs) { openUpsell("collabs"); return; }
    const v: Member = f.kind === "client"
      ? { ...base, password: genPw(), mustChange: true, tempExpires: Date.now() + INVITE_DAYS * DAY_MS, status: "pending" }
      : { ...base, password: "", mustChange: false, tempExpires: 0, status: "pending" };
    update((st) => { st.team.push(v); queueMail(st, v); });
    onSent(v);
  };
  return (
    <Modal title={member ? t("team.edit") : t("team.add")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div><label htmlFor="tmn">{t("name")} *</label><input id="tmn" autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="tml">{t("team.lastname")} *</label><input id="tml" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
        <div className="full"><label htmlFor="tme">{t("team.email")} *</label><input id="tme" type="email" required autoComplete="off" disabled={locked} value={f.email} onChange={(e) => { setErr(""); setF({ ...f, email: e.target.value }); }} />{err && <div className="small" style={{ color: "var(--danger)" }}>{err}</div>}</div>
        <div className="full"><label htmlFor="tmk">{t("team.role")} *</label>
          <select id="tmk" value={f.kind === "employee" ? "team" : f.kind} disabled={!!member} onChange={(e) => setKind(e.target.value as CollabKind)}>{(["team", "supplier", "client"] as CollabKind[]).map((k) => <option key={k} value={k}>{t("collab.kind." + k)}</option>)}</select>
          <div className="muted small">{t("team.kindhint." + (f.kind === "client" ? "client" : "invite"))}</div></div>
        <div className="full"><label>{t("team.access")}</label>
          <div className="row">{MEMBER_FEATURES.map((k) => (
            <label key={k} className="row small" style={{ margin: 0, color: "var(--ink)", gap: 4 }}><input type="checkbox" checked={f.access.includes(k)} onChange={() => setF({ ...f, access: toggle(f.access, k) })} />{t("tab." + k)}</label>
          ))}</div>
        </div>
        <div className="full"><label>{t("team.scope")}</label>
          {f.kind !== "client" && <label className="row small" style={{ margin: 0, color: "var(--ink)", gap: 6 }}><input type="radio" name="scope" checked={f.scopeAll} onChange={() => setF({ ...f, scopeAll: true })} />{t("team.scope.all")}</label>}
          {f.kind !== "client" && <label className="row small" style={{ margin: "4px 0", color: "var(--ink)", gap: 6 }}><input type="radio" name="scope" checked={!f.scopeAll} onChange={() => setF({ ...f, scopeAll: false })} />{t("team.scope.pick")}</label>}
          {f.kind === "client" && <div className="muted small" style={{ marginBottom: 4 }}>{t("team.scope.clientonly")}</div>}
          {(f.kind === "client" || !f.scopeAll) && <div className="row" style={{ marginLeft: f.kind === "client" ? 0 : 22 }}>{s.events.map((ev) => (
            <label key={ev.id} className="row small" style={{ margin: 0, color: "var(--ink)", gap: 4 }}><input type="checkbox" checked={f.eventIds.includes(ev.id)} onChange={() => setF({ ...f, eventIds: toggle(f.eventIds, ev.id) })} />{ev.name}</label>
          ))}</div>}
          {f.kind === "client" && f.eventIds.length === 0 && <div className="small" style={{ color: "var(--danger)", marginTop: 4 }}>{t("team.scope.clientreq")}</div>}
        </div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={f.kind === "client" && f.eventIds.length === 0}>{member ? t("save") : t("team.sendinvite")}</button></div>
      </form>
    </Modal>
  );
}

export default function Team() {
  const s = useStore();
  const { t, locale } = useT();
  const [modal, setModal] = useState<{ member?: Member } | null>(null);
  const [sent, setSent] = useState<Member | null>(null);
  const [box, setBox] = useState(false);
  const [tab, setTab] = useState<"all" | CollabKind>("all");
  const KINDS: CollabKind[] = ["team", "supplier", "client"]; // employees (older data) are listed with the team
  const ofKind = (k: CollabKind) => s.team.filter((m) => m.kind === k || (k === "team" && m.kind === "employee"));
  const [reset, setReset] = useState<{ id: string; typed: string; pw: string } | null>(null);
  const [del, setDel] = useState<Member | null>(null);
    const resetsLeft = (m: Member) => RESET_LIMIT - m.resetLog.filter((x) => Date.now() - x < DAY_MS).length;
  const resetMember = reset ? s.team.find((m) => m.id === reset.id) : undefined;
  const nextReset = (m: Member) => { const used = m.resetLog.filter((x) => Date.now() - x < DAY_MS); return used.length ? Math.min(...used) + DAY_MS : 0; };
  const doReset = () => {
    if (!reset || !resetMember || reset.typed !== "RESET" || resetsLeft(resetMember) <= 0) return;
    const now = Date.now();
    update((st) => { const x = st.team.find((y) => y.id === reset.id)!; x.resetLog = [...x.resetLog.filter((y) => now - y < DAY_MS), now]; queueReset(st, x.email, x.name); });
    setReset({ ...reset, pw: "sent" });
  };
  const pwState = (m: Member) => (!m.mustChange ? "" : m.tempExpires && m.tempExpires < Date.now() ? "expired" : "temp");
  const scopeText = (m: Member) => (m.scopeAll ? t("team.scope.all") : `${m.eventIds.filter((id) => s.events.some((e) => e.id === id)).length} ${t("team.eventsel")}`);
  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>{t("nav.team")}</h1>
        <span className="row"><button className="ghost" onClick={() => setBox(true)}><Mail size={15} /> {t("team.mailbox")}</button><button onClick={() => setModal({})}><Plus size={16} /> {t("team.add")}</button></span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{t("team.desc")}</p>
      <div className="seg" role="group" aria-label={t("collab.kind")} style={{ marginBottom: 12 }}>
        {(["all", ...KINDS] as const).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k === "all" ? t("collab.all") : t("collab.kind." + k)} <span className="muted small">{k === "all" ? s.team.length : ofKind(k).length}</span></button>)}
      </div>
      {(tab === "all" ? KINDS.filter((k) => ofKind(k).length > 0) : [tab]).map((k) => {
        const rows = ofKind(k);
        return (
          <section key={k} style={{ marginBottom: 22 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}><h3 style={{ margin: 0 }}>{t("collab.kind." + k)}</h3><span className="muted">{rows.length}</span></div>
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table className="collab">
                <thead><tr><th>{t("name")}</th><th>{t("team.email")}</th><th>{t("status")}</th><th>{t("team.access")}</th><th>{t("collab.created")}</th><th>{t("collab.lastlogin")}</th><th /></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={7} className="muted"><Users size={15} style={{ verticalAlign: -3 }} /> {t("team.none")}</td></tr>}
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td><b>{m.name} {m.lastName}</b>{pwState(m) === "temp" && <div className="muted small">{t("team.temppw")}{m.tempExpires > 0 && ` · ${t("team.expires")} ${new Date(m.tempExpires).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}`}</div>}{pwState(m) === "expired" && <div className="small" style={{ color: "var(--danger)" }}>{t("team.pw.expired")}</div>}</td>
                      <td className="small">{m.email}</td>
                      <td className="small"><span className="pill" style={{ background: m.status === "accepted" ? "var(--teal)" : "var(--gold)", color: "#14203A" }}>{t("team.st." + m.status)}</span>{m.status === "pending" && <div><button className="ghost sm" style={{ marginTop: 4 }} onClick={() => { update((st) => { const x = st.team.find((y) => y.id === m.id)!; if (x.kind === "client") { x.tempExpires = Date.now() + INVITE_DAYS * DAY_MS; } queueMail(st, x); }); setSent(m); }}>{t("team.resend")}</button></div>}</td>

                      <td className="muted small">{m.access.length === MEMBER_FEATURES.length ? t("team.allfeat") : m.access.map((x) => t("tab." + x)).join(", ") || "—"}<br />{scopeText(m)}</td>
                      <td className="small">{new Date(m.createdAt).toLocaleDateString(locale, { dateStyle: "medium" })}</td>
                      <td className="small">{m.lastLogin ? new Date(m.lastLogin).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("collab.never")}</td>
                      <td><span className="row" style={{ gap: 2, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                        <button className="ghost icon" aria-label={t("team.edit")} title={t("team.edit")} onClick={() => setModal({ member: m })}><Pencil size={15} /></button>
                        {m.status === "accepted" && <button className="ghost icon" aria-label={t("team.reset")} title={t("team.reset")} onClick={() => setReset({ id: m.id, typed: "", pw: "" })}><KeyRound size={15} /></button>}
                        <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => setDel(m)}><Trash2 size={15} /></button>
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {modal && <MemberModal member={modal.member} kind={tab === "all" ? undefined : tab} onClose={() => setModal(null)} onSent={(m) => { setModal(null); setSent(m); }} />}
      {(sent || box) && (
        <Modal title={sent ? t("team.invite.sent", { email: sent.email }) : t("team.mailbox")} onClose={() => { setSent(null); setBox(false); }} wide>
          <p className="muted small" style={{ marginTop: 0 }}>{t("team.invite.demo")}</p>
          {(sent ? s.outbox.filter((x) => x.to === sent.email && (x.kind === "invite" || x.kind === "client")).slice(-1) : s.outbox.filter((x) => (x.kind === "invite" || x.kind === "client")).slice().reverse()).map((x) => <MailView key={x.id} mail={x} />)}
          {box && !s.outbox.some((x) => (x.kind === "invite" || x.kind === "client")) && <p className="muted">{t("none")}</p>}
          <div className="row" style={{ justifyContent: "flex-end" }}><button onClick={() => { setSent(null); setBox(false); }}>{t("close")}</button></div>
        </Modal>
      )}
      {reset && resetMember && (
        <Modal title={t("team.reset")} onClose={() => setReset(null)}>
          {!reset.pw ? (
            <>
              <p style={{ marginTop: 0 }}>{t("team.reset.warn", { name: resetMember.name })}</p>
              <p className="small" style={{ color: resetsLeft(resetMember) > 0 ? "var(--muted)" : "var(--danger)" }}>
                {resetsLeft(resetMember) > 0 ? t("team.reset.left", { n: resetsLeft(resetMember), max: RESET_LIMIT }) : t("team.reset.limit", { when: new Date(nextReset(resetMember)).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) })}
              </p>
              <label htmlFor="rst">{t("team.reset.type")}</label>
              <input id="rst" autoFocus autoComplete="off" disabled={resetsLeft(resetMember) <= 0} value={reset.typed} onChange={(e) => setReset({ ...reset, typed: e.target.value })} onKeyDown={(e) => e.key === "Enter" && doReset()} />
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                <button className="ghost" onClick={() => setReset(null)}>{t("cancel")}</button>
                <button className="danger" disabled={reset.typed !== "RESET" || resetsLeft(resetMember) <= 0} onClick={doReset}>{t("team.reset.go")}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>{t("team.reset.done", { name: resetMember.name })}</p>
              <p className="muted small">{t("sent.demo")}</p>
              {[...s.outbox].reverse().filter((m) => m.kind === "reset" && m.to === resetMember.email).slice(0, 1).map((m) => <ResetMail key={m.id} mail={m} />)}
              <p className="small">{t("team.reset.left", { n: resetsLeft(resetMember), max: RESET_LIMIT })}</p>
              <div className="row" style={{ justifyContent: "flex-end" }}><button onClick={() => setReset(null)}>{t("close")}</button></div>
            </>
          )}
        </Modal>
      )}
      {del && (
        <Modal title={t("delete")} onClose={() => setDel(null)}>
          <p style={{ marginTop: 0 }}>{t("team.delete.warn", { name: del.name })}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="ghost" onClick={() => setDel(null)}>{t("cancel")}</button>
            <button className="danger" onClick={() => { update((st) => { st.team = st.team.filter((x) => x.id !== del.id); }); setDel(null); }}>{t("delete")}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
