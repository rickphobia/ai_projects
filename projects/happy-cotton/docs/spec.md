# Happy Cotton: first playable

## Problem Statement

Forced labour in Xinjiang's cotton fields is documented by researchers, leaked police files and the UN, yet to most people it is an abstract headline. Meanwhile, cheerful farm games like Hay Day teach millions of players to enjoy watching numbers go up while someone works the field. The owner wants a browser game that uses the comfort of that genre against itself: it plays like a cozy farm game, but the player is the one being worked, and the cheerful voice belongs to the state.

Players need to be able to open a link on desktop or phone, understand within a minute what the game is about and that it is grounded in fact, feel the loop pull them in, and then feel what the loop is doing to the Worker. The owner needs a first version that is small, honest about its sources, deployed to rickphobia.com and built so later features (the supply chain, Co-workers, Reports, the Privilege store, the satire layers) can be added without a rewrite.

## Solution

**Happy Cotton** is an endless, real-time 3D farm game in the style of Hay Day, built in Godot 4 and played in the browser (decision 0001). The player is an adult Uyghur Worker on a state Farm. Over a grim, grounded, stylised field sits The App: a bright, state-issued "Happy Cotton" overlay with a smiling cotton-boll Mascot, cheerful doublespeak and a Quota bar. The gap between the two is the satire.

This first playable has one field. The Worker plants, runs laps of a track around the field to power a Generator that waters it (crops grow only while it turns), and picks cotton with Hay Day tap controls. Each Shift (10 minutes of online play) ends with a Quota check. A missed Quota means a Study Session: the Worker is taken off the field for a stretch of real time, and each one in a row lasts longer. Picking earns a small number of Labour Points, which can buy one Privilege, a rest hour. Every action raises Exhaustion, and rest never brings it below a floor that creeps up Shift after Shift. When the game is closed the Shift pauses but the crops grow slowly (the night shift), and ripe cotton left too long Withers; The App logs it as Negligence, which is punished more severely than a missed Quota. There is no ending.

The title screen carries a plain content note and a Sources page. Every factual claim and every piece of state vocabulary in the game traces to a documented source.

## User Stories

### Opening the game

1. As a player, I want to open the game from a link on rickphobia.com, so that I can play without installing anything.
2. As a player on a phone, I want the game to run in my mobile browser, so that I can play wherever I am.
3. As a player on a phone held upright, I want a prompt to turn my phone sideways, so that I see the field the way it is meant to be seen.
4. As a player, I want to see a loading indicator while the game downloads, so that I know it hasn't frozen.
5. As a player, I want a title screen that names the game and states plainly what it depicts, so that I can decide whether I want to play it.
6. As a player, I want the content note to say that the game is based on documented reporting, so that I know it isn't invented.
7. As a player, I want a Sources button on the title screen, so that I can read where the game's claims come from.
8. As a player, I want each source listed with its author, publisher, date and a link, so that I can check it myself.
9. As a player, I want to start playing with one tap or click from the title screen, so that I'm not slowed down by menus.
10. As a returning player, I want the title screen to continue my saved game, so that I pick up where I left off.

### The field and the Worker

11. As a player, I want to see the Worker standing in a cotton field from an angled camera that never rotates, so that the game feels like a farm game I know.
12. As a player, I want the world to look grim and grounded (dust, muted colour, harsh light, fences), so that the reality under The App is visible.
13. As a player, I want the Worker to look like a person, not a caricature, so that I see them as someone with dignity.
14. As a player, I want the field divided into plots I can tap, so that I know exactly where I can act.
15. As a player, I want to tap an empty plot to plant cotton, so that I can start a crop.
16. As a player, I want to see a planted plot grow through visible stages, so that I can tell how far along it is.
17. As a player, I want to see how long a growing plot has left when I tap it, so that I can plan.
18. As a player, I want to tap a ripe plot to pick it, so that the cotton counts towards the Quota.
19. As a player, I want picking to clear the plot so I can plant again, so that the loop keeps going.
20. As a player using a mouse, I want clicks to work exactly like taps, so that desktop play feels the same.
21. As a player, I want crops to grow in real time while the Worker runs the Generator, so that the farm feels alive like Hay Day and growth visibly costs the Worker.

