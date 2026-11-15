# A plan — prototype (formerly "Event Planner")

Clickable front-end prototype (Vite + React + TypeScript). Scope: **public landing page + Client (event planner) account**.
Data is seeded and saved in the browser (localStorage); there is no backend yet. The first version (Next.js + database) is archived in `old-version/`.

```bash
npm install
npm run dev     # http://localhost:5173
```
Login: Google, Apple (simulated), email/password, or "Create account". New accounts choose **Planner** or **Supplier** first; the Supplier area is a "coming soon" page. "Enter the demo" opens the seeded planner. Font: Roboto everywhere (invitation templates keep their own selectable fonts).

## What's in it
- **Landing**: services, features, task tracker, custom invitations + AI, a section per event type, plans/prices, ES / EN / PT, light/dark/auto.
- **Client sidebar**: create event, my events, my tasks, customer support (requests + chat), platform feedback, user feedback (surveys for end users), account (photo, password reset, logout, plan switcher).
- **Per event tabs**: Tasks · To-dos · User admin (sub users) · Invitations (incl. table arrangement) · Invitation design.
- **Task tracker**: Columns (drag & drop), Calendar, Gantt; per-event choice of fields (start, due, tag, responsible, priority, sub tasks, linked tasks, rich notes); rename/add/remove statuses; CSV export.
- **Plan rules** (switch plans in Account to try them): Free = 1 event/30 days, 20 invitations, no tables, default templates, 3 design updates, no contact edits, no assigning/to-dos/sub users. Event planner = 4 events, 200 invitations, tables, all templates, contact edits, assign, sub users. Pro = unlimited + AI design. Locked actions open an upgrade prompt. Sent invitations are locked.

## Assumptions
- Colors: teal primary; gold/blue/rose for statuses, priorities and event types (rose = weddings, gold = birthdays).
- "Up to 3 updates on one invitation" = 3 saves of the invitation design; planner plan assumed 10, sub users 10 per event.
- Free plan cannot assign tasks, use to-dos or create sub users (spec lists them under paid plans).
- Sending invitations, AI design, chat replies and RSVP responses are simulated.
- Not built yet: end-user, supplier, customer-support and superadmin roles, real login, payments, email/SMS.

## v2 changes (planner account)
- Name "Event Planner"; collapsible icon sidebar (Lucide icons, no emojis); light/dark icon toggle; account (name + plan) bottom-left; floating customer-support button bottom-right; single "Help" section (support, platform feedback, user feedback).
- "Create new event" form with picture (defaults to the business logo set in Account), custom event types (only visible to you), event date, location, venue.
- "My events": not listed in the sidebar; search by keyword/type/venue/description, date range (event or creation date), sort by timeline or creation date, status filter (active/archived/cancelled).
- Event header with edit (pencil) window: edit info, archive, cancel, delete (requires typing the exact event name).
- Tasks: board / Gantt / calendar / list views (board is always the default), floating "+" and "Add task" in every section, drag & drop for tasks and sections (calendar drag changes dates), gear window with left/right field lists, status renaming and "use as default".
- Landing page still uses the previous layout (icons updated, emojis removed).

## v5 changes
- Customer support only from Help (no floating button); search shows "Advanced search" only while the bar is empty.
- Event tabs: Tasks · Checklist · Documents · Invitation Studio · Guests & RSVP, plus a placeholder "+" (does nothing yet). New Documents tab (upload/download/delete, CSV list; files kept in the browser, 1.5 MB max). The old "User admin" tab is no longer shown.
- Tasks: statuses removed from Customize; "+" at the far right of the board (and at the bottom of the list view) adds a column after asking for its name; double-click a column name to rename it.
- New events start with Name, Responsible and Notes; new tasks are assigned to the current user, shown as @name. A saved "use as default" template overrides this.

