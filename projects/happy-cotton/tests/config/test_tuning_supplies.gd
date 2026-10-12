extends GutTest
## Tuning validation for supplies: Fertiliser's prices and growth factor, and the most held.


func test_the_fast_table_is_good() -> void:
	assert_eq(FastTuning.table().problems(), [] as Array[String])


func test_fertiliser_prices_must_be_whole_numbers_of_at_least_one() -> void:
	var tuning := FastTuning.table()
	tuning.fertiliser_first_price = 0.0
	tuning.fertiliser_price_rise = 1.5

	assert_eq(
		tuning.problems(),
		(
			[
				"fertiliser_first_price is 0.0, but it must be between 1.0 and 1000000.0",
				"fertiliser_price_rise is 1.5, but it must be a whole number",
			]
			as Array[String]
		)
	)


func test_the_growth_factor_must_speed_growth_up() -> void:
	var tuning := FastTuning.table()
	tuning.fertiliser_growth_factor = 1.0

	assert_eq(
		tuning.problems(),
		["fertiliser_growth_factor is 1.0, but it must be more than 1"] as Array[String]
	)


func test_the_growth_factor_has_a_ceiling() -> void:
	var tuning := FastTuning.table()
	tuning.fertiliser_growth_factor = 20.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "fertiliser_growth_factor")


func test_the_most_held_must_be_a_whole_number_of_at_least_one() -> void:
	var tuning := FastTuning.table()
	tuning.most_supplies_held = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "most_supplies_held")


func test_a_missing_supply_value_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.fertiliser_growth_factor = NAN

	assert_has(tuning.problems(), "fertiliser_growth_factor is missing from the tuning table")
