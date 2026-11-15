import { useState } from "react";
import { log, PRESENCE, PRESENCE_LIST, ROLE_LABEL, setPresence, update, useStore, type Presence, type Staff } from "../store";
import { Avatar, fmtDate, readAvatar } from "../ui";

/** Staff can personalise their own picture and availability. Name, email, role and password are managed by a super admin. */
export default function Profile({ me }: { me: Staff }) {
  const s = useStore();
  const m = s.staff.find((x) => x.id === me.id) ?? me;
  const [note, setNote] = useState(m.presenceNote);
  const [err, setErr] = useState("");
  const upload = async (f?: File) => {
    if (!f) return; setErr("");
    if (f.size > 8_000_000) return setErr("Choose a picture under 8 MB.");
    try { const url = await readAvatar(f); update((x) => { x.staff.find((y) => y.id === m.id)!.avatar = url; }); log(m.name, "Changed profile picture"); } catch { setErr("That file is not a picture."); }
  };
  return (
    <>
      <h1>My profile</h1>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="card grid" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 16 }}>
            <Avatar m={m} size={88} dot />
            <div className="grid" style={{ gap: 6 }}>
              <label className="btn" style={{ margin: 0, cursor: "pointer", color: "var(--on-primary)" }}>Upload picture<input type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
              {m.avatar && <button className="ghost sm" onClick={() => update((x) => { x.staff.find((y) => y.id === m.id)!.avatar = ""; })}>Remove picture</button>}
            </div>
          </div>
          {err && <div className="alert" role="alert">{err}</div>}
          <div className="form">
            <div><label>Name</label><input value={m.name} readOnly aria-readonly="true" /></div>
            <div><label>Work email</label><input value={m.email} readOnly aria-readonly="true" /></div>
            <div><label>Profile</label><input value={ROLE_LABEL[m.role]} readOnly aria-readonly="true" /></div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Your name, email, profile and password are managed by a super admin. To change them, or if you lose access to your password or authenticator, message a super admin in the team chat.</p>
          <div className="muted small">Last sign-in {fmtDate(m.lastLogin)} · account created {fmtDate(m.createdAt)}</div>
        </div>
        <div className="card grid" style={{ gap: 12 }}>
          <h3 style={{ margin: 0 }}>My status</h3>
          <div className="grid" style={{ gap: 6 }} role="radiogroup" aria-label="Status">
            {PRESENCE_LIST.map((p) => (
              <button key={p} role="radio" aria-checked={m.presence === p} className="ghost" style={{ justifyContent: "flex-start", borderColor: m.presence === p ? PRESENCE[p].color : undefined, background: m.presence === p ? "var(--soft)" : undefined }} onClick={() => setPresence(m.id, p as Presence, note)}>
                <i className="pdot static" style={{ background: PRESENCE[p].color }} />{PRESENCE[p].label}
              </button>
            ))}
          </div>
          <div><label htmlFor="pn">Status message (optional)</label><div className="row" style={{ flexWrap: "nowrap" }}><input id="pn" maxLength={60} placeholder="e.g. back at 2 pm" value={note} onChange={(e) => setNote(e.target.value)} /><button className="ghost" onClick={() => setPresence(m.id, m.presence, note)}>Save</button></div></div>
          <p className="muted small" style={{ margin: 0 }}>Your status is visible to your colleagues and super admins (availability reports). <b>Customers and users of the Event Planner app never see it.</b> It switches to Online when you sign in and to Offline when you sign out or are signed out for inactivity.</p>
        </div>
      </div>
    </>
  );
}
