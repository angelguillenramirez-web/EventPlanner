import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { useCloudStatus } from "../cloud";

/** Small save indicator for real accounts: "Saving…", "Saved" (fades out), or an error that stays until the next save works. */
export default function CloudBadge() {
  const { t } = useT();
  const st = useCloudStatus();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (st === "idle") return setShow(false);
    setShow(true);
    if (st !== "saved") return;
    const id = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(id);
  }, [st]);
  if (!show || st === "idle") return null;
  const bad = st === "error";
  return (
    <div role={bad ? "alert" : "status"} className="small" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 60, padding: "6px 12px", borderRadius: 12, background: "var(--surface)", border: `1px solid ${bad ? "var(--danger)" : "var(--line)"}`, color: bad ? "var(--danger)" : "var(--muted)", boxShadow: "var(--shadow)", maxWidth: 320 }}>
      {t(bad ? "cloud.error" : st === "saving" ? "cloud.saving" : "cloud.saved")}
    </div>
  );
}
