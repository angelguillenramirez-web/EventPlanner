import { useEffect, useState } from "react";
import { useT } from "../i18n";

/** Days to an event: "-129 Days"; inside the last 7 days a live countdown "-3 days · 22:11". */
export function useCountdown(date: string, time?: string) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, []);
  const target = new Date(`${date}T${time || "00:00"}`).getTime(), diff = target - now, DAY = 86400000;
  const p = (n: number) => String(n).padStart(2, "0");
  const parts = diff > 0 ? { d: Math.floor(diff / DAY), h: Math.floor((diff % DAY) / 3600000), m: Math.floor((diff % 3600000) / 60000) } : null; // days / hours / minutes left
  if (diff > 7 * DAY) return { big: `-${time ? Math.floor(diff / DAY) : Math.round((target - new Date().setHours(0, 0, 0, 0)) / DAY)}`, small: t("ev.days.far"), parts };
  if (diff > 0) { const d = Math.floor(diff / DAY), h = Math.floor((diff % DAY) / 3600000), m = Math.floor((diff % 3600000) / 60000); return { big: `-${d}`, small: `${t("ev.days.near")} · ${p(h)}:${p(m)}`, parts }; }
  if (now < target + DAY) return { big: t("ev.today"), small: "", parts };
  return { big: `+${Math.floor((now - target) / DAY)}`, small: t("ev.days.far"), parts };
}

/** lg = framed box of the event header, compact = the same when the header shrinks, card = small box on an event card, inline = plain text for lists. */
export default function Countdown({ date, time, variant = "lg" }: { date: string; time?: string; variant?: "lg" | "compact" | "card" | "inline" }) {
  const { t } = useT();
  const { big, small, parts } = useCountdown(date, time);
  if (variant === "lg" && parts) { // header: three tiles (days, hours, minutes) while the event is still ahead
    const tiles: [number, string][] = [[parts.d, "unit.d"], [parts.h, "unit.h"], [parts.m, "unit.m"]];
    return <div className="countdown tiles" title={t("ev.countdown")} role="timer" aria-label={`${t("ev.countdown")}: ${big} ${small}`}>{tiles.map(([n, k]) => <div key={k}><b>{k === "unit.d" ? n : String(n).padStart(2, "0")}</b><small>{t(k)}</small></div>)}</div>;
  }
  if (variant === "card" && parts) { // card: "34 DAYS" (same day count as the "Faltan N días" line on the card)
    const days = Math.max(0, time ? Math.floor((new Date(`${date}T${time}`).getTime() - Date.now()) / 86400000) : Math.ceil((new Date(date + "T12:00").getTime() - Date.now()) / 86400000));
    return <div className="countdown evcard" title={t("ev.countdown")} role="timer" aria-label={`${t("ev.countdown")}: ${days} ${t("unit.d")}`}><b>{days}</b><span>{t("unit.d")}</span></div>;
  }
  if (variant === "inline") return <span className="countdown-inline" title={t("ev.countdown")}><b>{big}</b> {small}</span>;
  return <div className={`countdown${variant === "lg" ? "" : variant === "card" ? " evcard" : " " + variant}`} title={t("ev.countdown")} role="timer" aria-label={`${t("ev.countdown")}: ${big} ${small}`}><b>{big}</b>{small && <span>{small}</span>}</div>;
}
