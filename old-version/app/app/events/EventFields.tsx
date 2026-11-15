import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import { toInputD, toInputDT } from "@/lib/util";
import type { TFn } from "@/lib/i18n";

type Ev = { title: string; type: string; status: string; date: Date; venue: string; description: string; rsvpDeadline: Date | null; clientId: string | null };

export function EventFields({ t, ev, clients }: { t: TFn; ev?: Ev; clients: { id: string; name: string }[] }) {
  return (
    <div className="fields">
      <div className="full"><label htmlFor="title">{t("title")}</label><input id="title" name="title" required defaultValue={ev?.title} /></div>
      <div><label htmlFor="type">{t("type")}</label>
        <select id="type" name="type" defaultValue={ev?.type ?? "WEDDING"}>{EVENT_TYPES.map((x) => <option key={x} value={x}>{t("type." + x)}</option>)}</select></div>
      <div><label htmlFor="status">{t("status")}</label>
        <select id="status" name="status" defaultValue={ev?.status ?? "PLANNING"}>{EVENT_STATUSES.map((x) => <option key={x} value={x}>{t("status." + x)}</option>)}</select></div>
      <div><label htmlFor="date">{t("date")}</label><input id="date" name="date" type="datetime-local" required defaultValue={toInputDT(ev?.date)} /></div>
      <div><label htmlFor="rsvpDeadline">{t("rsvpDeadline")}</label><input id="rsvpDeadline" name="rsvpDeadline" type="date" defaultValue={toInputD(ev?.rsvpDeadline)} /></div>
      <div><label htmlFor="venue">{t("venue")}</label><input id="venue" name="venue" defaultValue={ev?.venue} /></div>
      <div><label htmlFor="clientId">{t("client")}</label>
        <select id="clientId" name="clientId" defaultValue={ev?.clientId ?? ""}><option value="">{t("noClient")}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="full"><label htmlFor="description">{t("description")}</label><textarea id="description" name="description" rows={3} defaultValue={ev?.description} /></div>
    </div>
  );
}
