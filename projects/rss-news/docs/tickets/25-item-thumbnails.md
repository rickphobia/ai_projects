# 25: Item thumbnails

**What to build:** Inbox rows show a small thumbnail on the right when the feed gives an image for the Item (Reddit and most news feeds do), like oksskolten's list. Rows without one keep the plain layout. Spec user story 91.

**Blocked by:** 24 (Look and feel)

**Status:** done

**Touches:** sources/feed_parsing, adapters/sqlite/items, items, web/inbox, pwa/inbox

**Effort:** low

- [x] Feed parsing keeps one image link per Item from the feed itself (media thumbnail, media content or an image enclosure), and only `http(s)` links
- [x] The link is saved with the Item (a database migration adds it) and returned by the Inbox API; nothing else is downloaded or stored
- [x] The Inbox row shows the thumbnail at a fixed size, lazy-loaded, and hides it if the image fails to load
- [x] Tests cover parsing each image form, an Item with no image, and the row with and without a thumbnail
