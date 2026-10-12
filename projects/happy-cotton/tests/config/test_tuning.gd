extends GutTest
## The tuning table must stop the game with a message that names the bad field.

const SHIPPED_TABLE := "res://data/tuning.tres"


func _good_table() -> Tuning:
	return FastTuning.table()


func test_a_complete_table_has_no_problems() -> void:
	assert_eq(_good_table().problems(), [] as Array[String])


func test_a_missing_value_is_reported_by_field_name() -> void:
	var tuning := _good_table()
	tuning.grow_seconds = NAN

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "grow_seconds")
	assert_string_contains(problems[0], "missing")


func test_a_value_that_is_too_high_is_reported_with_the_value() -> void:
	var tuning := _good_table()
	tuning.grow_seconds = 999999.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "grow_seconds")
	assert_string_contains(problems[0], "999999")


func test_a_value_that_is_too_low_is_reported_by_field_name() -> void:
	var tuning := _good_table()
	tuning.grow_seconds = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "grow_seconds")


func test_a_count_that_is_not_a_whole_number_is_reported() -> void:
	var tuning := _good_table()
	tuning.first_quota = 2.5

	var expected: Array[String] = ["first_quota is 2.5, but it must be a whole number"]
	assert_eq(tuning.problems(), expected)


func test_rent_must_be_whole_but_electricity_per_lap_can_be_a_fraction() -> void:
	var tuning := _good_table()
	tuning.electricity_per_lap = 0.5
	tuning.rent_per_shift = 2.5

	var expected: Array[String] = ["rent_per_shift is 2.5, but it must be a whole number"]
	assert_eq(tuning.problems(), expected)


func test_a_bill_below_zero_is_reported() -> void:
	var tuning := _good_table()
	tuning.rent_per_shift = -1.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "rent_per_shift")


func test_school_fees_and_their_interval_must_be_whole() -> void:
	var tuning := _good_table()
	tuning.school_fees = 12.5
	tuning.school_fees_every_shifts = 2.5

	var expected: Array[String] = [
		"school_fees is 12.5, but it must be a whole number",
		"school_fees_every_shifts is 2.5, but it must be a whole number",
	]
	assert_eq(tuning.problems(), expected)


func test_school_fees_must_come_at_least_every_shift() -> void:
	var tuning := _good_table()
	tuning.school_fees_every_shifts = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "school_fees_every_shifts")


func test_letters_must_come_a_whole_number_of_shifts_apart() -> void:
	var tuning := _good_table()
	tuning.letter_every_shifts = 1.5

	assert_eq(
		tuning.problems(),
		["letter_every_shifts is 1.5, but it must be a whole number"] as Array[String]
	)


func test_letters_must_come_at_least_every_shift() -> void:
	var tuning := _good_table()
	tuning.letter_every_shifts = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "letter_every_shifts")


func test_a_quota_that_does_not_rise_is_reported() -> void:
	var tuning := _good_table()
	tuning.quota_rise = 0.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "quota_rise")


func test_a_study_session_cap_below_the_first_length_is_reported() -> void:
	var tuning := _good_table()
	tuning.study_session_cap_seconds = tuning.study_session_seconds - 1.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "study_session_cap_seconds")


func test_a_negligence_study_session_no_longer_than_the_missed_quota_cap_is_reported() -> void:
	var tuning := _good_table()
	tuning.negligence_study_session_seconds = tuning.study_session_cap_seconds

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "negligence_study_session_seconds")
	assert_string_contains(problems[0], "longer than study_session_cap_seconds")


func test_a_mistake_threshold_below_the_slow_threshold_is_reported() -> void:
	var tuning := _good_table()
	tuning.mistake_exhaustion = tuning.slow_exhaustion - 1.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "mistake_exhaustion")


func test_fewest_laps_above_the_laps_at_no_exhaustion_is_reported() -> void:
	var tuning := _good_table()
	tuning.fewest_laps_before_breath = tuning.laps_before_breath + 1.0

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "fewest_laps_before_breath")


func test_every_missing_field_is_reported_at_once() -> void:
	# Every flat value, and the Generator's and the tools' tier lists, which are empty.
	assert_eq(Tuning.new().problems().size(), Tuning.LIMITS.size() + 2)


func test_a_file_that_does_not_exist_loads_as_nothing() -> void:
	assert_null(Tuning.load_file("res://data/does_not_exist.tres"))


func test_the_shipped_table_loads_and_has_no_problems() -> void:
	var tuning := Tuning.load_file(SHIPPED_TABLE)

	assert_not_null(tuning)
	assert_eq(tuning.problems(), [] as Array[String])
