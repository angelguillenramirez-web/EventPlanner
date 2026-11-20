import { useState } from "react";
import { useT } from "../i18n";
import { TALENT_KINDS, uid, update, useStore, type EventT, type Talent } from "../store";
import { Clock, Disc3, Mail, Mic, Music, Pencil, Phone, Plus, Sparkles, Trash2, Users } from "../icons";
import { Modal } from "./ui";
import ApprovalButton from "./Approval";
import { ask } from "./Ask";

const ICON: Record<string, React.ComponentType<{ size?: number }>> = { host: Mic, mc: Mic, dj: Disc3, musician: Music, band: Music, singer: Music, dancer: Sparkles, performer: Sparkles, other: Users };
const money = (n: number, locale: string) => "$" + n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function TalentModal({ event, item, onClose }: { event: EventT; item?: Talent; onClose: () => void }) {
  const { t } = useT();
  const [f, setF] = useState<Talent>(() => item ?? { id: uid(), eventId: event.id, kind: "dj", name: "", contact: "", phone: "", email: "", fee: 0, arrival: "", start: "", duration: 60, status: "prospect", notes: "", createdAt: Date.now() });
  const set = <K extends keyof Talent>(k: K, v: Talent[K]) => setF({ ...f, [k]: v });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    update((st) => { const v = { ...f, name: f.name.trim() }; if (item) st.talents = st.talents.map((x) => (x.id === v.id ? v : x)); else st.talents.push(v); });
    onClose();
  };
  return (
    <Modal title={item ? t("tal.edit") : t("tal.add")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div><label htmlFor="tk">{t("tal.kind")}</label><select id="tk" value={f.kind} onChange={(e) => set("kind", e.target.value)}>{TALENT_KINDS.map((k) => <option key={k} value={k}>{t("talk." + k)}</option>)}</select></div>
        <div><label htmlFor="tn">{t("tal.name")} *</label><input id="tn" autoFocus required value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label htmlFor="tc">{t("tal.contact")}</label><input id="tc" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
        <div><label htmlFor="tp">{t("phone")}</label><input id="tp" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="full"><label htmlFor="te">{t("email")}</label><input id="te" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><label htmlFor="ta">{t("tal.arrival")}</label><input id="ta" type="time" value={f.arrival} onChange={(e) => set("arrival", e.target.value)} /></div>
        <div><label htmlFor="ts">{t("tal.start")}</label><input id="ts" type="time" value={f.start} onChange={(e) => set("start", e.target.value)} /></div>
        <div><label htmlFor="td">{t("meet.duration")} (min)</label><input id="td" type="number" min={0} step={5} value={f.duration} onChange={(e) => set("duration", Math.max(0, Number(e.target.value) || 0))} /></div>
        <div><label htmlFor="tf">{t("tal.fee")}</label><input id="tf" type="number" min={0} step={10} value={f.fee} onChange={(e) => set("fee", Math.max(0, Number(e.target.value) || 0))} /></div>
        <div className="full"><label htmlFor="tt">{t("tal.status")}</label><select id="tt" value={f.status} onChange={(e) => set("status", e.target.value as Talent["status"])}><option value="prospect">{t("tal.prospect")}</option><option value="confirmed">{t("tal.confirmed")}</option></select></div>
        <div className="full"><label htmlFor="tno">{t("tal.notes")}</label><textarea id="tno" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div className="row full" style={{ justifyContent: "flex-end" }}><button type="button" className="ghost" onClick={onClose}>{t("cancel")}</button><button>{item ? t("save") : t("add")}</button></div>
      </form>
    </Modal>
  );
}

/** Talent hired for the event: host, MC, DJ, musicians, band... with contact, schedule and fee. */
export default function TalentTab({ event }: { event: EventT }) {
  const s = useStore();
  const { t, locale } = useT();
  const [modal, setModal] = useState<{ item?: Talent } | null>(null);
  const list = s.talents.filter((x) => x.eventId === event.id).sort((a, b) => (a.start || "99").localeCompare(b.start || "99"));
  const total = list.reduce((n, x) => n + x.fee, 0);
  const summary = () => [...list.map((x) => `${t("talk." + x.kind)}: ${x.name}${x.start ? ` · ${x.start}` : ""}${x.fee ? ` · ${money(x.fee, locale)}` : ""} · ${t("tal." + x.status)}`), `${t("tal.total")}: ${money(total, locale)}`];
  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>{t("tal.desc")}</p>
        <div className="row">
          <ApprovalButton event={event} scope="talent" subject={t("tab.talent")} summary={summary} disabled={list.length === 0} />
          <button onClick={() => setModal({})}><Plus size={16} /> {t("tal.add")}</button>
        </div>
      </div>
      {list.length === 0 ? <div className="card muted"><Mic size={18} /> {t("tal.none")}</div> : (
        <>
          <div className="talgrid">
            {list.map((x) => { const I = ICON[x.kind] ?? Users; return (
              <div className="card talcard" key={x.id} title={t("ins.dbl")} onDoubleClick={() => setModal({ item: x })}>
                <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <span className="talico"><I size={20} /></span>
                    <div><b style={{ display: "block" }}>{x.name}</b><span className="muted small">{t("talk." + x.kind)}</span></div>
                  </div>
                  <span className="row" style={{ gap: 0, flexWrap: "nowrap" }}>
                    <button className="ghost icon" aria-label={t("seat.edit")} title={t("seat.edit")} onClick={() => setModal({ item: x })}><Pencil size={15} /></button>
                    <button className="ghost icon" aria-label={t("delete")} title={t("delete")} onClick={() => ask(`${t("confirm.delete")}\n${x.name}`, () => update((st) => { st.talents = st.talents.filter((y) => y.id !== x.id); }), { danger: true })}><Trash2 size={15} /></button>
                  </span>
                </div>
                <div className="small" style={{ marginTop: 8, display: "grid", gap: 4 }}>
                  {(x.start || x.arrival) && <span className="row" style={{ gap: 6 }}><Clock size={13} />{x.arrival && `${t("tal.arrival")} ${x.arrival}`}{x.arrival && x.start && " · "}{x.start && `${t("tal.start")} ${x.start}`}{x.duration > 0 && ` · ${x.duration} min`}</span>}
                  {x.contact && <span className="row" style={{ gap: 6 }}><Users size={13} />{x.contact}</span>}
                  {x.phone && <a className="row" style={{ gap: 6, color: "inherit" }} href={`tel:${x.phone}`}><Phone size={13} />{x.phone}</a>}
                  {x.email && <a className="row" style={{ gap: 6, color: "inherit" }} href={`mailto:${x.email}`}><Mail size={13} />{x.email}</a>}
                  {x.notes && <span className="muted">{x.notes}</span>}
                </div>
                <div className="row between" style={{ marginTop: 10 }}>
                  <span className={`badge${x.status === "confirmed" ? " ok" : ""}`}>{t("tal." + x.status)}</span>
                  <b>{x.fee ? money(x.fee, locale) : "—"}</b>
                </div>
              </div>
            ); })}
          </div>
          <p style={{ textAlign: "right", marginTop: 12 }}><span className="muted">{t("tal.total")}</span> <b>{money(total, locale)}</b></p>
        </>
      )}
      {modal && <TalentModal event={event} item={modal.item} onClose={() => setModal(null)} />}
    </>
  );
}
