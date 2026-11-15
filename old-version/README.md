# Fiesta Planner

Event-celebration platform (weddings, birthdays, anniversaries, baby showers, graduations, corporate): checklists, schedule, forms, document repository, guest list and RSVP invitations. Bilingual ES/EN, light/dark, mobile-first.

Stack: Next.js 15 (App Router, server actions) · Prisma 6 + SQLite · JWT cookie sessions (bcrypt).

## Run
```bash
npm install
npm run setup     # generate client, create DB, seed demo data
npm run dev       # http://localhost:3000
```
Copy `.env` and set a long random `AUTH_SECRET` and `APP_URL` (used in RSVP links) before deploying.

Demo accounts (seed): `admin@fiesta.test / admin1234` · `organizer@fiesta.test / organizer1234` · `client@fiesta.test / client1234`. Change them before any real use.

## Roles
| Role | Sees | Can | Cannot | Access |
|---|---|---|---|---|
| Superadmin | everything | all; create organizers/clients; delete users | – | seeded |
| Organizer | own events + own clients | create/edit/delete events, schedule, forms, documents, send invitations, create client accounts | see other organizers' events, delete users | created by superadmin |
| Client | events assigned to them | tick/add checklist tasks, manage guests, upload documents, view schedule/forms, see documents marked visible | edit event details, send invitations, delete events/forms | created by organizer (temp password) |
| Guest | their own RSVP link only | answer RSVP, fill public forms | log in | unique link, no account |

## Rules
- If the RSVP deadline (+1 day grace) has passed or the event is cancelled → RSVP is closed.
- If a guest declines → attendees = 0. Attendees can never exceed the seats allotted.
- If a user is a client → documents not flagged "visible to client" are hidden and not downloadable.
- Only the superadmin can delete users; a user who owns events cannot be deleted.
- A schedule item's end time earlier than its start is discarded.
- Uploads: max 10 MB, stored outside the web root with random names, always downloaded as attachments.

## Assumptions (change on request)
- **Email**: no SMTP configured. "Send invitation" saves the message in the event's outbox with a RSVP link and a `mailto:` button. Wiring Resend/SMTP is a small change in `sendInvite` (`app/actions.ts`).
- Times are stored/displayed in the server's local timezone.
- SQLite and local-disk uploads suit tens of users; for thousands, move to Postgres and S3-style storage.
- PDF = browser "Print / PDF" on the event's print view. CSV export/import for guests, CSV export for form responses.
- No self-signup; no password-reset email (superadmin/organizer can recreate accounts).
- Rate limiting on login is not implemented yet.