## v6 changes
- Board/list columns have a trash icon: empty columns ask for confirmation; columns with tasks require typing DELETE (tasks are deleted with the column).
- Documents: folders (default set + "New folder"); documents can only be added by dragging files onto a folder; double-click opens a folder (miniature view) and a document (preview; real preview for PDF, file card for Word/PowerPoint). Accepted: PDF, DOC/DOCX, PPT/PPTX.
- Account tabs: Basic info (click the picture to change it, hover shows a pencil), Identity & password, Billing information, My subscription. Language and theme removed from Account (they stay in the top bar).
- "User feedback" moved into each event as the "Feedback Surveys" tab; question types: single choice, multiple choice, open text, Likert scale, yes/no; "save as default survey".

## v7 changes
- Tasks open in a side panel on the right (over the page, no overlay window) in event Tasks and in My tasks. Layout: status pill on top, task name with a hover pencil (Rename / Delete), then one column: start date, due date, tag, responsible, priority, linked tasks (if enabled), notes ("Add note" button). Delete and Done buttons removed; close with X or Esc. Deleting asks for confirmation.
- Notes toolbar: tooltips on every control; "A" shows/changes the text colour, "F" shows/changes the highlight colour.
- Sub tasks were removed everywhere (including Customize).

## v8 changes
- Task panel: creation date/time (local) under the name, an always-open Description box, mandatory Responsible (always shown as @name), tag picker (newest tags first, tag icon), notes always visible with an "Add" button (saved notes are listed with timestamps), and a History log (created, renamed, status moved, dates, tag, responsible, priority, description, notes).
- Notes toolbar: text colour (A) and highlight (F) now open swatch palettes and apply to the selected text.
- My tasks: switch between "My events tasks" and "Personal tasks"; "+" / "Add task" asks whether the task is personal or related to an event.
- Name, Description, Responsible and Notes are always on; Customize now lists Start date, Due date, Tag, Priority and Linked tasks (none on by default).

## v9 changes
- One task panel for creating and editing (right side, over the page). Every "Add task" entry point (floating +, column/section buttons, Gantt, calendar) opens it in create mode, with a "Create task" button; editing saves automatically. Status and close button stay fixed at the top while the rest scrolls.
- Tags are multi-select: only selected tags are shown; typing finds existing tags or creates a new one (added to the library).
- Responsible is chosen from a list (the account owner plus users created by the owner); no free typing. Other users are locked on the Free plan. There is no screen yet to create these users (two demo users are seeded).
- "My tasks" is intentionally empty for now.

## v10 changes
- Creating a task opens a floating window (name, description, dates, tags, responsible, priority); no creation date, status selector or notes until the task exists. Start date, due date and priority start empty. Once created, the task opens in the right-side panel with status, creation date, notes and history.
- Base font reduced from 15 px to 14 px and headings scaled down across the platform.

## v11 changes
- The "+" after the event tabs now opens an "Add section" menu. First option: **Meetings**, which adds a Meetings tab to that event.
- Meetings: schedule a video meeting with **Google Meet** or **Zoom** (title, date, time, duration, attendees from team and guests, agenda). The link is simulated in the prototype; each meeting can copy its link, download an .ics calendar file, or be deleted. Real Google/Zoom creation needs account connections and a backend.

## v12 changes
- Task customization (gear icon / Customize window / default templates) is paused. Every task option (description, start date, due date, tag, responsible, priority, linked tasks, notes) is always available when creating and editing a task.

## v13 changes
- New event tab **Itinerary** (after Documents): a vertical line with 11 px dots. "Add dot" appends a dot; hovering a dot (or its row) shows "Add activity" and "Remove dot". Each activity has name, date, time, duration and location, and can be edited or deleted. Demo data ("Reset demo data") includes a sample itinerary for the wedding.

## v14 changes
- Itinerary: one activity per dot, shown in chronological order. The bottom button is "Add activity"; hovering an existing dot shows "Edit activity" (with a pencil). A new activity's date/time defaults to when the latest activity ends. Each activity has a Comments section.
- Layout moved up: less space above the page content and in the landing hero.

