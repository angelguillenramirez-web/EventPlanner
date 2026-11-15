import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { logout } from "../actions";
import { LangSwitch } from "../components";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/app" className="brand">🎉 {t("app")}</Link>
          <nav>
            <Link href="/app">{t("dashboard")}</Link>
            {user.role !== "CLIENT" && <Link href="/app/users">{user.role === "SUPERADMIN" ? t("users") : t("myClients")}</Link>}
            <LangSwitch back="/app" />
            <span className="muted">{user.name} · {t("role." + user.role)}</span>
            <form action={logout}><button className="ghost sm">{t("logout")}</button></form>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
