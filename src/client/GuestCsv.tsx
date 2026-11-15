import { useState } from "react";
import { useT } from "../i18n";
import { guestDefaults, uid, update, type Channel, type EventT, type Guest, type Lang } from "../store";
import { COUNTRIES, dialOf } from "../countries";
import { AlertCircle, Check, Download, Upload } from "../icons";
import { Modal } from "./ui";

const HEAD = ["name", "guests", "channel", "country", "whatsapp", "email", "language", "message"];
const SAMPLE = [["Maria Lopez", "2", "whatsapp", "MX", "5512345678", "", "es", "Welcome!"], ["John Smith", "1", "email", "US", "", "john@example.com", "en", ""]];

/** Reads CSV text (comma or semicolon, quoted fields, line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = (src.split("\n")[0].match(/;/g)?.length ?? 0) > (src.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const cell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** Downloads an example file the user can fill in (Excel and Google Sheets open it directly). */
export const downloadTemplate = () => {
  const csv = "﻿" + [HEAD, ...SAMPLE].map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "guest-list-template.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

interface Row { n: number; guest?: Guest; err?: string }
/** Import window: choose a CSV, review what will be added and what has problems, then confirm. */
export function CsvImport({ event, existing, onClose }: { event: EventT; existing: Guest[]; onClose: () => void }) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [file, setFile] = useState("");
  const [err, setErr] = useState("");
  const read = async (f: File | undefined) => {
    if (!f) return;
    setErr(""); setFile(f.name);
    if (f.size > 2_000_000) return setErr(t("csv.err.big"));
    const data = parseCsv(await f.text());
    if (data.length < 2) return setErr(t("csv.err.empty"));
    const idx = (k: string, alt: string[] = []) => data[0].findIndex((h) => [k, ...alt].includes(h.trim().toLowerCase()));
    const ix = { name: idx("name", ["nombre", "nome"]), guests: idx("guests", ["invitees", "invitados", "convidados", "personas"]), channel: idx("channel", ["canal"]), country: idx("country", ["pais", "país", "país"]), phone: idx("whatsapp", ["phone", "telefono", "teléfono", "telefone"]), email: idx("email", ["correo", "e-mail"]), lang: idx("language", ["lang", "idioma"]), msg: idx("message", ["mensaje", "mensagem"]) };
    if (ix.name < 0) return setErr(t("csv.err.cols"));
    const seen = new Set(existing.map((g) => (g.name + g.email + g.phone).toLowerCase()));
    const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    setRows(data.slice(1).map((r, i): Row => {
      const name = get(r, ix.name), email = get(r, ix.email), num = get(r, ix.phone).replace(/[^\d]/g, "");
      const cRaw = get(r, ix.country).toUpperCase(), country = COUNTRIES.find((c) => c.iso === cRaw || c.dial === cRaw || c.name.toUpperCase() === cRaw)?.iso ?? "MX";
      const chRaw = get(r, ix.channel).toLowerCase(), channel: Channel = chRaw.startsWith("e") || chRaw.startsWith("c") ? "email" : chRaw.startsWith("w") ? "whatsapp" : email && !num ? "email" : "whatsapp";
      const lang = (["es", "en", "pt"].includes(get(r, ix.lang).toLowerCase()) ? get(r, ix.lang).toLowerCase() : "es") as Lang;
      if (!name) return { n: i + 2, err: t("csv.err.name") };
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { n: i + 2, err: t("csv.err.email", { v: email }) };
      if (channel === "whatsapp" && !num) return { n: i + 2, err: t("csv.err.phone") };
      if (channel === "email" && !email) return { n: i + 2, err: t("csv.err.mail") };
      const phone = num ? `${dialOf(country)} ${num}` : "";
      if (seen.has((name + email + phone).toLowerCase())) return { n: i + 2, err: t("csv.err.dup") };
      seen.add((name + email + phone).toLowerCase());
      return { n: i + 2, guest: guestDefaults({ id: uid(), eventId: event.id, name, invitees: Math.max(1, parseInt(get(r, ix.guests)) || 1), message: get(r, ix.msg), channel, country, phone, email, lang }) };
    }));
  };
  const ok = rows?.filter((r) => r.guest) ?? [], bad = rows?.filter((r) => r.err) ?? [];
  const run = () => { update((st) => { ok.forEach((r) => st.guests.push(r.guest!)); }); onClose(); };
  return (
    <Modal title={t("csv.title")} onClose={onClose} wide>
      <p className="muted small" style={{ marginTop: 0 }}>{t("csv.sub")}</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="ghost" onClick={downloadTemplate}><Download size={15} /> {t("csv.template")}</button>
        <label className="ghost btnlike"><Upload size={15} /> {file || t("csv.choose")}<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      {err && <p role="alert" style={{ color: "var(--rose)" }}>{err}</p>}
      {rows && (
        <>
          <p className="row" style={{ gap: 12, margin: "14px 0 6px" }}><span style={{ color: "var(--teal)" }}><Check size={14} style={{ verticalAlign: -2 }} /> {t("csv.ready", { n: ok.length })}</span>{bad.length > 0 && <span style={{ color: "var(--rose)" }}><AlertCircle size={14} style={{ verticalAlign: -2 }} /> {t("csv.skipped", { n: bad.length })}</span>}</p>
          {bad.length > 0 && <ul className="small" style={{ maxHeight: 120, overflow: "auto", margin: "0 0 8px", paddingLeft: 18 }}>{bad.slice(0, 50).map((r) => <li key={r.n}>{t("csv.row", { n: r.n })}: {r.err}</li>)}</ul>}
          {ok.length > 0 && <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 4 }}><table><thead><tr><th>{t("name")}</th><th>{t("gst.invitees")}</th><th>{t("gst.contact")}</th></tr></thead><tbody>{ok.slice(0, 100).map((r) => <tr key={r.n}><td>{r.guest!.name}</td><td>{r.guest!.invitees}</td><td className="small">{r.guest!.channel === "email" ? r.guest!.email : r.guest!.phone}</td></tr>)}</tbody></table></div>}
        </>
      )}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button className="ghost" onClick={onClose}>{t("cancel")}</button><button disabled={!ok.length} onClick={run}>{t("csv.import", { n: ok.length })}</button></div>
    </Modal>
  );
}
