import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { go, goNotif, update, useStore } from "../store";
import { DI } from "../navicons";
import { reduce, toast } from "../motion";

/** Slide-in notifications panel opened from the bell in the top bar (same look as the design draft). */
export default function NotifDrawer({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const { t, locale } = useT();
  const [out, setOut] = useState(false);
  const close = () => { if (out) return; if (reduce()) { onClose(); return; } setOut(true); setTimeout(onClose, 220); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line
  const list = [...s.notifs].sort((a, b) => b.at - a.at).slice(0, 12);
  const unread = s.notifs.filter((n) => !n.read).length;
  const ago = (at: number) => {
    const m = Math.round((at - Date.now()) / 60000), rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (Math.abs(m) < 60) return rtf.format(m, "minute");
    if (Math.abs(m) < 1440) return rtf.format(Math.round(m / 60), "hour");
    return rtf.format(Math.round(m / 1440), "day");
  };
  const open = (id: string, href: string) => { update((st) => { const n = st.notifs.find((x) => x.id === id); if (n) n.read = true; }); onClose(); goNotif(href); };
  const markAll = () => { update((st) => { st.notifs.forEach((n) => { n.read = true; }); }); toast(t("toast.allread")); };
  return (
    <>
      <div className={`ndbg${out ? " out" : ""}`} onClick={close} />
      <aside className={`ndrw${out ? " out" : ""}`} role="dialog" aria-label={t("inb.notifications")}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "1.4rem" }}>{t("inb.notifications")}</h3>
          <button className="ghost icon" aria-label="Close" onClick={close}><DI k="x" size={18} /></button>
        </div>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="muted small">{unread > 0 ? `${unread} ${t("inb.f.unread").toLowerCase()}` : t("toast.allread")}</span>
          <button className="ghost sm" disabled={unread === 0} onClick={markAll}>{t("inb.markall")}</button>
        </div>
        <div className="nlist">
          {list.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 24 }}>{t("inb.n.empty")}</p>}
          {list.map((n, i) => (
            <button key={n.id} className={`nitem${n.read ? " read" : ""}`} style={{ ["--i" as string]: i }} onClick={() => open(n.id, n.href)}>
              <span className="ndot" aria-hidden />
              <span style={{ flex: 1, textAlign: "left" }}><b>{t(n.key, n.vars)}</b><span className="muted small">{t("inb.t." + n.type)} · {ago(n.at)}</span></span>
            </button>
          ))}
        </div>
        <button className="ghost" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={() => { onClose(); go("/app/inbox/notifications"); }}>{t("notif.viewall")}</button>
      </aside>
    </>
  );
}
