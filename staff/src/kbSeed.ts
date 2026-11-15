import type { Article } from "./store";

/**
 * Knowledge base — first version (one-time update). It describes the Event Planner features and "how to" steps
 * as of this prototype; it is NOT refreshed automatically. When the platform changes, the articles must be reviewed.
 */
type A = [title: string, category: string, tags: string[], body: string];
const ARTICLES: A[] = [
  ["Getting started: create your first event", "Getting started", ["events", "start"],
    "1. Sign in and open **My events**.\n2. Press **New event**, choose the event type (wedding, birthday, corporate…), then fill name, date, city and expected guests.\n3. The event page opens with tabs: Tasks, Guests, Invitations, Tables, Timeline, Meetings, Menu, Documents and more.\n4. The first-time tour video is available any time from **Help → How-to video**.\n\nTip: the number of events depends on the plan (Basic 3, Planner 10, Pro unlimited)."],
  ["Plans, prices and what each includes", "Account & billing", ["plans", "billing", "pro"],
    "Plans are Basic, Planner and Pro. Pro unlocks everything (unlimited events, unlimited invitations, custom templates, table planning, assignments to sub-users, AI helpers). Prices are managed by the super admin and shown on the landing page.\n\n**Upgrade:** Account → Billing → choose a plan → pay. A feature that is locked shows a padlock and opens the upgrade window.\n**Downgrade / cancel:** Billing → Change plan. Existing data is kept, extra features lock."],
  ["Task tracker: boards, list, calendar and Gantt", "Planning", ["tasks", "board", "gantt"],
    "Each event has a task tracker with four views: **Board**, **Gantt**, **Calendar** and **List**.\n\n- Add a task with the **+** button. Give it a name, dates, priority, tags and responsible people.\n- Drag cards between lists, or drag a day on the calendar to move the dates.\n- Open a task to add notes and see its history.\n- **My tasks** (left menu) shows every task assigned to you across events.\n\nAssigning tasks to sub-users needs a plan that includes assignments."],
  ["Guest list: add, import and track RSVPs", "Guests", ["guests", "csv", "rsvp"],
    "Open the event → **Guests**.\n\n**Add one by one:** press Add guest (name, email/phone, party size, group).\n**Import:** Import CSV, download the sample file, keep the same column names and upload. Errors are listed row by row.\n**RSVP:** each guest has a status (draft, invited, accepted, declined). Guests answer from their personal invitation link; the answers update here automatically.\n\nCommon issue: a CSV saved with semicolons — re-export as comma-separated UTF-8."],
  ["Designing and sending invitations", "Invitations", ["invitations", "templates", "editor"],
    "Open the event → **Invitations**.\n\n1. Pick a template from the catalogue (published by the design team) or start from a blank design.\n2. Edit it in the **Invitation Studio**: drag blocks (title, date, map, RSVP button, countdown, gallery), change fonts and colours, switch between desktop/tablet/phone preview.\n3. Save. Versions are kept so you can restore an earlier one.\n4. **Send** by email or WhatsApp to all guests or a selection.\n\nCustom templates are a Pro feature. Customers can also ask the design team for a custom invitation from **Help → Contact support** (type *Custom invitation design*) and will get a ticket ID."],
  ["Seating: tables and guest placement", "Planning", ["tables", "seating"],
    "Open the event → **Tables**. Add tables (round, rectangular), set seats, then drag guests onto tables. Unassigned guests are listed on the left. Table planning is included in Pro."],
  ["Timeline and meetings", "Planning", ["timeline", "meetings", "calendar"],
    "**Timeline** is the run-of-show for the event day: add moments with time, duration and owner.\n**Meetings** schedules calls with suppliers or the team and keeps notes. Reminders appear in the Inbox."],
  ["Menu, documents, agreements and approvals", "Planning", ["menu", "documents", "agreements"],
    "**Menu** lists dishes and dietary options per guest.\n**Documents** stores files for the event (contracts, floor plans); a preview opens inside the platform.\n**Agreements** and **Approvals** let the planner send a document to a client or supplier, who accepts or requests changes. Every decision is logged."],
  ["Suppliers, services and talent", "Marketplace", ["suppliers", "services", "talent"],
    "**Suppliers** is the directory (venues, catering, photography…). Open a profile to see services, prices and contact.\n**Services** is where a supplier publishes what they offer.\n**Talent** lists performers/DJs and their availability.\nA planner can invite a supplier to an event; the supplier answers from the supplier home page."],
  ["Team: sub-users and permissions", "Account & billing", ["team", "sub-users"],
    "Account owners can add collaborators under **Team**. Each has their own sign-in; the owner can view the platform \"as\" a collaborator to check what they see. The number of sub-users depends on the plan."],
  ["Inbox, notifications and feedback", "Account & billing", ["inbox", "notifications", "feedback"],
    "The **Inbox** gathers messages and notifications (RSVPs, approvals, support replies). A dot on the menu shows unread items. **Help → Feedback** sends ideas to the product team."],
  ["Contacting support from the platform", "Support", ["support", "tickets"],
    "Customers open **Help → Contact support**, choose *Help* or *Custom invitation design*, and describe the issue. The request gets a ticket ID (SUP-… or DSN-…) and a status that updates live in the same panel. Replies from staff appear there. Internal notes are never shown to customers."],
  ["Reset a customer's password or unblock an account", "Support procedures", ["support", "password", "unblock"],
    "Staff console → **Customers** → open the customer.\n- **Reset password** creates a temporary password (shown once) — send it through the verified channel only.\n- **Unblock** clears a lock after too many failed sign-ins. A **blocked** account (policy) can only be changed by a super admin.\nAlways verify identity (registered email + last invoice or event name) before resetting. Every action is written to the audit log."],
  ["Payment problems: failed, pending, refunded", "Support procedures", ["payments", "refund", "billing"],
    "Customers → open the customer → **Payments**.\n- **Failed:** ask the customer to update the card; **Retry** the charge once they confirm.\n- **Pending:** bank transfers can take 1–3 business days.\n- **Duplicate charge:** escalate to a super admin (creates an ADM- task) — only a super admin can refund.\nNever ask customers for full card numbers."],
  ["Handing a request to the design team", "Support procedures", ["design", "handoff"],
    "When a customer asks for a custom invitation or a design change, open the request and use **Hand over to a designer**. Pick a designer (or leave it automatic: the least busy one) and add a note. A DSN- task is created and linked; when the designer finishes you get a note and can reply to the customer."],
  ["Response-time targets (SLA)", "Support procedures", ["sla", "metrics"],
    "Targets: support 24 h, design 72 h, admin 48 h from creation. A request past its target shows a **late** flag. First reply should be within 4 hours during staffed hours. Set your status (online, break, lunch…) so teammates know your availability."],
];

export function seedArticles(now: number, by: string): Article[] {
  return ARTICLES.map(([title, category, tags, body], i) => ({ id: "kb" + (i + 1), title, category, tags, body, updatedAt: now, by }));
}
