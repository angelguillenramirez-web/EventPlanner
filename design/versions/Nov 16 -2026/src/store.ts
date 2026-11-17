import { useSyncExternalStore } from "react";

export type Lang = "en" | "es" | "pt";
export type Theme = "light" | "dark";
export type Plan = "basic" | "planner" | "pro";
export type Priority = "urgent" | "high" | "medium" | "low" | ""; // "" = not set
export type TaskField = "start" | "due" | "tag" | "priority" | "links"; // Name, Responsible, Description and Notes are always shown
export type ViewMode = "board" | "calendar" | "gantt" | "list";

export interface Status { id: string; name: string; color: string; archived?: boolean }
export const MEMBER_FEATURES = ["tasks", "todos", "documents", "itinerary", "design", "guests", "invitations", "tables", "menu", "meetings", "agreement"] as const;
export const MEMBER_ROLES = ["coordinator", "assistant", "viewer", "vendor", "client"] as const;
export type CollabKind = "team" | "employee" | "supplier" | "client";
export const COLLAB_KINDS: CollabKind[] = ["team", "employee", "supplier", "client"];
/** Starting role, access and scope when an access is created for each kind of collaborator. */
export const KIND_PRESET: Record<CollabKind, { role: string; access: string[]; scopeAll: boolean }> = {
  team: { role: "coordinator", access: [...MEMBER_FEATURES], scopeAll: true },
  employee: { role: "assistant", access: [...MEMBER_FEATURES], scopeAll: true },
  supplier: { role: "vendor", access: ["itinerary", "documents", "menu", "meetings"], scopeAll: false },
  client: { role: "client", access: ["itinerary", "design", "guests", "invitations", "tables", "menu", "agreement"], scopeAll: false },
};
export const KIND_ROLES: Record<CollabKind, string[]> = { team: ["coordinator", "assistant", "viewer"], employee: ["coordinator", "assistant", "viewer"], supplier: ["vendor", "viewer"], client: ["client", "viewer"] };
/** Collaborator (team member, employee, supplier/vendor or client) created and managed only by the account owner. */
export interface Member { lastName: string; /** pending until the collaborator accepts the invitation (team / supplier) or opens the access link for the first time (client) */ status: "pending" | "accepted"; /** unique link token sent by e-mail */ token: string; kind: CollabKind; relation: string; lastLogin: number; resetLog: number[]; tempExpires: number; id: string; name: string; email: string; username: string; password: string; mustChange: boolean; role: string; responsibilities: string; access: string[]; scopeAll: boolean; eventIds: string[]; createdAt: number }
export const memberDefaults = (m: Partial<Member> & { name: string }): Member => ({ lastName: "", status: "accepted", token: uid(), kind: "team", relation: "", lastLogin: 0, resetLog: [], tempExpires: 0, id: uid(), email: "", username: m.name.toLowerCase().replace(/\s+/g, ""), password: "", mustChange: false, role: "coordinator", responsibilities: "", access: [...MEMBER_FEATURES], scopeAll: true, eventIds: [], createdAt: Date.now(), ...m });
export type AccountType = "planner" | "supplier";
/** Answers to the five profile questions asked after the e-mail is confirmed. */
export interface Profile { role: string; volume: string; team: string; goals: string[]; source: string }
/** A registered user (the owner of a planner or supplier account). */
export interface Account { id: string; name: string; email: string; company: string; password: string; promo: string; token: string; confirmed: boolean; confirmedAt: number; createdAt: number; profile: Profile | null; accountType: AccountType | null; test?: boolean }
/** Public profile of the business in the suppliers market, and the open link to the service catalog (platform link / business name). */
export interface SupplierProfile { published: boolean; name: string; slug: string; category: string; tagline: string; about: string; city: string; country: string; phone: string; email: string; web: string; instagram: string; supports: string[]; tier: 1 | 2 | 3; from: number; cover: string; catalogOpen: boolean }
export const emptyProfile = (): SupplierProfile => ({ published: false, name: "", slug: "", category: "catering", tagline: "", about: "", city: "", country: "", phone: "", email: "", web: "", instagram: "", supports: [], tier: 2, from: 0, cover: "", catalogOpen: false });
/** Account details edited but not saved yet (listed when the user signs out). */
export interface AccDraft { name?: string; avatar?: string; logo?: string }
/** URL-safe text: "Laura Events & Co." -> "laura-events-co". */
export const slugify = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
/** Queues the password reset e-mail (link valid for one hour, one use). */
export const RESET_MINUTES = 60;
export const queueReset = (st: State, to: string, name: string) => { st.outbox.push({ id: uid(), to, subject: "reset", token: uid() + uid() + uid(), at: Date.now(), kind: "reset", name }); };
/** Words that cannot be used as the public catalog address. */
export const RESERVED = ["forgot", "reset", "app", "login", "join", "invite", "access", "confirm", "welcome", "choose-type", "trial", "rsvp", "catalog", "api", "admin", "www"];
/** The confirmation e-mail the prototype "sends" (shown in the demo inbox; no real mail is sent). */
export interface Mail { id: string; to: string; subject: string; token: string; at: number; /** "confirm" = sign-up confirmation (default); "invite" = collaborator invitation; "client" = client access link with a temporary password */ kind?: "confirm" | "invite" | "client" | "notice" | "reset"; /** reset links can be used once */ used?: boolean; /** notices: how it is delivered and what it says (dictionary key + values) */ chan?: "email" | "whatsapp"; key?: string; vars?: Record<string, string>; name?: string; pw?: string; role?: string; from?: string; scope?: string }
export const CANCEL_REASONS = ["price", "features", "usage", "competitor", "hard", "trying", "paused", "other"] as const;
export type CancelReason = typeof CANCEL_REASONS[number];
export const CANCEL_FEATURES = ["events", "guests", "invitations", "seating", "agreement", "tasks", "suppliers", "inbox", "team", "budget"] as const;
/** Answers from the short survey shown when a planner cancels a trial or a subscription. */
export interface CancelSurvey { id: string; at: number; plan: Plan; cycle: "monthly" | "yearly"; stage: "trialing" | "active"; reason: CancelReason; detail: string; used: string[]; rating: number; stay: string; contact: boolean }
export interface Subscription { plan: Plan; cycle: "monthly" | "yearly"; status: "none" | "trialing" | "active" | "canceled" | "expired"; startedAt: number; renewsAt: number; trialEndsAt: number; cancelAtEnd: boolean; promo: string }
export interface Invoice { id: string; number: string; at: number; description: string; plan: Plan; cycle: "monthly" | "yearly"; subtotal: number; discount: number; total: number; promo: string; last4: string; billTo: string; address: string }
/** Only the brand and last four digits are kept (test mode: no real card is ever stored). */
export interface Card { brand: string; last4: string; exp: string; holder: string }
export interface Note { id: string; html: string; at: number }
export interface HistoryEntry { id: string; at: number; by: string; key: string; from?: string; to?: string }
export interface Task {
  id: string; eventId: string | null; name: string; start: string; due: string; tags: string[]; assignees: string[]; done: boolean; likes: string[];
  priority: Priority; statusId: string; parentId: string | null; links: string[];
  createdAt: number; description: string; notes: Note[]; history: HistoryEntry[];
}
export interface Todo { id: string; eventId: string; text: string; done: boolean }
export type Channel = "whatsapp" | "email";
export interface Guest { id: string; eventId: string; name: string; email: string; phone: string; status: "draft" | "sent" | "confirmed" | "declined"; table: string; invitees: number; message: string; channel: Channel; country: string; lang: Lang; token: string; sentAt: number; sentVia: "" | Channel }
export const guestDefaults = (g: Partial<Guest> & { id: string; eventId: string; name: string }): Guest => ({ email: "", phone: "", status: "draft", table: "", invitees: 1, message: "", channel: g.phone && !g.email ? "whatsapp" : g.email ? "email" : "whatsapp", country: "MX", lang: "es", token: uid() + uid(), sentAt: 0, sentVia: "", ...g });
/** A hand-built HTML invitation (made in the invitation studio editor). */
export interface InvVersion { id: string; at: number; name: string; html: string; css: string }
export interface Invitation { id: string; eventId: string; name: string; html: string; css: string; createdAt: number; modifiedAt: number; versions: InvVersion[]; /** who made it: an 1Plan designer, or the user from a template / the AI. Nobody but 1Plan staff edits the HTML. */ source?: "staff" | "template" | "ai"; comments?: Comment[]; likes?: string[]; requestId?: string }
/** A custom design requested from the 1Plan design team. */
export interface DesignRequest { id: string; eventId: string; colors: string; tone: string; vibe: string; links: string[]; images: string[]; ref: string; createdAt: number; delivered: boolean }
export interface Design { template: string; title: string; message: string; color: string; font: string; edits: number; sent: boolean }
export interface SubUser { id: string; name: string; email: string; password: string }
export type EventStatus = "active" | "archived" | "cancelled";
export interface EventT {
  id: string; name: string; type: string; date: string; location: string; venue: string; description: string; picture: string; createdAt: number;
  status: EventStatus; /** name used in the RSVP links of this event (…/rsvp/<name>/<guest>) */ rsvpSlug?: string; /** colours recently used in this event's seating plans */ recentColors?: string[]; sections: string[]; hiddenTabs: string[]; tabOrder: string[]; statuses: Status[]; fields: TaskField[]; design: Design; subUsers: SubUser[];
}
export type SeatShape = "round" | "square" | "rect" | "oval" | "serpent" | "head" | "rows";
export interface Seat { id: string; label: string; color: string; guestId: string; party: number }
export interface SeatTable { id: string; name: string; shape: SeatShape; x: number; y: number; color: string; seats: Seat[]; rot: number; scale: number; /** columns of a chair-rows block */ cols?: number; /** a single loose chair that can be dropped onto a table */ chair?: boolean }
export const FIGURE_KINDS = ["square", "circle", "triangle", "diamond", "hexagon", "pentagon", "star", "cross", "arrow", "arrowdouble", "chevron", "line"] as const;
export interface Figure { id: string; kind: (typeof FIGURE_KINDS)[number]; name: string; x: number; y: number; w: number; h: number; color: string; rot: number }
export interface Approval { id: string; name: string; kind: "team" | "client"; status: "pending" | "approved" | "changes"; at: number }
/** One saved version of one seating arrangement (ceremony, dinner, bar...) of an event; versions of the same arrangement share `arrId`. */
export interface Seating { id: string; eventId: string; arrId: string; arrName: string; kind: string; name: string; createdAt: number; locked: boolean; tables: SeatTable[]; figures: Figure[]; w: number; h: number; legend: { id: string; color: string; meaning: string }[]; approvals: Approval[]; pos?: number; archived?: boolean }
export const MENU_CATEGORIES = ["starter", "main", "side", "drink", "dessert", "kids", "other"] as const;
export interface MenuItem { id: string; eventId: string; category: string; name: string; description: string; price: number; image: string; selected: boolean; createdAt: number }
export type PriceModel = "fixed" | "hourly" | "perGuest" | "quote";
export const SERVICE_CATEGORIES = ["planning", "coordination", "design", "vendors", "guests", "production", "other"] as const;
/** A service the planner offers to clients (shown in the planner's service catalog). */
export interface Service { id: string; name: string; category: string; description: string; priceModel: PriceModel; price: number; duration: string; includes: string[]; eventTypes: string[]; active: boolean; featured: boolean; image: string; createdAt: number }
export const defaultServices = (): Service[] => ([
  ["planning", "Full event planning", "From the first idea to the last dance: concept, budget, timeline and every detail handled for you.", "fixed", 3500, "4–8 months", ["Concept & budget", "Vendor search and contracts", "Timeline & checklists", "Guest management & RSVP", "Event-day coordination"], true],
  ["coordination", "Day-of coordination", "A coordinator runs the event so you can enjoy it.", "fixed", 900, "10–12 hours", ["Final walkthrough", "Vendor arrival management", "Run-of-show", "Problem solving on site"], false],
  ["design", "Décor & design", "Mood board, floral and table design, and styling on the day.", "fixed", 1500, "2–3 months", ["Mood board", "Floral & table design", "Styling & set-up"], false],
  ["vendors", "Vendor management", "We find, compare and manage the best suppliers for your budget.", "fixed", 700, "Ongoing", ["Shortlist of suppliers", "Quotes comparison", "Contract follow-up"], false],
  ["guests", "Guest & RSVP management", "Invitations, RSVP follow-up and seating plan.", "perGuest", 6, "Ongoing", ["Digital invitations", "RSVP follow-up", "Seating arrangement versions"], false],
  ["coordination", "Consulting hour", "One-to-one planning advice for DIY events.", "hourly", 80, "1 hour", ["Video call", "Written summary"], false],
] as [string, string, string, PriceModel, number, string, string[], boolean][]).map(([category, name, description, priceModel, price, duration, includes, featured]) => ({ id: uid(), name, category, description, priceModel, price, duration, includes, eventTypes: [], active: true, featured, image: "", createdAt: Date.now() }));
export interface Folder { id: string; eventId: string; name: string; createdAt: number; modifiedAt: number }
export interface Doc { id: string; eventId: string; folderId: string; name: string; category: string; size: number; mime: string; data: string; createdAt: number }
export interface Meeting { id: string; eventId: string; title: string; date: string; time: string; duration: number; provider: "meet" | "zoom"; link: string; agenda: string; attendees: string[]; createdAt: number }
export interface Comment { id: string; by: string; at: number; text: string; /** task created from this comment */ taskId?: string }
export interface Activity { id: string; name: string; date: string; time: string; duration: number; location: string; comments: Comment[]; history: ActHist[]; icon?: string }
export interface ActHist { id: string; at: number; by: string; key: "created" | "name" | "date" | "time" | "duration" | "location" | "commentadded" | "commentdeleted"; from?: string; to?: string }
export interface Itinerary { id: string; eventId: string; name: string }
export interface Dot { id: string; eventId: string; itinId?: string; activities: Activity[] } // one stop on the event itinerary
export const TALENT_KINDS = ["host", "mc", "dj", "musician", "band", "singer", "dancer", "performer", "other"] as const;
/** A performer / host booked for the event (host, MC, DJ, musicians, band...). */
export interface Talent { id: string; eventId: string; kind: string; name: string; contact: string; phone: string; email: string; fee: number; arrival: string; start: string; duration: number; status: "prospect" | "confirmed"; notes: string; createdAt: number }
export type SignoffScope = "itinerary" | "tables" | "invitations" | "talent" | "menu" | "agreement";
export interface Approver { id: string; name: string; kind: "planner" | "client"; userId: string; at: number; by: string }
/** A started approval: planner and clients confirm a decision. Immutable once approved; every approver keeps a timestamp. */
export type Snap =
  | { k: "itinerary"; acts: { when: string; time: string; name: string; location: string }[] }
  | { k: "tables"; rec: Seating }
  | { k: "invitation"; html: string; css: string }
  | { k: "agreement"; html: string; paper?: AgPaper }
  | { k: "menu"; perPerson: number; items: { category: string; name: string; price: number }[] };
