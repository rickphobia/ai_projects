extends GutTest
## Tuning validation for the call home's price and length.


func _good_table() -> Tuning:
	return FastTuning.table()


func test_a_call_home_must_cost_a_whole_number_of_labour_points() -> void:
	var tuning := _good_table()
	tuning.call_home_price = 2.5

	assert_eq(
		tuning.problems(),
		["call_home_price is 2.5, but it must be a whole number"] as Array[String]
	)


func test_a_call_home_must_last_at_least_a_second() -> void:
	var tuning := _good_table()
	tuning.call_home_seconds = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "call_home_seconds")
