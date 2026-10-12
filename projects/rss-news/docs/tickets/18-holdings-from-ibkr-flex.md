# 18: Holdings from IBKR Flex

**What to build:** The owner's Holdings are read once a day from an IBKR Flex Query, so they never type them in. Spec user story 18.

**Blocked by:** 17 (Watchlist, ticker Sources and stock mentions)

**Status:** ready

**Touches:** stocks, adapters/holdings_report, tick

**Effort:** medium

- [ ] Before building, confirm from IBKR's documentation that the Flex Web Service returns positions with only a token and query ID; if it doesn't, stop and bring the alternative to the owner
- [ ] HoldingsReport port with a Flex adapter (request, then poll for the report, with timeouts and retries) and a fake
- [ ] The tick syncs Holdings once a day; ticker Sources follow the change
- [ ] A failed sync keeps the previous Holdings and is logged without the token
- [ ] Adapter test against a saved Flex report; API tests cover the daily sync and a failure
- [ ] README explains how to create the Flex Query and token; `.env.example` updated

**Owner steps:** create the Flex Query and token in IBKR Client Portal and put them in the Beelink secrets file.
