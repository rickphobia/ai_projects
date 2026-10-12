class_name Tuning
extends Resource
## The one table of game numbers. Rules and adapters read their numbers from here,
## never from literals. Every field starts as NAN, so a table that leaves one out
## is caught as "missing" instead of silently using a default.
## A ticket that adds a rule adds its numbers here, to LIMITS, and to data/tuning.tres.

## Allowed range per field, inclusive: [lowest, highest].
const LIMITS: Dictionary = {
	"grow_seconds": [1.0, 86400.0],
	"shift_seconds": [10.0, 86400.0],
	"first_quota": [1.0, 10000.0],
	"quota_rise": [1.0, 10000.0],
	"labour_points_per_pick": [1.0, 10000.0],
	"study_session_seconds": [1.0, 86400.0],
	"study_session_cap_seconds": [1.0, 604800.0],
	"lap_seconds": [0.5, 600.0],
	"laps_before_breath": [1.0, 1000.0],
	"whistle_after_seconds": [0.5, 600.0],
	"whip_after_seconds": [0.5, 600.0],
	"offline_growth_rate": [0.01, 1.0],
	"offline_cap_seconds": [60.0, 2592000.0],
	"wither_seconds": [1.0, 2592000.0],
	"negligence_labour_points": [0.0, 10000.0],
	"negligence_study_session_seconds": [1.0, 604800.0],
	"exhaustion_per_plant": [0.0, 100.0],
	"exhaustion_per_pick": [0.0, 100.0],
	"exhaustion_per_lap": [0.0, 100.0],
	"slow_exhaustion": [0.0, 100.0],
	"slow_action_seconds": [0.1, 60.0],
	"mistake_exhaustion": [0.0, 100.0],
	"dropped_cotton_chance": [0.0, 1.0],
	"exhaustion_floor_rise": [0.0, 100.0],
	"fewest_laps_before_breath": [1.0, 1000.0],
	"rest_hour_price": [0.0, 10000.0],
	"rest_hour_seconds": [1.0, 86400.0],
	"rest_hour_recovery": [0.0, 100.0],
	"offline_recovery_per_hour": [0.0, 100.0],
	"electricity_per_lap": [0.0, 10000.0],
	"rent_per_shift": [0.0, 10000.0],
	"school_fees": [0.0, 100000.0],
	"school_fees_every_shifts": [1.0, 1000.0],
	"letter_every_shifts": [1.0, 1000.0],
	"call_home_price": [0.0, 10000.0],
	"call_home_seconds": [1.0, 86400.0],
	"first_land_columns": [1.0, 20.0],
	"first_land_rows": [1.0, 20.0],
	"largest_land_columns": [1.0, 20.0],
	"largest_land_rows": [1.0, 20.0],
	"first_plot_price": [1.0, 1000000.0],
	"plot_price_rise": [0.0, 1000000.0],
	"plot_quota_rise": [1.0, 10000.0],
	"plot_yield_per_shift": [1.0, 10000.0],
}
## Fields that count things (picks, points), so they must be whole numbers.
const WHOLE_NUMBERS: Array[String] = [
	"first_quota",
	"quota_rise",
	"labour_points_per_pick",
	"laps_before_breath",
	"negligence_labour_points",
	"fewest_laps_before_breath",
	"rest_hour_price",
	"rent_per_shift",
	"school_fees",
	"school_fees_every_shifts",
	"letter_every_shifts",
	"call_home_price",
	"first_land_columns",
	"first_land_rows",
	"largest_land_columns",
	"largest_land_rows",
	"first_plot_price",
	"plot_price_rise",
	"plot_quota_rise",
	"plot_yield_per_shift",
]
## What a Generator tier's growth multiplier is measured against: no Upgrade at all.
const NO_UPGRADE_GROWTH := 1.0
## The most a tier can cost, multiply growth by, or raise the Quota by.
const MOST_TIER_PRICE := 1000000.0
const MOST_GROWTH_MULTIPLIER := 100.0
## What a tools tier's work share is measured against: no Upgrade at all.
const NO_UPGRADE_WORK_SHARE := 1.0
## The least share of a slow pick and of the drop chance a tools tier can leave: tools never
## make a pick instant or a drop impossible.
const LEAST_WORK_SHARE := 0.01
const MOST_TIER_QUOTA_RISE := 10000.0