export interface Signoff { id: string; eventId: string; scope: SignoffScope; subject: string; summary: string[]; snap?: Snap; startedBy: string; startedAt: number; approvers: Approver[] }
export type AgKind = "parties" | "event" | "itinerary" | "menu" | "talent" | "seating" | "invitation" | "fees" | "payment" | "terms" | "custom";
/** Paper look of the agreement: colour, texture (preset or an uploaded picture) and the company logo shown at the top. */
export interface AgPaper { color: string; texture: string; image: string; logo: "" | "account" | "upload"; logoImg: string; logoSize: "s" | "m" | "l"; logoAlign: "left" | "center" | "right"; logoPos: "top" | "bottom" }
export const defaultPaper = (): AgPaper => ({ color: "#ffffff", texture: "", image: "", logo: "", logoImg: "", logoSize: "m", logoAlign: "center", logoPos: "top" });
/** `vis` = pictures that go with the section (dish photos, seating plan, invitation), generated from the event; `showVis` = include them in the document. `taskIds` = tasks created from comments. */
export interface AgSection { id: string; kind: AgKind; title: string; html: string; included: boolean; comments: Comment[]; vis?: string; showVis?: boolean }
export interface AgVersion { id: string; at: number; by: string; name: string; sections: AgSection[] }
/** The Event Agreement: one editable document with every detail of an event; once approved by planner and client it is locked and works as the contract. */
export interface Agreement { paper?: AgPaper; id: string; eventId: string; version: number; status: "draft" | "sent"; sections: AgSection[]; versions: AgVersion[]; createdAt: number; modifiedAt: number }
export interface Support { id: string; subject: string; message: string; status: "open" | "answered"; createdAt: number; kind?: "support" | "design"; /** reference from the staff console, "" = not delivered yet */ ref?: string; taskId?: string; remote?: string; replies?: { at: number; text: string }[] }
/** Inbox: conversations with suppliers and a feed of platform notifications. */
export interface InboxMsg { id: string; from: "me" | "them"; text: string; /** dictionary key for seeded messages (so they follow the language) */ key?: string; at: number; attach?: { name: string; size: number }; quote?: { amount: number; status: "pending" | "accepted" | "declined" }; read: boolean }
export interface Thread { id: string; supplierId: string; eventId: string; pinned: boolean; archived: boolean; muted: boolean; createdAt: number; msgs: InboxMsg[] }
export const NOTIF_TYPES = ["approval", "supplier", "task", "guest", "collab", "billing"] as const;
export type NotifType = (typeof NOTIF_TYPES)[number];
export interface Notif { id: string; type: NotifType; key: string; vars: Record<string, string | number>; at: number; read: boolean; href: string }
export interface InboxPrefs { types: Record<NotifType, boolean>; digest: "off" | "daily" | "weekly" }
export interface ChatMsg { id: string; from: "me" | "support"; text: string }
export type QType = "single" | "multiple" | "text" | "likert" | "yesno";
export interface Question { id: string; type: QType; text: string; options: string[] }
export interface Survey { id: string; eventId: string; title: string; questions: Question[]; responses: Record<string, string | string[]>[] }
export interface DefaultSurvey { title: string; questions: Question[] }
export interface Billing { name: string; taxId: string; address: string; city: string; country: string }
export interface EventType { id: string; color: string; name?: string; custom?: boolean }

