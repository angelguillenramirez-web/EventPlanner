import { db } from "@/lib/db";
import { canManage, getEventFor, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { deleteDocument } from "@/app/actions";
import { fmtSize } from "@/lib/util";
import ConfirmDelete from "@/app/ConfirmDelete";
import UploadForm from "./UploadForm";

export default async function Documents({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  await getEventFor(user, id);
  const { t, locale } = await getT();
  const manage = canManage(user);
  // rule: clients only see documents flagged visible to them
  const docs = await db.document.findMany({ where: { eventId: id, ...(manage ? {} : { visibleToClient: true }) }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <UploadForm eventId={id} manage={manage} labels={{ file: t("file"), category: t("category"), visible: t("visibleToClient"), upload: t("upload"), max: t("maxSize"), tooBig: t("tooBig") }} />
      <div className="card tablewrap">
        <table>
          <thead><tr><th>{t("file")}</th><th>{t("category")}</th><th>{t("size")}</th><th>{t("date")}</th><th></th></tr></thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={5} className="muted">{t("noItems")}</td></tr>}
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.name}{manage && !d.visibleToClient && <> <span className="badge">🔒</span></>}</td>
                <td>{d.category}</td><td>{fmtSize(d.size)}</td><td>{d.createdAt.toLocaleDateString(locale)}</td>
                <td className="row">
                  <a className="btn ghost sm" href={`/api/documents/${d.id}`}>{t("download")}</a>
                  {(manage || d.uploadedById === user.id) && <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><ConfirmDelete small label="✕" msg={t("confirmDelete")} /></form>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
