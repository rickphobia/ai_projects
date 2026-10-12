# 22: Call home

**What to build:** A short call home joins the rest hour as a Privilege in the store. During the call the Worker is off the Generator, so the crops halt. The call is a card of a few lines from the Children that follow how they sound in their latest letter, and The App reminds him that calls support "family harmony". A missed Quota or Debt blocks it like every Privilege (economy spec: stories 22, 25–26, 51; "Implementation Decisions": Call home).

**Blocked by:** 21 (Letters from the Children)

**Status:** done

**Touches:** rules, config/tuning, content/family-text, content/app-text, adapters/app-overlay, adapters/letters

**Effort:** low

- [x] Buying a call home costs Labour Points (tuning price), takes the Worker off the Generator for the call's length (tuning), and growth halts during it
- [x] The rules emit a "call home" Family event whose call id follows the latest letter received
- [x] The call shows as a card of the Children's lines, not in The App's style
- [x] The App's monitoring line cites a source only if one supports it; otherwise it is reworded so it makes no claim
- [x] Refused with the reason after a missed Quota, in Debt, in a Study Session, or when unaffordable
- [x] The content test covers call scripts the same way as letters
- [x] GUT tests through Farm and tuning validation tests
