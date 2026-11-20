import { useT } from "../i18n";
import { go, upgradeToPlanner } from "../store";
import { LockI } from "../icons";

/** What a free supplier account sees in the planner-only sections: they need the Planner plan. */
export default function Locked() {
  const { t } = useT();
  return (
    <div className="card" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: "2.2rem" }}><LockI /></div>
      <h2 style={{ margin: "8px 0" }}>{t("lock.title")}</h2>
      <p className="muted">{t("lock.body")}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
        <button onClick={upgradeToPlanner}>{t("sup.app.promo.link")} →</button>
        <button className="ghost" onClick={() => go("/app/services")}>{t("lock.back")}</button>
      </div>
    </div>
  );
}