export interface State {
  lang: Lang; theme: Theme; plan: Plan; sidebarCollapsed: boolean; businessLogo: string; defaultFields: TaskField[]; defaultFieldsCustom: boolean; loggedIn: boolean; sub: Subscription; eventLog: number[]; invoices: Invoice[]; card: Card | null; sessionId: string; accounts: Account[]; outbox: Mail[]; accountType: "planner" | "supplier" | null; userName: string; avatar: string;
  tags: string[]; team: Member[]; events: EventT[]; tasks: Task[]; todos: Todo[]; guests: Guest[]; invitations: Invitation[]; seatings: Seating[]; menu: MenuItem[]; menuLibrary: MenuItem[]; services: Service[]; documents: Doc[]; meetings: Meeting[]; dots: Dot[]; itineraries: Itinerary[]; talents: Talent[]; signoffs: Signoff[]; agreements: Agreement[]; designRequests: DesignRequest[]; folders: Folder[]; defaultSurvey: DefaultSurvey | null; userEmail: string; userPhone: string; billing: Billing;
  supplierProfile: SupplierProfile; accDraft: AccDraft | null; confirmOut: boolean; tourSeen: string[]; threads: Thread[]; notifs: Notif[]; inboxPrefs: InboxPrefs; support: Support[]; chat: ChatMsg[]; supplierChats: Record<string, ChatMsg[]>; surveys: Survey[]; feedback: { rating: number; text: string; at: number }[]; cancelSurveys: CancelSurvey[];
  eventTypes: EventType[]; upsell: string | null; supportOpen: boolean; viewAs: string; seatEditor: boolean; seatDirty: boolean;
}

/** Brand colors (Paper + Coral Spark palette). gold = sun yellow, blue = soft blue, rose = coral. */
export const COLORS = { teal: "#46C8B2", gold: "#F0B429", blue: "#6FA8FF", rose: "#FF7A59" };
/** Colors used before the palette change: data saved with them is moved to the new ones when it loads. */
const OLD_COLORS: Record<string, string> = { "#F0B429": "#F0B429", "#6FA8FF": "#6FA8FF", "#FF7A59": "#FF7A59" };

/** What each plan allows. Ids stay "basic" / "planner" / "pro" (stored in accounts); names shown to users are Essential / Premier / Unlimited.
 *  events = per 30 days (archived, cancelled and deleted still count). tables / itineraries / collabs / designEdits = maximum amounts; customStatuses = tasks can have more than To do / In progress / Done. */
export interface PlanRules { events: number; invites: number; tables: number; printTables: boolean; customStatuses: boolean; documents: boolean; itineraries: number; designRequest: boolean; designEdits: number; customLink: boolean; agreements: boolean; meetings: boolean; collabs: number; customTemplates: boolean; editContacts: boolean; assign: boolean; todos: boolean; subUsers: number; ai: boolean }
const FULL: PlanRules = { events: Infinity, invites: Infinity, tables: Infinity, printTables: true, customStatuses: true, documents: true, itineraries: Infinity, designRequest: true, designEdits: Infinity, customLink: true, agreements: true, meetings: true, collabs: Infinity, customTemplates: true, editContacts: true, assign: true, todos: true, subUsers: Infinity, ai: false };
export const PLANS: Record<Plan, PlanRules> = {
  basic: { ...FULL, events: 2, invites: 25, tables: 1, printTables: false, customStatuses: false, documents: false, itineraries: 1, designRequest: false, designEdits: 0, customLink: false, agreements: false, meetings: false, collabs: 2 },
  planner: { ...FULL, events: 4, invites: 50, tables: 2, printTables: false, designEdits: 3, customLink: false, collabs: 5 },
  pro: { ...FULL },
};

