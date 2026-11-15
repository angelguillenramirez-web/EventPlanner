import { useT } from "../i18n";
import { HOWTO_VIDEO_URL, update, useStore } from "../store";
import { ClipboardCheck, Inbox, Play, Users } from "../icons";
import { Modal } from "./ui";

/** The "how to" video. The real video is added later (HOWTO_VIDEO_URL in the store); until then a placeholder with the main steps is shown. */
export function HowTo({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const steps: [React.ReactNode, string][] = [[<Play size={16} />, "howto.s1"], [<Users size={16} />, "howto.s2"], [<ClipboardCheck size={16} />, "howto.s3"], [<Inbox size={16} />, "howto.s4"]];
  return (
    <Modal title={t("howto.title")} onClose={onClose} wide>
      {HOWTO_VIDEO_URL
        ? <video className="howtovid" src={HOWTO_VIDEO_URL} controls autoPlay playsInline />
        : <div className="howtovid ph" role="img" aria-label={t("howto.soon")}><span className="playbtn"><Play size={30} /></span><b>{t("howto.soon")}</b><span className="muted small">{t("howto.soon.sub")}</span></div>}
      <ol className="howtosteps">{steps.map(([ic, k]) => <li key={k}><span className="nico">{ic}</span><span>{t(k)}</span></li>)}</ol>
      <div className="row" style={{ justifyContent: "flex-end" }}><button onClick={onClose}>{t("howto.start")}</button></div>
    </Modal>
  );
}

/** Shows the video once, the first time each user enters the platform. */
export function HowToGate() {
  const s = useStore();
  const key = s.sessionId || "owner";
  if (!s.loggedIn || s.tourSeen.includes(key)) return null;
  return <HowTo onClose={() => update((st) => { if (!st.tourSeen.includes(key)) st.tourSeen.push(key); })} />;
}
