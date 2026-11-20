import { useEffect } from "react";
import { useRoute, useStore, go, accountTypes, update } from "./store";
import Landing from "./Landing";
import Login from "./Login";
import ChooseType from "./ChooseType";
import Welcome from "./Welcome";
import { Join, Sent, Confirm, CloudSent } from "./Join";
import { Invite, Access } from "./Invite";
import { Forgot, LinkError, ResetPage, SetPassword } from "./Reset";
import ClientApp from "./client/ClientApp";
import { TrialPage } from "./client/Billing";
import Upsell from "./client/Upsell";
import SignOutDialog from "./client/SignOut";
import PublicCatalog from "./client/PublicCatalog";
import Rsvp from "./client/Rsvp";
import { RESERVED } from "./store";
import CloudBadge from "./client/CloudBadge";
import { AskHost } from "./client/Ask";

export default function App() {
  const s = useStore();
  const route = useRoute();

  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.lang = s.lang;
  }, [s.theme, s.lang]);

  useEffect(() => { // access rules: the app needs a session; new accounts finish the profile questions and pick an account type first
    const acct = s.accounts.find((x) => x.id === s.sessionId);
    const priv = route.startsWith("/app") || route === "/choose-type" || route === "/welcome" || route === "/trial";
    if (priv && !s.loggedIn) go("/login");
    else if (s.loggedIn && (route === "/login" || route === "/join")) go("/app");
    else if (priv && s.loggedIn && acct) {
      if (!acct.profile && route !== "/welcome") go("/welcome");
      else if (acct.profile && !s.accountType && route !== "/choose-type") go("/choose-type");
      else if (acct.profile && !s.viewAs && accountTypes(acct).includes("planner") && s.accountType === "supplier") update((st) => { st.accountType = "planner"; const a = st.accounts.find((x) => x.id === st.sessionId); if (a) a.accountType = "planner"; }); // a person with a planner profile always gets the full app (the supplier profile is inside it)
      else if (acct.profile && s.accountType === "planner" && s.sub.status === "none" && route !== "/trial") go("/trial"); // a card is required to start the free trial
      else if (acct.profile && s.accountType && (route === "/choose-type" || route === "/welcome" || (route === "/trial" && (s.accountType !== "planner" || s.sub.status !== "none")))) go("/app");
    }
  }, [route, s.loggedIn, s.accountType, s.sessionId, s.accounts, s.sub.status]);

  let page: React.ReactNode = <Landing />;
  const acct = s.accounts.find((x) => x.id === s.sessionId);
  if (route === "/login") page = <Login />;
  else if (route === "/join") page = <Join />;
  else if (route === "/join/check") page = <CloudSent />;
  else if (route === "/set-password") page = <SetPassword />;
  else if (route === "/link-error") page = <LinkError />;
  else if (route.startsWith("/join/sent/")) page = <Sent id={route.split("/")[3]} />;
  else if (route.startsWith("/confirm/")) page = <Confirm token={route.split("/")[2]} />;
  else if (route.startsWith("/rsvp/")) page = <Rsvp parts={route.split("/").slice(2)} />;
  else if (route.startsWith("/catalog/")) page = <PublicCatalog slug={route.split("/")[2]} />;
  else if (route.split("/").filter(Boolean).length === 1 && !RESERVED.includes(route.split("/")[1]) && route.split("/")[1] === s.supplierProfile.slug && s.supplierProfile.slug) page = <PublicCatalog slug={route.split("/")[1]} />;
  else if (route === "/forgot") page = <Forgot />;
  else if (route.startsWith("/reset/")) page = <ResetPage token={route.split("/")[2]} />;
  else if (route.startsWith("/invite/")) page = <Invite token={route.split("/")[2]} />;
  else if (route.startsWith("/access/")) page = <Access token={route.split("/")[2]} />;
  else if (route === "/welcome") page = s.loggedIn && acct ? <Welcome /> : null;
  else if (route === "/choose-type") page = s.loggedIn && !s.accountType && acct?.profile ? <ChooseType /> : null;
  else if (route === "/trial") page = s.loggedIn && s.accountType === "planner" ? <TrialPage /> : null;
  else if (route.startsWith("/app")) page = !s.loggedIn || !s.accountType ? null : <ClientApp route={route} />;
  return <>{page}<Upsell />{s.loggedIn && <SignOutDialog />}<CloudBadge /><AskHost /></>;
}
