# 12: Spending limit and page

**What to build:** A Settings screen shows this month's AI cost by feature. The app warns at 80% of the monthly limit, and at 100% Briefings stop with a clear message while scoring keeps running. Spec user stories 76–78.

**Blocked by:** 11 (Briefing scopes and history)

**Status:** done

**Touches:** spending, briefings, web/spending, pwa/settings, pwa/shell

**Effort:** low

- [x] Spending summary API: month-to-date total, total per feature, and the limit status (ok, warning, stopped) in the owner's time zone
- [x] Monthly limit comes from config (100 USD by default)
- [x] Briefings check the status first and refuse with a clear error when stopped; scoring never stops
- [x] PWA Settings screen with the spending summary, and a warning banner at 80%
- [x] API tests cover the month boundary, the warning, and the refusal; a Vitest test covers the banner
- [x] README and `.env.example` updated
