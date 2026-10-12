# 20: Push set-up and test Alert

**What to build:** The owner turns on Alerts for their phone in Settings and sends a test Alert. Tapping an Alert opens its Item. The README explains the Honor battery setting that lets Alerts arrive on time. Spec user stories 69, 71, 74.

**Blocked by:** 12 (Spending limit and page), 19 (Installable app)

**Status:** ready

**Touches:** alerts, adapters/push_sender, adapters/sqlite/alerts, web/alerts, pwa/settings, pwa/service-worker

**Effort:** medium

- [ ] VAPID key pair comes from config; a subcommand generates one
- [ ] PushSender port with a Web Push adapter and a fake; gone subscriptions are removed
- [ ] Push API: subscribe, unsubscribe, send test Alert
- [ ] Service worker shows the Alert and opens the Item view when it's tapped
- [ ] Settings screen has the Alert opt-in and the test button
- [ ] API tests cover subscribe, test Alert and gone subscriptions; a Vitest test covers the opt-in
- [ ] README explains the Honor battery setting; `.env.example` updated

**Owner steps:** generate the VAPID keys into the Beelink secrets file, turn Alerts on from the phone and send a test Alert.
