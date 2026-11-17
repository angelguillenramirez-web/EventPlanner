import { useSyncExternalStore } from "react";
import { useT } from "../i18n";
import { Modal } from "./ui";

/** The platform's own confirmation window. Use ask(message, onYes) instead of the browser's confirm(): every question looks like the rest of the app. */
interface Pending { message: string; onYes: () => void; yes?: string; danger?: boolean }
let pending: Pending | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function ask(message: string, onYes: () => void, opts: { yes?: string; danger?: boolean } = {}) { pending = { message, onYes, ...opts }; emit(); }
const close = () => { pending = null; emit(); };

export function AskHost() {
  const p = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => pending);
  const { t } = useT();
  if (!p) return null;
  return (
    <Modal title={t("ask.title")} onClose={close}>
      <p style={{ margin: "0 0 16px", whiteSpace: "pre-line" }}>{p.message}</p>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="ghost" onClick={close}>{t("cancel")}</button>
        <button className={p.danger ? "danger" : ""} autoFocus onClick={() => { const f = p.onYes; close(); f(); }}>{p.yes ?? t("ask.yes")}</button>
      </div>
    </Modal>
  );
}
