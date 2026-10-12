# The app reads amounts itself; the AI only picks Categories

Amounts, Merchants and Wallets are read from notification text by per-Wallet patterns in the app, never by the AI. The AI's only job is to choose a Category during the Daily Sort. A model could parse the notifications with no per-Wallet code at all, but the Category Prompt must show the amount the moment you pay, the app must work offline and without a key, and a money app can't let a model misread RM12.50 as RM1250.

**Trade-offs:** a Wallet that changes its notification wording breaks capture until its pattern is updated. That is why the original notification text is kept with every Transaction, and why each pattern is tested against real (anonymised) samples.
