import { useEffect, useState, useSyncExternalStore } from "react";
import { bridgeLink, onBridge, startSync } from "./bridge";
import { signOut } from "./auth";
import { BarChart3, BookOpen, Brush, ClipboardCheck, Gauge, KeyRound, LifeBuoy, ListChecks, LogOut, MessageCircle, Moon, Palette, ScrollText, Sun, UserCircle, Users, Globe, DollarSign, Inbox } from "./icons";
import Login from "./Login";
import { getSession, IDLE_MS, PRESENCE, PRESENCE_LIST, ROLE_LABEL, setPresence, setSession, touchSession, unreadTotal, update, useStore, type Presence, type Role } from "./store";
import { Avatar, go, Logo, Modal, useRoute } from "./ui";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Customers from "./pages/Customers";
import Templates from "./pages/Templates";
import Admin from "./pages/Admin";
import Work from "./pages/Work";
import Chat from "./pages/Chat";
import Kb from "./pages/Kb";
import Metrics from "./pages/Metrics";
import Profile from "./pages/Profile";

/** Which areas each profile can open. Enforced here for navigation and again inside the pages that act on data. */
export const ACCESS: Record<Role, string[]> = {
  super_admin: ["dashboard", "tasks", "customers", "templates", "work", "chat", "kb", "metrics", "profile", "admin"],
  support: ["dashboard", "tasks", "customers", "work", "chat", "kb", "metrics", "profile"],
  designer: ["dashboard", "tasks", "templates", "work", "chat", "profile"],
};
type Item = { href: string; area: string; label: string; icon: React.ReactNode; sec?: string };
const NAV: Item[] = [
  { href: "/", area: "dashboard", label: "My requests", icon: <Gauge size={16} /> },
  { href: "/tasks", area: "tasks", label: "Team queue", icon: <ListChecks size={16} /> },
  { href: "/customers", area: "customers", label: "Customers", icon: <LifeBuoy size={16} /> },
  { href: "/templates", area: "templates", label: "Templates & designs", icon: <Brush size={16} /> },
  { href: "/work", area: "work", label: "Task manager", icon: <ClipboardCheck size={16} /> },
  { href: "/chat", area: "chat", label: "Team chat", icon: <MessageCircle size={16} /> },
  { href: "/kb", area: "kb", label: "Knowledge base", icon: <BookOpen size={16} /> },
  { href: "/metrics", area: "metrics", label: "Support metrics", icon: <BarChart3 size={16} /> },
  { href: "/profile", area: "profile", label: "My profile", icon: <UserCircle size={16} /> },
  { href: "/admin/users", area: "admin", label: "Staff & roles", icon: <Users size={16} />, sec: "Platform control" },
  { href: "/admin/pricing", area: "admin", label: "Plans & prices", icon: <DollarSign size={16} /> },
  { href: "/admin/apis", area: "admin", label: "API keys", icon: <KeyRound size={16} /> },
  { href: "/admin/webmaster", area: "admin", label: "Web master", icon: <Globe size={16} /> },
  { href: "/admin/webdesign", area: "admin", label: "Web design", icon: <Palette size={16} /> },
  { href: "/admin/coupons", area: "admin", label: "Coupons", icon: <DollarSign size={16} /> },
  { href: "/admin/intake", area: "admin", label: "Request intake", icon: <Inbox size={16} /> },
  { href: "/admin/audit", area: "admin", label: "Audit log", icon: <ScrollText size={16} /> },
];