## How long a planted plot takes to ripen, in seconds of real time.
@export var grow_seconds: float = NAN
## How long a Shift lasts, in seconds of online play.
@export var shift_seconds: float = NAN
## Cotton picks demanded in the first Shift.
@export var first_quota: float = NAN
## How many more picks each Shift demands than the last. At least 1: the Quota never falls.
@export var quota_rise: float = NAN
## Labour Points earned for each pick.
@export var labour_points_per_pick: float = NAN
## How long the first Study Session after a met Quota lasts, in seconds of real time. Each
## one in a row lasts twice as long as the last.
@export var study_session_seconds: float = NAN
## The longest a Study Session can last, however many come in a row. At least
## study_session_seconds.
@export var study_session_cap_seconds: float = NAN
## How long one lap of the track round the fence takes, in seconds of online play. The field
## shows him running at the pace this sets over the track's length (about 52 m as shipped).
@export var lap_seconds: float = NAN
## How many laps the Worker runs on the Generator before he stops to breathe. Leaving the
## Generator doesn't rest him: the laps since his last breath carry over.
@export var laps_before_breath: float = NAN
## How long he stands bent over on the Generator, breathing, before the Overseer blows his
## whistle. Crops halt meanwhile.
@export var whistle_after_seconds: float = NAN
## How long after the whistle the Overseer uses the whip, and the Worker runs again.
@export var whip_after_seconds: float = NAN
## How fast crops grow while the game is closed or its tab hidden (the night shift), as a share
## of how fast they grow while the Worker runs on the Generator. No Generator is needed.
@export var offline_growth_rate: float = NAN
## The most offline time one return counts, in seconds. More is cut to this, so one bad
## timestamp can't move the Farm on by years.
@export var offline_cap_seconds: float = NAN
## How long ripe cotton can wait to be picked before it Withers, in seconds counted outside
## Study Sessions, online or offline.
@export var wither_seconds: float = NAN
## Labour Points docked for each Withered plot. The balance never goes below zero.
@export var negligence_labour_points: float = NAN
## How long the Study Session for Negligence lasts. It must be longer than the cap for a missed
## Quota, so Negligence is always punished more severely.
@export var negligence_study_session_seconds: float = NAN
## Exhaustion runs from 0 (rested) to 100 (spent). This is how much each plant adds.
@export var exhaustion_per_plant: float = NAN
## Exhaustion added by each pick, even one that drops its cotton.
@export var exhaustion_per_pick: float = NAN
## Exhaustion added by each lap run on the Generator, a little at a time as he runs.
@export var exhaustion_per_lap: float = NAN
## Above this Exhaustion a plant, pick or clear takes slow_action_seconds, and the Worker can do
## nothing else in the field until it is done. At or below it they are instant.
@export var slow_exhaustion: float = NAN
## How long a plant, pick or clear takes above slow_exhaustion, in seconds of online play.
@export var slow_action_seconds: float = NAN
## Above this Exhaustion a pick can drop its cotton. At least slow_exhaustion.
@export var mistake_exhaustion: float = NAN
## The chance, from 0 to 1, that a pick above mistake_exhaustion drops its cotton: the plot is
## emptied but nothing counts towards the Quota and no Labour Points are earned.
@export var dropped_cotton_chance: float = NAN
## How much the Exhaustion floor rises at the end of every Shift. Rest never goes below the
## floor, and it never falls.
@export var exhaustion_floor_rise: float = NAN
## How many laps he runs before he stops to breathe when fully exhausted. Between this and
## laps_before_breath (at no Exhaustion) it falls in step with Exhaustion, set at the start of
## each run. At most laps_before_breath.
@export var fewest_laps_before_breath: float = NAN
## Labour Points a rest hour costs.
@export var rest_hour_price: float = NAN
## How long a rest hour lasts, in seconds of online play. It is the state's name for it, not a
## real hour. The Shift keeps counting and crops halt, as he is off the Generator.
@export var rest_hour_seconds: float = NAN
## How much Exhaustion a whole rest hour takes away, a little at a time, never below the floor.
@export var rest_hour_recovery: float = NAN
## How much Exhaustion an hour away from the game takes away, never below the floor.
@export var offline_recovery_per_hour: float = NAN
## Labour Points the electricity Bill charges for each lap he ran on the Generator that Shift:
## he pays for the power his own body made. It can be a fraction; the Bill is rounded to whole
## Labour Points.
@export var electricity_per_lap: float = NAN
## Labour Points the dormitory rent Bill charges at the end of every Shift, after electricity.
@export var rent_per_shift: float = NAN
## Labour Points the Children's school-fees Bill charges, after rent, at the end of every
## school_fees_every_shifts-th Shift. The fees are the game's invention, not a documented fact.
@export var school_fees: float = NAN
## How many Shifts apart the school fees come; the first are due at the end of this Shift.
@export var school_fees_every_shifts: float = NAN
## How many Shifts apart the Children's letters come: one arrives at the start of every Shift
## whose number divides by this, unless the letters have stopped.
@export var letter_every_shifts: float = NAN
## Labour Points a call home costs.
@export var call_home_price: float = NAN
## How long a call home lasts, in seconds of online play. He is off the Generator for it, so
## crops halt, but unlike a rest hour it takes no Exhaustion away.
@export var call_home_seconds: float = NAN
## The Farm's land at the start, in Plots across (columns) and front to back (rows).
@export var first_land_columns: float = NAN
@export var first_land_rows: float = NAN
## The most land the Farm can grow to, in columns and rows. At least the first land.
@export var largest_land_columns: float = NAN
@export var largest_land_rows: float = NAN
## Labour Points the first Plot bought costs; each one after costs plot_price_rise more.
@export var first_plot_price: float = NAN
@export var plot_price_rise: float = NAN
## How many more picks the Quota demands for each Plot bought, from the Shift after it was
## bought. Less than plot_yield_per_shift, so land always leaves a margin.
@export var plot_quota_rise: float = NAN
## The cotton a Plot should yield in a Shift, in picks. The state's own reckoning of what the
## land is worth; every Plot bought must yield more than it adds to the Quota.
@export var plot_yield_per_shift: float = NAN
## The Generator Upgrade's tiers, bought in order: each one's price, growth per second of
## running, and Quota rise. At least one tier.
@export var generator_tiers: Array[GeneratorTier] = []
## The tools Upgrade's tiers, bought in order: each one's price, share of a slow pick's time and
## of the drop chance, and Quota rise. At least one tier.
@export var tools_tiers: Array[ToolsTier] = []


