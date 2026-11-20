import { useStore, type Lang } from "./store";
import { D } from "./dict";

export const LANGS: { id: Lang; label: string }[] = [{ id: "es", label: "ES" }, { id: "en", label: "EN" }];
const idx: Record<Lang, number> = { en: 0, es: 1, pt: 2 };

export function useT() {
  const { lang, eventTypes } = useStore();
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = D[key]?.[idx[lang] ?? 1] ?? D[key]?.[0] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  /** Label for an event type: custom types carry their own name. */
  const tn = (id: string) => eventTypes.find((x) => x.id === id)?.name ?? t("type." + id);
  return { t, tn, lang, locale: lang === "es" ? "es-MX" : lang === "pt" ? "pt-BR" : "en-US" };
}