/** Profile in use: the account owner, or (demo) a collaborator the owner is viewing the platform as. */
export const me = (st: State) => { const m = st.viewAs ? st.team.find((x) => x.id === st.viewAs) : undefined; return m ? { id: m.id, name: m.name } : { id: "owner", name: st.userName }; };
/** Test users (prototype). Everyone signs in with an e-mail address. */
export const TEST_USERS = {
  planner: { login: "planner@aplan.test", password: "Planner#2026" },
  supplier: { login: "supplier@aplan.test", password: "Supplier#2026" },
  client: { login: "sofia.client@aplan.test", password: "Client#2026" },
  collaborator: { login: "daniel.team@aplan.test", password: "Team#2026" },
};
export const TEST_CLIENT = { kind: "client" as CollabKind, ...KIND_PRESET.client, email: TEST_USERS.client.login, username: TEST_USERS.client.login, password: TEST_USERS.client.password, relation: "Bride", scopeAll: false };
export const TEST_COLLAB = { kind: "team" as CollabKind, ...KIND_PRESET.team, email: TEST_USERS.collaborator.login, username: TEST_USERS.collaborator.login, password: TEST_USERS.collaborator.password, relation: "", role: "coordinator" };
const mkAccount = (p: Partial<Account> & { name: string; email: string; password: string }): Account => ({ id: Math.random().toString(36).slice(2, 10), company: "", promo: "", token: "", confirmed: true, confirmedAt: Date.now(), createdAt: Date.now(), profile: null, accountType: null, ...p });
const testAccounts = (): Account[] => [
  mkAccount({ name: "Laura", email: TEST_USERS.planner.login, password: TEST_USERS.planner.password, company: "Laura Events", accountType: "planner", test: true, profile: { role: "planner", volume: "6-20", team: "2-5", goals: ["tasks", "invitations"], source: "other" } }),
  mkAccount({ name: "Marco (supplier)", email: TEST_USERS.supplier.login, password: TEST_USERS.supplier.password, company: "Marco Catering", accountType: "supplier", test: true, profile: { role: "vendor", volume: "21-50", team: "2-5", goals: ["clients"], source: "other" } }),
];
/** Address of the "how to" video shown on first access. Empty until the video is produced: a placeholder is shown instead. */
export const HOWTO_VIDEO_URL = "";
export const TRIAL_DAYS = 7;
/** Plan prices in USD. Yearly is billed once a year with 10% off (12 x monthly x 0.9). */
export const PRICES: Record<Plan, { monthly: number; yearly: number }> = { basic: { monthly: 40, yearly: 432 }, planner: { monthly: 70, yearly: 756 }, pro: { monthly: 110, yearly: 1188 } };
/** USD saved per year by paying annually instead of monthly. */
export const yearlySaving = (p: Plan) => Math.round((PRICES[p].monthly * 12 - PRICES[p].yearly) * 100) / 100;
export const PLAN_NAMES: Record<Plan, string> = { basic: "Essential", planner: "Premier", pro: "Unlimited" };
/** A free trial of a plan, starting now. */
export const newTrial = (plan: Plan): Subscription => ({ plan, cycle: "monthly", status: "trialing", startedAt: Date.now(), renewsAt: 0, trialEndsAt: Date.now() + TRIAL_DAYS * 86400000, cancelAtEnd: false, promo: "" });
export const uid = () => Math.random().toString(36).slice(2, 10);
export const DAY = 86400000;
export const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

export const defaultStatuses = (): Status[] => [
  { id: "todo", name: "To do", color: COLORS.blue },
  { id: "doing", name: "In progress", color: COLORS.gold },
  { id: "done", name: "Done", color: COLORS.teal },
];
const defaultDesign = (type: string): Design => ({
  template: type === "wedding" ? "classic" : "party", title: "", message: "", color: type === "wedding" ? COLORS.rose : type === "birthday" ? COLORS.gold : COLORS.teal, font: type === "wedding" ? "serif" : "sans", edits: 0, sent: false,
});
export const DEFAULT_FIELDS: TaskField[] = [];
export const newEvent = (p: { name: string; type: string; date: string; location?: string; venue?: string; description?: string; picture?: string }, fields: TaskField[] = DEFAULT_FIELDS): EventT => ({
  id: uid(), name: p.name, type: p.type, date: p.date, location: p.location ?? "", venue: p.venue ?? "", description: p.description ?? "", picture: p.picture ?? "",
  createdAt: Date.now(), status: "active", sections: [],
  // new events start with Tasks, Itinerary and Invitation Studio; the rest are hidden (listed under "+")
  hiddenTabs: ["todos", "documents", "guests", "invitations", "tables", "menu"], tabOrder: ["tasks", "todos", "documents", "itinerary", "design", "guests", "invitations", "tables", "menu", "talent", "agreement"], statuses: defaultStatuses(), fields: [...fields], design: defaultDesign(p.type), subUsers: [],
});

export const newTask = (p: Partial<Task> & { eventId: string | null; name: string; statusId: string }): Task => ({
  id: uid(), start: iso(), due: iso(7), tags: [], assignees: [], done: false, likes: [], priority: "medium", parentId: null, links: [], description: "", notes: [], createdAt: Date.now(),
  history: [{ id: uid(), at: p.createdAt ?? Date.now(), by: p.assignees?.[0] || "", key: "created" }], ...p,
});
/** Applies a patch to a task and records each real change in its history. */
export function patchTask(st: State, id: string, patch: Partial<Task>) {
  const tk = st.tasks.find((x) => x.id === id);
  if (!tk) return;
  const ev = st.events.find((e) => e.id === tk.eventId);
  const sName = (sid: string) => (ev?.statuses ?? defaultStatuses()).find((x) => x.id === sid)?.name ?? sid;
  const tName = (ids: string[]) => ids.map((x) => st.tasks.find((y) => y.id === x)?.name ?? "").join(", ");
  for (const k of Object.keys(patch) as (keyof Task)[]) {
    const from = tk[k], to = patch[k];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    let e: [string, string, string] | null = null;
    if (k === "statusId") e = ["status", sName(from as string), sName(to as string)];
    else if (k === "links") e = ["links", tName(from as string[]), tName(to as string[])];
    else if (k === "description") e = ["description", "", ""];
    else if (k === "tags") e = ["tags", (from as string[]).join(", "), (to as string[]).join(", ")];
    else if (k === "assignees") e = ["assignees", (from as string[]).map((x) => "@" + x).join(", "), (to as string[]).map((x) => "@" + x).join(", ")];
    else if (k === "done") e = [to ? "done" : "undone", "", ""];
    else if (["name", "start", "due", "priority"].includes(k)) e = [k, String(from ?? ""), String(to ?? "")];
    if (e) tk.history.unshift({ id: uid(), at: Date.now(), by: st.userName, key: e[0], from: e[1], to: e[2] });
  }
  Object.assign(tk, patch);
}
export const q = (type: QType, text: string, options: string[] = []): Question => ({ id: uid(), type, text, options });
function seedSurveys(eventId: string): Survey[] {
  const q1 = q("likert", "¿Qué tan satisfecho estás con la organización?"), q2 = q("yesno", "¿Recomendarías el servicio?"), q3 = q("text", "¿Qué mejorarías?");
  return [{ id: uid(), eventId, title: "Satisfacción del servicio", questions: [q1, q2, q3], responses: [
    { [q1.id]: "5", [q2.id]: "yes", [q3.id]: "Todo perfecto" }, { [q1.id]: "4", [q2.id]: "yes", [q3.id]: "Más recordatorios" }, { [q1.id]: "3", [q2.id]: "no", [q3.id]: "" }] }];
}

