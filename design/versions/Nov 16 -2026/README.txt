Nov 16 -2026: snapshot of the real app (src/) after every color was brought inside the approved palette.

What changed since "nov 16 landing + app"
- Old rose (#C7465C) removed: new --danger token (coral-ink #C2461F light, #FF9C7F dark) used for errors, delete items, like button, notification dot
- ~50 stray hex/rgb colors in CSS, pickers, documents, invitation templates, supplier avatars mapped to palette colors
- Account profile picture is coral with a white initial, like the sidebar avatar
- scripts/check-palette.mjs flags hex, rgb/rgba, hsl and var(--rose); currently reports 0

Notes
- Some files also contain edits made by other chats. Nothing here is committed to git.

Updates after first save
- Sent invitations and Guests tables: action cell no longer breaks the row's bottom line
- Event cards: event type label takes the type's color
- Task priorities: Urgent (deep coral) and High (coral) now distinct
