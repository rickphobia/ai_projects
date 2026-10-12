# 21: Letters from the Children

**What to build:** Every few Shifts a letter arrives from the Worker's Children, shown as a handwritten page that looks nothing like The App. A letters box keeps them to re-read. Over the series their tone slowly changes, from warm and homesick to distant and full of school slogans. When school fees go unpaid the letters stop; they start again once Debt is cleared, and letters that would have come in between are lost. The Children are never shown or described being punished (economy spec: stories 44–50, 52, 59; "Implementation Decisions": Letters, Family text, Sources register; "Content rules for this spec").

**Blocked by:** 20 (School fees)

**Status:** done

**Touches:** rules, config/tuning, content/family-text, content/sources, adapters/letters, adapters/save

**Effort:** medium

**Owner steps:** on a phone held sideways (`scripts/try-pr.sh <PR>`), play to the start of Shift 2 (one 10-minute Shift; Skip time is offline time and doesn't move the Shift) and check the letter page and the Letters box read well and close. The session built the web export, but had no phone or working browser to check it on.

- [x] The rules emit a "letter arrived" Family event (letter id) at the start of every Nth Shift (tuning), separate from App messages
- [x] The letter is chosen by how many letter Shifts have passed, so letters missed while stopped are skipped; when the list runs out, no new letters come
- [x] Letters stop while school fees are unpaid and start again when Debt reaches zero
- [x] A Family text table holds each letter: id, which Child, text, and source ids where a line makes a factual claim; the Children's names and ages are decided here
- [x] zenz-2019 is checked for what the change in tone draws on; lines it doesn't support are written as the Child's own experience, not as claims
- [x] A content test fails if a letter the rules can emit has no text or cites a source id not in the register
- [x] A letter opens as a handwritten page (CC0 font, credited) and the letters box lists received letters in order
- [x] Letters received, the letter Shift count and the stopped state are saved; a save without them restores with none
- [x] Letters stopping and starting are logged, never their text
- [x] GUT tests through Farm cover arrival, stopping, starting again and skipping
- [ ] Works in the web export on a phone-sized screen (record what was checked in the PR)
