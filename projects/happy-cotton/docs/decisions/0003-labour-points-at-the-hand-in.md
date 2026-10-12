# Labour Points are paid at the Hand-in, not at each pick

Since the first playable, every pick paid Labour Points at once. The land and hazards spec adds keeping back: at the end of each Shift the Worker hands in his cotton and may keep some for his Family. If picks were still paid as they happen, keeping cotton back would cost him nothing, and the choice would only be about the Quota. So Labour Points are now paid at the Hand-in, for the cotton handed in, and nothing is paid at a pick (owner's decision, ticket 29). Each pick still feels rewarded through the crop counter beside the Labour Points and a "+1" rising from the Plot. The Farm stands still while the Hand-in is open, so the player is never rushed into it, and a Hand-in left open is saved.

**Trade-offs:**

- Labour Points arrive once a Shift instead of steadily, so a Privilege or Upgrade bought mid-Shift is paid for from earlier Shifts' Labour Points.
- Online time stops at the Hand-in until the player answers, so a Shift no longer rolls straight into the next one.
- A save from before this change carries on with the Shift's picks as cotton in hand; they were already paid at the pick, so that Shift's cotton is paid a second time at its Hand-in. That is one Shift, once, and simpler than saving which picks were paid.

**Consequences:**

- The pay slip's "earned" line is now exactly what the Hand-in paid, and those Labour Points pay any Debt down before that Shift's Bills are charged.
- Existing tests that counted Labour Points after a pick now finish the Shift and hand in first (`tests/rules/handing_in.gd`). A few whose subject is something else (Negligence docking, the save round trip) credit the Labour Points through the debug command instead of playing a whole Shift.
