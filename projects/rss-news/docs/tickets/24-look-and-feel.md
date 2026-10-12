# 24: Look and feel

**What to build:** The app gets a real design, modelled on oksskolten's: a light grey Folder sidebar (a drawer on the phone), an Inbox of tidy rows (title, one-line summary, Source, time, Importance) split by thin lines, and a centred reading column for Briefings, Items and Reader view. Light and dark themes follow the device setting. Every existing screen is restyled. Spec user stories 87–90.

**Blocked by:** 12 (Spending limit and page)

**Status:** done

**Touches:** pwa/styles, pwa/shell, pwa/inbox, pwa/item, pwa/briefings, pwa/sources, pwa/settings, pwa/login

**Effort:** medium

- [x] One shared stylesheet with colour, spacing and type tokens, and a light and a dark set chosen by the device setting; no UI framework added
- [x] Shell: Folder sidebar on wide screens, a drawer opened from a header button on the phone, with the current screen highlighted
- [x] Inbox rows show title, one-line summary (two lines at most), Source, relative time and an Importance marker, with unread rows marked
- [x] Item view, Reader view and Briefings read in a centred column of comfortable width with good line height, headings, links, quotes, code and images styled
- [x] Login, Sources and Folders, Briefings list and Settings use the same buttons, inputs and spacing
- [x] Works at phone width (no sideways scrolling at 360px) and on a desktop browser; `theme-color` matches the theme
- [x] Existing Vitest tests still pass; a test covers opening and closing the drawer
- [x] README screenshot or short description of the look updated

**Owner steps:** look it over on your phone after the deploy; say what to change in a follow-up ticket.
