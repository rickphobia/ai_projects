class_name FastTuning
extends RefCounted
## The test tuning table: small, round numbers so a test can play a whole crop in a few calls.
## Cotton ripens in 30 seconds, so each of the three growing stages lasts 10. A Shift lasts
## 100 seconds, the first Quota is 3 picks and rises by 2 each Shift, and a pick earns 5
## Labour Points. A missed Quota's first Study Session lasts 20 seconds and each one in a row
## doubles, capped at 50: 20, 40, 50, 50. On the Generator a lap takes 10 seconds and the
## Worker runs 10 laps (100 seconds, longer than a crop takes) before he stops to breathe;
## 3 seconds later the Overseer whistles, and 2 seconds after that he whips and the Worker runs.
## Offline, crops grow at half speed (60 seconds offline to ripen) and one return counts at
## most 1000 seconds. Each Withered plot docks 8 Labour Points, and Negligence starts an
## 80-second Study Session, longer than the 50-second cap for missed Quotas.
## In table() ripe cotton takes far longer to Wither than any test plays, so tests about other
## rules never meet it; withering_table() makes it Wither after 50 seconds.
## In table() work adds no Exhaustion and its floor never rises, so tests about other rules
## never meet it; exhausting_table() makes each plant and pick add 10 and each lap 1, and
## raises the floor by 5 each Shift. Above 50 a field action takes 2 seconds; above 80 a pick
## drops its cotton half the time. Laps before a breath fall from 10 at no Exhaustion to 2 at
## 100 (6 at 50). A rest hour costs 10 Labour Points and lasts 20 seconds, taking away 40
## Exhaustion (2 a second); an hour offline takes away 36 (0.01 a second).
## The Generator has two Upgrade tiers: the first costs 10 Labour Points (two picks), doubles
## growth per second of running and raises the Quota by 1; the second costs 20, triples growth
## and raises the Quota by 2 more.
## The tools have two tiers: the first costs 10, halves a slow pick's time and the drop chance
## (a 1-second pick, a 1-in-4 drop) and raises the Quota by 1; the second costs 20, leaves a
## quarter of each and raises the Quota by 2 more.
## A letter from the Children arrives at the start of every second Shift (2, 4, 6...). A call
## home costs 5 Labour Points (one pick) and lasts 10 seconds.
## The Farm starts as 2 × 2 Plots (4) and can grow to 3 × 3; with_land() starts it at another size.
## The first Plot bought costs 10 Labour Points and each one after costs 5 more; each raises the
## Quota by 1 and should yield 2 picks a Shift. Each column or row the Farm grows adds 5 seconds
## to a lap.

const GROW_SECONDS := 30.0
const SHIFT_SECONDS := 100.0
const FIRST_QUOTA := 3
const QUOTA_RISE := 2
const LABOUR_POINTS_PER_PICK := 5
const STUDY_SESSION_SECONDS := 20.0
const STUDY_SESSION_CAP_SECONDS := 50.0
const LAP_SECONDS := 10.0
const LAP_SECONDS_PER_STRIP := 5.0
const LAPS_BEFORE_BREATH := 10
const WHISTLE_AFTER_SECONDS := 3.0
const WHIP_AFTER_SECONDS := 2.0
## His whole breath: until the whistle, then until the whip.
const BREATH_SECONDS := WHISTLE_AFTER_SECONDS + WHIP_AFTER_SECONDS
const OFFLINE_GROWTH_RATE := 0.5
const OFFLINE_CAP_SECONDS := 1000.0
const WITHER_SECONDS := 50.0
const SLOW_WITHER_SECONDS := 1000000.0
const NEGLIGENCE_LABOUR_POINTS := 8
const NEGLIGENCE_STUDY_SESSION_SECONDS := 80.0
const EXHAUSTION_PER_PLANT := 10.0
const EXHAUSTION_PER_PICK := 10.0
const EXHAUSTION_PER_LAP := 1.0
const SLOW_EXHAUSTION := 50.0
const SLOW_ACTION_SECONDS := 2.0
const MISTAKE_EXHAUSTION := 80.0
const DROPPED_COTTON_CHANCE := 0.5
const EXHAUSTION_FLOOR_RISE := 5.0
const FEWEST_LAPS_BEFORE_BREATH := 2
const REST_HOUR_PRICE := 10
const REST_HOUR_SECONDS := 20.0
const REST_HOUR_RECOVERY := 40.0
const OFFLINE_RECOVERY_PER_HOUR := 36.0
const GENERATOR_PRICES: Array[int] = [10, 20]
const GENERATOR_MULTIPLIERS: Array[float] = [2.0, 3.0]
const GENERATOR_QUOTA_RISES: Array[int] = [1, 2]
const TOOLS_PRICES: Array[int] = [10, 20]
const TOOLS_WORK_SHARES: Array[float] = [0.5, 0.25]
const TOOLS_QUOTA_RISES: Array[int] = [1, 2]
const ELECTRICITY_PER_LAP := 1
const RENT_PER_SHIFT := 4
const SCHOOL_FEES := 20
const SCHOOL_FEES_EVERY_SHIFTS := 3
const LETTER_EVERY_SHIFTS := 2
const CALL_HOME_PRICE := 5
const CALL_HOME_SECONDS := 10.0
const FIRST_LAND_COLUMNS := 2
const FIRST_LAND_ROWS := 2
const FIRST_PLOTS := FIRST_LAND_COLUMNS * FIRST_LAND_ROWS
const LARGEST_LAND_COLUMNS := 3
const LARGEST_LAND_ROWS := 3
const FIRST_PLOT_PRICE := 10
const PLOT_PRICE_RISE := 5
const PLOT_QUOTA_RISE := 1
const PLOT_YIELD_PER_SHIFT := 2


