extends GutTest
## Tuning validation for the Farm's first and largest land, the Plots sold to grow it, and the
## hidden savings that cotton kept back off that land sells for.


func _good_table() -> Tuning:
	return FastTuning.table()


func test_land_must_be_whole_plots() -> void:
	var tuning := _good_table()
	tuning.first_land_columns = 1.5

	assert_eq(
		tuning.problems(),
		["first_land_columns is 1.5, but it must be a whole number"] as Array[String]
	)


func test_land_must_be_at_least_one_plot_across_and_deep() -> void:
	var tuning := _good_table()
	tuning.first_land_rows = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "first_land_rows")


func test_a_largest_farm_narrower_than_the_first_is_reported() -> void:
	var tuning := _good_table()
	tuning.largest_land_columns = FastTuning.FIRST_LAND_COLUMNS - 1

	assert_eq(
		tuning.problems(),
		(
			["largest_land_columns is 1, but it must be at least first_land_columns (2)"]
			as Array[String]
		)
	)


func test_a_largest_farm_shallower_than_the_first_is_reported() -> void:
	var tuning := _good_table()
	tuning.largest_land_rows = FastTuning.FIRST_LAND_ROWS - 1

	assert_eq(
		tuning.problems(),
		["largest_land_rows is 1, but it must be at least first_land_rows (2)"] as Array[String]
	)


func test_a_largest_farm_the_same_size_as_the_first_is_allowed() -> void:
	var tuning := FastTuning.with_land(_good_table(), 4, 3)

	assert_eq(tuning.problems(), [] as Array[String])


func test_a_plot_that_adds_as_much_to_the_quota_as_it_yields_is_reported() -> void:
	var tuning := _good_table()
	tuning.plot_yield_per_shift = FastTuning.PLOT_QUOTA_RISE

	assert_eq(
		tuning.problems(),
		["plot_yield_per_shift is 1, but it must be more than plot_quota_rise (1)"] as Array[String]
	)


func test_plot_prices_must_be_whole_labour_points() -> void:
	var tuning := _good_table()
	tuning.plot_price_rise = 2.5

	assert_eq(
		tuning.problems(),
		["plot_price_rise is 2.5, but it must be a whole number"] as Array[String]
	)


func test_a_plot_always_raises_the_quota() -> void:
	var tuning := _good_table()
	tuning.plot_quota_rise = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "plot_quota_rise is 0")


func test_the_first_plot_price_is_required() -> void:
	var tuning := _good_table()
	tuning.first_plot_price = NAN

	assert_has(tuning.problems(), "first_plot_price is missing from the tuning table")


func test_each_plot_costs_more_than_the_last() -> void:
	var tuning := _good_table()
	tuning.plot_price_rise = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "plot_price_rise is 0")


func test_hidden_savings_per_kept_pick_must_be_more_than_labour_points_per_pick() -> void:
	var tuning := _good_table()
	tuning.hidden_savings_per_kept_pick = FastTuning.LABOUR_POINTS_PER_PICK

	assert_eq(
		tuning.problems(),
		(
			[
				(
					"hidden_savings_per_kept_pick is 5, but it must be more than"
					+ " labour_points_per_pick (5)"
				)
			]
			as Array[String]
		)
	)


func test_hidden_savings_per_kept_pick_must_be_whole() -> void:
	var tuning := _good_table()
	tuning.hidden_savings_per_kept_pick = 8.5

	assert_eq(
		tuning.problems(),
		["hidden_savings_per_kept_pick is 8.5, but it must be a whole number"] as Array[String]
	)
