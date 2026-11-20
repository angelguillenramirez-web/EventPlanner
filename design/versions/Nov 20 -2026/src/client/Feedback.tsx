import { useState } from "react";
import { useT } from "../i18n";
import { update, useStore } from "../store";
import { Download } from "../icons";

const Stars = ({ v, set }: { v: number; set: (n: number) => void }) => (
  <div className="row" role="radiogroup" aria-label="rating" style={{ gap: 2 }}>
    {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={v === n} className="ghost" style={{ fontSize: "1.3rem", padding: "0 4px", border: 0, color: n <= v ? "var(--gold)" : "var(--muted)" }} onClick={() => set(n)}>★</button>)}
  </div>
);

export function Feedback() {
  const s = useStore();
  const { t } = useT();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <>
      <h1>{t("nav.feedback")}</h1><p className="muted">{t("feedback.desc")}</p>
      <form className="card form" style={{ maxWidth: 640 }} onSubmit={(e) => { e.preventDefault(); if (!rating) return; update((st) => { st.feedback.push({ rating, text, at: Date.now() }); }); setRating(0); setText(""); setOk(true); }}>
        <div className="full"><label>{t("feedback.rating")}</label><Stars v={rating} set={(n) => { setRating(n); setOk(false); }} /></div>
        <div className="full"><label htmlFor="ft">{t("feedback.text")}</label><textarea id="ft" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <button disabled={!rating}>{t("support.send")}</button>
        {ok && <span role="status" style={{ color: "var(--teal)" }}>{t("feedback.thanks")}</span>}
      </form>
      <p className="muted small">{s.feedback.length > 0 && t("feedback.count", { n: s.feedback.length })}</p>
    </>
  );
}
