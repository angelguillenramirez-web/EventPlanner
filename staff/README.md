# 643 — Staff Console (prototype)

Internal platform for 643 employees. **Not public**: no link from the public site, `noindex` meta + `robots.txt` disallow, separate app and port (5174), separate storage.

```bash
cd staff
npm install
npm run dev        # open http://643.localhost:5174
```

## Addresses (local prototype)
| App | Address |
|---|---|
| Public site + customer app | `http://eventplanner.localhost:5173` |
| **Staff console (its own address)** | `http://643.localhost:5174` |
| Bridge / API | `http://localhost:5175` |

`*.localhost` names resolve to your own machine in the browser, so nothing needs installing. Each address is a separate origin, so the console's storage and session are fully isolated from the customer app. In production this becomes a real subdomain (e.g. `staff.yourdomain.com`) with HTTPS, ideally restricted by VPN or IP allow-list; the bridge's allowed origins in `bridge/server.mjs` must then be updated.

## Sign-in (3 factors of the flow)
1. Work email + password (salted PBKDF2-SHA256, 210k iterations; same generic error for any wrong detail).
2. Authenticator code (standard TOTP, RFC 6238 — Google Authenticator, Authy, 1Password…; verified against the RFC test vectors). A code cannot be used twice.
3. New accounts: temporary password → forced personal password (12+ chars, upper/lower, number, symbol) → QR enrollment of the authenticator.
- 5 failed attempts lock the account for 15 min (a super admin can unlock). Auto sign-out after 30 min idle. Session lives in `sessionStorage` (closes with the tab).
- In `npm run dev` only, the login page shows a **demo box** (demo accounts, live authenticator code, reset data). It is stripped from production builds. Demo accounts use the password `DEMO_PASSWORD` in `src/store.ts`; there are three starter accounts for testing: `admin@` (super admin), `support@` (customer support), `designer@eventplanner.test`. Add more people from **Staff & roles**. (Data from the earlier 5-account prototype is replaced the first time this version loads.)

## Profiles
| Profile | Can do |
|---|---|
| **Super admin** | Everything: staff & roles (create, change profile, reset password / 2FA, unlock, deactivate), plans & prices, API keys (rotate / revoke), web master (maintenance, banner, SEO, analytics), web design (colours, hero), request intake, audit log, all queues and customers (block, refund). |
| **Customer support** | Team queue (support), customer lookup, reset password, unblock/unlock, payment history, retry payment, escalate a payment issue to a super admin (creates an `ADM-` task), usage guides. |
| **Designer** | Team queue (design), template library (draft/publish/unpublish), HTML studio (the same editor as the 1Plan app's invitation editor: same plugins, fonts, invitation blocks, version history, HTML download, shortcuts ⌘/Ctrl+S and ⌘/Ctrl+⇧+S), deliver a design to the request that asked for it (closes the task). |

## Daily tools (all profiles)
- **Sign out** asks for confirmation first.
- **My profile**: own picture and availability status (online, busy, in a meeting, lunch, break, away, offline; optional message). Name, email, profile and password can only be changed by a super admin. Status goes Online at sign-in and Offline at sign-out/idle timeout. Statuses and time-per-status reports are visible to super admins (Dashboard → *Team availability*, CSV download) and teammates; **they are never sent to the bridge, so customers cannot see them**.
- **Task manager** (`/work`): internal work tasks with the same structure as the 1Plan tracker (board, Gantt, calendar, list; lists, dates, priority, tags, responsible people, notes, history, drag and drop) but not linked to any event. Super admin can switch to everyone's tasks.
- **Team chat** (`/chat`): groups (create, add/remove members, topic), direct messages, emoji picker, stickers, animated GIF-style reactions, pictures, replies, reactions, pins, edit/delete, @mentions, search, unread badges. Messages sync between tabs of the same browser; real multi-user chat needs the backend. Real GIF libraries (Giphy/Tenor) need an API key and are not connected.
- **Customer support** only: no "new request" button (they work on customer requests: written or live chat); **Hand over to a designer** creates a linked `DSN-` task (and tells support when it is done); **Knowledge base** (first version, written once; it does not update by itself — a super admin edits it); **Support metrics** (requests, first response, time to resolve, SLA %, per day/status/agent) with CSV downloads and print/PDF.
- **Designer** only: library filters by *Template / Event request / Draft*, status, tags and search; tags and comments on each design; edit any of them in the studio.

## Requests / task IDs
- Every support or design request creates a unique sequential **task ID**: `SUP-000001`, `DSN-000001`, `ADM-000001`.
- **Auto-assigned by team scope** to the active member of the right team with the fewest open tasks; if nobody is available it waits in the team queue ("Take it").
- **My requests** (benchmark): task ID, created time, age, status (New · Assigned · In progress · Waiting on customer · Done), priority, late flag (targets: support 24h, design 72h, admin 48h), average time to resolve. Super admin also sees workload per team member.
- Every sensitive action is written to the audit log.

## Connection with the 1Plan app
A small local **bridge** (`bridge/server.mjs`, port 5175, no dependencies) links the two apps. Start all three:
```bash
npm run bridge                 # in the project root → http://localhost:5175
npm run dev                    # 1Plan app → :5173
npm --prefix staff run dev     # Staff console → :5174
```
- **Customer → staff**: the support panel in the 1Plan app (type *Help* or *Custom invitation design*) sends the request to the bridge; the console pulls it every 5 s, creates the task ID, auto-assigns it and links the customer by email. If the bridge is down the app keeps the request and retries.
- **Staff → customer**: the console publishes task status and *Reply to customer* notes (internal notes never leave the console), plus plan prices, the site banner/maintenance flag/SEO, web design and **published** templates. The app shows the ticket ID, live status and replies in the support panel, and the landing page shows the prices and banner.
- Staff-only endpoints need the `x-staff-key` header (default dev key; override with `STAFF_BRIDGE_KEY` on the bridge and `VITE_BRIDGE_KEY` in the console). API keys are never sent to the bridge.
- Not wired into the app yet: maintenance mode, web-design colours/hero text, and published templates in the Invitation Studio (they are available from `GET /api/public`).
- Still a prototype: bridge data is a JSON file and the browser holds the staff data. Production needs a real backend with sessions, server-side role checks and a database.

## Real staff accounts (Supabase)

Off by default (the console uses local demo accounts). To try real sign-in:

1. Supabase > SQL Editor: run `supabase/staff-schema.sql` (after the customer `supabase/schema.sql`).
2. Supabase > Authentication > Users > **Add user** (email + password, tick "Auto confirm"). Copy the user's UUID.
3. SQL Editor, create the first super admin (replace the values):
   `insert into public.staff_members (user_id, email, name, role) values ('<UUID>', 'you@example.com', 'Your name', 'super_admin');`
4. Copy `.env.example` to `.env.local` and restart `npm run dev`. Sign in with that email and password.

Second factor is off at first. To require it later (after staff enrol an authenticator): `update public.staff_security set require_2fa = true;`

### Deploy the staff-admin function (create accounts, reset passwords, deactivate)
Supabase > Edge Functions > **Deploy a new function** > name `staff-admin` > paste `supabase/functions/staff-admin/index.ts` > Deploy.
(With the Supabase CLI instead: `supabase functions deploy staff-admin --project-ref gzhssfgpvljinnvaofjz`.) No secrets to add: the service key is provided by Supabase to the function itself.
