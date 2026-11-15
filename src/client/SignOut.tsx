import { useT } from "../i18n";
import { go, logout, update, useStore } from "../store";
import { unsavedList } from "./Account";
import { Modal } from "./ui";

/** Confirms signing out. When details were edited but not saved, it lists them first; continuing discards them. */
export default function SignOutDialog() {
  const { t } = useT();
  const s = useStore();
  if (!s.confirmOut || !s.loggedIn) return null;
  const close = () => update((st) => { st.confirmOut = false; });
  const list = unsavedList(s, t);
  return (
    <Modal title={t("out.title")} onClose={close}>
      {list.length > 0 ? (
        <>
          <p style={{ marginTop: 0 }}>{t("out.unsaved")}</p>
          <ul>{list.map((x) => <li key={x}><b>{x}</b></li>)}</ul>
          <p className="muted small">{t("out.discard")}</p>
        </>
      ) : <p style={{ marginTop: 0 }}>{t("out.sure")}</p>}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
        <button className="ghost" autoFocus onClick={close}>{list.length ? t("out.stay") : t("cancel")}</button>
        <button className={list.length ? "danger" : ""} onClick={() => { logout(); go("/"); }}>{list.length ? t("out.go.discard") : t("logout")}</button>
      </div>
    </Modal>
  );
}
