import { useT } from "./i18n";
import { go, update, useStore } from "./store";
import { LangSwitch, Logo, ThemeToggle } from "./shared";

/** Step 5: choose the kind of account to create; step 6: go to its page. */
export default function ChooseType() {
  const { t } = useT();
  const s = useStore();
  const acct = s.accounts.find((a) => a.id === s.sessionId);
  const suggested = acct?.profile && ["vendor", "venue"].includes(acct.profile.role) ? "supplier" : "planner";
  const pick = (type: "planner" | "supplier") => { update((st) => { st.accountType = type; if (type === "supplier") st.services = []; const a = st.accounts.find((x) => x.id === st.sessionId); if (a) { a.accountType = type; a.types = [type]; } }); go(type === "planner" ? "/trial" : "/app"); };
  const opts: ["planner" | "supplier", string][] = [["planner", "🗓"], ["supplier", "🤝"]];
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
      <div style={{ width: 640, maxWidth: "100%" }}>
        <div className="row between" style={{ marginBottom: 24 }}><Logo href="#/" /><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        <h1>{t("type.title")}</h1><p className="muted">{t("type.sub")}</p>
        <div className="grid g2">
          {opts.map(([id, ic]) => (
            <button key={id} onClick={() => pick(id)} className="card" style={{ textAlign: "left", display: "block", cursor: "pointer", color: "var(--ink)", background: "var(--surface)", borderColor: id === suggested ? "var(--teal)" : "var(--line)", fontWeight: 400 }}>
              <div style={{ fontSize: "2.2rem" }}>{ic}</div><h2>{t("acct." + id)}</h2>{id === suggested && <span className="badge ok">{t("type.suggested")}</span>}<p className="muted" style={{ margin: "6px 0 0" }}>{t("acct." + id + ".d")}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
