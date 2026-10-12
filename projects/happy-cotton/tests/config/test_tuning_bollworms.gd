extends GutTest
## Tuning validation for Bollworms: their chance, and eating taking longer than picking off.


func test_the_fast_table_is_good_with_bollworms() -> void:
	assert_eq(FastTuning.with_bollworms(FastTuning.table()).problems(), [] as Array[String])


func test_eating_a_crop_must_take_longer_than_picking_them_off() -> void:
	var tuning := FastTuning.table()
	tuning.bollworm_eat_seconds = FastTuning.BOLLWORM_PICK_OFF_SECONDS

	assert_eq(
		tuning.problems(),
		(
			[
				"bollworm_eat_seconds is 3.0, but it must be longer than bollworm_pick_off_seconds (3.0)"
			]
			as Array[String]
		)
	)


func test_the_chance_must_be_between_0_and_1() -> void:
	var tuning := FastTuning.table()
	tuning.bollworm_chance = 1.5

	assert_eq(
		tuning.problems(),
		["bollworm_chance is 1.5, but it must be between 0.0 and 1.0"] as Array[String]
	)


func test_a_missing_bollworm_value_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.bollworm_check_seconds = NAN

	assert_has(tuning.problems(), "bollworm_check_seconds is missing from the tuning table")
