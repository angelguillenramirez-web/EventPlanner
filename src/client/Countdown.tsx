import { useEffect, useState } from "react";
import { useT } from "../i18n";

/** Days to an event: "-129 Days"; inside the last 7 days a live countdown "-3 days · 22:11". */
export function useCountdown(date: string) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, []);
  const target = new Date(date + "T00:00").getTime(), diff = target - now, DAY = 86400000;
  const p = (n: number) => String(n).padStart(2, "0");
  if (diff > 7 * DAY) { const today = new Date(); today.setHours(0, 0, 0, 0); return { big: `-${Math.round((target - +today) / DAY)}`, small: t("ev.days.far") }; }
  if (diff > 0) { const d = Math.floor(diff / DAY), h = Math.floor((diff % DAY) / 3600000), m = Math.floor((diff % 3600000) / 60000); return { big: `-${d}`, small: `${t("ev.days.near")} · ${p(h)}:${p(m)}` }; }
  if (now < target + DAY) return { big: t("ev.today"), small: "" };
  return { big: `+${Math.floor((now - target) / DAY)}`, small: t("ev.days.far") };
}

/** lg = framed box of the event header, compact = the same when the header shrinks, card = small box on an event card, inline = plain text for lists. */
export default function Countdown({ date, variant = "lg" }: { date: string; variant?: "lg" | "compact" | "card" | "inline" }) {
  const { t } = useT();
  const { big, small } = useCountdown(date);
  if (variant === "inline") return <span className="countdown-inline" title={t("ev.countdown")}><b>{big}</b> {small}</span>;
  return <div className={`countdown${variant === "lg" ? "" : variant === "card" ? " evcard" : " " + variant}`} title={t("ev.countdown")} role="timer" aria-label={`${t("ev.countdown")}: ${big} ${small}`}><b>{big}</b>{small && <span>{small}</span>}</div>;
}
