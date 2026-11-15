"use client";
import { useActionState, useRef } from "react";
import { uploadDocument } from "@/app/actions";

type Labels = { file: string; category: string; visible: string; upload: string; max: string; tooBig: string };
export default function UploadForm({ eventId, manage, labels }: { eventId: string; manage: boolean; labels: Labels }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (p: unknown, fd: FormData) => {
    const r = await uploadDocument(p, fd);
    if (r?.ok) ref.current?.reset();
    return r;
  }, null);
  return (
    <form ref={ref} action={action} className="card fields">
      <input type="hidden" name="eventId" value={eventId} />
      <div><label htmlFor="file">{labels.file}</label><input id="file" name="file" type="file" required /></div>
      <div><label htmlFor="category">{labels.category}</label><input id="category" name="category" /></div>
      {manage && <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}><input type="checkbox" name="visibleToClient" defaultChecked /> {labels.visible}</label>}
      <button disabled={pending}>{labels.upload}</button>
      <p className="muted full">{labels.max}</p>
      {state?.error === "tooBig" && <p className="err full" role="alert">{labels.tooBig}</p>}
    </form>
  );
}