### The App

22. As a player, I want a bright, cheerful overlay over the grim field, so that I feel the clash between what the state says and what I see.
23. As a player, I want a Quota bar showing how much I've picked against how much is demanded this Shift, so that I know where I stand.
24. As a player, I want to see how much of the Shift is left, so that I can pace myself.
25. As a player, I want to see my Labour Points, so that I know what I've earned.
26. As a player, I want to see the Worker's Exhaustion, so that I know how worn down they are.
27. As a player, I want the Mascot to give cheerful tips and announcements, so that the state's voice is a character I come to distrust.
28. As a player, I want The App to describe everything in the state's own vocabulary (for example, "Poverty Alleviation" for forced labour, "Vocational Skills Training" for detention), so that I learn how the language hides what is happening.
29. As a player, I want The App to celebrate a met Quota with confetti and praise, so that the reward loop is uncomfortable once I understand it.
30. As a player, I want The App's messages to grow colder after repeated failures, so that I feel the pressure tighten.
31. As a player, I want The App never to speak for the Worker, so that the Worker's perspective stays separate from the state's.

### Shifts and the Quota

32. As a player, I want each Shift to last 10 minutes of play, so that a short phone session can cover a whole Shift.
33. As a player, I want the Shift to pause when I close the game or switch tabs, so that I'm not punished for living my life.
34. As a player, I want the Quota checked at the end of each Shift, so that there's a clear moment of pass or fail.
35. As a player, I want a new Shift to start right after the last one ends, so that the work never stops.
36. As a player, I want the Quota to rise a little every Shift, so that I feel it is never enough.
37. As a player, I want the Quota never to go down, even after I fail, so that the system's indifference is felt.
38. As a player, I want picks above the Quota to earn praise but no lasting credit, so that exceeding it only raises expectations.

### Labour Points and Privileges

39. As a player, I want each pick to earn a small number of Labour Points, so that I'm paid something, but far less than the cotton is worth.
40. As a player, I want to spend Labour Points on a rest hour, so that I can lower the Worker's Exhaustion.
41. As a player, I want to see the cost of a Privilege before I buy it, so that I can decide.
42. As a player, I want to be told plainly when I can't afford a Privilege, so that I'm not confused.
43. As a player, I want Privileges to be taken away after a missed Quota, so that failure has a cost to the Worker's comfort.

### Exhaustion

44. As a player, I want every pick and plant to add Exhaustion, so that work visibly costs the Worker something.
45. As a player, I want high Exhaustion to slow the Worker down, so that I feel the body giving out.
46. As a player, I want high Exhaustion to cause mistakes (some cotton dropped), so that pushing harder backfires.
47. As a player, I want rest to lower Exhaustion but never below a floor, so that the Worker never fully recovers.
48. As a player, I want the Exhaustion floor to creep up every Shift, so that the exhaustion is endless.
49. As a player, I want Exhaustion to recover a little while the game is closed, but never below the floor, so that coming back is a small relief and not a reset.
50. As a player, I want the world to drain of colour and the Worker to slump as Exhaustion rises, so that I feel it, not just read it.
51. As a player who prefers less motion, I want the Exhaustion effects to respect reduced motion, so that the game stays comfortable for me.

### Study Sessions

52. As a player, I want a missed Quota to send the Worker to a Study Session, so that failure has a real consequence.
53. As a player, I want a Study Session to take the Worker off the field for a stretch of real time, so that the punishment costs me time.
54. As a player, I want to see how long the Study Session has left, so that I know when I can work again.
55. As a player, I want the Study Session shown as a plain room and a loudspeaker, never as physical harm, so that the game condemns abuse without displaying it.
56. As a player, I want each Study Session in a row to last longer than the last, so that repeated failure escalates.
57. As a player, I want a met Quota to reset the escalation, so that recovery is possible.
58. As a player, I want the Study Session to count down even while the game is closed, so that I can serve it by coming back later.
59. As a player, I want my crops not to wither while the Worker is in a Study Session, so that one punishment can't cause another I couldn't prevent.

### Offline time, Withering and Negligence

