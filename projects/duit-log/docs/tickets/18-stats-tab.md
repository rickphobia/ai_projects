# 18: Stats tab

**What to build:** A Stats tab with a donut chart of the Month's Expenses (or Income, by a toggle) per Category, and a list of each Category's amount and percentage. Tapping a Category lists its Transactions.

**Blocked by:** 17 (Monthly tab)

**Status:** ready

**Touches:** core/summary, app/screens

**Effort:** low

- [ ] Per-Category totals and percentages in the Month summary, after Paybacks and Refunds, without Excluded; tests cover rounding so percentages add up to 100
- [ ] Donut drawn in Compose without a chart library unless one saves real work (record why if one is added)
- [ ] Expenses / Income toggle and Month switching
- [ ] On-phone check: the donut and list match the Daily tab's totals
