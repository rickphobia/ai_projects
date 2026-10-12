# 21: Alert rules

**What to build:** After each tick scores new Items, the owner gets an Alert for an Item that mentions a Watchlist stock, or has Importance 5. There is at most one Alert per Item, none in quiet hours, and no more than the daily cap. Spec user stories 65–68, 70.

**Blocked by:** 18 (Remove Holdings), 20 (Push set-up and test Alert)

**Status:** done

**Touches:** alerts, tick, pwa/settings

**Effort:** medium

- [x] The tick sends Alerts after scoring, for Items that mention a Watchlist stock or have Importance 5
- [x] At most one Alert per Item, even if it matches several rules
- [x] Quiet hours (23:00 to 07:00 by default) and the daily cap (10 by default) come from config, in the owner's time zone
- [x] Alerts blocked by quiet hours or the cap are dropped, not sent later; the Item still shows in the Inbox
- [x] Alerts keep working when the spending limit is reached
- [x] Settings screen shows the quiet hours and the cap
- [x] API tests with the fake Clock and PushSender cover each rule, one Alert per Item, quiet hours, the cap and the day boundary
- [x] README and `.env.example` updated
