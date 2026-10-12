extends GutTest
## Tuning validation for the Farm's first and largest land.


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
