import { useState } from "react";
import { useT } from "./i18n";
import { go, update, useStore, type Profile } from "./store";
import { LangSwitch, Logo, ThemeToggle } from "./shared";

const QUESTIONS: { id: keyof Profile; multi?: boolean; opts: string[] }[] = [
  { id: "role", opts: ["planner", "wedding", "corporate", "venue", "vendor", "other"] },
  { id: "volume", opts: ["1-5", "6-20", "21-50", "50+"] },
  { id: "team", opts: ["solo", "2-5", "6-15", "16+"] },
  { id: "goals", multi: true, opts: ["tasks", "invitations", "seating", "clients", "suppliers", "docs"] },
  { id: "source", opts: ["search", "referral", "social", "event", "other"] },
];

/** Step 4: five short questions about the user's profile and expectations. */
export default function Welcome() {
  const { t } = useT();
  const s = useStore();
  const [i, setI] = useState(0);
  const [a, setA] = useState<Record<string, string | string[]>>({ goals: [] });
  const q = QUESTIONS[i], val = a[q.id];
  const ok = q.multi ? (val as string[]).length > 0 : !!val;
  const toggle = (o: string) => setA({ ...a, [q.id]: q.multi ? ((val as string[]).includes(o) ? (val as string[]).filter((x) => x !== o) : [...(val as string[]), o]) : o });
  const next = () => {
    if (!ok) return;
    if (i < QUESTIONS.length - 1) return setI(i + 1);
    update((st) => { const acct = st.accounts.find((x) => x.id === st.sessionId); if (acct) acct.profile = a as unknown as Profile; });
    go("/choose-type");
  };
  void s;
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
      <div style={{ width: 600, maxWidth: "100%" }}>
        <div className="row between" style={{ marginBottom: 20 }}><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        <h1 style={{ marginBottom: 4 }}>{t("prof.title")}</h1><p className="muted" style={{ marginTop: 0 }}>{t("prof.sub")}</p>
        <div className="profbar" aria-hidden><span style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} /></div>
        <div className="card">
          <div className="muted small">{t("prof.step", { n: i + 1, m: QUESTIONS.length })}</div>
          <h2 style={{ margin: "4px 0 14px" }}>{t("prof.q." + q.id)}</h2>
          <div className="grid" style={{ gap: 8 }} role={q.multi ? "group" : "radiogroup"}>
            {q.opts.map((o) => { const on = q.multi ? (val as string[]).includes(o) : val === o; return (
              <button type="button" key={o} className={`profopt${on ? " on" : ""}`} role={q.multi ? "checkbox" : "radio"} aria-checked={on} onClick={() => toggle(o)}>{t("prof.o." + o)}</button>
            ); })}
          </div>
          <div className="row between" style={{ marginTop: 18 }}>
            <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{t("back")}</button>
            <button disabled={!ok} onClick={next}>{i < QUESTIONS.length - 1 ? t("prof.next") : t("prof.finish")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