## v15 changes
- Event header and tabs stay fixed while scrolling (the header shrinks once you scroll). On Tasks the view selector and on Guests & RSVP the summary numbers stick right under it.
- (Reverted) The hide/unhide eye icons were removed. New events still start with Tasks, Itinerary and Invitation Studio on the bar; the other sections are added from the "+" menu.
- Tabs can be reordered by dragging; hidden/order choices are saved per event.
- Itinerary comments can be deleted.

## v16
- Every event tab has a small down-arrow menu: Hide (sends the tab to "+"), Move to left, Move to right.
- Itinerary: cards show only name, date and time; hovering opens a cloud with edit, delete, details and comments.
- Tasks: column delete icon appears only when hovering the top-right corner; the task side panel closes on X or an outside click; "Linked to other tasks" removed from the UI.

## v17
- Open task panel is 440 px wide, on the right.
- New "Team management" module below My tasks: create members (user name, temporary password, role, responsibilities, feature access, event scope), edit, reset password, delete. Passwords are stored in plain text in localStorage (prototype only); access settings are saved but not enforced until team sign-in exists.
- Account button (bottom-left) opens a speech bubble: My account, language, dark/light mode. Language and theme removed from the top-right; the page now starts higher.

## v18
- Guests & RSVP: add guests with number of invitees, message, preferred channel (WhatsApp/Email), country with flag + area code, and preferred language; edit with the pencil. New "Sent invitations" table: resend via WhatsApp/Email (simulated) or copy the unique link.
- Table arrangement is now its own tab (hidden by default, add it from "+"). The Feedback Surveys tab was removed from every plan.
- Meetings: calendar (default), list and Gantt views; double-click a date or "+ Schedule meeting" to schedule; double-click a meeting or use the pencil (before the trash can) to edit.
- Documents: folders show their name inside the folder; grid or list view (list shows creation and last-modified dates); no "double-click" hints.
- Invitation Studio: "+ Create invitation" (top right) offers "Create new invitation" (GrapesJS visual HTML editor, free and open source) and "Create from template" (template picker window). Created invitations appear under "My invitations".

## v19
- Tasks: checkbox left of the name (greys the whole task, also in the open panel next to status); "Responsible" is now "Assignee" with several people picked like tags; like button (thumb + count) bottom-right of each card and next to the X in the open panel; board columns are 440 px wide.
- New "Suppliers" module (below Team management, Pro plan only): filter by type of service, events they support, price tier and location; contact by chat (simulated replies) or contact card.
- Documents: any file type accepted, no format hint, big "+ New" button bottom-right (uploads inside a folder, creates a folder at the top level).
- Guests & RSVP: CSV download removed; flag/area-code chip removed from the number field; sent-invitation actions are icon buttons with tooltips.
- Itinerary: icon left of each activity name (defaults to the event type icon; click it to pick another).
- Frameless pencil by the event name and frameless tab controls.

## v20
- Task board: columns are back to the normal width (the 440 px width is only the open-task panel). Column header has no drag dots; a vertical 3-dot menu offers Add task, Copy list, Archive list and Delete list (dragging the header still reorders lists). Archived lists are restored from the gear icon at the right of the view options.
- Task window: "+" buttons next to Assignee and Tag open a dropdown to pick (tags can also be searched or created); the "+" stays to the right of the chosen items.
- Guest list: send and simulate-response actions are icon buttons with tooltips (no dropdown lists).
- Table arrangement (Pro): table designs (round, square, rectangular, oval, serpent), seats per table, drag tables, drag guests onto tables/seats, table and seat names and colours, colour legend, saved/lockable versions with navigation, approvals from team and clients (simulated responses) and print.
- New "Menu" tab (hidden by default): dishes and drinks by type with price per person, picture, selection, and totals for the guests.