/** The planner's default menu options (kept across events; clients pick from them or create new ones). */
export const defaultMenuLibrary = (): MenuItem[] => ([
  ["starter", "Crema de calabaza", "Con crujiente de tocino y crema.", 6], ["starter", "Ensalada de burrata", "Jitomate, albahaca y reducción de balsámico.", 8], ["starter", "Ceviche de camarón", "Limón, cilantro y aguacate.", 9],
  ["main", "Filete de res en reducción de vino", "Puré de papa y vegetales asados.", 22], ["main", "Pechuga rellena", "Espinacas y queso, salsa de champiñones.", 17], ["main", "Salmón al limón", "Con arroz silvestre y espárragos.", 21], ["main", "Risotto de hongos (vegetariano)", "Parmesano y trufa.", 16],
  ["side", "Vegetales asados", "Calabacita, zanahoria y espárragos.", 3], ["drink", "Barra libre nacional", "4 horas de servicio.", 18], ["drink", "Barra de café y té", "Servicio continuo.", 4],
  ["dessert", "Pastel de tres leches", "Con fresas frescas.", 5], ["dessert", "Mesa de postres", "Selección de mini postres.", 7], ["kids", "Mini hamburguesas y papas", "Menú infantil.", 8],
] as [string, string, string, number][]).map(([category, name, description, price]) => ({ id: uid(), eventId: "", category, name, description, price, image: "", selected: false, createdAt: Date.now() }));

