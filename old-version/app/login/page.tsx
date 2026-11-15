import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LangSwitch } from "../components";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await getUser()) redirect("/app");
  const { t } = await getT();
  return (
    <div className="center card">
      <div className="row between"><h1>🎉 {t("app")}</h1><LangSwitch back="/login" /></div>
      <p className="muted">{t("tagline")}</p>
      <LoginForm labels={{ email: t("email"), password: t("password"), login: t("login"), bad: t("badLogin") }} />
    </div>
  );
}