## v21
- No icon in the platform has a framed/coloured outline any more (3-dot menus, "+ Add task", checklist X, delete icons...): only a soft highlight on hover.
- "Guests & RSVP" split in two tabs: **Guests** (add/edit guests; numbers: guests, total people, not invited yet, missing contact) and **RSVP** (numbers: sent, confirmed, declined, quota; ready to send, sent invitations with responses, resend and links). Existing events get both tabs.
- Table arrangement: several arrangements per version (ceremony, dinner, cocktail, panel, conference, classroom, other; the ones suggested for the event type come first) with vertical tabs when there is more than one; tables resize (corner handles or slider) and rotate (handle, slider, ±15° buttons); new shapes (head/panel table, rows of chairs); smaller serpent table; basic figures (square, circle, triangle) renamed and resized by dragging any side; the panel grows with its content and by dragging its corner; zoom in/out and a default "fit" view.
- Menu: the planner keeps a library of default options (add several to an event at once, create new defaults, or tick "also save as default" when creating an item; a bookmark icon saves an existing item).

## v22
- RSVP: "Send all pending (n)" sits at the top of the ready-to-send list; each guest can still be sent manually with the send icon.
- Table arrangement works like a diagram editor: it opens read-only (current arrangement + a list of arrangement types to add: ceremony, dinner, cocktail, bar, panel...); double-click the arrangement (or press Edit) to enter edit mode, where the add table/figure tools, guest panel (now with quick "add guest"), inspector and legend editing appear; Done/Esc leaves edit mode. Figures rotate (handle, slider, ±15°) and resize along their own axes.
- "Team management" is now **Collaborators**: accesses for team members, employees, suppliers/vendors and clients (relationship such as bride, groom, birthday person), each kind with a sensible starting role, access and scope; filter by kind.
- New **Service Catalog** module: the planner defines the services offered (category, description, pricing model, time commitment, what is included, event types, image), toggles them active/hidden, features and duplicates them.
- **My tasks** now lists every task from all events: list / board / calendar views, group by event date, event, priority, due date, status or assignee; filter by assignee (me, everyone, specific people, or whole groups by kind and role), by event, search and show/hide completed; opens the task panel.

## v23
- My tasks: "+ Add task" with an event selector (or no event); a task linked to an event also appears in that event's Tasks tab.
- Table arrangement: left panel of arrangement tabs with "Create new seating arrangement"; the selected arrangement shows a preview (with its versions) and a pencil that opens a full-page editor (everything except the app sidebar): back arrow, rename, undo/redo (Ctrl+Z / Ctrl+Shift+Z), save/navigate versions, lock, approvals, print, tables, figures, guests, legend. Versions now belong to each arrangement (older data was migrated).
- Invitation Studio: the old "Customize invitation" section is gone. Only "+ Create invitation" (new, from template, Design with AI [Pro]) and the default invitations in miniature (double-click to customize) show until invitations exist. Invitations are named with their creation date and time and can save/restore versions. The HTML editor now includes forms, navbar, countdown, tabs, typing effect, tooltips, custom code, gradients/backgrounds, filters, touch support, Google Fonts, local image upload, import/export and invitation-specific blocks (script title, date & place, itinerary, RSVP button, photo frame...).
- Documents: read-only viewer on the page for PDF, images, text, XML, JSON, CSV, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx).
- Guests: the chosen preferred contact channel is clearly highlighted. RSVP: the unique link can be customized per guest (checked for duplicates).
- Menu: bigger "Add dish or drink" button first; selecting a picture (or clicking a picture) opens it in a floating window.

## v24
- Fixed a style bug from v21 that made buttons with an icon and text lose their fill (this is why "Add task", "Add collaborator" and "New service" looked different). Only real icon-only buttons are frameless now; all page-level add buttons share the same size and style.
- Table arrangement: Ctrl/Cmd+C and Ctrl/Cmd+V (and Copy/Paste buttons) for tables and figures, pasted as "Copy <name>" (works between arrangements). Approvals removed from the UI for now. The "+ Arrangement" button uses the standard size. The selected tab has a chevron menu (move up/down, print, copy, archive, delete), archived arrangements can be restored, double-clicking a tab opens the editor, and Edit/Print are visible text buttons.
- Documents: confirmation before deleting a file; PDFs of any size are accepted (big ones live in IndexedDB; other formats stay limited to 1.5 MB).
- Itinerary: dates show the weekday in three letters in the active language; many more icons (celebration, food and drinks, office and logistics); a "+" between activities appears on hover; activities can move up or down with a confirmation of the new times.
- Menu: the add buttons are on the left; each category starts with a "+" tile.
- Collaborators: one table per kind of access with name, email, role, access, creation date and last login.

