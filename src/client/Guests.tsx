import { useRef, useState } from "react";
import { useT } from "../i18n";
import { LANGS } from "../i18n";
import { uid, update, guestDefaults, useStore, type Channel, type EventT, type Guest, type Lang } from "../store";
import { COUNTRIES, dialOf, flag } from "../countries";
import { Check, Download, FileSpreadsheet, LockI, Mail, MessageCircle, Pencil, Plus, X } from "../icons";
import { Modal } from "./ui";
import { CsvImport, downloadTemplate } from "./GuestCsv";

const TONE: Record<Guest["status"], string> = { draft: "var(--muted)", sent: "var(--blue)", confirmed: "var(--teal)", declined: "var(--rose)" };
const LANG_NAME: Record<Lang, string> = { es: "Español", en: "English", pt: "Português" };
const blank = (lang: Lang) => ({ name: "", invitees: 1, message: "", channel: "whatsapp" as Channel, country: "MX", number: "", email: "", lang });

export default function Guests({ event }: { event: EventT }) {
  const s = useStore();
  const { t } = useT();
  const [f, setF] = useState(() => blank(s.lang));
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [added, setAdded] = useState(0);
    const guests = s.guests.filter((g) => g.eventId === event.id);
  const patch = (id: string, p: Partial<Guest>) => update((st) => { Object.assign(st.guests.find((g) => g.id === id)!, p); });
  const phoneOf = (x: typeof f) => (x.number.trim() ? `${dialOf(x.country)} ${x.number.trim()}` : "");
  const contactOk = f.channel === "whatsapp" ? !!f.number.trim() : !!f.email.trim();

  /** Saves the guest. "another" keeps the window open with an empty form. */
  const save = (another: boolean) => {
    if (!formRef.current?.reportValidity() || !f.name.trim() || !contactOk) return;
    const base = { name: f.name.trim(), invitees: Math.max(1, f.invitees || 1), message: f.message.trim(), channel: f.channel, country: f.country, phone: phoneOf(f), email: f.email.trim(), lang: f.lang };
    if (editing) patch(editing, base);
    else update((st) => { st.guests.push(guestDefaults({ id: uid(), eventId: event.id, ...base })); });
    setF(blank(s.lang)); setEditing(null);
    if (another && !editing) { setAdded((n) => n + 1); setTimeout(() => document.getElementById("gn")?.focus(), 0); } else { setOpen(false); setAdded(0); }
  };
  const close = () => { setOpen(false); setEditing(null); setF(blank(s.lang)); setAdded(0); };
  const edit = (g: Guest) => {
    const dial = dialOf(g.country);
    setEditing(g.id);
    setF({ name: g.name, invitees: g.invitees, message: g.message, channel: g.channel, country: g.country, number: g.phone.startsWith(dial) ? g.phone.slice(dial.length).trim() : g.phone, email: g.email, lang: g.lang });
    setOpen(true);
  };
  const chan = (c: Channel) => (c === "whatsapp" ? <MessageCircle size={14} /> : <Mail size={14} />);
  const contact = (g: Guest) => (g.channel === "whatsapp" ? `${flag(g.country)} ${g.phone || "—"}` : g.email || "—");

  return (
    <>
      <div className="grid g4 stickbar">
        <div className="card"><div className="muted small">{t("gst.total")}</div><h2 style={{ margin: 0 }}>{guests.length}</h2></div>
        <div className="card"><div className="muted small">{t("gst.people")}</div><h2 style={{ margin: 0, color: "var(--teal)" }}>{guests.reduce((n, x) => n + x.invitees, 0)}</h2></div>
        <div className="card"><div className="muted small">{t("gst.notinvited")}</div><h2 style={{ margin: 0 }}>{guests.filter((x) => x.status === "draft").length}</h2></div>
        <div className="card"><div className="muted small">{t("gst.nocontact")}</div><h2 style={{ margin: 0, color: "var(--rose)" }}>{guests.filter((x) => (x.channel === "whatsapp" ? !x.phone : !x.email)).length}</h2></div>
      </div>

      <div className="row between" style={{ margin: "0 0 12px" }}>
        <h3 style={{ margin: 0 }}>{t("tab.guests")}</h3>
        <span className="row" style={{ gap: 6 }}>
          <button className="ghost" onClick={downloadTemplate} title={t("csv.template")}><Download size={15} /> <span>{t("csv.template")}</span></button>
          <button className="ghost" onClick={() => setCsv(true)}><FileSpreadsheet size={15} /> {t("csv.import.btn")}</button>
          <button onClick={() => { setEditing(null); setF(blank(s.lang)); setOpen(true); }}><Plus size={16} /> {t("gst.add")}</button>
        </span>
      </div>
      {csv && <CsvImport event={event} existing={guests} onClose={() => setCsv(false)} />}
      {open && <Modal title={editing ? t("gst.edit") : t("gst.add")} onClose={close} wide>
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); save(false); }} className="form">
        <div><label htmlFor="gn">{t("name")} *</label><input id="gn" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label htmlFor="gi">{t("gst.invitees")}</label><input id="gi" type="number" min={1} value={f.invitees} onChange={(e) => setF({ ...f, invitees: Number(e.target.value) })} /></div>
        <div className="full"><label htmlFor="gm">{t("gst.message")}</label><textarea id="gm" rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
        <div className="full"><label>{t("gst.channel")}</label>
          <div className="scope" role="group" aria-label={t("gst.channel")}>
            <button type="button" className={f.channel === "whatsapp" ? "" : "ghost"} aria-pressed={f.channel === "whatsapp"} onClick={() => setF({ ...f, channel: "whatsapp" })}>{f.channel === "whatsapp" ? <Check size={15} /> : <MessageCircle size={15} />} WhatsApp</button>
            <button type="button" className={f.channel === "email" ? "" : "ghost"} aria-pressed={f.channel === "email"} onClick={() => setF({ ...f, channel: "email" })}>{f.channel === "email" ? <Check size={15} /> : <Mail size={15} />} Email</button>
          </div>
        </div>
        <div><label htmlFor="gc">{t("gst.country")}</label>
          <select id="gc" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{flag(c.iso)} {c.dial} · {c.name}</option>)}</select></div>
        <div><label htmlFor="gw">WhatsApp {f.channel === "whatsapp" && "*"}</label>
          <input id="gw" inputMode="tel" required={f.channel === "whatsapp"} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
        <div><label htmlFor="ge">{t("email")} {f.channel === "email" && "*"}</label><input id="ge" type="email" required={f.channel === "email"} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label htmlFor="gl">{t("gst.lang")}</label><select id="gl" value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value as Lang })}>{LANGS.map((l) => <option key={l.id} value={l.id}>{LANG_NAME[l.id]}</option>)}</select></div>
        {added > 0 && <p className="full small" role="status" style={{ margin: 0, color: "var(--teal)" }}><Check size={14} style={{ verticalAlign: -2 }} /> {t("gst.added", { n: added })}</p>}
        <div className="row full" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ghost" onClick={close}>{t("cancel")}</button>
          {!editing && <button type="button" className="ghost" onClick={() => save(true)}>{t("gst.saveanother")}</button>}
          <button type="submit">{t("save")}</button>
        </div>
      </form>
      </Modal>}

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("gst.invitees")}</th><th>{t("gst.contact")}</th><th>{t("gst.lang")}</th><th>{t("status")}</th><th /></tr></thead>
          <tbody>
            {guests.length === 0 && <tr><td colSpan={6} className="muted">{t("none")}</td></tr>}
            {guests.map((g) => (
              <tr key={g.id}>
                <td>{g.name}{g.message && <div className="muted small" style={{ maxWidth: 260 }}>{g.message}</div>}</td>
                <td>{g.invitees}</td>
                <td><span className="row" style={{ gap: 6 }}>{chan(g.channel)}{contact(g)}</span></td>
                <td>{g.lang.toUpperCase()}</td>
                <td><span className="pill" style={{ background: TONE[g.status], color: g.status === "draft" ? "#fff" : "#0c1a18" }}>{t("g." + g.status)}</span></td>
                <td className="row" style={{ flexWrap: "nowrap" }}>
                  <button className="ghost icon" aria-label={t("gst.edit")} title={t("gst.edit")} onClick={() => edit(g)}><Pencil size={14} /></button>
                  {g.status !== "draft" && <span title={t("inv.locked")}><LockI /></span>}
                  {g.status === "draft" && <button className="danger sm icon" aria-label={t("delete")} onClick={() => update((st) => { st.guests = st.guests.filter((x) => x.id !== g.id); })}><X size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
