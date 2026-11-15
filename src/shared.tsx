import { useSyncExternalStore } from "react";
import { LANGS, useT } from "./i18n";
import { Moon, Sun } from "./icons";
import { update, useStore } from "./store";

export function LangSwitch() {
  const { lang } = useStore();
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => <button key={l.id} aria-pressed={lang === l.id} onClick={() => update((s) => { s.lang = l.id; })}>{l.label}</button>)}
    </div>
  );
}
/** Single icon toggle: light <-> dark. */
export function ThemeToggle() {
  const { theme } = useStore();
  const { t } = useT();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="ghost icon" aria-label={t("theme." + next)} title={t("theme." + next)} onClick={() => update((s) => { s.theme = next; })}>
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
import logoUrl from "./assets/logo.png";
/** The calendar mark used in the upper-left corner of the app (not on the public website). */
export const AppMark = ({ size = 30 }: { size?: number }) => <img className="appmark" src={logoUrl} alt="" width={size} height={size} />;
export const Logo = ({ href }: { href: string }) => <a className="logo" href={href}>A <b>plan</b></a>;

/** True while the media query matches (e.g. "(max-width: 700px)" for phones). */
export function useMedia(q: string) {
  return useSyncExternalStore((cb) => { const m = matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => matchMedia(q).matches);
}
