# 22: Review, Anki style

**What to build:** The home screen shows "Review · N due". Review shows every due Entry from every Revision log, one course at a time, with a course picker to review only one. Each card shows its front (no ink); Show answer reveals the back (with ink, plus the why line); Again or Good schedules it. A new Entry is first due 3 days after it was added; Good multiplies the gap by 2.3 (3 → 7 → 16 → 37 days); Again brings it back tomorrow and starts the stretching over. Key points are cards too. Leaving halfway keeps the ratings already given. No daily limit. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 20 (Add mistake and Add key point)

**Status:** ready

**Touches:** core-revisionlog, app-revisionlog, app-home

**Effort:** medium

- [ ] Schedule tested with a fake clock: first due after 3 days, Good gaps 3 → 7 → 16 → 37, Again → tomorrow and then 3 again; constants are named in `core`
- [ ] Review queue tested across two Course folders: grouped by course, oldest due first, due means on or before today
- [ ] Home shows "Review · N due"; the course picker reviews one course only
- [ ] Front, Show answer, back with why, Again / Good; Key points included
- [ ] Each rating is saved straight away (tested: reopening keeps ratings given before leaving)
- [ ] On-tablet check written in the PR: with the tablet's date moved forward 3 days, review a Mistake and a Key point
