import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { deleteUser } from "@/app/actions";
import ConfirmDelete from "@/app/ConfirmDelete";
import UserForm from "./UserForm";

export default async function Users() {
  const me = await requireRole("SUPERADMIN", "ORGANIZER");
  const { t, locale } = await getT();
  const users = await db.user.findMany({
    where: me.role === "SUPERADMIN" ? {} : { createdById: me.id },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return (
    <>
      <h1>{me.role === "SUPERADMIN" ? t("users") : t("myClients")}</h1>
      <UserForm isSuper={me.role === "SUPERADMIN"} labels={{
        name: t("name"), email: t("email"), role: t("role"), create: t("newUser"), temp: t("tempPassword"), done: t("userCreated"), taken: t("emailTaken"),
        organizer: t("role.ORGANIZER"), client: t("role.CLIENT"),
      }} />
      <div className="card tablewrap">
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("date")}</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td><span className="badge">{t("role." + u.role)}</span></td><td>{u.createdAt.toLocaleDateString(locale)}</td>
                <td>{me.role === "SUPERADMIN" && u.id !== me.id && <form action={deleteUser}><input type="hidden" name="id" value={u.id} /><ConfirmDelete small label={t("delete")} msg={t("confirmDelete")} /></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
