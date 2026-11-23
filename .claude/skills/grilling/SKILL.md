---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

**Ask with the `AskUserQuestion` tool, never as numbered questions in your reply.** The user answers by picking an option, not by typing replies. If the tool isn't available (e.g. a non-interactive run), say so and stop; don't fall back to text questions.

- **One question per frontier decision, at most 4 per call.** A bigger frontier is several calls in a row, most important first.
- **Each question stands alone.** While the dialog is open the user may see only the question, not your earlier text. So name what is being decided, and the fact that makes it a question.
- **2–4 options. Your recommended answer is the first option, its label ending in "(Recommended)".** Each option's description gives its trade-off in a line or two.
- **Open questions** (a name, a number, a free-form rule) still get options: your best 2–3 guesses. The dialog always adds "Other", where the user can type their own answer.
- **`multiSelect: true`** when more than one option can be true at once.
- **`header`** is a short chip naming the topic, at most 12 characters.
- **A confused or partial answer** (a question back, or "Other" text that doesn't decide it) gets the same question again next round, in plainer words. Never fill in the answer yourself.

Keep your own text between rounds short: what the last answers settled, and anything you looked up.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), send a plain lookup (where something is, what a file says) to the `fact-finder` sub-agent, and look up anything that needs judgment yourself; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the answer; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
