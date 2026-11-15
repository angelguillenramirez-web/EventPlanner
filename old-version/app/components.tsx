import { setLang } from "./actions";
import { getLang } from "@/lib/i18n";

export async function LangSwitch({ back }: { back: string }) {
  const lang = await getLang();
  return (
    <div className="langs no-print" role="group" aria-label="Language">
      {(["es", "en"] as const).map((l) => (
        <form action={setLang} key={l}>
          <input type="hidden" name="lang" value={l} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" aria-pressed={lang === l}>{l.toUpperCase()}</button>
        </form>
      ))}
    </div>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + "%" }} /></div>;
}

export const statusTone = (s: string) => (s === "CONFIRMED" || s === "DONE" ? "ok" : s === "CANCELLED" ? "bad" : "warn");
export const guestTone = (s: string) => (s === "ATTENDING" ? "ok" : s === "DECLINED" ? "bad" : "");