/** Two extra demo events (corporate and anniversary), so the My events list has more than one row of cards. */
const SAMPLES_KEY = "fiesta-proto-samples-v1";
function sampleEvents(): { events: EventT[]; tasks: Task[] } {
  const c = newEvent({ name: "Cumbre de equipo 2027", type: "corporate", date: iso(119), venue: "Hotel Central", location: "Monterrey, México", description: "Reunión anual del equipo, 85 personas." });
  const a = newEvent({ name: "Bodas de plata (25 años)", type: "anniversary", date: iso(143), venue: "Casa Lomas", location: "Guadalajara, México", description: "Celebración de aniversario para 40 invitados." });
  for (const e of [c, a]) { e.createdAt -= 40 * DAY; e.hiddenTabs = ["tables", "menu"]; e.tabOrder = []; } // older than 30 days: they do not use up the monthly event limit
  const mk = (eventId: string, name: string, off: number, len: number, tag: string, priority: Priority, statusId: string): Task =>
    newTask({ eventId, name, statusId, tags: [tag], assignees: ["Laura"], priority, start: iso(off), due: iso(off + len), createdAt: Date.now() - 20 * DAY });
  const tasks = [
    mk(c.id, "Reservar hotel", -10, 8, "Venue", "high", "done"), mk(c.id, "Armar la agenda", 10, 20, "Admin", "medium", "todo"), mk(c.id, "Contratar ponentes", 15, 40, "Suppliers", "high", "todo"),
    mk(c.id, "Catering del evento", 30, 30, "Food", "medium", "todo"), mk(c.id, "Material impreso", 60, 20, "Admin", "low", "todo"),
    mk(a.id, "Reservar salón", -5, 10, "Venue", "high", "doing"), mk(a.id, "Lista de invitados", 5, 25, "Invitations", "medium", "todo"),
    mk(a.id, "Pastel y bocadillos", 40, 30, "Food", "medium", "todo"), mk(a.id, "Música en vivo", 50, 40, "Suppliers", "low", "todo"),
  ];
  return { events: [c, a], tasks };
}
function seed(): State {
  const w = newEvent({ name: "Boda de Sofía & Daniel", type: "wedding", date: iso(75), venue: "Hacienda Los Arcos", location: "Valle de Bravo, México", description: "Ceremonia y recepción para 120 invitados." });
  w.fields = ["start", "due", "tag", "priority", "links"];
  w.sections = ["meetings"];
  w.hiddenTabs = ["tables", "menu"]; w.tabOrder = [];
  w.design = { ...w.design, title: "Sofía & Daniel", message: "Nos casamos y queremos celebrarlo contigo.", edits: 1 };
  const b = newEvent({ name: "Cumpleaños de Valentina (15)", type: "birthday", date: iso(30), venue: "Salón Aurora", location: "Ciudad de México" });
  b.createdAt -= 12 * DAY;
  b.hiddenTabs = ["tables", "menu"]; b.tabOrder = [];
  const sm = sampleEvents();
  const mk = (eventId: string, name: string, off: number, len: number, tag: string, who: string, priority: Priority, statusId: string, notes = ""): Task => ({
    ...newTask({ eventId, name, statusId, tags: tag ? [tag] : [], assignees: who ? [who] : [], priority, start: iso(off), due: iso(off + len), createdAt: Date.now() - 20 * DAY }),
    notes: notes ? [{ id: uid(), html: notes, at: Date.now() - 18 * DAY }] : [],
  });
  const t1 = mk(w.id, "Reservar lugar", -20, 10, "Venue", "Laura", "urgent", "done", "<b>Contrato firmado.</b>");
  const t2 = mk(w.id, "Contratar catering", -5, 25, "Food", "Laura", "high", "doing");
  const t3 = mk(w.id, "Enviar invitaciones", 5, 10, "Invitations", "Laura", "high", "todo");
  const t4 = mk(w.id, "Plan de mesas", 40, 10, "Seating", "Sofía", "medium", "todo");
  const t5 = mk(w.id, "Contratar fotógrafo", 0, 30, "Suppliers", "Daniel", "medium", "doing");
  t3.links = [t2.id];
  t2.history.unshift({ id: uid(), at: Date.now() - 3 * DAY, by: "Laura", key: "due", from: iso(20), to: iso(20 + 5) });
  const tasks = [t1, t2, t3, t4, t5,
    mk(b.id, "Reservar salón", -10, 8, "Venue", "Laura", "high", "done"), mk(b.id, "Pastel", 5, 20, "Food", "Laura", "medium", "todo"),
    { ...mk("", "Revisar contratos pendientes", 0, 3, "Admin", "Laura", "medium", "todo"), eventId: null }];
  const g = (eventId: string, name: string, email: string, phone: string, status: Guest["status"], table = ""): Guest => guestDefaults({ id: uid(), eventId, name, email, phone, status, table, sentAt: status === "draft" ? 0 : Date.now() - 3 * DAY, sentVia: status === "draft" ? "" : "email", channel: "email" });
  return {
    lang: "es", theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", plan: "pro", sidebarCollapsed: false, businessLogo: "", defaultFields: [...DEFAULT_FIELDS], defaultFieldsCustom: false, documents: [], folders: [], defaultSurvey: null, userEmail: "laura@planner.test", userPhone: "+52 55 0000 0000", billing: { name: "", taxId: "", address: "", city: "", country: "" }, loggedIn: false, sub: newTrial("pro"), eventLog: [Date.now() - 12 * DAY, Date.now()], invoices: [], card: { brand: "Visa", last4: "4242", exp: "12/30", holder: "Laura" }, sessionId: "", accounts: testAccounts(), outbox: [], accountType: "planner", userName: "Laura", avatar: "",
    tags: [...new Set(tasks.flatMap((x) => x.tags))].reverse(), team: [memberDefaults({ name: "Sofía", lastName: "Ramos", ...TEST_CLIENT, eventIds: [w.id] }), memberDefaults({ name: "Daniel", lastName: "Torres", ...TEST_COLLAB })], events: [w, b, ...sm.events], tasks: [...tasks, ...sm.tasks],
    todos: [{ id: uid(), eventId: w.id, text: "Probar vestido", done: false }, { id: uid(), eventId: w.id, text: "Confirmar música", done: true }],
    invitations: [], seatings: [], menuLibrary: defaultMenuLibrary(), services: defaultServices(),
    menu: [
      ["starter", "Crema de calabaza", "Con crujiente de tocino y crema.", 6], ["starter", "Ensalada de burrata", "Jitomate, albahaca y reducción de balsámico.", 8],
      ["main", "Filete de res en reducción de vino", "Puré de papa y vegetales asados.", 22], ["main", "Salmón al limón", "Con arroz silvestre y espárragos.", 21],
      ["drink", "Barra libre nacional", "4 horas de servicio.", 18], ["dessert", "Pastel de tres leches", "Pastel de bodas con fresas.", 5],
    ].map(([category, name, description, price], i) => ({ id: uid(), eventId: w.id, category: category as string, name: name as string, description: description as string, price: price as number, image: "", selected: i % 2 === 0, createdAt: Date.now() })),
    guests: [g(w.id, "María López", "maria@example.com", "+52 55 1234 5678", "confirmed", "1"), g(w.id, "Carlos Ruiz", "carlos@example.com", "+52 55 8765 4321", "declined"),
      g(w.id, "Familia Pérez", "perez@example.com", "+52 55 1111 2222", "sent", "2"), g(w.id, "Ana Torres", "ana@example.com", "", "draft")],
    support: [{ id: uid(), subject: "Cambiar fecha del evento", message: "Necesito mover la fecha una semana.", status: "answered", createdAt: Date.now() - 3 * DAY }],
    supplierChats: {},
    threads: [
      { id: uid(), supplierId: "s1", eventId: w.id, pinned: true, archived: false, muted: false, createdAt: Date.now() - 3 * 3600000, msgs: [
        { id: uid(), from: "me", text: "", key: "inb.seed.v0", at: Date.now() - 26 * 3600000, read: true },
        { id: uid(), from: "them", text: "", key: "inb.seed.v1", at: Date.now() - 3 * 3600000, read: false, quote: { amount: 6500, status: "pending" } }] },
      { id: uid(), supplierId: "s3", eventId: w.id, pinned: false, archived: false, muted: false, createdAt: Date.now() - 24 * 3600000, msgs: [
        { id: uid(), from: "them", text: "", key: "inb.seed.c1", at: Date.now() - 24 * 3600000, read: false }] },
      { id: uid(), supplierId: "s7", eventId: w.id, pinned: false, archived: false, muted: false, createdAt: Date.now() - 4 * 86400000, msgs: [
        { id: uid(), from: "me", text: "", key: "inb.seed.m0", at: Date.now() - 4 * 86400000, read: true },
        { id: uid(), from: "them", text: "", key: "inb.seed.m1", at: Date.now() - 4 * 86400000 + 3600000, read: true, attach: { name: "Repertorio.pdf", size: 482000 } }] },
    ],
    notifs: [
      { id: uid(), type: "supplier", key: "inb.n.quote", vars: { name: "Hacienda Los Arcos" }, at: Date.now() - 3 * 3600000, read: false, href: "/app/inbox" },
      { id: uid(), type: "approval", key: "inb.n.approved", vars: { name: "Daniel", subject: "Distribución de mesas" }, at: Date.now() - 5 * 3600000, read: false, href: `/app/event/${w.id}/tables` },
      { id: uid(), type: "guest", key: "inb.n.rsvp", vars: { n: 3 }, at: Date.now() - 20 * 3600000, read: false, href: `/app/event/${w.id}/guests` },
      { id: uid(), type: "task", key: "inb.n.due", vars: { n: 2 }, at: Date.now() - 30 * 3600000, read: true, href: "/app/tasks" },
      { id: uid(), type: "collab", key: "inb.n.joined", vars: { name: "Sofía" }, at: Date.now() - 2 * 86400000, read: true, href: "/app/team" },
    ],
    tourSeen: [], cancelSurveys: [], supplierProfile: emptyProfile(), accDraft: null, confirmOut: false,
    inboxPrefs: { types: { approval: true, supplier: true, task: true, guest: true, collab: true, billing: true }, digest: "daily" },
    chat: [{ id: uid(), from: "support", text: "¡Hola! ¿En qué podemos ayudarte?" }],
    surveys: seedSurveys(w.id),
    feedback: [],
    eventTypes: [
      { id: "wedding", color: COLORS.rose }, { id: "birthday", color: COLORS.gold }, { id: "babyshower", color: COLORS.blue },
      { id: "graduation", color: COLORS.teal }, { id: "anniversary", color: "#9B87F5" }, { id: "corporate", color: "#B8A98A" },
    ],
    dots: [
      ["Llegada de invitados", "17:30", 30, "Jardín"], ["Ceremonia", "18:00", 60, "Capilla"], ["Cena", "20:00", 120, "Salón principal"], ["Brindis", "20:30", 15, "Salón principal"],
    ].map(([name, time, duration, location]) => ({ id: uid(), eventId: w.id, activities: [{ id: uid(), name: name as string, date: w.date, time: time as string, duration: duration as number, location: location as string, comments: [], history: [] }] })),
    meetings: [{ id: uid(), eventId: w.id, title: "Reunión con el proveedor de catering", date: iso(6), time: "10:00", duration: 45, provider: "meet", link: "https://meet.google.com/abc-defg-hij", agenda: "Revisar menú y cantidades.", attendees: ["Sofía", "Daniel"], createdAt: Date.now() }],
    itineraries: [], talents: [], signoffs: [], agreements: [], designRequests: [], viewAs: "",
    upsell: null, supportOpen: false, seatEditor: false, seatDirty: false,
  };
}