## v25
- Table arrangement: the tab's chevron menu now opens above the canvas (and has Edit too); the editor toolbar is a single row (Back, name, versions, undo/redo) with three dropdown menus on click: Add (tables and figures), Edition (copy/paste) and Version (save, lock, print, delete); the "+ Arrangement" button uses the standard button style; Edit and Print were removed from the top right of the arrangement view.
- Collaborators: the email column/field is replaced by a custom User ID. "Reset password" asks you to type RESET, allows 3 resets per 24 hours (shows the chances left and when the next one is available), and the temporary password expires after 24 hours (shown in the list; expired ones are flagged). Clients can only be given specific events (no "all events").

## v26
- Platform renamed to **A plan** (logo, browser title, calendar exports, footer text). The landing page is otherwise untouched and stays frozen until you say so.
- Collaborators: a copy icon next to every generated password (new collaborator form and reset result).
- Event header: "[ -129 Days ]" after the event date; inside the last 7 days it turns into a live countdown "[ -3 days 22:11 ]" (event date counted from 00:00).
- Seating editor: the app sidebar folds away while editing (reopen it with the arrow; the "A" logo mark stays at the top left); leaving with unsaved changes (Back, Esc or any sidebar link) asks to Save, Cancel the changes or Keep editing.
- RSVP: "Preview invitation" (and an eye icon on every guest row) opens a read-only preview of the invitation; with several invitations you can pick which one.

## v27
- Seating editor re-laid out like a diagram tool (draw.io): title + menu bar (File, Edit, View, Arrange, Extras, Help — options open on click, and hovering switches between menus), an icon toolbar (panel toggle, zoom, undo/redo, delete/copy/paste, colour, rotate, lock, print), a left panel with search, Guests and a shapes palette (click or drag a table/figure onto the canvas), a right panel with "Arrangement" and "Style" tabs (grid, panel size, colour legend / selected item properties), a grid canvas and page-style tabs at the bottom for the versions (+ saves a new one, double-click renames, chevron for lock/delete).

## v28
- Table arrangement: seat tooltip with the guest name (only when a name is assigned); editor toolbar shows number of tables and seats.
- Event header: days-to-event is now a framed box in the upper-right corner.
- Documents: miniatures show a real first-page preview (images, PDF, Word, Excel/CSV, PowerPoint, text).
- New **Talent** tab (host, MC, DJ, musicians, band…).
- Itinerary: several named itineraries per event (Before, During, After…), switched with tabs.
- **Start approval** on itinerary, table arrangement, invitations, talent and menu: floating window, planner + client approvers, append-only record (who, when, frozen summary); approvals cannot be undone.

## v29
- HTML editor: compact top bar, blocks/style/layers panel on the left (like the seating editor), Ctrl/Cmd+S save, Ctrl/Cmd+Shift+S save version.
- Seating editor: no approval button; File → Save (Ctrl+S) keeps edits, Save as new version (Ctrl+Shift+S); toolbar save icon.
- Seating view: tables/seats counter left of the approval button.
- My events: days-to box on cards, "Days to" column in the list views (shared `Countdown.tsx`).
- Documents: small "Drag and drop" zone at the bottom once a folder has documents.
- Itinerary tabs: chevron menu (rename, move left/right, copy, delete).
- Approvals: horizontal timeline with speech bubbles; only the indicated user can approve, from their own profile (demo switcher "View as" in the account bubble).

## v30
- Tab "Invitation Studio" is now **Invitation**. "+ New invitation": Request design (colors, tone, vibe, links, images → A plan design team), Create from template (basic info only), Design with AI (prompt → same basic-info form). Nobody on the client side edits HTML.
- A plan designs (up to 3) show on the tab with preview, likes, comments and Start approval; only one invitation can be in approval/approved. "Demo: deliver designs" simulates the designer.
- Default templates only appear inside "Create from template".
- Approval window shows a miniature (itinerary, invitation, table arrangement, menu); click opens the full frozen view.

