# 30: Keeping back and hidden savings

**What to build:** At the Hand-in the slider now lets the Worker keep some cotton back. Kept cotton is sold on the side and becomes hidden savings, at a better rate than Labour Points, shown only in a hand-drawn tin under his mattress, never in The App. He can pay for anything in the store with them instead of Labour Points, and they pay a Bill his Labour Points can't cover before it becomes Debt (land and hazards spec: stories 21, 33–35, 38, 40–41; "Implementation Decisions": Hidden savings, Adapters: Hidden savings tin).

**Blocked by:** 29 (Crop counter and wages at the Hand-in)

**Status:** done

**Touches:** rules, config/tuning, content/app-text, adapters/app-overlay, adapters/save

**Effort:** medium

- [x] The slider starts at everything; what is kept back neither counts towards the Quota nor earns Labour Points
- [x] Kept cotton adds hidden savings per pick (tuning), validated to be more than Labour Points per pick
- [x] Hidden savings are a second balance in the Ledger, never below zero, shown only in the hand-drawn tin
- [x] Store items offer "pay with" Labour Points or hidden savings when he has any, with "not enough hidden savings" as a refusal
- [x] Bills draw on Labour Points, then hidden savings, and only the rest becomes Debt; savings never pay existing Debt
- [x] Debt blocks every store purchase, whatever pays; Negligence never touches hidden savings
- [x] The App never mentions hidden savings
- [x] Hidden savings are saved
- [x] Each Hand-in logs handed in and kept; hidden savings spent are logged (item, amount)
- [x] GUT tests through Farm cover keeping back, savings, paying with them, Bills and Debt
