# 22: Newsletters

**What to build:** Newsletters sent to a dedicated Gmail address arrive as Items. Each sender becomes its own Source in a "Newsletters" Folder until the owner moves it. Spec user stories 15–17.

**Blocked by:** 21 (Alert rules)

**Status:** done

**Touches:** newsletters, adapters/mailbox, sources/catalog, tick

**Effort:** low

- [x] Mailbox port with an IMAP adapter and a fake; the Gmail address and app password come from config
- [x] The tick reads new messages and marks them handled, so each newsletter issue becomes one Item
- [x] A new sender gets a Source in the "Newsletters" Folder, created if missing
- [x] Email bodies are never logged
- [x] Adapter test against a saved newsletter email; API tests cover new and known senders
- [x] README explains setting up the Gmail app password; `.env.example` updated

**Owner steps:** create the Gmail address and app password, put them in the Beelink secrets file, and subscribe the address to newsletters.