60. As a returning player, I want crops to have grown slowly while I was away (the night shift), so that coming back still feels like Hay Day.
61. As a returning player, I want ripe cotton left unpicked for 8 hours to Wither, so that leaving the field untended has a cost.
62. As a returning player, I want Withered plots clearly shown, so that I see what happened.
63. As a returning player, I want to clear a Withered plot before replanting it, so that the waste costs me an action.
64. As a returning player, I want The App to log each Withered crop as Negligence, so that the state treats an untended field as the Worker's offence.
65. As a returning player, I want Negligence to dock Labour Points and send the Worker to a longer Study Session than a missed Quota, so that it is punished more severely.
66. As a returning player, I want a short summary of what happened while I was away (crops ripened, crops Withered, Exhaustion recovered), so that I understand the state I've returned to.
67. As a player, I want switching away from the tab to count as being away, so that the rules are the same whether I close the game or not.
68. As a player who changed their device clock backwards, I want the game not to break, so that a wrong clock never corrupts my save.

### Saving and settings

69. As a player, I want the game to save automatically, so that I never lose progress.
70. As a player, I want my save kept in my browser with no account, so that I don't hand over any personal data.
71. As a player, I want a "Start over" option that asks me to confirm, so that I can begin again without losing my game by accident.
72. As a player whose save is damaged, I want a clear message and the choice to start over, so that I'm not stuck on a broken game.
73. As a player, I want to change the text size, so that I can read The App comfortably on a small screen.
74. As a player, I want a reduced-motion setting, so that screen effects don't bother me.
75. As a player, I want my settings remembered between visits, so that I set them once.

### Owner and developer

76. As the owner, I want the game deployed to `rickphobia.com/ai-projects/happy-cotton/` by one script on the server, so that a merged change reaches the site the same way as my other games.
77. As the owner, I want a rollback script, so that I can undo a bad deploy quickly.
78. As the owner, I want the game served as plain static files with no special server headers, so that my existing nginx setup works unchanged.
79. As a developer, I want all the game's numbers (grow time, Shift length, Quota growth, Exhaustion rates, wither time, Study Session lengths, prices) in one tuning table, so that balancing never means hunting through code.
80. As a developer, I want the rules to run without the scene tree, a real clock or files, so that I can test hours of play in milliseconds.
81. As a developer, I want The App's messages produced as data by the rules, so that I can test what the state says without rendering anything.
82. As a developer, I want every sourced line of App text and every doublespeak term linked to an entry in the sources list, and a test that fails if one isn't, so that ground rule 1 is enforced by CI, not by memory.
83. As a developer, I want structured logs for loading, saving, offline resume, Quota checks and Study Sessions, so that I can debug a player's report without re-running their game.
84. As a developer, I want one command that runs format check, lint, type check and tests, so that I know the project is green before I commit.
85. As a developer, I want CI to run that command and the web export on every push that touches the project, so that main never breaks.
86. As a developer, I want the README to take me from clone to running, testing and exporting, so that I don't need to ask anyone.
87. As the owner, I want a debug-only Skip time control, so that I can see growth, offline time, Withering and Negligence without waiting hours.
88. As a player, I want to drag to pan and pinch or scroll to zoom, within limits, so that I can look around the field the way I do in Hay Day.
89. As a player, I want moving the view never to plant or pick, so that looking around doesn't waste my cotton or my Exhaustion.
90. As a player, I want to tap the Generator to send the Worker to run, and plant or pick a plot to bring him back to the field, so that I choose when he Toils.
91. As a player, I want crops to grow only while the Worker runs (the Generator pumps their water), so that every bit of growth costs his body.
92. As a player, I want running to add Exhaustion, and resting to stop the Generator, so that I must choose between his rest and the Quota.
93. As a player, I want the Generator to also power the loudspeaker and The App, so that I see the state's cheerful voice literally run on the Worker's body.
94. As a player, I want the Worker to tire after a few laps, fewer as Exhaustion rises, and stop to breathe while the crops halt, so that I see the body give out.
95. As a player, I want the Overseer to blow a whistle and then use the whip when the Worker stops, with its sounds, so that the coercion behind the cheerful surface is felt.
96. As a player, I want a master volume and mute, so that I can play without sound.

## Implementation Decisions

### Engine and platform