## v31
- Invitations: planner/client can only like and comment (no delete). Design request accepts up to 10 images.
- Seating editor: deleting a version returns to the arrangement tab; hiding the left/right panel now expands the canvas; version chevron menu no longer clipped; colour picker has "More colors…" and recent colours per event; 9 new figures (diamond, hexagon, pentagon, star, cross, arrows, chevron, line); loose seat (drop on a table or pick "Add this seat to a table"), "Add seat" button, rows × columns for chair rows; legend wording ("Color legend" / "Add legend entry").

## v32
- Responsive: tablet (≤1024px) uses the slim icon sidebar; phone (≤700px) uses a top bar + slide-out drawer, small event header, scrolling tabs (menus as bottom sheets), full-width itinerary cards, stacked arrangement tabs, bottom-aligned modals. Seating editor starts with side panels closed on tablet/phone (panels overlay on phone) and has touch-friendly dragging.

## v33
- New **Agreement** tab (Event Agreement): one editable document built from the event (parties, event details, itinerary, menu and drinks, talent, seating, invitation, fees, payment schedule, terms). Refresh sections from the event, add/reorder/include sections, per-section comments, saved versions, send to client (simulated), print/PDF/download, and signing through the approval flow (locks when approved; later changes via amendment). Clients get access to it by default.

## v34–v36 notes
- **Plans:** Basic / Event planner / Pro Event Planner, all features in every plan; they differ by events per 30 days (archived, cancelled and deleted count) and invitations per event. 7-day trial, card required. Prices in USD only.
- **Collaborators:** name, last name, email (no more user IDs), role (team member, supplier/vendor, client), access, scope. Team/supplier get an invitation link (`#/invite/<token>`) to create their password; clients get an access link (`#/access/<token>`) with a temporary password and choose a new one. Status accepted/pending in the list. Emails are simulated ("Sent invitations (demo)").
- **Guests:** "+ Add guest" window with Cancel / Save / Save and create another.
- **Agreement:** paper colour and texture (preset or uploaded), company logo, pictures per section (dish photos, seating plan, invitation), side comment bubbles with delete and task creation.
- **Inbox:** supplier conversations (quotes, attachments, pin/mute/archive, link to event, create task) and a notifications feed with preferences.
- **How-to video:** shown once per user on first access; set `HOWTO_VIDEO_URL` in `store.ts` when the video exists.
- **Logo:** not applied yet, the image did not arrive with the message.

## v37 notes
- **Responsive:** the public pages (log in, sign up, invitation/access links, trial) no longer overflow on phones; stat cards sit 2 per row; wide children cannot push the page sideways.
- **Guests:** "CSV template" and "Import CSV" next to "+ Add guest" (preview, skipped rows with reasons, then import).
- **Agreement:** upload controls look like buttons; logo placement top/bottom and left/center/right.
- **Account:** single-column basic info, pencil on photo and logo, email/phone edited with their own window and notified (email / WhatsApp, simulated), unsaved changes listed when signing out, new "Supplier profile" tab with market preview.
- **Links:** RSVP links are `#/rsvp/<event name>/<guest code>` (event name editable in Invitations, guest code editable per guest) and open a real RSVP page. The service catalog can be shared as an open view-only link `#/<business-name>` (works in this browser only, since data is local).

## v38 notes
- **Full-width layout:** the app content no longer stops at 1280px; the task board columns stretch with the screen.
- **Password reset:** only on request, through a one-hour, single-use link sent to the account email (`#/forgot`, `#/reset/<token>`; Login, Account > Access and security, and the planner's reset button for collaborators all send that email). If the old email is no longer reachable, the screen points to customer service.
- **Client access:** a client (collaborator signed in with their own access) sees only My events, their assigned tabs, My tasks and Help. Account has only Basic info (name, last name, password reset) and My subscription (invitation notice with "Create my own account").
