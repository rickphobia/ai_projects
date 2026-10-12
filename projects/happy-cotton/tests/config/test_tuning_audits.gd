extends GutTest
## Tuning validation for Harmony Audits: their chances, the tell, on watch and the caught Study
## Session.


func test_the_fast_table_is_good() -> void:
	assert_eq(FastTuning.table().problems(), [] as Array[String])


func test_an_audit_chance_above_one_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 1.5

	assert_eq(
		tuning.problems(),
		["audit_base_chance is 1.5, but it must be between 0.0 and 1.0"] as Array[String]
	)


func test_a_tolerance_below_zero_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.audit_tolerance = -0.1

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "audit_tolerance")


func test_the_audit_memory_must_be_whole_shifts() -> void:
	var tuning := FastTuning.table()
	tuning.audit_memory_shifts = 2.5

	assert_eq(
		tuning.problems(),
		["audit_memory_shifts is 2.5, but it must be a whole number"] as Array[String]
	)


func test_on_watch_must_be_whole_shifts() -> void:
	var tuning := FastTuning.table()
	tuning.on_watch_shifts = 1.5

	assert_eq(
		tuning.problems(),
		["on_watch_shifts is 1.5, but it must be a whole number"] as Array[String]
	)


func test_on_watch_must_not_lower_the_chance() -> void:
	var tuning := FastTuning.table()
	tuning.on_watch_chance_factor = 0.5

	var problems := tuning.problems()

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "on_watch_chance_factor")


func test_a_caught_study_session_no_longer_than_negligence_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.caught_study_session_seconds = FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS

	assert_eq(
		tuning.problems(),
		(
			[
				(
					"caught_study_session_seconds is 80.0, but it must be longer than"
					+ " negligence_study_session_seconds (80.0)"
				)
			]
			as Array[String]
		)
	)


func test_a_tell_longer_than_a_shift_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.audit_tell_seconds = FastTuning.SHIFT_SECONDS + 1.0

	assert_eq(
		tuning.problems(),
		(
			["audit_tell_seconds is 101.0, but it must be at most shift_seconds (100.0)"]
			as Array[String]
		)
	)


func test_a_missing_audit_value_is_reported() -> void:
	var tuning := FastTuning.table()
	tuning.caught_study_session_seconds = NAN

	assert_has(tuning.problems(), "caught_study_session_seconds is missing from the tuning table")


func test_the_game_table_is_good() -> void:
	var tuning := Tuning.load_file("res://data/tuning.tres")

	assert_eq(tuning.problems(), [] as Array[String])
