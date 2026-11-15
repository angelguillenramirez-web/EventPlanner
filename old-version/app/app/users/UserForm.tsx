"use client";
import { useActionState } from "react";
import { createUser } from "@/app/actions";

type L = { name: string; email: string; role: string; create: string; temp: string; done: string; taken: string; organizer: string; client: string };
export default function UserForm({ isSuper, labels }: { isSuper: boolean; labels: L }) {
  const [s, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="card fields">
      <div><label htmlFor="name">{labels.name}</label><input id="name" name="name" required /></div>
      <div><label htmlFor="email">{labels.email}</label><input id="email" name="email" type="email" required /></div>
      {isSuper && <div><label htmlFor="role">{labels.role}</label><select id="role" name="role"><option value="ORGANIZER">{labels.organizer}</option><option value="CLIENT">{labels.client}</option></select></div>}
      <button disabled={pending}>{labels.create}</button>
      {s && "ok" in s && <p className="okmsg full" role="status">{labels.done} <b>{s.email}</b> · {labels.temp}: <code>{s.temp}</code></p>}
      {s && "error" in s && <p className="err full" role="alert">{s.error === "emailTaken" ? labels.taken : "Invalid"}</p>}
    </form>
  );
}
