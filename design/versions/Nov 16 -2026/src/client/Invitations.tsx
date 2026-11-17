import { useState } from "react";
import { useT } from "../i18n";
import { PLANS, invitesCount, openUpsell, update, useStore, type Channel, type EventT, type Guest } from "../store";
import { flag } from "../countries";
import { invitationDoc, templateHtml } from "../invitationTemplates";
import { Modal } from "./ui";
import { Bar } from "./ui";
import { Check, CircleCheck, CircleX, Copy, Eye, Mail, MessageCircle, Pencil, Send, Wand2, X } from "../icons";

const TONE: Record<Guest["status"], string> = { draft: "var(--muted)", sent: "var(--blue)", confirmed: "var(--teal)", declined: "var(--danger)" };
const slug = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const inviteLink = (g: Guest, ev: EventT) => `${location.origin}${location.pathname}#/rsvp/${ev.rsvpSlug || slug(ev.name)}/${g.token}`;

export default function Invitations({ event }: { event: EventT }) {
  const s = useStore();
  const { t, tn, locale } = useT();
  const plan = PLANS[s.plan];
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [invId, setInvId] = useState("");
  const [linkEdit, setLinkEdit] = useState<{ id: string; v: string; err: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const guests = s.guests.filter((g) => g.eventId === event.id);
  const sent = invitesCount(s, event.id);
  const max = plan.invites;
  const patch = (id: string, p: Partial<Guest>) => update((st) => { Object.assign(st.guests.find((g) => g.id === id)!, p); });
  const send = (ids: string[]) => {
    const room = max === Infinity ? ids.length : Math.max(0, max - sent);
    if (room < ids.length) openUpsell("invites");
    update((st) => { ids.slice(0, room).forEach((id) => { const g = st.guests.find((x) => x.id === id)!; g.status = "sent"; g.sentAt = Date.now(); g.sentVia = g.channel; }); });
  };
  const resend = (g: Guest, via: Channel) => {
    patch(g.id, { sentAt: Date.now(), sentVia: via });
    setNote(t("gst.resent", { name: g.name, via: via === "whatsapp" ? "WhatsApp" : "Email" }));
    setTimeout(() => setNote(""), 3500);
  };
  const copy = async (g: Guest) => { try { await navigator.clipboard.writeText(inviteLink(g, event)); } catch { /* clipboard may be blocked */ } setCopied(g.id); setTimeout(() => setCopied(null), 1500); };
  const saveLink = () => {
    if (!linkEdit) return;
    const v = slug(linkEdit.v);
    if (!v) { setLinkEdit({ ...linkEdit, err: t("rsvp.link.empty") }); return; }
    if (s.guests.some((x) => x.id !== linkEdit.id && x.token === v)) { setLinkEdit({ ...linkEdit, err: t("rsvp.link.taken") }); return; }
    patch(linkEdit.id, { token: v }); setLinkEdit(null);
  };
  const [rsName, setRsName] = useState(event.rsvpSlug || slug(event.name));
  const [rsSaved, setRsSaved] = useState(false);
  const mine = s.invitations.filter((i) => i.eventId === event.id).sort((a, b) => b.modifiedAt - a.modifiedAt);
  const chosen = mine.find((i) => i.id === invId) ?? mine[0];
  // the invitation shown here is read-only; with none created yet, the default design is previewed
  const previewDoc = chosen ? invitationDoc(chosen.html, chosen.css) : invitationDoc(templateHtml("classic", event, { title: event.name, message: t("design.msg.default"), date: new Date(event.date + "T12:00").toLocaleDateString(locale, { dateStyle: "full" }), typeName: tn(event.type), venue: event.venue }), "");
  const drafts = guests.filter((g) => g.status === "draft");
  const sentList = guests.filter((g) => g.status !== "draft");
  const chan = (c: Channel) => (c === "whatsapp" ? <MessageCircle size={14} /> : <Mail size={14} />);
  const contact = (g: Guest) => (g.channel === "whatsapp" ? `${flag(g.country)} ${g.phone || "—"}` : g.email || "—");

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <label htmlFor="rsn">{t("rsvp.linkname")}</label>
        <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
          <code className="small nowrap" style={{ background: "var(--soft)", padding: "8px 8px", borderRadius: 8 }}>…/#/rsvp/</code>
          <input id="rsn" value={rsName} onChange={(e) => { setRsName(e.target.value); setRsSaved(false); }} onBlur={() => setRsName(slug(rsName))} placeholder={slug(event.name)} />
          <code className="small nowrap" style={{ padding: "8px 4px" }}>/guest-name</code>
          <button disabled={!slug(rsName) || slug(rsName) === (event.rsvpSlug || slug(event.name))} onClick={() => { update((st) => { st.events.find((e) => e.id === event.id)!.rsvpSlug = slug(rsName); }); setRsSaved(true); }}>{t("save")}</button>
        </div>
        <p className="muted small" style={{ margin: "4px 0 0" }}>{t("rsvp.linkname.hint")}{rsSaved && <span style={{ color: "var(--teal)" }}> · {t("saved")}</span>}</p>
      </div>
      <div className="grid g4 stickbar">
        {(["sent", "confirmed", "declined"] as const).map((k) => <div className="card" key={k}><div className="muted small">{t("g." + k)}</div><h2 style={{ margin: 0, color: TONE[k] }}>{guests.filter((g) => g.status === k).length}</h2></div>)}
        <div className="card"><div className="muted small">{t("inv.quota")}</div><h2 style={{ margin: 0 }}>{sent}/{max === Infinity ? "∞" : max}</h2>{max !== Infinity && <Bar value={sent} max={max} />}</div>
      </div>

      <div className="row between" style={{ marginTop: 6, marginBottom: 8 }}>
        <div><h2 style={{ margin: 0 }}>{t("rsvp.ready")}</h2><span className="muted small">{t("inv.rule")}</span></div>
        <span className="row"><button className="ghost" onClick={() => setPreview(true)}><Eye size={15} /> {t("rsvp.preview")}</button><button disabled={!drafts.length} onClick={() => send(drafts.map((g) => g.id))}><Send size={15} /> {t("inv.sendall", { n: drafts.length })}</button></span>
      </div>
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
                <td><span className="row" style={{ gap: 0, flexWrap: "nowrap" }}><button className="ghost icon" aria-label={t("rsvp.preview")} title={t("rsvp.preview")} onClick={() => setPreview(true)}><Eye size={16} /></button><button className="ghost icon" aria-label={t("inv.send")} title={t("inv.send")} onClick={() => send([g.id])}><Send size={16} /></button></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>{t("gst.sent.title")}</h2>
      {note && <p role="status" className="small" style={{ color: "var(--teal)" }}>{note}</p>}
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("status")}</th><th>{t("gst.sentat")}</th><th>{t("gst.link")}</th><th /></tr></thead>
          <tbody>
            {sentList.length === 0 && <tr><td colSpan={5} className="muted">{t("none")}</td></tr>}
            {sentList.map((g) => (
              <tr key={g.id}>
                <td>{g.name}<div className="muted small">{g.invitees}</div></td>
                <td><span className={`pill st-${g.status}`}>{t("g." + g.status)}</span></td>
                <td className="small"><span className="row" style={{ gap: 6 }}>{g.sentVia && chan(g.sentVia)}{g.sentAt ? new Date(g.sentAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}</span></td>
                <td>
                  {linkEdit?.id === g.id ? (
                    <div>
                      <div className="row" style={{ flexWrap: "nowrap", gap: 2 }}>
                        <code className="small">…/rsvp/{event.rsvpSlug || slug(event.name)}/</code>
                        <input autoFocus aria-label={t("rsvp.link.custom")} style={{ width: 150, padding: "3px 6px" }} value={linkEdit.v} onChange={(e) => setLinkEdit({ id: g.id, v: e.target.value, err: "" })} onKeyDown={(e) => { if (e.key === "Enter") saveLink(); if (e.key === "Escape") setLinkEdit(null); }} />
                        <button className="ghost icon" aria-label={t("save")} title={t("save")} onClick={saveLink}><Check size={15} /></button>
                        <button className="ghost icon" aria-label={t("rsvp.link.fromname")} title={t("rsvp.link.fromname")} onClick={() => setLinkEdit({ id: g.id, v: slug(g.name), err: "" })}><Wand2 size={15} /></button>
                        <button className="ghost icon" aria-label={t("cancel")} title={t("cancel")} onClick={() => setLinkEdit(null)}><X size={15} /></button>
                      </div>
                      {linkEdit.err && <div className="small" style={{ color: "var(--danger)" }}>{linkEdit.err}</div>}
                    </div>
                  ) : (
                    <span className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                      <code className="small" title={inviteLink(g, event)} style={{ background: "var(--soft)", padding: "3px 8px", borderRadius: 8 }}>…/rsvp/{event.rsvpSlug || slug(event.name)}/{g.token.slice(0, 24)}</code>
                      <button className="ghost icon" aria-label={t("rsvp.link.custom")} title={t("rsvp.link.custom")} onClick={() => { if (!plan.customLink) { openUpsell("link"); return; } setLinkEdit({ id: g.id, v: g.token, err: "" }); }}><Pencil size={14} /></button>
                    </span>
                  )}
                </td>
                <td><div className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                  {g.status === "sent" && (
                    <>
                      <button className="ghost icon" aria-label={t("inv.sim.ok")} title={t("inv.sim.ok")} onClick={() => patch(g.id, { status: "confirmed" })}><CircleCheck size={16} style={{ color: "var(--teal)" }} /></button>
                      <button className="ghost icon" aria-label={t("inv.sim.no")} title={t("inv.sim.no")} onClick={() => patch(g.id, { status: "declined" })}><CircleX size={16} style={{ color: "var(--danger)" }} /></button>
                    </>
                  )}
                  <button className="ghost icon" aria-label={t("rsvp.preview")} title={t("rsvp.preview")} onClick={() => setPreview(true)}><Eye size={16} /></button>
                  <button className="ghost icon" aria-label={t("gst.resend.wa")} title={t("gst.resend.wa")} disabled={!g.phone} onClick={() => resend(g, "whatsapp")}><MessageCircle size={16} /></button>
                  <button className="ghost icon" aria-label={t("gst.resend.mail")} title={t("gst.resend.mail")} disabled={!g.email} onClick={() => resend(g, "email")}><Mail size={16} /></button>
                  <button className="ghost icon" aria-label={t("gst.copylink")} title={copied === g.id ? t("gst.copied") : t("gst.copylink")} onClick={() => copy(g)}>{copied === g.id ? <Check size={16} /> : <Copy size={16} />}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview && (
        <Modal title={t("rsvp.preview")} onClose={() => setPreview(false)} wide>
          <div className="row between" style={{ margin: "8px 0" }}>
            <span className="muted small">{chosen ? t("rsvp.preview.hint") : t("rsvp.preview.none")}</span>
            {mine.length > 1 && <select aria-label={t("ins.mine")} value={chosen?.id ?? ""} style={{ width: "auto" }} onChange={(e) => setInvId(e.target.value)}>{mine.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
          </div>
          <iframe title={t("rsvp.preview")} sandbox="" srcDoc={previewDoc} style={{ width: "100%", height: "65vh", border: "1px solid var(--line)", borderRadius: 12, background: "#F5EFE4" }} />
        </Modal>
      )}
    </>
  );
}
