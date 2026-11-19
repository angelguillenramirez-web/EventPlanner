// 643 · staff-admin Edge Function. Super admins create staff accounts, reset passwords and (de)activate accounts;
// support and super admins can send a customer a password-reset email and unblock them; only super admins block customers.
// Runs on Supabase's servers: the service-role key (provided automatically as SUPABASE_SERVICE_ROLE_KEY) never reaches the browser.
// Single file on purpose: it can be pasted into Supabase > Edge Functions > Deploy a new function (name: staff-admin).
// Actions (POST JSON): { action: "create", email, name, role } | { action: "reset_password", userId } | { action: "set_active", userId, active }
//   | { action: "customer_reset", userId } | { action: "customer_block", userId, blocked }
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["http://643.localhost:5174", "http://localhost:5174", "https://643.1plan.com.mx"];
const ROLES = ["super_admin", "support", "designer"];

const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": ORIGINS.includes(req.headers.get("Origin") ?? "") ? req.headers.get("Origin")! : ORIGINS[2],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const reply = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** 16 random characters with upper, lower, digit and symbol (meets the console's 12+ rule). */
function tempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const all = sets.join("");
  const out = sets.map(pick);
  while (out.length < 16) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "method" }, 405);
  try {
    const sb = admin();
    // 1) Who is calling? Must be an ACTIVE super admin (and, once staff_security.require_2fa is on, a 2FA-verified session).
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u.user) return reply(req, { error: "not_signed_in" }, 401);
    const { data: me } = await sb.from("staff_members").select("role, active").eq("user_id", u.user.id).maybeSingle();
    if (!me?.active) return reply(req, { error: "forbidden" }, 403);
    const { data: sec } = await sb.from("staff_security").select("require_2fa").maybeSingle();
    if (sec?.require_2fa) {
      const aal = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.aal;
      if (aal !== "aal2") return reply(req, { error: "mfa_required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    // Who may do what: customer actions are open to support and super admins (blocking: super admin only); everything else is super admin only.
    const isCustomerAction = body.action === "customer_reset" || body.action === "customer_block";
    const allowed = me.role === "super_admin" || (isCustomerAction && me.role === "support" && !(body.action === "customer_block" && body.blocked));
    if (!allowed) return reply(req, { error: "forbidden" }, 403);
    const audit = (action: string, target: string) => sb.from("audit_log").insert({ actor: u.user!.id, action, target });


    if (isCustomerAction) {
      const id = String(body.userId);
      const { data: staffRow } = await sb.from("staff_members").select("user_id").eq("user_id", id).maybeSingle();
      if (staffRow) return reply(req, { error: "not_a_customer" }, 400);       // staff are managed in Staff & roles
      const { data: cu, error: ce } = await sb.auth.admin.getUserById(id);
      if (ce || !cu.user?.email) return reply(req, { error: "not_found" }, 404);
      if (body.action === "customer_reset") {
        // Same email the customer gets from "Forgot password": they choose their own new password. No password is ever shown to staff.
        const mailer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } });
        const { error } = await mailer.auth.resetPasswordForEmail(cu.user.email, { redirectTo: "https://1plan.com.mx/" });
        if (error) return reply(req, { error: "email_failed" }, 502);
        await audit("Sent customer password-reset email", cu.user.email);
        return reply(req, { ok: true });
      }
      const blocked = !!body.blocked;
      const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: blocked ? "876000h" : "none" });
      if (error) return reply(req, { error: "failed" }, 500);
      await audit(blocked ? "Blocked customer account" : "Unblocked customer account", cu.user.email);
      return reply(req, { ok: true });
    }

    if (body.action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim().slice(0, 120);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !ROLES.includes(body.role)) return reply(req, { error: "invalid" }, 400);
      const pw = tempPassword();
      const { data, error } = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { must_change_password: true, staff: true } });
      if (error || !data.user) return reply(req, { error: /already|registered/i.test(error?.message ?? "") ? "exists" : "create_failed" }, error ? 409 : 500);
      const { error: e2 } = await sb.from("staff_members").insert({ user_id: data.user.id, email, name, role: body.role, created_by: u.user.id });
      if (e2) { await sb.auth.admin.deleteUser(data.user.id); return reply(req, { error: "create_failed" }, 500); }
      await audit(`Created ${body.role} account`, email);
      return reply(req, { ok: true, userId: data.user.id, tempPassword: pw });
    }

    if (body.action === "reset_password") {
      const { data: t } = await sb.from("staff_members").select("email").eq("user_id", String(body.userId)).maybeSingle();
      if (!t) return reply(req, { error: "not_found" }, 404);
      const pw = tempPassword();
      const { error } = await sb.auth.admin.updateUserById(String(body.userId), { password: pw, user_metadata: { must_change_password: true, staff: true } });
      if (error) return reply(req, { error: "failed" }, 500);
      await audit("Password reset", t.email);
      return reply(req, { ok: true, tempPassword: pw });
    }

    if (body.action === "set_active") {
      const id = String(body.userId);
      const active = !!body.active;
      if (id === u.user.id) return reply(req, { error: "self" }, 400);
      const { data: t } = await sb.from("staff_members").select("email, role, active").eq("user_id", id).maybeSingle();
      if (!t) return reply(req, { error: "not_found" }, 404);
      if (!active && t.role === "super_admin") {
        const { count } = await sb.from("staff_members").select("user_id", { count: "exact", head: true }).eq("role", "super_admin").eq("active", true);
        if ((count ?? 0) <= 1) return reply(req, { error: "last_admin" }, 400);
      }
      await sb.from("staff_members").update({ active }).eq("user_id", id);
      await sb.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" }); // deactivated = cannot sign in at all
      await audit(active ? "Reactivated account" : "Deactivated account", t.email);
      return reply(req, { ok: true });
    }

    return reply(req, { error: "unknown_action" }, 400);
  } catch (e) {
    console.error("staff-admin", e);
    return reply(req, { error: "server" }, 500);
  }
});