static func table() -> Tuning:
	var tuning := Tuning.new()
	tuning.grow_seconds = GROW_SECONDS
	tuning.shift_seconds = SHIFT_SECONDS
	tuning.first_quota = FIRST_QUOTA
	tuning.quota_rise = QUOTA_RISE
	tuning.labour_points_per_pick = LABOUR_POINTS_PER_PICK
	tuning.study_session_seconds = STUDY_SESSION_SECONDS
	tuning.study_session_cap_seconds = STUDY_SESSION_CAP_SECONDS
	tuning.lap_seconds = LAP_SECONDS
	tuning.lap_seconds_per_strip = LAP_SECONDS_PER_STRIP
	tuning.laps_before_breath = LAPS_BEFORE_BREATH
	tuning.whistle_after_seconds = WHISTLE_AFTER_SECONDS
	tuning.whip_after_seconds = WHIP_AFTER_SECONDS
	tuning.offline_growth_rate = OFFLINE_GROWTH_RATE
	tuning.offline_cap_seconds = OFFLINE_CAP_SECONDS
	tuning.wither_seconds = SLOW_WITHER_SECONDS
	tuning.negligence_labour_points = NEGLIGENCE_LABOUR_POINTS
	tuning.negligence_study_session_seconds = NEGLIGENCE_STUDY_SESSION_SECONDS
	tuning.exhaustion_per_plant = 0.0
	tuning.exhaustion_per_pick = 0.0
	tuning.exhaustion_per_lap = 0.0
	tuning.slow_exhaustion = SLOW_EXHAUSTION
	tuning.slow_action_seconds = SLOW_ACTION_SECONDS
	tuning.mistake_exhaustion = MISTAKE_EXHAUSTION
	tuning.dropped_cotton_chance = DROPPED_COTTON_CHANCE
	tuning.exhaustion_floor_rise = 0.0
	tuning.fewest_laps_before_breath = FEWEST_LAPS_BEFORE_BREATH
	tuning.rest_hour_price = REST_HOUR_PRICE
	tuning.rest_hour_seconds = REST_HOUR_SECONDS
	tuning.rest_hour_recovery = REST_HOUR_RECOVERY
	tuning.offline_recovery_per_hour = OFFLINE_RECOVERY_PER_HOUR
	tuning.electricity_per_lap = 0.0
	tuning.rent_per_shift = 0.0
	tuning.school_fees = 0.0
	tuning.school_fees_every_shifts = SCHOOL_FEES_EVERY_SHIFTS
	tuning.letter_every_shifts = LETTER_EVERY_SHIFTS
	tuning.call_home_price = CALL_HOME_PRICE
	tuning.call_home_seconds = CALL_HOME_SECONDS
	tuning.first_land_columns = FIRST_LAND_COLUMNS
	tuning.first_land_rows = FIRST_LAND_ROWS
	tuning.largest_land_columns = LARGEST_LAND_COLUMNS
	tuning.largest_land_rows = LARGEST_LAND_ROWS
	tuning.first_plot_price = FIRST_PLOT_PRICE
	tuning.plot_price_rise = PLOT_PRICE_RISE
	tuning.plot_quota_rise = PLOT_QUOTA_RISE
	tuning.plot_yield_per_shift = PLOT_YIELD_PER_SHIFT
	var tiers: Array[GeneratorTier] = []
	for index in GENERATOR_PRICES.size():
		tiers.append(
			GeneratorTier.make(
				GENERATOR_PRICES[index], GENERATOR_MULTIPLIERS[index], GENERATOR_QUOTA_RISES[index]
			)
		)
	tuning.generator_tiers = tiers
	var tools_tiers: Array[ToolsTier] = []
	for index in TOOLS_PRICES.size():
		tools_tiers.append(
			ToolsTier.make(TOOLS_PRICES[index], TOOLS_WORK_SHARES[index], TOOLS_QUOTA_RISES[index])
		)
	tuning.tools_tiers = tools_tiers
	return tuning


## The test table with ripe cotton Withering after WITHER_SECONDS.
static func withering_table() -> Tuning:
	var tuning := table()
	tuning.wither_seconds = WITHER_SECONDS
	return tuning


## The test table with work adding Exhaustion and its floor rising every Shift.
static func exhausting_table() -> Tuning:
	var tuning := table()
	tuning.exhaustion_per_plant = EXHAUSTION_PER_PLANT
	tuning.exhaustion_per_pick = EXHAUSTION_PER_PICK
	tuning.exhaustion_per_lap = EXHAUSTION_PER_LAP
	tuning.exhaustion_floor_rise = EXHAUSTION_FLOOR_RISE
	return tuning


## The test table with the Bills charged at the end of every Shift, and school fees at the end
## of every third.
static func billing_table() -> Tuning:
	var tuning := table()
	tuning.electricity_per_lap = ELECTRICITY_PER_LAP
	tuning.rent_per_shift = RENT_PER_SHIFT
	tuning.school_fees = SCHOOL_FEES
	return tuning


## A table starting the Farm with another first land, and no larger land to grow into.
static func with_land(tuning: Tuning, columns: int, rows: int) -> Tuning:
	tuning.first_land_columns = columns
	tuning.first_land_rows = rows
	tuning.largest_land_columns = columns
	tuning.largest_land_rows = rows
	return tuning