const KEY = "fiesta-proto-v1";
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = { ...seed(), ...JSON.parse(raw), upsell: null, supportOpen: false, seatEditor: false, seatDirty: false, accDraft: null, confirmOut: false } as State;
      st.tasks = st.tasks.filter((x) => !x.parentId); // sub tasks were removed from the product
      st.tasks = st.tasks.map((x) => ({ ...x, createdAt: x.createdAt ?? Date.now(), description: x.description ?? "", history: x.history ?? [{ id: uid(), at: x.createdAt ?? Date.now(), by: st.userName, key: "created" }],
        notes: Array.isArray(x.notes) ? x.notes : (x.notes as unknown as string) ? [{ id: uid(), html: x.notes as unknown as string, at: Date.now() }] : [] }));
      st.tasks = st.tasks.map((x) => { const o = x as unknown as { responsible?: string; assignees?: string[] }; return { ...x, assignees: Array.isArray(o.assignees) ? o.assignees : o.responsible ? [o.responsible] : [], done: x.done ?? false, likes: x.likes ?? [] }; });
      st.tasks = st.tasks.map((x) => { const o = x as unknown as { tag?: string; tags?: string[] }; return { ...x, tags: Array.isArray(o.tags) ? o.tags : o.tag ? [o.tag] : [] }; });
      if (!st.tags) st.tags = [...new Set(st.tasks.flatMap((x) => x.tags))].reverse();
      if (!st.team) st.team = seed().team;
      st.team = st.team.map((m) => memberDefaults(m)); // fill the new member fields on older data
      const ALLOWED = ["start", "due", "tag", "priority", "links"];
      st.events.forEach((e) => { e.fields = e.fields.filter((f) => ALLOWED.includes(f)); });
      st.defaultFields = st.defaultFields.filter((f) => ALLOWED.includes(f));
      st.events.forEach((e) => { e.fields = e.fields.filter((f) => (f as string) !== "subtasks"); });
      st.defaultFields = st.defaultFields.filter((f) => (f as string) !== "subtasks");
      if (!st.defaultFieldsCustom) st.defaultFields = [...DEFAULT_FIELDS];
      if (st.surveys.some((x) => !x.eventId || typeof (x.questions[0] as unknown) === "string")) st.surveys = seedSurveys(st.events[0]?.id ?? "");
      if ((st.theme as string) === "system") st.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      st.meetings = st.meetings ?? [];
      st.invitations = (st.invitations ?? []).map((i) => ({ ...i, versions: i.versions ?? [], comments: i.comments ?? [], likes: i.likes ?? [], source: i.source ?? "template" }));
      st.supplierChats = st.supplierChats ?? {};
      st.seatings = (st.seatings ?? []).flatMap((x) => { // older shapes: a version holding several arrangements (layouts) or a flat list of tables
        const o = x as unknown as { layouts?: { id: string; kind: string; name: string; tables: SeatTable[]; figures: Figure[]; w: number; h: number }[]; tables?: SeatTable[] } & Seating;
        if (o.layouts) return o.layouts.map((l) => ({ id: uid(), eventId: o.eventId, arrId: l.id, arrName: l.name, kind: l.kind, name: o.name, createdAt: o.createdAt, locked: o.locked, tables: l.tables.map((tb) => ({ ...tb, rot: tb.rot ?? 0, scale: tb.scale ?? 1 })), figures: l.figures.map((f) => ({ ...f, rot: f.rot ?? 0 })), w: l.w, h: l.h, legend: structuredClone(o.legend), approvals: structuredClone(o.approvals) } as Seating));
        if (!o.arrId) return [{ ...o, arrId: uid(), arrName: "Dinner", kind: "dinner", figures: [], w: 1000, h: 640, tables: (o.tables ?? []).map((tb) => ({ ...tb, rot: tb.rot ?? 0, scale: tb.scale ?? 1 })) } as Seating];
        return [x];
      });
      st.menu = st.menu ?? []; st.menuLibrary = st.menuLibrary ?? defaultMenuLibrary(); st.services = st.services ?? defaultServices();
      st.guests = st.guests.map((x) => guestDefaults(x));
      st.folders = st.folders.map((f) => ({ ...f, createdAt: f.createdAt ?? Date.now(), modifiedAt: f.modifiedAt ?? f.createdAt ?? Date.now() }));
      st.events.forEach((e) => { // survey tab was removed; table arrangement is now a tab (hidden by default)
        e.hiddenTabs = (e.hiddenTabs ?? []).filter((k) => k !== "survey"); e.tabOrder = (e.tabOrder ?? []).filter((k) => k !== "survey");
        if (!e.tabOrder.length) e.tabOrder = ["tasks", "todos", "documents", "itinerary", "design", "invitations"];
        if (!e.tabOrder.includes("guests")) { const i = e.tabOrder.indexOf("invitations"); if (i >= 0) e.tabOrder.splice(i, 0, "guests"); else e.tabOrder.push("guests"); if (e.hiddenTabs.includes("invitations") && !e.hiddenTabs.includes("guests")) e.hiddenTabs.push("guests"); } // Guests and RSVP are separate tabs now
        if (!e.tabOrder.includes("tables")) { e.tabOrder.push("tables"); if (!e.hiddenTabs.includes("tables")) e.hiddenTabs.push("tables"); }
        if (!e.tabOrder.includes("talent")) e.tabOrder.push("talent");
        if (!e.tabOrder.includes("agreement")) e.tabOrder.push("agreement");
        if (!e.tabOrder.includes("menu")) { e.tabOrder.push("menu"); if (!e.hiddenTabs.includes("menu")) e.hiddenTabs.push("menu"); }
      });
      const oldIds: Record<string, string> = { "sofia.client": TEST_USERS.client.login, "daniel.team": TEST_USERS.collaborator.login };
      st.team.forEach((m) => { // user IDs no longer exist: the e-mail address is the login
        if (!m.username.includes("@")) m.email = oldIds[m.username] ?? (m.email.includes("@") ? m.email : m.username + "@example.com");
        m.username = m.email.toLowerCase(); m.lastName = m.lastName ?? ""; m.status = m.status ?? "accepted"; m.token = m.token ?? uid();
      });
      st.viewAs = st.team.some((m) => m.id === st.viewAs) ? st.viewAs : "";
      if (!st.threads) { const d = seed(), first = st.events[0]?.id ?? "", old = d.events[0]?.id ?? ""; st.threads = d.threads.map((x) => ({ ...x, eventId: first })); st.notifs = d.notifs.map((n) => ({ ...n, href: n.href.replace(old, first) })); st.inboxPrefs = d.inboxPrefs; } // the demo conversations point at this browser's first event
      st.tourSeen = st.tourSeen ?? []; st.cancelSurveys = st.cancelSurveys ?? []; st.supplierProfile = { ...emptyProfile(), ...(st.supplierProfile ?? {}) };
      st.designRequests = st.designRequests ?? []; st.agreements = st.agreements ?? [];
      st.team.forEach((m) => { if (!m.access.includes("agreement") && (m.kind === "client" || m.access.length >= 10)) m.access.push("agreement"); });
      if (st.loggedIn && !st.sessionId) st.loggedIn = false; // sessions from before real log-in existed
      if ((st.lang as string) === "pt") st.lang = "es"; // Portuguese was removed (Spanish and English only for now)
      st.invoices = st.invoices ?? []; st.card = st.card ?? null; st.sub = st.sub ?? newTrial(st.plan);
      if ((st.plan as string) === "free") st.plan = "planner"; if ((st.sub.plan as string) === "free") { st.sub.plan = "planner"; if (st.sub.status === "active") st.sub.status = "expired"; } // the Free plan no longer exists
      if (st.sub.status === "trialing" && st.sub.trialEndsAt < Date.now()) { // the trial ended: the card on file is charged (simulated), otherwise the account has no active plan
        if (st.card && st.sub.plan) { const p = st.sub.plan, c = st.sub.cycle, amount = PRICES[p][c]; st.sub = { ...st.sub, status: "active", startedAt: st.sub.trialEndsAt, renewsAt: st.sub.trialEndsAt + (c === "monthly" ? 30 : 365) * DAY };
          st.invoices.unshift({ id: uid(), number: `INV-${new Date().getFullYear()}-${String(st.invoices.length + 1).padStart(4, "0")}`, at: st.sub.trialEndsAt, description: `1Plan ${PLAN_NAMES[p]} · ${c}`, plan: p, cycle: c, subtotal: amount, discount: 0, total: amount, promo: "", last4: st.card.last4, billTo: st.billing.name || st.userName, address: [st.billing.address, st.billing.city, st.billing.country].filter(Boolean).join(", ") }); }
        else st.sub.status = "expired"; }
      st.eventLog = st.eventLog ?? st.events.map((e) => e.createdAt);
      st.accounts = st.accounts ?? []; st.outbox = st.outbox ?? []; st.sessionId = st.sessionId ?? "";
      testAccounts().forEach((a) => { if (!st.accounts.some((x) => x.email === a.email)) st.accounts.push(a); });
      st.team.forEach((m) => { // test collaborators: make sure they can sign in with a user ID
        const t = m.name === "Sofía" ? TEST_CLIENT : m.name === "Daniel" ? TEST_COLLAB : null;
        if (t && !m.password) Object.assign(m, { email: t.email, username: t.username, status: "accepted", password: t.password, kind: t.kind, role: t.role, access: [...t.access], scopeAll: t.scopeAll, eventIds: t.kind === "client" ? [st.events[0]?.id].filter(Boolean) : m.eventIds });
      });
      st.itineraries = st.itineraries ?? []; st.talents = st.talents ?? []; st.signoffs = st.signoffs ?? [];
      st.dots = (st.dots ?? []).flatMap((d) => (d.activities.length > 1 ? d.activities.map((a) => ({ id: uid(), eventId: d.eventId, activities: [a] })) : [d])); // one activity per dot
      st.dots.forEach((d) => d.activities.forEach((a) => { a.comments = a.comments ?? []; a.history = a.history ?? []; }));
      st.events = st.events.map((e) => ({ ...e, sections: e.sections ?? [], hiddenTabs: e.hiddenTabs ?? [], tabOrder: e.tabOrder ?? [], location: e.location ?? "", description: e.description ?? "", picture: e.picture ?? "", status: e.status ?? ("active" as const) }));
      { // palette change: old default colors of event types and task statuses become the new palette colors
        const swap = (c: string) => OLD_COLORS[(c ?? "").toUpperCase()] ?? c;
        st.eventTypes = (st.eventTypes ?? []).map((x) => ({ ...x, color: x.id === "anniversary" && (x.color ?? "").toUpperCase() === "#FF7A59" ? "#9B87F5" : x.id === "corporate" && (x.color ?? "").toUpperCase() === "#6FA8FF" ? "#B8A98A" : swap(x.color) }));
        st.events.forEach((e) => e.statuses?.forEach((s) => { s.color = swap(s.color); }));
      }
      if (!localStorage.getItem(SAMPLES_KEY)) { const sm = sampleEvents(); st.events.push(...sm.events); st.tasks.push(...sm.tasks); localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem(SAMPLES_KEY, "1"); } // saved right away, in case load() runs again before the next update // add the demo events once to data saved before they existed
      return st;
    }
  } catch {}
  try { localStorage.setItem(SAMPLES_KEY, "1"); } catch {} // fresh data already includes them
  return seed();
}
let state: State = load();
const subs = new Set<() => void>();
export function update(fn: (draft: State) => void) {
  const draft = structuredClone(state);
  fn(draft);
  state = draft;
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, upsell: null, supportOpen: false, seatEditor: false, seatDirty: false, accDraft: null, confirmOut: false })); } catch {}
  subs.forEach((s) => s());
}
/** Ends the session (owner or collaborator). */
export const logout = () => update((st) => { st.loggedIn = false; st.sessionId = ""; st.viewAs = ""; st.accountType = null; st.accDraft = null; st.confirmOut = false; });
/** Asks to sign out: a window confirms it (and lists unsaved changes). */
export const askLogout = () => update((st) => { st.confirmOut = true; });
export const resetDemo = () => { try { localStorage.removeItem(KEY); } catch {} state = seed(); subs.forEach((s) => s()); };
export const getState = () => state;
export const useStore = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
export const openUpsell = (reason: string) => update((s) => { s.upsell = reason; });

