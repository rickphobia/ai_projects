# 27: Buy a Plot: the fence moves out

**What to build:** The App's store sells land, one Plot at a time, each dearer than the last. Buying a Plot in a new column or row moves the fence out to take in the whole strip; its other cells show as hard, unworked ground until bought. Each new Plot works like the first twelve and raises the Quota from the next Shift, by less than it yields. The camera can reach and take in the bigger Farm (land and hazards spec: stories 1–8, 13–19, 94–96, 98; "Implementation Decisions": Land, Quota and land, Tuning table, Adapters: Field and Field camera, Save).

**Blocked by:** 26 (The Farm's land comes from the rules)

**Status:** done

**Touches:** rules, config/tuning, content/app-text, adapters/app-overlay, adapters/field, adapters/save

**Effort:** medium

- [x] The store's land item shows the next Plot's price and Quota rise in The App's voice, or that the Farm is fully bought
- [x] Buying a Plot takes the next cell in the fixed order (a column on the right, then a row at the back), with the refusals: not enough Labour Points, in Debt, in a Study Session, fully bought
- [x] Plot prices rise with each one bought; first price, rise, Quota rise and yield per Plot per Shift come from the tuning table, with validation that each Plot yields more than it adds to the Quota
- [x] A new Plot's Quota rise starts with the next Shift
- [x] The fence and track move out to take in the whole strip; unbought cells show as unworked ground
- [x] The camera's pan limits follow the track, and the farthest zoom grows with it; field camera tests cover this
- [x] The App celebrates a new Plot as the state's gain
- [x] The save format version goes up; Plots bought are saved; a previous-version save carries on with the first twelve Plots
- [x] Plot bought (number, price) is logged
- [x] GUT tests through Farm cover buying, the order, prices, refusals, the Quota rise and save round trips