export default function App() {
  const s = useStore();
  const route = useRoute();
  const link = useSyncExternalStore(onBridge, bridgeLink);
  const [menu, setMenu] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false); // phone/tablet: collapsible menu
  useEffect(() => setMenu(false), [route]);
  const [sess, setSess] = useState(getSession());
  const me = sess ? s.staff.find((m) => m.id === sess.staffId && m.active) : undefined;

  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  // idle timeout: any activity renews the session; no activity for IDLE_MS signs the user out
  useEffect(() => {
    if (!me) return;
    const bump = () => touchSession();
    const evs = ["click", "keydown", "mousemove"] as const;
    evs.forEach((e) => addEventListener(e, bump, { passive: true }));
    const i = setInterval(() => { if (!getSession()) { if (me) setPresence(me.id, "offline"); setSess(null); } }, 5000);
    return () => { evs.forEach((e) => removeEventListener(e, bump)); clearInterval(i); };
  }, [me]);
  // keep prices / templates / request statuses in sync with the 1Plan app, and receive its requests
  useEffect(() => (me ? startSync() : undefined), [me?.id]);
  // deactivated or removed while signed in → out
  useEffect(() => { if (sess && !me) { setSession(null); setSess(null); } }, [sess, me]);

  if (!me) return <Login onDone={() => { setSess(getSession()); go("/"); }} />;

  const allowed = ACCESS[me.role];
  const seg = route === "/" ? "dashboard" : route.split("/")[1];
  const area = seg === "studio" ? "templates" : seg; // the HTML studio belongs to the templates area
  const out = () => { setConfirmOut(false); signOut(me); setSess(null); go("/"); };
  const unread = unreadTotal(s, me.id);
  const cur = (href: string) => (href === "/" ? route === "/" : route === href || route.startsWith(href + "/"));
  let lastSec = "";

  let page: React.ReactNode;
  if (!allowed.includes(area)) page = <div className="card"><h2>No access</h2><p className="muted">Your profile ({ROLE_LABEL[me.role]}) cannot open this area.</p><a className="btn" href="#/">Back to my requests</a></div>;
  else if (area === "dashboard") page = <Dashboard me={me} />;
  else if (area === "tasks") page = <Tasks me={me} route={route} />;
  else if (area === "customers") page = <Customers me={me} route={route} />;
  else if (area === "templates") page = <Templates me={me} route={route} />;
  else if (area === "work") page = <Work me={me} />;
  else if (area === "chat") page = <Chat me={me} />;
  else if (area === "kb") page = <Kb me={me} />;
  else if (area === "metrics") page = <Metrics me={me} />;
  else if (area === "profile") page = <Profile me={me} />;
  else if (area === "admin") page = <Admin me={me} route={route} />;
  else page = <div className="card"><h2>Not found</h2></div>;

  return (
    <div className="shell">
      <aside className={`side${menu ? " open" : ""}`} aria-label="Main">
        <div className="row between" style={{ flexWrap: "nowrap" }}><div><div className="brand"><Logo height={56} /></div></div><button className="ghost menubtn" aria-expanded={menu} aria-controls="navlinks" onClick={() => setMenu(!menu)}>{menu ? "Close" : "Menu"}</button></div>
        <div id="navlinks" className="navlinks">
        {NAV.filter((n) => allowed.includes(n.area)).map((n) => {
          const sec = n.sec && n.sec !== lastSec ? (lastSec = n.sec) : "";
          return <span key={n.href} style={{ display: "contents" }}>{sec && <div className="sec">{sec}</div>}<a href={"#" + n.href} aria-current={cur(n.href) ? "page" : undefined}>{n.icon}{n.label}{n.area === "chat" && unread > 0 && <span className="navbadge">{unread}</span>}</a></span>;
        })}
        <span className="grow" />
        <div style={{ padding: "8px 10px", fontSize: ".78rem" }}>
          <div className="row" style={{ flexWrap: "nowrap", gap: 8, marginBottom: 6 }}><Avatar m={me} size={34} dot /><div><b style={{ color: "#fff" }}>{me.name}</b><br />{ROLE_LABEL[me.role]}</div></div>
          <select aria-label="My status" value={me.presence} onChange={(e) => setPresence(me.id, e.target.value as Presence)} style={{ marginBottom: 6, padding: "4px 6px" }}>{PRESENCE_LIST.map((p) => <option key={p} value={p}>{PRESENCE[p].label}</option>)}</select><span style={{ color: link === "online" ? "var(--teal)" : "#e6a6b2" }}>● {link === "online" ? "Connected to 643" : link === "offline" ? "643 link offline" : "Connecting…"}</span><br /><span style={{ opacity: .6 }}>Auto sign-out after {IDLE_MS / 60000} min idle</span></div>
        <a href="#/" onClick={(e) => { e.preventDefault(); update((st) => { st.theme = st.theme === "dark" ? "light" : "dark"; }); }}>{s.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}{s.theme === "dark" ? "Light mode" : "Dark mode"}</a>
        <a href="#/" onClick={(e) => { e.preventDefault(); setConfirmOut(true); }}><LogOut size={16} />Sign out</a>
        </div>
      </aside>
      <main className="main">{page}</main>
      {confirmOut && (
        <Modal title="Sign out?" onClose={() => setConfirmOut(false)}>
          <p style={{ marginTop: 0 }}>You will be signed out of the staff console and your status will change to Offline.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="ghost" autoFocus onClick={() => setConfirmOut(false)}>Cancel</button><button onClick={out}>Sign out</button></div>
        </Modal>
      )}
    </div>
  );
}
