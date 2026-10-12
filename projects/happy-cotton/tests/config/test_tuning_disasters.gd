extends GutTest
## Tuning validation for Disasters: no longer than a quarter of a Shift, the warning and the
## Disaster fitting in one, a Sandstorm slowing growth to no less than half, and a
## Heatwave tiring the Worker no more than twice as fast.


func test_the_fast_table_is_good_with_sandstorms() -> void:
	assert_eq(FastTuning.with_sandstorms(FastTuning.table()).problems(), [] as Array[String])


func test_a_disaster_may_last_exactly_a_quarter_of_a_shift() -> void:
	var tuning := FastTuning.table()
	tuning.disaster_seconds = FastTuning.SHIFT_SECONDS / 4.0

	assert_eq(tuning.problems(), [] as Array[String])


func test_a_disaster_longer_than_a_quarter_of_a_shift_is_rejected() -> void:
	var tuning := FastTuning.table()
	tuning.disaster_seconds = 26.0

	assert_eq(
		tuning.problems(),
		(
			["disaster_seconds is 26.0, but it must be at most a quarter of shift_seconds (25.0)"]
			as Array[String]
		)
	)


func test_the_warning_and_the_disaster_must_fit_in_a_shift() -> void:
	var tuning := FastTuning.table()
	tuning.disaster_warning_seconds = 81.0

	assert_eq(
		tuning.problems(),
		(
			[
				(
					"disaster_warning_seconds plus disaster_seconds is 101.0, but it must be at"
					+ " most shift_seconds (100.0)"
				)
			]
			as Array[String]
		)
	)


func test_a_sandstorm_may_not_slow_growth_below_half() -> void:
	var tuning := FastTuning.table()
	tuning.sandstorm_growth_factor = 0.4

	assert_eq(
		tuning.problems(),
		["sandstorm_growth_factor is 0.4, but it must be between 0.5 and 1.0"] as Array[String]
	)


func test_a_sandstorm_may_not_speed_growth_up() -> void:
	var tuning := FastTuning.table()
	tuning.sandstorm_growth_factor = 1.2

	assert_eq(
		tuning.problems(),
		["sandstorm_growth_factor is 1.2, but it must be between 0.5 and 1.0"] as Array[String]
	)


func test_the_fast_table_is_good_with_heatwaves() -> void:
	assert_eq(FastTuning.with_heatwaves(FastTuning.table()).problems(), [] as Array[String])


func test_a_heatwave_may_not_more_than_double_exhaustion() -> void:
	var tuning := FastTuning.table()
	tuning.heatwave_exhaustion_factor = 2.5

	assert_eq(
		tuning.problems(),
		["heatwave_exhaustion_factor is 2.5, but it must be between 1.0 and 2.0"] as Array[String]
	)


func test_a_heatwave_may_not_ease_exhaustion() -> void:
	var tuning := FastTuning.table()
	tuning.heatwave_exhaustion_factor = 0.9

	assert_eq(
		tuning.problems(),
		["heatwave_exhaustion_factor is 0.9, but it must be between 1.0 and 2.0"] as Array[String]
	)


func test_the_chance_must_be_between_0_and_1() -> void:
	var tuning := FastTuning.table()
	tuning.sandstorm_chance = -0.1

	assert_eq(
		tuning.problems(),
		["sandstorm_chance is -0.1, but it must be between 0.0 and 1.0"] as Array[String]
	)


func test_a_missing_disaster_value_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.disaster_warning_seconds = NAN

	assert_has(tuning.problems(), "disaster_warning_seconds is missing from the tuning table")
