import { useState } from "react";
import { useT } from "../i18n";
import { me, notify, uid, update, useStore, type Approver, type EventT, type Signoff, type SignoffScope, type Snap } from "../store";
import { Check, ClipboardCheck } from "../icons";
import { Modal } from "./ui";
import SnapView from "./ApprovalSnap";

/**
 * "Start approval" button for itinerary, table arrangement, invitation, talent and menu.
 * Opens a floating window where the planner and the clients confirm a decision. Approvals are
 * append-only: they keep who, when and a frozen summary, and can never be undone or deleted.
 */
export default function ApprovalButton({ event, scope, subject, summary, snap, blocked, disabled }: { event: EventT; scope: SignoffScope; subject: string; summary: () => string[]; snap?: () => Snap; blocked?: string; disabled?: boolean }) {
  const s = useStore();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]); // collaborator ids asked to approve
  const [big, setBig] = useState<{ subject: string; snap: Snap } | null>(null); // miniature clicked: show it large
  const [confirmId, setConfirmId] = useState<string | null>(null); // "<signoff>:<approver>" awaiting the "cannot be undone" confirmation
  const mine = s.signoffs.filter((x) => x.eventId === event.id && x.scope === scope && x.subject === subject).sort((a, b) => b.startedAt - a.startedAt);
  const pendingOne = mine.find((x) => x.approvers.some((a) => !a.at));
  const who = me(s);
  const people = s.team.filter((m) => m.scopeAll || m.eventIds.includes(event.id));
  const when = (ms: number) => new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const done = (x: Signoff) => x.approvers.every((a) => a.at);
  const lastDone = mine.find(done);

  const begin = () => {
    update((st) => {
      const pick = st.team.filter((m) => picked.includes(m.id));
      st.signoffs.push({
        id: uid(), eventId: event.id, scope, subject, summary: summary(), snap: snap?.(), startedBy: me(st).name, startedAt: Date.now(),
        approvers: ([{ id: uid(), name: st.userName, kind: "planner", userId: "owner", at: 0, by: "" }, ...pick.map((m) => ({ id: uid(), name: m.name, kind: (m.kind === "client" ? "client" : "planner") as "client" | "planner", userId: m.id, at: 0, by: "" }))] as Approver[]).filter((x, i, arr) => arr.findIndex((y) => y.userId === x.userId) === i),
      });
      notify(st, "approval", "inb.n.started", { name: me(st).name, subject }, `/app/event/${event.id}`);
    });
    setStarting(false); setPicked([]);
  };
  const approve = (sid: string, aid: string) => {
    update((st) => { const so = st.signoffs.find((x) => x.id === sid); const a = so?.approvers.find((x) => x.id === aid); if (so && a && !a.at && a.userId === me(st).id) { a.at = Date.now(); a.by = me(st).name; notify(st, "approval", "inb.n.approved", { name: a.by, subject: so.subject }, `/app/event/${so.eventId}`); } }); // only the indicated user, from their own profile
    setConfirmId(null);
  };
  const label = pendingOne ? t("apv.pending", { n: pendingOne.approvers.filter((a) => a.at).length, m: pendingOne.approvers.length }) : lastDone ? t("apv.approved") : t("apv.start");
  return (
    <>
      <button className={lastDone && !pendingOne ? "ghost apvbtn done" : "ghost apvbtn"} disabled={disabled || (!!blocked && mine.length === 0)} onClick={() => { setOpen(true); setStarting(mine.length === 0); }} title={blocked || t("apv.desc")}>
        {lastDone && !pendingOne ? <Check size={15} /> : <ClipboardCheck size={15} />} {label}
      </button>
      {open && (
        <Modal title={`${t("apv.title")} · ${subject}`} onClose={() => { setOpen(false); setConfirmId(null); }} wide>
          <p className="muted" style={{ marginTop: 0 }}>{t("apv.warn")}</p>
          {starting ? (
            <div>
              <h3 style={{ margin: "0 0 6px" }}>{t("apv.summary")}</h3>
              <div className="apvbody">
                {snap && <button type="button" className="apvmini" aria-label={t("apv.open")} title={t("apv.open")} onClick={() => setBig({ subject, snap: snap() })}><SnapView snap={snap()} mini /></button>}
                <ul className="apvsum">{summary().map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <h3 style={{ margin: "14px 0 6px" }}>{t("apv.who")}</h3>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked disabled style={{ width: "auto" }} /> {s.userName} <span className="muted small">({t("apv.owner")})</span></label>
              {people.map((c) => (
                <label key={c.id} className="row" style={{ gap: 8, marginTop: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} /> {c.name} <span className="muted small">({t("collab.kind." + c.kind)})</span></label>
              ))}
              {people.length === 0 && <p className="muted small" style={{ margin: "6px 0 0" }}>{t("apv.nocollab")}</p>}
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                {mine.length > 0 && <button className="ghost" onClick={() => setStarting(false)}>{t("cancel")}</button>}
                <button onClick={begin}><ClipboardCheck size={15} /> {t("apv.begin")}</button>
              </div>
            </div>
          ) : (
            <>
              {mine.map((x) => (
                <div key={x.id} className="card apvcard" style={{ boxShadow: "none" }}>
                  <div className="row between" style={{ flexWrap: "nowrap" }}>
                    <b>{done(x) ? t("apv.confirmed") : t("apv.inprogress")}</b>
                  </div>
                  <div className="apvbody">
                    {x.snap && <button type="button" className="apvmini" aria-label={t("apv.open")} title={t("apv.open")} onClick={() => setBig({ subject: x.subject, snap: x.snap! })}><SnapView snap={x.snap} mini /></button>}
                    <ul className="apvsum">{x.summary.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </div>
                  <div className="apvtl" role="list">
                    <div className="apvstep" role="listitem"><div className="apvbubble"><b>{t("apv.started")}</b><span>{x.startedBy}</span><span className="muted">{when(x.startedAt)}</span></div><i className="apvdot on" /></div>
                    {x.approvers.map((a) => (
                      <div key={a.id} className="apvstep" role="listitem">
                        <div className={`apvbubble${a.at ? " ok" : ""}`}>
                          <b>{a.name}</b><span className="muted small">{a.userId === "owner" ? t("apv.owner") : t("collab.kind." + (s.team.find((m) => m.id === a.userId)?.kind ?? "team"))}</span>
                          {a.at ? <><span className="apvok"><Check size={13} /> {t("apv.approvedby", { by: a.by })}</span><span className="muted">{when(a.at)}</span></>
                            : a.userId !== who.id ? <span className="muted small">{t("apv.only", { name: a.name })}</span>
                            : confirmId === `${x.id}:${a.id}` ? <><span className="small" style={{ color: "var(--danger)" }}>{t("apv.sure")}</span><span className="row" style={{ gap: 6 }}><button className="ghost sm" onClick={() => setConfirmId(null)}>{t("cancel")}</button><button className="sm" onClick={() => approve(x.id, a.id)}>{t("apv.yes")}</button></span></>
                            : <button className="sm" onClick={() => setConfirmId(`${x.id}:${a.id}`)}>{t("apv.approve")}</button>}
                        </div>
                        <i className={`apvdot${a.at ? " on" : ""}`} />
                      </div>
                    ))}
                    <div className="apvstep" role="listitem"><div className={`apvbubble${done(x) ? " ok" : ""}`}><b>{done(x) ? t("apv.confirmed") : t("apv.waiting")}</b></div><i className={`apvdot${done(x) ? " on" : ""}`} /></div>
                  </div>
                </div>
              ))}
              {!pendingOne && !(scope === "invitations" && lastDone) && <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}><button className="ghost" onClick={() => setStarting(true)}><ClipboardCheck size={15} /> {t("apv.new")}</button></div>}
            </>
          )}
        </Modal>
      )}
      {big && <Modal title={big.subject} onClose={() => setBig(null)} wide><div style={{ marginTop: 10 }}><SnapView snap={big.snap} /></div></Modal>}
    </>
  );
}
