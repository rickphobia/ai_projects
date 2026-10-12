# 25: Split the Shift end out of Farm

**What to build:** The Farm rules file is about twice the project's ~300-line limit, and the Hand-in, Harmony Audits and Disasters all hook into the end of a Shift. Before they arrive, the Shift's clock, the Quota check, Study Sessions and the Shift end move into their own module inside the rules, which Farm owns and delegates to. Nothing a player sees changes (land and hazards spec: "Implementation Decisions": Hand-in and Shift end; repo rule: one job per module).

**Blocked by:** 22 (Call home)

**Status:** done

**Touches:** rules

**Effort:** medium

- [x] The Shift's clock, Quota check, Study Sessions and the Shift end's order live in a module of their own inside the rules, tested only through Farm
- [x] Farm is under ~300 lines, or the ticket says plainly what still keeps it over and which later ticket takes it: see **Still over the limit** below
- [x] No behaviour changes: every existing rules test passes unchanged
- [x] No save format change

**Still over the limit:** the Shift's part is now `src/rules/shifts.gd` (about 240 lines), and Farm went from 971 lines to about 870. The rest of Farm is still too big for one module:

- the message keys, refusal reasons and the letter and call tables, with their docs (about 190 lines);
- the store and the Privileges: buying Upgrades, the rest hour and the call home, their refusals and the store views (about 190 lines);
- save and restore (about 100 lines);
- online and offline time (about 80 lines);
- the commands and views that must stay on Farm, because Farm is the seam.

No ticket takes this yet. The next split is the store and Privileges into their own module inside the rules, and save and restore after it. Add those as a ticket before ticket 29 (crop counter and Hand-in), which changes how the store is paid for.
