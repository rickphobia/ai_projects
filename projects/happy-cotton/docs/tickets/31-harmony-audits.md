# 31: Harmony Audits

**What to build:** Now and then The App announces a Harmony Audit at the Hand-in. It is likelier the more the Worker kept back over the last few Shifts, compared with what his Plots should yield, and spending hidden savings in the state's store raises the chance a little. Before an audit the Overseer watches the scale. A cut above the tolerance catches him: his hidden savings are taken, he serves the longest Study Session yet, and he is put on watch, when audits come more often and any cut is found. A second catch sends its own message for the story and endings spec to build on (land and hazards spec: stories 36–37, 39, 42–55, 99–100, 102–103, 105; "Implementation Decisions": Audits).

**Blocked by:** 30 (Keeping back and hidden savings)

**Status:** done

**Touches:** rules, config/tuning, content/app-text, content/sources, adapters/app-overlay, adapters/field, adapters/save, adapters/debug

**Effort:** medium

- [x] At the start of each Shift after the first, an audit is rolled: base chance, plus kept share times a factor, plus hidden savings spent in the store times a small factor, at most 1, multiplied while on watch
- [x] Paying Bills from hidden savings doesn't raise the chance
- [x] The rules remember the last few Shifts (tuning, 3 to start): kept, should-have-yielded, and savings spent in the store
- [x] With an audit planned, the Overseer stands at a scale by the gate for the last part of the Shift
- [x] At the Hand-in the audit finds nothing below the tolerance (cheered by The App) and catches him above it; on watch, any cut is caught
- [x] Caught: all hidden savings taken, the caught Study Session (longer than Negligence's, and the only one if the Quota was also missed), on watch for a set number of Shifts, and the catch count up; a second catch sends its own message
- [x] The App shows being on watch and the Shifts left as "Harmony Support"; being caught is paperwork, never violence
- [x] All the numbers come from the tuning table, with validation
- [x] A planned audit, the remembered Shifts, on watch and the catch count are saved
- [x] Debug mode adds "Audit this Shift"
- [x] Audits planned (chance) and their result (kept share, tolerance), and catches, are logged
- [x] Whether audits of pickers or penalties for keeping cotton back are documented is checked; if not, they are not presented as fact and the Sources page doesn't cite them
- [x] GUT tests through Farm cover the chance, the tell, the result, being caught, on watch and save round trips

**Notes:** Choices made while building, for the owner to confirm. Being caught wipes the remembered Shifts, so the cut he was caught for can't catch him again on watch. Every catch carries the same penalties; the second and later send `caught_again` instead of `caught`. The App announces a planned audit when the Hand-in opens, after the tell. No source in the register documents audits of pickers or penalties for keeping cotton back (also searched more widely), so they are marked as the game's invention in `app_text.gd` and the spec, and nothing is cited for them.
