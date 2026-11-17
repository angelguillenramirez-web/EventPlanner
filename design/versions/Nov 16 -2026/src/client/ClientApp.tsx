import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { go, me, unreadCounts, update, useStore } from "../store";
import { Modal } from "./ui";
import { AppMark, LangSwitch, Logo, ThemeToggle, useMedia } from "../shared";
import { Play, Inbox as InboxIcon, Menu, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Headset, LifeBuoy, ListChecks, BriefcaseBusiness, Bell, MessageSquare, Search, Store, User, Users } from "../icons";
import { AnimSwitchItem, ThemeSwitchItem } from "./Switches";
import { setSearch, useSearch } from "../search";
import { DI } from "../navicons";
import NotifDrawer from "./NotifDrawer";
import { EventsList } from "./Events";
import EventPage from "./EventPage";
import MyTasks from "./MyTasks";
import SupportWidget from "./Support";
import { Feedback } from "./Feedback";
import Account from "./Account";
import Team from "./Team";
import { discardSeatEdits } from "./Tables";
import Suppliers from "./Suppliers";
import Services from "./Services";
import Inbox from "./Inbox";

export default function ClientApp({ route }: { route: string }) {
  const s = useStore();
  const who = me(s);
  const { t } = useT();
  const [help, setHelp] = useState(false);
  const search = useSearch();
  const [notifs, setNotifs] = useState(false); // notifications panel from the bell
  const [spin, setSpin] = useState(0); // light/dark glyph turns half a circle each time
  const [pending, setPending] = useState<string | null>(null); // a link clicked while the seating editor has unsaved changes
  const [acc, setAcc] = useState<{ left: number; bottom: number } | null>(null); // account speech bubble position
  const accRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!acc) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAcc(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [acc]);
  const openAcc = () => {
    if (acc) { setAcc(null); return; }
    const r = accRef.current!.getBoundingClientRect();
    setAcc(collapsed ? { left: r.right + 10, bottom: window.innerHeight - r.bottom } : { left: r.left + 6, bottom: window.innerHeight - r.top + 10 });
  };
  const parts = route.split("/").filter(Boolean); // ["app", ...]
  const sec = parts[1] ?? "";
  const phone = useMedia("(max-width: 700px)"), tablet = useMedia("(max-width: 1024px)");
  const [navOpen, setNavOpen] = useState(false); // phone: the sidebar is a drawer
  useEffect(() => setNavOpen(false), [route]);
  const collapsed = !phone && (s.sidebarCollapsed || tablet); // tablets always get the slim icon sidebar
  const helpOpen = (help || sec === "feedback") && !collapsed;
  const nav = (path: string, icon: React.ReactNode, label: string, active: boolean) => (
    <a className="nav" href={"#" + path} title={label} aria-current={active ? "page" : undefined}>{icon}<span className="lbl">{label}</span></a>
  );
  // top bar: where you are, the inbox bell and the light/dark button
  const crumbKey: Record<string, string> = { "": "nav.myevents", tasks: "nav.mytasks", inbox: "nav.inbox", team: "nav.team", services: "nav.services", suppliers: "nav.suppliers", feedback: "nav.feedback", account: "nav.account" };
  const evName = sec === "event" ? s.events.find((e) => e.id === parts[2])?.name : undefined;
  const unread = unreadCounts(s), unreadAll = unread.msgs + unread.notifs;
  let page: React.ReactNode;
  if (sec === "event") page = <EventPage id={parts[2]} tab={parts[3] ?? "tasks"} />;
  else if (sec === "tasks") page = <MyTasks />;
  else if (sec === "inbox" && !s.viewAs) page = <Inbox sub={parts[2] ?? ""} />;
  else if (sec === "team" && !s.viewAs) page = <Team />;
  else if (sec === "suppliers" && !s.viewAs) page = <Suppliers />;
  else if (sec === "services" && !s.viewAs) page = <Services />;
  else if (sec === "feedback") page = <Feedback />;
  else if (sec === "account") page = <Account tab={parts[2] ?? "basic"} />;
  else page = <EventsList />;

  return (
    <div className="shell" style={{ ["--side-w" as string]: phone ? "0px" : collapsed ? "68px" : "250px" }} onClickCapture={(e) => {
      if (!s.seatEditor || !s.seatDirty) return;
      const a = (e.target as HTMLElement).closest("a"), href = a?.getAttribute("href") ?? "";
      if (!a || !href.startsWith("#/") || a.closest(".seat-full")) return;
      e.preventDefault(); e.stopPropagation(); setPending(href.slice(1));
    }}>
      {phone && <div className="mtop noprint"><button className="ghost icon" aria-label={t("side.show")} aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Menu size={22} /></button><Logo href="#/app" height={28} /></div>}
      {phone && navOpen && <div className="menu-bg" style={{ zIndex: 79 }} onClick={() => setNavOpen(false)} />}
      <aside className={`side${collapsed ? " collapsed" : ""}${phone ? " drawer-nav" : ""}${navOpen ? " open" : ""}`} aria-label="Main navigation">
        <div className="side-head"><span className="lbl brandrow"><Logo href="#/app" /></span><a className="logomark" href="#/app" aria-label="1Plan" title="1Plan"><AppMark size={32} /></a></div>
        {nav("/app", <DI k="cal" />, t("nav.myevents"), sec === "" || sec === "event")}
        {nav("/app/tasks", <DI k="chk" />, t("nav.mytasks"), sec === "tasks")}
        {!s.viewAs && <a className="nav" href="#/app/inbox" title={t("nav.inbox")} aria-current={sec === "inbox" ? "page" : undefined}><span style={{ position: "relative", display: "inline-flex" }}><DI k="inbox" />{unreadCounts(s).msgs + unreadCounts(s).notifs > 0 && <i className="navdot" aria-label={t("inb.f.unread")} />}</span><span className="lbl">{t("nav.inbox")}</span>{unreadCounts(s).msgs + unreadCounts(s).notifs > 0 && <span className="inbbadge lbl" style={{ marginLeft: "auto" }}>{unreadCounts(s).msgs + unreadCounts(s).notifs}</span>}</a>}
        {!s.viewAs && nav("/app/team", <DI k="users" />, t("nav.team"), sec === "team")}
        {!s.viewAs && nav("/app/services", <DI k="brief" />, t("nav.services"), sec === "services")}
        {!s.viewAs && nav("/app/suppliers", <DI k="store" />, t("nav.suppliers"), sec === "suppliers")}

        <button className="nav navbtn" title={t("nav.help")} aria-expanded={helpOpen} onClick={() => { if (collapsed) { update((st) => { st.sidebarCollapsed = false; }); setHelp(true); } else setHelp(!help); }}>
          <DI k="help" /><span className="lbl" style={{ flex: 1, textAlign: "left" }}>{t("nav.help")}</span>
          <ChevronDown size={14} className="lbl" style={{ transform: helpOpen ? "rotate(180deg)" : undefined }} />
        </button>
        {helpOpen && (
          <div className="subnav">
            <button className="nav navbtn" onClick={() => update((st) => { st.supportOpen = true; })}><Headset size={16} /><span className="lbl">{t("nav.support")}</span></button>
            {nav("/app/feedback", <MessageSquare size={16} />, t("nav.feedback"), sec === "feedback")}
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button ref={accRef} className="nav account" title={t("nav.account")} aria-haspopup="menu" aria-expanded={!!acc} onClick={openAcc} aria-current={sec === "account" ? "page" : undefined}>
          <span className="avatar">{s.avatar && !s.viewAs ? <img src={s.avatar} alt="" /> : who.name[0]}</span>
          <span className="lbl" style={{ textAlign: "left" }}><b>{who.name}</b><br /><span className="muted small">{s.viewAs ? t("collab.kind." + (s.team.find((m) => m.id === s.viewAs)?.kind ?? "team")) : t("plan." + s.plan)}</span></span>
        </button>
      </aside>
      {!phone && !tablet && <button className="side-toggle" aria-label={collapsed ? t("side.show") : t("side.hide")} title={collapsed ? t("side.show") : t("side.hide")} aria-expanded={!collapsed}
        onClick={() => update((st) => { st.sidebarCollapsed = !st.sidebarCollapsed; })}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>}
      {notifs && <NotifDrawer onClose={() => setNotifs(false)} />}
      <div className="main">
        {!phone && (
          <header className="topbar2 noprint">
            {!tablet && <button className="ghost icon tbtoggle" aria-label={collapsed ? t("side.show") : t("side.hide")} title={collapsed ? t("side.show") : t("side.hide")} aria-expanded={!collapsed}
              onClick={() => update((st) => { st.sidebarCollapsed = !st.sidebarCollapsed; })}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>}
            <nav className="crumbs" aria-label="Breadcrumb">
              {sec === "event" ? <><a href="#/app">{t("nav.myevents")}</a><span aria-hidden>›</span><b>{evName ?? ""}</b></> : <b>{t(crumbKey[sec] ?? "nav.myevents")}</b>}
            </nav>
            <span className="grow" />
            {!s.viewAs && <div className="tbsearch"><DI k="search" size={16} /><input aria-label={t("search.events")} placeholder={t("search.events")} value={search} onChange={(e) => { setSearch(e.target.value); if (sec !== "") go("/app"); }} /></div>}
            {!s.viewAs && (
              <button className="bellbtn" aria-label={t("inb.notifications")} title={t("inb.notifications")} aria-haspopup="dialog" onClick={() => setNotifs(true)}>
                <DI k="bell" size={18} />{unreadAll > 0 && <i className="bdot" aria-label={t("inb.f.unread")} />}
              </button>
            )}
            <button className="bellbtn" aria-label={s.theme === "dark" ? t("theme.light") : t("theme.dark")} title={s.theme === "dark" ? t("theme.light") : t("theme.dark")} onClick={() => { update((st) => { st.theme = st.theme === "dark" ? "light" : "dark"; }); setSpin((n) => n + 180); }}>
              <span className="tglyph" style={{ transform: `rotate(${spin}deg)` }}>◐</span>
            </button>
          </header>
        )}
        <main className="content">{page}</main>
      </div>
      {acc && (
        <>
          <div className="menu-bg" style={{ zIndex: 94 }} onClick={() => setAcc(null)} />
          <div className={`accbubble${collapsed ? " side-right" : ""}`} role="menu" style={{ left: acc.left, bottom: acc.bottom }}>
            <a role="menuitem" className="accitem" href="#/app/account" onClick={() => setAcc(null)}><User size={16} /> {t("acc.menu")}</a>
            <div className="accitem"><span className="muted small">{t("acc.language")}</span><LangSwitch /></div>
            {s.sessionId && !s.sessionId.startsWith("member:") && <div className="accitem"><span className="muted small" title={t("acc.viewas.hint")}>{t("acc.viewas")}</span>
              <select aria-label={t("acc.viewas")} value={s.viewAs} style={{ width: "auto", padding: "2px 6px" }} onChange={(e) => update((st) => { st.viewAs = e.target.value; })}>
                <option value="">{s.userName}</option>{s.team.map((m) => <option key={m.id} value={m.id}>{m.name} ({t("collab.kind." + m.kind)})</option>)}
              </select>
            </div>}
            <ThemeSwitchItem />
            <AnimSwitchItem />
          </div>
        </>
      )}
      {pending && (
        <Modal title={t("seat.leave.title")} onClose={() => setPending(null)}>
          <p style={{ marginTop: 0 }}>{t("seat.leave.desc")}</p>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
            <button className="ghost" onClick={() => setPending(null)}>{t("seat.leave.keep")}</button>
            <button className="danger" onClick={() => { const to = pending; discardSeatEdits(); setPending(null); go(to); }}>{t("seat.leave.discard")}</button>
            <button onClick={() => { const to = pending; update((st) => { st.seatDirty = false; }); setPending(null); go(to); }}>{t("seat.leave.save")}</button>
          </div>
        </Modal>
      )}
      <SupportWidget />
    </div>
  );
}
