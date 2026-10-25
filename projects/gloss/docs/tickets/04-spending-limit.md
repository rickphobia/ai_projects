# 04: Spending limit

**What to build:** Gloss counts what each Lookup costs and keeps a monthly Spending limit ($10 to start): Settings shows this month's spend, the card warns past 80%, and at the limit Gloss stops calling the AI until next month. Milestone 1 is complete.

**Blocked by:** 03 Book context from Legado

**Status:** done

**Touches:** core-spending, core-gloss, app-settings, app-card

**Effort:** low

- [x] Cost from token usage and per-model prices in the settings module; monthly spend stored, summed per calendar month in the phone's time zone
- [x] Limit checked before every call; at or over it no call is made and the card says the limit is reached and the date it resets
- [x] A failed call that still cost money counts toward the limit
- [x] A warning line in the card once this month's spend passes 80%
- [x] Settings shows "$X of $Y this month", lets the owner change the limit, and has Change key
- [x] Core tests: under, past 80%, at the limit, a failed call with cost, month rollover in the time zone