static func load_file(path: String) -> Tuning:
	if not ResourceLoader.exists(path):
		return null
	return load(path) as Tuning


## Everything wrong with the table, one line per bad value, each naming the field.
## Empty when the table is good.
func problems() -> Array[String]:
	var found: Array[String] = []
	for field: String in LIMITS:
		var value: float = get(field)
		var limits: Array = LIMITS[field]
		var lowest: float = limits[0]
		var highest: float = limits[1]
		if is_nan(value):
			found.append("%s is missing from the tuning table" % field)
		elif value < lowest or value > highest:
			found.append(
				"%s is %s, but it must be between %s and %s" % [field, value, lowest, highest]
			)
		elif field in WHOLE_NUMBERS and value != roundf(value):
			found.append("%s is %s, but it must be a whole number" % [field, value])
	if study_session_cap_seconds < study_session_seconds:
		var cap_problem := "study_session_cap_seconds is %s, but it must be at least %s"
		found.append(cap_problem % [study_session_cap_seconds, study_session_seconds])
	if negligence_study_session_seconds <= study_session_cap_seconds:
		var negligence_problem := (
			"negligence_study_session_seconds is %s, but it must be longer than"
			+ " study_session_cap_seconds (%s)"
		)
		found.append(
			negligence_problem % [negligence_study_session_seconds, study_session_cap_seconds]
		)
	if mistake_exhaustion < slow_exhaustion:
		var mistake_problem := "mistake_exhaustion is %s, but it must be at least slow_exhaustion (%s)"
		found.append(mistake_problem % [mistake_exhaustion, slow_exhaustion])
	if fewest_laps_before_breath > laps_before_breath:
		var laps_problem := (
			"fewest_laps_before_breath is %s, but it must be at most" + " laps_before_breath (%s)"
		)
		found.append(laps_problem % [fewest_laps_before_breath, laps_before_breath])
	found.append_array(_land_problems())
	found.append_array(_generator_tier_problems())
	found.append_array(_tools_tier_problems())
	return found


