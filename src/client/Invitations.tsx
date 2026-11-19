import { useState } from "react";
import { useT } from "../i18n";
import { PLANS, go, invitesCount, openUpsell, update, useStore, type Channel, type EventT, type Guest } from "../store";
import { flag } from "../countries";
import { invSandbox, invitationDoc, isFullDoc, personalizeDoc, templateHtml, templatesFor } from "../invitationTemplates";
import { Modal, Popover } from "./ui";
import { Bar } from "./ui";
import { Check, CircleCheck, CircleX, Copy, Eye, Lock, Mail, Send, Share2, TriangleAlert, WhatsApp } from "../icons";
import { ask } from "./Ask";

const TONE: Record<Guest["status"], string> = { draft: "var(--muted)", sent: "var(--blue)", confirmed: "var(--teal)", declined: "var(--danger)" };
const slug = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const inviteLink = (g: Guest, ev: EventT) => `${location.origin}${location.pathname}#/rsvp/${ev.rsvpSlug || slug(ev.name)}/${slug(g.name) || "guest"}/${g.token}`;

export default function Invitations({ event }: { event: EventT }) {
  const s = useStore();
  const { t, tn, locale } = useT();
  const plan = PLANS[s.plan];
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<false | Guest | null>(false); // a guest = their personalised invitation, null = the invitation as designed
  const [share$, setShare] = useState<{ id: string; r: DOMRect } | null>(null);
  const [invId, setInvId] = useState("");
  const guests = s.guests.filter((g) => g.eventId === event.id);
  const sent = invitesCount(s, event.id);
  const max = plan.invites;
  const patch = (id: string, p: Partial<Guest>) => update((st) => { Object.assign(st.guests.find((g) => g.id === id)!, p); });
  // only an invitation design approved by everybody who was asked can be sent out
  const approved = s.signoffs.filter((x) => x.eventId === event.id && x.scope === "invitations" && x.approvers.every((a) => a.at)).sort((a, b) => b.startedAt - a.startedAt)[0];
  const approvedSnap = approved?.snap?.k === "invitation" ? approved.snap : null;
  const send = (ids: string[]) => {
    if (!approved) return;
    const room = max === Infinity ? ids.length : Math.max(0, max - sent);
    if (room < ids.length) openUpsell("invites");
    update((st) => { ids.slice(0, room).forEach((id) => { const g = st.guests.find((x) => x.id === id)!; g.status = "sent"; g.sentAt = Date.now(); g.sentVia = g.channel; }); });
  };
  const DAY = 24 * 3600 * 1000;
  const lastSend = (g: Guest) => g.resentAt ?? g.sentAt;
  const waWait = (g: Guest) => Math.max(0, lastSend(g) + DAY - Date.now()); // WhatsApp resend opens 24 hours after the last time it was sent
  const when = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  /** Runs an action that sends the invitation again; if the guest already opened it, the planner is advised not to. */
  const guarded = (g: Guest, run: () => void) => { if ((g.views ?? 0) > 0) ask(t("inv.viewed.warn", { name: g.name, n: g.views ?? 0 }), run, { yes: t("inv.sendanyway") }); else run(); };
  const resend = (g: Guest, via: Channel) => {
    if (via === "whatsapp" && waWait(g) > 0) return;
    guarded(g, () => {
      patch(g.id, { resentAt: Date.now(), sentVia: via });
      setNote(t("gst.resent", { name: g.name, via: via === "whatsapp" ? "WhatsApp" : "Email" }));
      setTimeout(() => setNote(""), 3500);
    });
  };
  const copy = async (g: Guest) => { try { await navigator.clipboard.writeText(inviteLink(g, event)); } catch { /* clipboard may be blocked */ } setNote(`${t("gst.copied")}: ${g.name}`); setTimeout(() => setNote(""), 2500); };
  const shareText = (g: Guest) => t("inv.share.text", { name: g.name, event: event.name, link: inviteLink(g, event) });
  /** Share with the planner's own apps: their WhatsApp, their mail program, the phone's share sheet or just copy the link. */
  const share = (g: Guest, how: "wa" | "native") => {
    setShare(null);
    guarded(g, () => {
      if (how === "wa") window.open(`https://wa.me/${g.phone.replace(/\D/g, "")}?text=${encodeURIComponent(shareText(g))}`, "_blank", "noopener");
      else void navigator.share?.({ title: event.name, text: shareText(g), url: inviteLink(g, event) }).catch(() => undefined);
    });
  };
  const todayIso = new Date().toLocaleDateString("en-CA");
  const eventOver = todayIso > event.date; // attendance is filled in once the event day has passed
  const [rsName, setRsName] = useState(event.rsvpSlug || slug(event.name));
  const [rsSaved, setRsSaved] = useState(false);
  const [rsErr, setRsErr] = useState("");
  const saveRsName = () => { // the event's link name is unique across all events and can be saved only once by the planner
    const v = slug(rsName);
    if (s.events.some((e) => e.id !== event.id && (e.rsvpSlug || slug(e.name)) === v)) { setRsErr(t("rsvp.linkname.taken")); return; }
    ask(t("rsvp.linkname.once"), () => { update((st) => { const ev = st.events.find((e) => e.id === event.id)!; ev.rsvpSlug = v; ev.rsvpSlugLocked = true; }); setRsSaved(true); });
  };
  const mine = s.invitations.filter((i) => i.eventId === event.id).sort((a, b) => b.modifiedAt - a.modifiedAt);
  const chosen = mine.find((i) => i.id === invId) ?? mine[0];
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  // the invitation shown here is read-only: the approved design, or the default design while none exists yet
  const baseDoc = approvedSnap ? invitationDoc(approvedSnap.html, approvedSnap.css) : chosen ? invitationDoc(chosen.html, chosen.css) : invitationDoc(templateHtml(templatesFor(event.type)[0], event, { title: event.name, message: t("design.msg.default"), date: new Date(event.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" }), typeName: tn(event.type), venue: event.venue }), "");
  const previewDoc = preview && isFullDoc(baseDoc) ? personalizeDoc(baseDoc, preview.name, preview.invitees) : preview ? baseDoc.replace("<body>", `<body><p style="font:600 15px system-ui,sans-serif;text-align:center;color:#14203A;margin:18px 12px 0">${esc(t("rsvp.pg.hello", { name: preview.name }))}<br><span style="font-weight:400;color:#6b7280">${esc(t("rsvp.pg.party", { n: preview.invitees }))}</span></p>`) : baseDoc;
  const drafts = guests.filter((g) => g.status === "draft");
  const sentList = guests.filter((g) => g.status !== "draft");
  const chan = (c: Channel) => (c === "whatsapp" ? <WhatsApp size={14} /> : <Mail size={14} />);
  const contact = (g: Guest) => (g.channel === "whatsapp" ? `${flag(g.country)} ${g.phone || "—"}` : g.email || "—");

  return (
    <>
      {guests.length === 0 ? <div className="card muted small" style={{ marginBottom: 12 }}><Lock size={12} style={{ verticalAlign: -1 }} /> {t("rsvp.linkname.none")}</div> : <div className="card" style={{ marginBottom: 12 }}>
        <label htmlFor="rsn">{t("rsvp.linkname")}</label>
        <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
          <code className="small nowrap" style={{ background: "var(--soft)", padding: "8px 8px", borderRadius: 8 }}>…/#/rsvp/</code>
          <input id="rsn" className={event.rsvpSlugLocked ? "rsvp-locked" : undefined} value={rsName} disabled={!!event.rsvpSlugLocked} onChange={(e) => { setRsName(e.target.value); setRsSaved(false); setRsErr(""); }} onBlur={() => setRsName(slug(rsName))} placeholder={slug(event.name)} />
          <code className="small nowrap" style={{ padding: "8px 4px" }}>/guest-name</code>
          <button className={event.rsvpSlugLocked ? "rsvp-locked" : undefined} disabled={!!event.rsvpSlugLocked || !slug(rsName) || slug(rsName) === (event.rsvpSlug || slug(event.name))} onClick={saveRsName}>{t("save")}</button>
        </div>
        {rsErr && <p className="small" role="alert" style={{ margin: "4px 0 0", color: "var(--danger)" }}>{rsErr}</p>}
        {event.rsvpSlugLocked && <p className="small" style={{ margin: "4px 0 0", color: "var(--muted)" }}><Lock size={12} style={{ verticalAlign: -1 }} /> {t("rsvp.linkname.locked")}</p>}
        <p className="muted small" style={{ margin: "4px 0 0" }}>{t("rsvp.linkname.hint")}{rsSaved && <span style={{ color: "var(--teal)" }}> · {t("saved")}</span>}</p>
      </div>}
      <div className="grid g4 stickbar">
        {(["sent", "confirmed", "declined"] as const).map((k) => <div className="card" key={k}><div className="muted small">{t("g." + k)}</div><h2 style={{ margin: 0, color: TONE[k] }}>{guests.filter((g) => g.status === k).length}</h2></div>)}
        <div className="card"><div className="muted small">{t("inv.quota")}</div><h2 style={{ margin: 0 }}>{sent}/{max === Infinity ? "∞" : max}</h2>{max !== Infinity && <Bar value={sent} max={max} />}</div>
      </div>

      <div className="row between" style={{ marginTop: 6, marginBottom: 8 }}>
        <div><h2 style={{ margin: 0 }}>{t("rsvp.ready")}</h2><span className="muted small">{t("inv.rule")}</span></div>
        <span className="row"><button className="ghost" onClick={() => setPreview(null)}><Eye size={15} /> {t("rsvp.preview")}</button><button disabled={!drafts.length || !approved} title={approved ? undefined : t("inv.needapp.title")} onClick={() => send(drafts.map((g) => g.id))}><Send size={15} /> {t("inv.sendall", { n: drafts.length })}</button></span>
      </div>
      {!approved && (
        <div className="card" role="status" style={{ marginBottom: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <TriangleAlert size={20} style={{ color: "var(--danger)", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 220 }}><b>{t("inv.needapp.title")}</b><div className="muted small">{t("inv.needapp.body")}</div></div>
          <button className="ghost" onClick={() => go(`/app/event/${event.id}/design`)}>{t("inv.needapp.cta")}</button>
        </div>
      )}
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("gst.invitees")}</th><th>{t("gst.contact")}</th><th>{t("gst.lang")}</th><th /></tr></thead>
          <tbody>
            {drafts.length === 0 && <tr><td colSpan={5} className="muted">{t("none")}</td></tr>}
            {drafts.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td><td>{g.invitees}</td>
                <td><span className="row" style={{ gap: 6 }}>{chan(g.channel)}{contact(g)}</span></td>
                <td>{g.lang.toUpperCase()}</td>
                <td><span className="row" style={{ gap: 0, flexWrap: "nowrap" }}><button className="ghost icon" aria-label={t("rsvp.preview")} title={t("rsvp.preview")} onClick={() => setPreview(g)}><Eye size={16} /></button><button className="ghost icon" aria-label={t("inv.send")} title={approved ? t("inv.send") : t("inv.needapp.title")} disabled={!approved} onClick={() => send([g.id])}><Send size={16} /></button></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>{t("gst.sent.title")}</h2>
      {note && <p role="status" className="small" style={{ color: "var(--teal)" }}>{note}</p>}
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("gst.invitees")}</th><th>{t("status")}</th><th>{t("gst.sentat")}</th><th>{t("gst.viewed")}</th><th>{t("gst.confirmedn")}</th><th>{t("gst.attended")}</th><th style={{ textAlign: "right" }}>{t("gst.ops")}</th></tr></thead>
          <tbody>
            {sentList.length === 0 && <tr><td colSpan={8} className="muted">{t("none")}</td></tr>}
            {sentList.map((g) => {
              const wait = waWait(g);
              const views = g.views ?? 0;
              return (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.invitees}</td>
                <td><span className={`pill st-${g.status}`}>{t("g." + g.status)}</span></td>
                <td className="small"><span className="row" style={{ gap: 6 }}>{g.sentVia && chan(g.sentVia)}{g.sentAt ? when(g.sentAt) : "—"}</span>{g.resentAt ? <div className="muted small">{t("gst.lastresent", { at: when(g.resentAt) })}</div> : null}</td>
                <td title={g.lastViewedAt ? t("gst.lastviewed", { at: when(g.lastViewedAt) }) : undefined}>{views}</td>
                <td>{g.status === "confirmed" ? `${g.confirmedN ?? g.invitees} / ${g.invitees}` : g.status === "declined" ? `0 / ${g.invitees}` : "-"}</td>
                <td>{eventOver && g.status === "confirmed"
                  ? <select aria-label={t("gst.attended")} value={g.attended ?? ""} style={{ width: "auto", padding: "3px 6px" }} onChange={(e) => patch(g.id, { attended: e.target.value as Guest["attended"] })}><option value="">-</option><option value="yes">{t("gst.att.yes")}</option><option value="no">{t("gst.att.no")}</option></select>
                  : <span title={eventOver ? undefined : t("gst.att.after")}>{g.attended === "yes" ? t("gst.att.yes") : g.attended === "no" ? t("gst.att.no") : "-"}</span>}</td>
                <td><div className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end", position: "relative" }}>
                  {g.status === "sent" && (
                    <>
                      <button className="ghost icon" aria-label={t("inv.sim.ok")} title={t("inv.sim.ok")} onClick={() => patch(g.id, { status: "confirmed", confirmedN: g.invitees })}><CircleCheck size={16} style={{ color: "var(--teal)" }} /></button>
                      <button className="ghost icon" aria-label={t("inv.sim.no")} title={t("inv.sim.no")} onClick={() => patch(g.id, { status: "declined", confirmedN: 0 })}><CircleX size={16} style={{ color: "var(--danger)" }} /></button>
                    </>
                  )}
                  <button className="ghost icon" aria-label={t("gst.view")} title={t("gst.view")} onClick={() => setPreview(g)}><Eye size={16} /></button>
                  <button className="ghost icon" aria-label={t("gst.resend.wa")} title={!g.phone ? t("gst.resend.wa") : wait > 0 ? t("gst.wa.wait", { at: when(Date.now() + wait) }) : t("gst.resend.wa")} disabled={!g.phone || wait > 0} onClick={() => resend(g, "whatsapp")}><WhatsApp size={16} /></button>
                  <button className="ghost icon" aria-label={t("gst.share")} title={t("gst.share")} aria-haspopup="dialog" aria-expanded={share$?.id === g.id} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setShare(share$?.id === g.id ? null : { id: g.id, r }); }}><Share2 size={16} /></button>
                </div></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {share$ && (() => { const sg = guests.find((x) => x.id === share$.id); if (!sg) return null; return (
        <Popover anchor={share$.r} onClose={() => setShare(null)} width={250} label={t("gst.share")}>
          <div className="small muted" style={{ marginBottom: 6 }}>{t("gst.share")} · {sg.name}</div>
          <div style={{ display: "grid", gap: 4 }}>
            <button className="ghost" style={{ justifyContent: "flex-start" }} onClick={() => share(sg, "wa")}><WhatsApp size={15} /> {t("gst.share.wa")}</button>
            {typeof navigator.share === "function" && <button className="ghost" style={{ justifyContent: "flex-start" }} onClick={() => share(sg, "native")}><Share2 size={15} /> {t("gst.share.more")}</button>}
            <button className="ghost" style={{ justifyContent: "flex-start" }} onClick={() => { setShare(null); void copy(sg); }}><Copy size={15} /> {t("gst.copylink")}</button>
          </div>
        </Popover>
      ); })()}
      {preview !== false && (
        <Modal title={preview?.name ? `${t("rsvp.preview")} · ${preview.name}` : t("rsvp.preview")} onClose={() => setPreview(false)} wide>
          <div className="row between" style={{ margin: "8px 0" }}>
            <span className="muted small">{approvedSnap || chosen ? t("rsvp.preview.hint") : t("rsvp.preview.none")}</span>
            {!approvedSnap && mine.length > 1 && <select aria-label={t("ins.mine")} value={chosen?.id ?? ""} style={{ width: "auto" }} onChange={(e) => setInvId(e.target.value)}>{mine.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
          </div>
          <iframe title={t("rsvp.preview")} sandbox={invSandbox(previewDoc)} srcDoc={previewDoc} style={{ width: "100%", height: "65vh", border: "1px solid var(--line)", borderRadius: 12, background: "#F5EFE4" }} />
        </Modal>
      )}
    </>
  );
}
