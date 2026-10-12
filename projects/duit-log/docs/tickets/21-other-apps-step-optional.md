# 21: "Switch other apps off" is optional

**What to build:** The notification access guide marks "Switch other apps off" as an optional extra-privacy step instead of something every user must do. Android's per-app list for a notification listener starts with every app on and has no "deselect all", so switching off everything but TNG, Grab and Shopee means tapping dozens of switches. The owner found this too much of a hassle on their own phone. duit-log already drops every notification that isn't from a Wallet app before reading its text (decision 0003, with tests), so the Android setting is a second layer, not the protection itself. The guide says so in plain words: "duit-log already ignores other apps; if you want Android to stop passing their notifications at all, switch them off here. At least consider messaging, banking, SMS and email apps."

**Blocked by:** None (can start immediately; 02 is done)

**Status:** ready

**Touches:** app/onboarding, docs

**Effort:** low

- [ ] Check the Android docs and source to see whether an app can pre-set or narrow its own notification listener's app list, e.g. a manifest meta-data entry or a public API, beyond the `default_filter_types` / `disabled_filter_types` that work by notification type. If there is a way, raise it in the PR before building, because it would replace this ticket. Record what you found in the PR body.
- [ ] Guide step title and text say the step is optional, explain why (the app's own Wallet allowlist already drops other apps' notifications unread), and suggest the apps most worth switching off
- [ ] The guide can be finished without doing this step, and nothing in the app nags about it
- [ ] README "Notification access" step 3 matches the guide
- [ ] Spec user story 8 reworded so the guide shows how to switch other apps off *if the user wants the extra layer*
- [ ] Ticket 20's install-steps criterion says "switching other apps off (optional)"
- [ ] Existing onboarding tests still pass, and any test that checks the guide's steps is updated

**Owner steps:** in the Preview app, open ⋮ → Notification access guide and check the step reads as optional and is clear about why.