## The largest Farm must take in the first one, in both columns and rows, and a Plot must yield
## more in a Shift than it adds to the Quota.
func _land_problems() -> Array[String]:
	var found: Array[String] = []
	found.append_array(_largest_land_problems("columns", largest_land_columns, first_land_columns))
	found.append_array(_largest_land_problems("rows", largest_land_rows, first_land_rows))
	if plot_yield_per_shift <= plot_quota_rise:
		var margin_problem := "plot_yield_per_shift is %d, but it must be more than plot_quota_rise (%d)"
		found.append(margin_problem % [plot_yield_per_shift, plot_quota_rise])
	return found


func _largest_land_problems(along: String, largest: float, first: float) -> Array[String]:
	if is_nan(largest) or is_nan(first) or largest >= first:
		return []
	var problem := "largest_land_%s is %d, but it must be at least first_land_%s (%d)"
	return [problem % [along, largest, along, first]]


## The tier list must not be empty; each tier has a whole, positive price, a whole Quota rise
## of at least 1 (an Upgrade always raises the Quota), and a growth multiplier no lower than
## the tier before it (or than no Upgrade, for the first). Tiers count from 1, as the store
## shows them.
func _generator_tier_problems() -> Array[String]:
	if generator_tiers.is_empty():
		return ["generator_tiers has no tiers"]
	var found: Array[String] = []
	var previous_multiplier := NO_UPGRADE_GROWTH
	for index in generator_tiers.size():
		var where := "generator_tiers[%d]" % (index + 1)
		var tier := generator_tiers[index]
		if tier == null:
			found.append("%s is missing" % where)
			continue
		found.append_array(
			_tier_value_problems(where + ".price", tier.price, 1.0, MOST_TIER_PRICE, true)
		)
		found.append_array(
			_tier_value_problems(
				where + ".quota_rise", tier.quota_rise, 1.0, MOST_TIER_QUOTA_RISE, true
			)
		)
		var multiplier_problems := _tier_value_problems(
			where + ".growth_multiplier",
			tier.growth_multiplier,
			previous_multiplier,
			MOST_GROWTH_MULTIPLIER,
			false
		)
		found.append_array(multiplier_problems)
		if multiplier_problems.is_empty():
			previous_multiplier = tier.growth_multiplier
	return found


## As for the Generator, but each tier's work share must be above 0 and no higher than the
## tier before it (or than no Upgrade, for the first): better tools never make work worse.
func _tools_tier_problems() -> Array[String]:
	if tools_tiers.is_empty():
		return ["tools_tiers has no tiers"]
	var found: Array[String] = []
	var previous_share := NO_UPGRADE_WORK_SHARE
	for index in tools_tiers.size():
		var where := "tools_tiers[%d]" % (index + 1)
		var tier := tools_tiers[index]
		if tier == null:
			found.append("%s is missing" % where)
			continue
		found.append_array(
			_tier_value_problems(where + ".price", tier.price, 1.0, MOST_TIER_PRICE, true)
		)
		found.append_array(
			_tier_value_problems(
				where + ".quota_rise", tier.quota_rise, 1.0, MOST_TIER_QUOTA_RISE, true
			)
		)
		var share_problems := _tier_value_problems(
			where + ".work_share", tier.work_share, LEAST_WORK_SHARE, previous_share, false
		)
		found.append_array(share_problems)
		if share_problems.is_empty():
			previous_share = tier.work_share
	return found


## One tier value checked as the flat values are: missing, out of range, or not whole.
func _tier_value_problems(
	field: String, value: float, lowest: float, highest: float, whole: bool
) -> Array[String]:
	if is_nan(value):
		return ["%s is missing from the tuning table" % field]
	if value < lowest or value > highest:
		return [
			"%s is %s, but it must be at least %s and at most %s" % [field, value, lowest, highest]
		]
	if whole and value != roundf(value):
		return ["%s is %s, but it must be a whole number" % [field, value]]
	return []
