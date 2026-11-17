import { useState } from "react";
import { useT } from "../i18n";
import { update, useStore } from "../store";
import { Moon, Sparkles } from "../icons";
import { motionOn, setMotion } from "../motion";

/** Account-menu rows with a sliding on/off switch (same look as the 1Plan design draft). */
export function ThemeSwitchItem() {
  const s = useStore();
  const { t } = useT();
  const dark = s.theme === "dark";
  return (
    <button role="menuitemcheckbox" aria-checked={dark} className="accitem" onClick={() => update((st) => { st.theme = dark ? "light" : "dark"; })}>
      <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}><Moon size={16} /> {t("acc.dark")}</span>
      <span className={`tgl${dark ? " on" : ""}`} aria-hidden />
    </button>
  );
}

/** Turns the app's animations on or off (remembered on this device). */
export function AnimSwitchItem() {
  const { t } = useT();
  const [on, setOn] = useState(motionOn());
  return (
    <button role="menuitemcheckbox" aria-checked={on} className="accitem" onClick={() => { setMotion(!on); setOn(!on); }}>
      <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}><Sparkles size={16} /> {t("acc.anim")}</span>
      <span className={`tgl${on ? " on" : ""}`} aria-hidden />
    </button>
  );
}