/** Adds a notification to the feed (unless the user turned that type off). */
export const notify = (st: State, type: NotifType, key: string, vars: Record<string, string | number>, href: string) => {
  if (st.inboxPrefs?.types[type] === false) return;
  st.notifs.unshift({ id: uid(), type, key, vars, at: Date.now(), read: false, href });
};
/** Unread conversations (messages) and unread notifications. */
export const unreadCounts = (s: State) => ({
  msgs: (s.threads ?? []).filter((t) => !t.archived && !t.muted && t.msgs.some((m) => m.from === "them" && !m.read)).length,
  notifs: (s.notifs ?? []).filter((n) => !n.read).length,
});

/* usage helpers */
/** Events created in the last 30 days. Archived, cancelled and deleted events still count, so deleting never frees a slot. */
export const eventsLast30 = (s: State) => (s.eventLog ?? []).filter((at) => Date.now() - at < 30 * DAY).length;
/** True while the account has a trial or a paid subscription. */
export const hasAccess = (s: State) => s.sub.status === "active" || s.sub.status === "trialing";
/** Events the account can still create in this period (0 without an active subscription). */
export const eventLimit = (s: State) => (hasAccess(s) ? PLANS[s.plan].events : 0);
export const invitesCount = (s: State, eventId: string) => s.guests.filter((g) => g.eventId === eventId && g.status !== "draft").length;

/* tiny hash router */
export const go = (path: string) => { location.hash = "#" + path; };
export function useRoute() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => location.hash.replace(/^#/, "") || "/",
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ───── Cloud accounts (Supabase) ───── */
/** True on a developer machine: the built-in test accounts and the local-only mode are available there, never on the public site. */
export const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || location.hostname.endsWith(".localhost");
export const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
/** Fields NOT saved to the cloud workspace: sign-in state, per-device settings and transient UI flags. */
export const CLOUD_SKIP = new Set(["accounts", "outbox", "loggedIn", "sessionId", "viewAs", "upsell", "supportOpen", "seatEditor", "seatDirty", "accDraft", "confirmOut", "lang", "theme", "sidebarCollapsed", "userEmail"]);
/** A brand-new real account starts with an empty workspace (no demo events, guests or tasks). */
export const blankWorkspace = (): Partial<State> => {
  const w: Partial<State> = {
    ...seed(), events: [], tasks: [], todos: [], guests: [], invitations: [], seatings: [], menu: [], team: [], tags: [], dots: [], meetings: [], itineraries: [], talents: [],
    signoffs: [], agreements: [], designRequests: [], documents: [], folders: [], threads: [], notifs: [], support: [], supplierChats: {}, surveys: [], feedback: [],
    cancelSurveys: [], tourSeen: [], eventLog: [], invoices: [], card: null, defaultSurvey: null, userName: "", userPhone: "", avatar: "", businessLogo: "",
    billing: { name: "", taxId: "", address: "", city: "", country: "" }, supplierProfile: emptyProfile(), plan: "planner", sub: { ...newTrial("planner"), status: "none" }, accountType: null,
  };
  for (const k of CLOUD_SKIP) delete (w as Record<string, unknown>)[k];
  return w;
};
