"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginForm({ labels }: { labels: { email: string; password: string; login: string; bad: string } }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="fields" style={{ gridTemplateColumns: "1fr" }}>
      <div><label htmlFor="email">{labels.email}</label><input id="email" name="email" type="email" required autoComplete="username" /></div>
      <div><label htmlFor="password">{labels.password}</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      {state?.error && <p className="err" role="alert">{labels.bad}</p>}
      <button disabled={pending}>{labels.login}</button>
    </form>
  );
}
