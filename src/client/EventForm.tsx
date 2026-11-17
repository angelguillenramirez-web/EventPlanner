import { useState } from "react";
import { useT } from "../i18n";
import { COLORS, uid, update, useStore } from "../store";
import { ImagePlus, MapPin, Navigation, TypeIcon } from "../icons";

export interface EventValues { name: string; type: string; picture: string; description: string; date: string; time?: string; location: string; venue: string }


export const mapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const mapsDirections = (q: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

export default function EventForm({ initial, submitLabel, onSubmit, onCancel }: { initial: EventValues; submitLabel: string; onSubmit: (v: EventValues) => void; onCancel?: () => void }) {
  const s = useStore();
  const { t, tn } = useT();
  const [v, setV] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");
  const [err, setErr] = useState("");
  const set = (p: Partial<EventValues>) => setV({ ...v, ...p });

  const addType = () => {
    const name = newType.trim();
    if (!name) return;
    const exists = s.eventTypes.find((x) => tn(x.id).toLowerCase() === name.toLowerCase());
    const id = exists?.id ?? "c" + uid();
    if (!exists) update((st) => { st.eventTypes.push({ id, name, color: COLORS.teal, custom: true }); });
    set({ type: id }); setAdding(false); setNewType("");
  };
  const onFile = (f?: File) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 2 * 1024 * 1024) { setErr(t("event.imgerr")); return; }
    setErr("");
    const r = new FileReader();
    r.onload = () => set({ picture: String(r.result) });
    r.readAsDataURL(f);
  };
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (v.name.trim() && v.type) onSubmit({ ...v, name: v.name.trim() }); }}>
      <div className="full"><label htmlFor="en">{t("event.name")} *</label><input id="en" required value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="full">
        <label htmlFor="et">{t("event.type")} *</label>
        <select id="et" required value={adding ? "__add__" : v.type} onChange={(e) => { if (e.target.value === "__add__") setAdding(true); else { setAdding(false); set({ type: e.target.value }); } }}>
          <option value="" disabled>{t("event.type.pick")}</option>
          {s.eventTypes.map((ty) => <option key={ty.id} value={ty.id}>{tn(ty.id)}{ty.custom ? " ★" : ""}</option>)}
          <option value="__add__">+ {t("event.type.add")}</option>
        </select>
        {adding && (
          <div className="row" style={{ marginTop: 8 }}>
            <input style={{ flex: 1 }} autoFocus value={newType} placeholder={t("event.type.new")} aria-label={t("event.type.new")} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }} />
            <button type="button" onClick={addType}>{t("add")}</button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>{t("cancel")}</button>
          </div>
        )}
        {adding && <p className="muted small" style={{ margin: "4px 0 0" }}>{t("event.type.note")}</p>}
      </div>
      <div className="full"><label htmlFor="ed">{t("description")}</label><textarea id="ed" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} /></div>
      <div><label htmlFor="edt">{t("event.date")}</label><input id="edt" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} /></div>
      <div><label htmlFor="etm">{t("event.time")}</label><input id="etm" type="time" value={v.time ?? ""} onChange={(e) => set({ time: e.target.value })} /></div>
      <div className="full">
        <label htmlFor="el">{t("location")} · Google Maps</label>
        <div className="row" style={{ flexWrap: "nowrap" }}><MapPin size={18} className="muted" /><input id="el" value={v.location} placeholder={t("location.ph")} onChange={(e) => set({ location: e.target.value })} /></div>
        {(v.location.trim() || v.venue.trim()) && (
          <div className="maplinks">
            <a href={mapsSearch([v.venue, v.location].filter(Boolean).join(", "))} target="_blank" rel="noopener noreferrer"><MapPin size={14} />{t("map.view")}</a>
            <a href={mapsDirections([v.venue, v.location].filter(Boolean).join(", "))} target="_blank" rel="noopener noreferrer"><Navigation size={14} />{t("map.directions")}</a>
          </div>
        )}
      </div>
      <div className="full"><label htmlFor="ev">{t("venue")}</label><input id="ev" value={v.venue} onChange={(e) => set({ venue: e.target.value })} /></div>
      <div className="full row"><button type="submit">{submitLabel}</button>{onCancel && <button type="button" className="ghost" onClick={onCancel}>{t("cancel")}</button>}</div>
    </form>
  );
}
