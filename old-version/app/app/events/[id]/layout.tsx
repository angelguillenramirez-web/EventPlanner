import { requireUser, getEventFor } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { statusTone } from "@/app/components";
import EventTabs from "./Tabs";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEventFor(user, id);
  const { t, locale } = await getT();
  return (
    <>
      <div className="row between">
        <div>
          <span className="badge">{t("type." + ev.type)}</span> <span className={`badge ${statusTone(ev.status)}`}>{t("status." + ev.status)}</span>
          <h1 style={{ marginTop: 6 }}>{ev.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{ev.date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}{ev.venue && ` · ${ev.venue}`}</p>
        </div>
      </div>
      <EventTabs id={id} labels={{ overview: t("overview"), checklist: t("checklist"), schedule: t("schedule"), guests: t("guests"), forms: t("forms"), documents: t("documents") }} />
      {children}
    </>
  );
}
