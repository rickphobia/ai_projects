# 02: Recorder

**What to build:** On first run, a guide explains in plain words why duit-log needs notification access, how to allow restricted settings for a sideloaded app (Android 13+) and how to switch other apps off for duit-log (Android 12+), then sends you to grant it. Once granted, the app records every notification from TNG, Grab and Shopee and nothing else, so their real wording can be collected for the Notification Reader. See decision 0003.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready

**Touches:** core/reader, app/capture, app/onboarding

**Effort:** medium

- [ ] The Notification Reader's first step in `core`: a notification whose posting app isn't a Wallet app is "Not a Wallet"; tests show a WhatsApp and a bank notification are dropped whatever their text says
- [ ] The notification listener drops "Not a Wallet" notifications before anything else: nothing saved, nothing logged, not even a count
- [ ] The Wallet apps' package names confirmed on the owner's phone (the recorder screen lists installed apps it would accept) and recorded in the README
- [ ] Recorder screen lists recorded Wallet notifications (app, time, title, text, expanded text); "Share" sends them as a text file through the share menu; "Clear" deletes them after a confirm
- [ ] First-run notification access guide, plus the permission to post notifications on Android 13+
- [ ] A banner on the home screen when notification access is missing, with a button to the right settings page
- [ ] The log records listener start and stop and each recorded Wallet notification's app and time, never its text
- [ ] On-phone check (Preview app): grant access, pay something with TNG, see it recorded; get a WhatsApp message, see nothing recorded

**Owner steps:** install the release, grant notification access, use TNG, Grab and Shopee normally for about a week (include a Reload, a Transfer sent and received, a Shopee order paid with TNG, a Grab ride and a GrabFood order if you can), then share the recordings with names and amounts blanked out so ticket 06 can turn them into test samples.