- Godot 4 (exact version pinned in ticket 01), single-threaded web export, Compatibility (WebGL 2) renderer, as recorded in decision 0001. Landscape only; a "rotate your phone" overlay in portrait.
- Static site. No server, no accounts, no analytics, no outside links except the source links on the Sources page.

### Modules

- **Farm rules (the main seam).** A plain GDScript object with no scene tree, clock or file access. It holds the plots, the Worker's Exhaustion and its floor, Labour Points, the current Shift and Quota, Study Session state and the escalation count. Its interface:
  - Commands: plant a plot, pick a plot, clear a Withered plot, buy a Privilege (rest hour). Each returns whether it happened and why not if it didn't (for example "Worker is in a Study Session", "not ripe", "not enough Labour Points").
  - Time: advance by some seconds of online play; resume after some seconds offline. Online time advances the Shift, the Study Session, and growth while the Worker runs the Generator. Offline time advances growth at the slower offline rate, Withering, Exhaustion recovery and the Study Session, but not the Shift.
  - Results: read-only views of plots (stage, time left, Withered), Quota progress, Shift time left, Labour Points, Exhaustion and floor, Study Session time left.
  - App messages: the rules emit App messages as data (a message key plus values), never text. Message keys cover Mascot tips, Quota met, Quota missed, Study Session start and end, Negligence logged and the away summary.
  - Save: produce a plain dictionary and restore from one, with a save format version number.
  - Created with a tuning table, so tests pass their own fast numbers.
- **Tuning table (config).** Starting values to balance in play: cotton grows in 3 minutes; a Shift is 10 minutes of online play; the first Quota and how much it rises per Shift; Labour Points per pick; Exhaustion per action; the slow-down and mistake thresholds; floor rise per Shift; offline recovery rate; ripe cotton Withers after 8 hours; the first Study Session lasts 5 minutes and each one in a row doubles, up to a cap; Negligence adds to the Study Session and docks Labour Points; the price of a rest hour. Validated at startup: a bad table stops the game with a clear message.
- **App text (content).** A table that maps each message key to its English text and, for sourced lines and doublespeak terms, a source id. Text lives here, not in the rules or the scenes.
- **Sources register (content).** The list shown on the Sources page: id, title, author or publisher, date, link, and a one-line note on what the game uses it for.
- **Player settings (config).** Text size and reduced motion, saved separately from the game.
- **Adapters:** the field scene (plots, the Worker, the grounded look, tap and click picking, and a camera that pans and zooms within limits but never rotates; a tap counts on release only if the pointer didn't move), The App overlay (Quota bar, Shift timer, Labour Points, Exhaustion, Mascot speech that closes after a few seconds or at any tap, the Privilege button, the Study Session screen, the away summary), the title screen with the content note and Sources page, the save store (one slot under Godot's user folder, which the web export keeps in browser storage), the wall clock (reports offline time on start and when the tab becomes visible again), and the game log.
- **Entrypoint:** thin. It loads the config, loads or creates the save, wires the rules to the adapters, autosaves after every command, at the end of each Shift and when the tab is hidden, and runs the clock.
- **Debug mode:** on only with `?debug=1` in the page URL or `-- --debug` on the command line. It adds a Skip time control (+1 hour, +8 hours) that feeds the chosen time through the same offline resume as a real absence, so it exercises the real rules rather than a shortcut. Players never see it.

### Rules decisions

