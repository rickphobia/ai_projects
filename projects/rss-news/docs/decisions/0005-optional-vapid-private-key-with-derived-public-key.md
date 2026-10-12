# Configure only an optional VAPID private key

Alerts are signed with a VAPID key pair, but only the private key is configured (`RSS_NEWS_VAPID_PRIVATE_KEY`); the public key the phone subscribes with is worked out from it, so the two can never disagree. The key is optional, unlike the other secrets: without it the app runs and the push API and Settings say Alerts aren't set up. That keeps a merge from taking the site down before the owner has put a key in the Beelink env file, and keeps PR previews running without one. A key that is set but malformed still stops startup.

**Trade-offs:** a missing key is only a warning in the logs and a message in Settings, not a failed start, so Alerts can be silently off. Every phone's subscription is tied to the key: changing it makes every stored subscription useless until the phone turns Alerts on again (Settings drops the old one when it opens).
