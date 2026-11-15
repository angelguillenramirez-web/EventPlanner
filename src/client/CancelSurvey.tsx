import { useState } from "react";
import { useT } from "../i18n";
import { CANCEL_FEATURES, CANCEL_REASONS, uid, update, type CancelReason, type CancelSurvey as Survey, type Subscription } from "../store";
import { Modal } from "./ui";

/** Short exit survey shown before a trial or subscription is cancelled. The answers are saved so the platform can learn about features, prices and advantages. */
export default function CancelSurvey({ sub, when, onClose, onDone }: { sub: Subscription; when: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const trial = sub.status === "trialing";
  const [reason, setReason] = useState<CancelReason | "">("");
  const [detail, setDetail] = useState("");
  const [used, setUsed] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [stay, setStay] = useState("");
  const [contact, setContact] = useState(false);
  const [err, setErr] = useState(false);
  const askDetail = reason === "price" || reason === "features" || reason === "competitor" || reason === "other";
  const toggle = (k: string) => setUsed((u) => (u.includes(k) ? u.filter((x) => x !== k) : [...u, k]));

  const submit = () => {
    if (!reason) { setErr(true); return; }
    const row: Survey = { id: uid(), at: Date.now(), plan: sub.plan, cycle: sub.cycle, stage: trial ? "trialing" : "active", reason, detail: askDetail ? detail.trim().slice(0, 500) : "", used, rating, stay: stay.trim().slice(0, 1000), contact };
    update((st) => {
      st.cancelSurveys.unshift(row);
      if (trial) st.sub.status = "canceled"; else st.sub.cancelAtEnd = true;
    });
    onDone();
  };

  return (
    <Modal title={t("cs.title")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0 }}>{t("cs.intro")}</p>

      <fieldset className="cs-q" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend><b>{t("cs.q.reason")}</b> <span className="muted small">· {t("cs.required")}</span></legend>
        <div className="cs-opts">
          {CANCEL_REASONS.map((r) => (
            <label key={r} className="cs-opt">
              <input type="radio" name="cs-reason" checked={reason === r} onChange={() => { setReason(r); setErr(false); }} />
              <span>{t("cs.r." + r)}</span>
            </label>
          ))}
        </div>
        {err && <div className="small" role="alert" style={{ color: "var(--red, #c0392b)", marginTop: 6 }}>{t("cs.err")}</div>}
      </fieldset>

      {askDetail && (
        <div style={{ margin: "0 0 14px" }}>
          <label className="small"><b>{t("cs.d." + reason)}</b></label>
          <input value={detail} maxLength={500} onChange={(e) => setDetail(e.target.value)} placeholder={t("cs.d.ph")} />
        </div>
      )}

      <fieldset className="cs-q" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend><b>{t("cs.q.used")}</b></legend>
        <div className="cs-chips">
          {CANCEL_FEATURES.map((f) => <button key={f} type="button" className={used.includes(f) ? "sm" : "ghost sm"} aria-pressed={used.includes(f)} onClick={() => toggle(f)}>{t("cs.f." + f)}</button>)}
        </div>
      </fieldset>

      <div style={{ margin: "0 0 14px" }}>
        <b>{t("cs.q.rating")}</b>
        <div className="cs-chips" role="radiogroup" aria-label={t("cs.q.rating")} style={{ marginTop: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} className={rating === n ? "sm" : "ghost sm"} onClick={() => setRating(n)}>{n}</button>)}
          <span className="muted small">{t("cs.rating.hint")}</span>
        </div>
      </div>

      <div style={{ margin: "0 0 12px" }}>
        <label className="small"><b>{t("cs.q.stay")}</b> <span className="muted">· {t("cs.optional")}</span></label>
        <textarea rows={3} value={stay} maxLength={1000} onChange={(e) => setStay(e.target.value)} />
      </div>

      <label className="cs-opt" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />
        <span>{t("cs.contact")}</span>
      </label>

      <p className="muted small" style={{ margin: "0 0 12px" }}>{trial ? t("cs.note.trial") : t("cs.note.sub", { when })}</p>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <button className="ghost" onClick={onClose}>{trial ? t("cs.keeptrial") : t("cs.keep")}</button>
        <button onClick={submit}>{trial ? t("cs.submit.trial") : t("cs.submit")}</button>
      </div>
    </Modal>
  );
}
