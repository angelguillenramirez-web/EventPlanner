import { useState } from "react";
import { useT } from "../i18n";
import { COLORS, uid, update, useStore } from "../store";
import { ImagePlus, MapPin, Navigation, TypeIcon } from "../icons";

export interface EventValues { name: string; type: string; picture: string; description: string; date: string; location: string; venue: string }

/** Picture shown for an event: its own, else the planner's business logo, else an icon. */
export function EventThumb({ picture, type, size = 112, className = "" }: { picture: string; type: string; size?: number; className?: string }) {
  const { businessLogo } = useStore();
  const src = picture || businessLogo;
  return <div className={`thumb ${picture ? "" : "logo"} ${className}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" /> : <TypeIcon type={type} size={36} />}</div>;
}

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
      <div className="full">
        <label htmlFor="ep">{t("event.picture")}</label>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <EventThumb picture={v.picture} type={v.type} size={140} />
          <div className="grow">
            <label className="btn ghost" style={{ cursor: "pointer", color: "var(--ink)" }}><ImagePlus size={16} /> {t("event.picture.choose")}<input id="ep" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
            {v.picture && <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => set({ picture: "" })}>{t("event.picture.remove")}</button>}
            <p className="muted small" style={{ margin: "6px 0 0" }}><b>{t("event.picture.preferred")}</b> {t("event.picture.preferred.v")}<br /><b>{t("event.picture.standard")}</b> {t("event.picture.standard.v")}</p>
            <p className="muted small" style={{ margin: "4px 0 0" }}>{t("event.picture.note")}</p>
            {err && <p role="alert" style={{ color: "var(--rose)", margin: 0 }}>{err}</p>}
          </div>
        </div>
      </div>
      <div className="full"><label htmlFor="ed">{t("description")}</label><textarea id="ed" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} /></div>
      <div><label htmlFor="edt">{t("event.date")}</label><input id="edt" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} /></div>
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
