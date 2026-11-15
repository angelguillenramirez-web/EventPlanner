import { useT } from "../i18n";
import { go, update, useStore } from "../store";
import { LockI } from "../icons";

export default function Upsell() {
  const { upsell } = useStore();
  const { t } = useT();
  if (!upsell) return null;
  const close = () => update((s) => { s.upsell = null; });
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={t("upsell.title")} onClick={close}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h3><LockI /> {t("upsell.title")}</h3>
        <p>{t("upsell." + upsell)}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="ghost" onClick={close}>{t("cancel")}</button>
          <button onClick={() => { close(); go("/app/account"); }}>{t("upsell.cta")}</button>
        </div>
      </div>
    </div>
  );
}
