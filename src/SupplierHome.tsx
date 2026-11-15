import { useT } from "./i18n";
import { askLogout, useStore } from "./store";
import { AppMark, LangSwitch, Logo, ThemeToggle } from "./shared";

export default function SupplierHome() {
  const { t } = useT();
  const s = useStore();
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: 560, maxWidth: "100%", textAlign: "center" }}>
        <div className="row between"><span className="brandrow"><AppMark /><Logo href="#/" /></span><div className="row"><LangSwitch /><ThemeToggle /></div></div>
        <div style={{ fontSize: "2.6rem", marginTop: 16 }}>🤝</div>
        <h2>{t("supplier.soon")}</h2>
        <p className="muted">{s.userName} · {t("acct.supplier")}</p>
        <p>{t("supplier.soon.d")}</p>
        <button className="ghost" onClick={askLogout}>{t("logout")}</button>
      </div>
    </div>
  );
}