- **Shift and Quota.** The Shift counts online time only. A hidden tab counts as offline. At the end of a Shift the Quota is checked: met resets the escalation and gives App praise; missed starts a Study Session and takes away the rest-hour Privilege for the next Shift. The next Shift starts right away with a higher Quota. Picks above the Quota carry no credit into the next Shift.
- **Exhaustion.** Plant and pick add Exhaustion. Above a threshold, each action takes longer; above a higher one, a pick can drop part of its cotton. A rest hour lowers Exhaustion towards the floor, never below it. The floor rises at the end of every Shift and never falls. Offline time recovers Exhaustion slowly, never below the floor.
- **Generator and Toil.** The Worker is either in the field or on the Generator. "On the Generator" means running laps of a dirt track around the fence; the track is paved with power tiles that turn his footsteps into the Generator's power (each step lights the tile under it, and the light fades behind him), and the Generator stands at one corner with a white lap line across the track, so a lap in the rules is a lap on screen. He stops to breathe on the lap line (ticket 24; tickets 15 and 23 had a turnstile there). The power tiles are the state's cheerful invention in the game, not how real power tiles are used. Tapping the Generator sends him to run; a plant, pick or clear that happens brings him back to the field. Tapping a growing plot to see its time left is only a look, not work, so it leaves him running: otherwise every check would stop the crops. While the game is open, crops grow only while he runs. The rules count him as running from the moment he is sent; the scene's short walk out (under two seconds) is not modelled, as it is small next to the grow time. After a set number of laps (fewer as Exhaustion rises, once ticket 08 adds it) he stops to breathe and growth halts; after a few seconds the Overseer whistles, then whips, and he runs again. The rules emit the whistle and the whip as events for the scene and sound; the whip itself changes no numbers. Running adds Exhaustion (ticket 08). Resting and Study Sessions take him off the Generator, so crops halt. While the game is closed, crops grow at a slower offline rate (the night shift).
- **Study Session.** It counts down on wall-clock time, online and offline. During it the Worker can't plant or pick, and nothing Withers. The Shift's clock waits while it runs (crops halt, as the Worker isn't running): otherwise a Study Session as long as a Shift would make the next Quota impossible, every miss would cause the next, and story 57's recovery could never happen. Each Study Session in a row lasts twice as long as the last, up to a cap; a met Quota resets the count. The App's Quota-missed message grows colder for the second miss in a row and again from the third.
- **Withering and Negligence.** Ripe cotton Withers once it has been ripe for 8 hours, counted in total time outside Study Sessions. Each Withered plot is logged as Negligence: Labour Points are docked (never below zero) and a Study Session starts that is longer than one for a missed Quota. A Withered plot must be cleared before replanting.
- **Clock safety.** If the wall clock reports negative offline time, the rules treat it as zero and the game log records a warning. Offline time is capped at a generous maximum so one bad timestamp can't Wither everything at once without reason.
- **Save.** One slot, autosaved. A save that can't be read is kept aside, not overwritten; the player is told and offered "Start over". "Start over" asks for confirmation.

### Content rules (the five ground rules)

- Every factual claim and every piece of state vocabulary links to an entry in the sources register. The Generator and the whip are the game's own invention, not documented practice; the game never presents them as fact and the Sources page doesn't cite them.
- The Worker and anyone else shown are people with dignity: no caricature in looks or speech, ever.
- Nothing graphic: no blood, wounds or gore. Punishment is shown as absence, time and loss, with one exception the owner chose on 2026-10-07: the Overseer whips the Worker at the Generator, shown as a whip crack, a flinch and a stagger.
- The title screen states: "Happy Cotton depicts the forced labour of Uyghurs in Xinjiang and the separation of their families, based on documented reporting. Sources are listed in the game." No age gate.
- Brands, when they arrive in later specs, are fictional parodies. No real company is named in the game.
- English only. CC0 models, textures and fonts, credited in a credits file.

### Project setup

- The standard project layout from the repo's new-project guide: config, rules grouped by feature, adapters, a thin entrypoint, tests mirroring the source, GLOSSARY.md and docs.
- One check script (format check, lint, type check, tests), the same shape as the repo's other Godot project, run by CI in `happy-cotton.yml`, scoped to the project folder, together with the web export and a shellcheck of the deploy scripts.
- Deploy and rollback scripts following the repo's existing pattern, building in a pinned container on the server and swapping the build into place. `.env.example` lists the deploy scripts' settings; the game itself reads no environment variables.

## Testing Decisions

- A good test drives the Farm rules only through their public interface (commands, advance, resume, save) and checks what a player would see (plot stages, Quota progress, Labour Points, Exhaustion, Study Session time, App message keys). Tests never reach into private fields, and they control time by calling advance and resume with chosen seconds, never by waiting.
- **Farm rules:** the main body of tests. They use a test tuning table with small, round numbers. They cover planting, growth, picking, the Shift ending, Quota met and missed, Quota rising, Labour Points earned and spent, Exhaustion rising, slowing and causing mistakes, the floor creeping up and resisting rest, offline growth, offline recovery, Withering at exactly the wither time and not before, Negligence docking points and starting a longer Study Session, Study Sessions blocking actions, escalating, resetting and counting down offline, no Withering during a Study Session, negative and huge offline times, and save round trips (a game saved and restored behaves identically).
- **Tuning table and player settings:** validation tests (a missing or nonsensical value stops the game with a clear message), as the repo's other Godot project does for its tuning and settings.
- **App text and sources:** a content test that every message key the rules can emit has text, and every sourced line and doublespeak term points to an existing source id.
- **Adapters:** light tests only where they hold logic (for example the wall clock's offline-time calculation and the save store's handling of a damaged file). The scenes are checked by playing them in the web build.
- Prior art: the repo's other Godot project tests its pure night rules this way: GUT tests, a test tuning table, tests that mirror the source folders, and one check script that CI runs.

## Out of Scope

These are agreed for later specs, not this one:

- The supply chain: gin, bales, spinning, yarn, fabric, and the parody brand orders that ask for them.
- The Farm Level and what it unlocks (more fields, buildings, Quota steps).
- Co-workers, the Overseer, Family letters and calls, and the story fragments; with them, collective punishment (a Co-worker sharing the cost of the Worker's failure) and the letters that stop after a missed Quota.
- Reports ("Neighbourhood Harmony") and Quiet Acts.
- The Privilege store beyond the rest hour.
- The satire layers: Gratitude and the monetisation parody (patriotic videos, the "Five-Year Plan" pass, offers), achievements, the "Daily Attendance" streak, and the fake "Model Worker" leaderboard.
- Sound beyond the Generator and the Overseer (ticket 15): the bright App layer and the grim world layer.
- Any server, account, real leaderboard, real money or real advertising, ever.
- Languages other than English.

## Further Notes

### Sources register (starting entries)

| Id | Source | Used for |
|----|--------|----------|
| aspi-2020 | Vicky Xiuzhong Xu et al., *Uyghurs for Sale: 'Re-education', forced labour and surveillance beyond Xinjiang*, Australian Strategic Policy Institute, March 2020 | Labour transfers, minders, dormitories, ideological training outside working hours |
| zenz-2020 | Adrian Zenz, *Coercive Labor in Xinjiang: Labor Transfer and the Mobilization of Ethnic Minorities to Pick Cotton*, Newlines Institute, December 2020 | Cotton-picking mobilisation under "poverty alleviation", quotas, "military-style management", police monitoring |
| shu-2021 | Laura T. Murphy et al., *Laundering Cotton: How Xinjiang Cotton is Obscured in International Supply Chains*, Sheffield Hallam University, November 2021 | The supply chain (later spec) |
| ohchr-2022 | OHCHR, *Assessment of human rights concerns in the Xinjiang Uyghur Autonomous Region*, 31 August 2022 | "Vocational Education and Training Centres", the UN's findings |
| xpf-2022 | *The Xinjiang Police Files*, Victims of Communism Memorial Foundation and a media consortium, May 2022 | Detention, surveillance and police directives |
| zenz-2019 | Adrian Zenz, *Break Their Roots: Evidence for China's Parent-Child Separation Campaign in Xinjiang*, Journal of Political Risk, July 2019 | Children separated from detained parents into boarding schools (later spec) |

Ticket work adds exact links and page references for each line of App text that cites a source. Where a source hedges (for example, Zenz notes that the line between coercion and consent can be hard to draw), the game's wording should not claim more than the source does.

### Why the satire works this way

The App is the state's voice and is always cheerful; the field is the truth and is always grim. Rules emit message keys, not text, so the voice can be rewritten and sharpened without touching the rules, and the sources check stays in one place.

### Accepted risks

- The page is not linked from the site's dashboard, but anyone with the URL can open it and search engines may index it. The whip (owner's choice, 2026-10-07) goes beyond the sourced record; restricting access (a password or Tailscale only) is the fix if that becomes a concern.

- A 30–40 MB download and slower start on phones (decision 0001).
- Players can move their device clock to cheat growth. That only harms their own single-player game, so the rules guard against crashes, not cheating.
- The subject is political and serious. The content rules above are what keep the game on the side of the people it depicts; any change to them should be agreed with the owner first.
