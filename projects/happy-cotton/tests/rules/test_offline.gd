extends GutTest
## Offline time, through the Farm's public interface: while the game is closed or its tab hidden
## crops grow at the slower offline rate (the night shift) with no Generator, a Study Session
## keeps counting down and the Shift waits. Coming back gives an away summary.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.table())
	_farm.take_messages()


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


## Seconds offline that grow a crop as much as `online` seconds of running.
func _offline_for(online: float) -> float:
	return online / FastTuning.OFFLINE_GROWTH_RATE


func test_crops_grow_offline_at_the_offline_rate_without_the_generator() -> void:
	_farm.plant(0)

	_farm.resume_offline(_offline_for(10.0))

	assert_eq(_farm.plot(0).stage, PlotView.Stage.FLOWERING)
	assert_almost_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0, 0.001)


func test_a_crop_ripens_offline_after_the_grow_time_at_the_offline_rate() -> void:
	_farm.plant(0)

	_farm.resume_offline(_offline_for(FastTuning.GROW_SECONDS))

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_true(_farm.pick(0).happened)


func test_the_shift_does_not_move_offline() -> void:
	_farm.advance(30.0)

	_farm.resume_offline(500.0)

	assert_eq(_farm.shift().number, 1)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS - 30.0)


func test_a_study_session_counts_down_offline() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)

	_farm.resume_offline(5.0)

	assert_eq(_farm.study_session_seconds_left(), FastTuning.STUDY_SESSION_SECONDS - 5.0)


func test_a_study_session_can_end_while_away() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	var report := _farm.resume_offline(FastTuning.STUDY_SESSION_SECONDS + 60.0)

	assert_false(_farm.in_study_session())
	assert_eq(report.study_seconds_served, FastTuning.STUDY_SESSION_SECONDS)
	var messages := _farm.take_messages()
	assert_not_null(_message(Farm.STUDY_SESSION_ENDED, messages))
	assert_true(_farm.plant(0).happened, "the Worker is back on the field")
	assert_eq(_farm.shift().number, 2, "the next Shift still waits")
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS)


func test_the_worker_stays_where_he_was_offline() -> void:
	_farm.run_generator()

	_farm.resume_offline(500.0)

	assert_eq(_farm.worker().activity, WorkerView.Activity.RUNNING)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)


func test_coming_back_gives_an_away_summary_of_what_ripened() -> void:
	_farm.plant(0)
	_farm.plant(1)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.plant(2)
	_farm.take_messages()

	_farm.resume_offline(_offline_for(FastTuning.GROW_SECONDS))

	var summary := _message(Farm.AWAY_SUMMARY, _farm.take_messages())
	assert_not_null(summary)
	var away_minutes := ceili(_offline_for(FastTuning.GROW_SECONDS) / 60.0)
	assert_eq(
		summary.values,
		{
			"minutes": away_minutes,
			"ripened": 1,
			"withered": 0,
			"study_minutes": 0,
			"exhaustion_recovered": 0,
		},
		"plots 0 and 1 were already ripe; only plot 2 ripened while away"
	)


func test_the_away_summary_lists_study_session_time_served() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	_farm.resume_offline(5.0)

	var summary := _message(Farm.AWAY_SUMMARY, _farm.take_messages())
	var study_minutes: int = summary.values["study_minutes"]
	var ripened: int = summary.values["ripened"]
	assert_eq(study_minutes, 1, "rounded up to whole minutes")
	assert_eq(ripened, 0)


func test_the_away_summary_comes_after_a_study_session_that_ended_while_away() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	_farm.resume_offline(120.0)

	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	assert_eq(keys, [Farm.STUDY_SESSION_ENDED, Farm.AWAY_SUMMARY] as Array[StringName])


func test_the_report_says_how_long_was_counted_and_what_ripened() -> void:
	_farm.plant(0)

	var report := _farm.resume_offline(_offline_for(FastTuning.GROW_SECONDS))

	assert_eq(report.seconds_away, _offline_for(FastTuning.GROW_SECONDS))
	assert_eq(report.seconds_counted, _offline_for(FastTuning.GROW_SECONDS))
	assert_eq(report.ripened, 1)
	assert_eq(report.clock_problem, &"")


func test_negative_offline_time_counts_as_zero() -> void:
	_farm.plant(0)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()
	var study_left := _farm.study_session_seconds_left()

	var report := _farm.resume_offline(-3600.0)

	assert_eq(report.seconds_counted, 0.0)
	assert_eq(report.clock_problem, Farm.NEGATIVE_OFFLINE_TIME)
	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS)
	assert_eq(_farm.study_session_seconds_left(), study_left)
	assert_eq(_farm.take_messages(), [] as Array[AppMessage], "nothing happened, so no summary")


func test_offline_time_is_capped_at_the_tuning_maximum() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	var report := _farm.resume_offline(FastTuning.OFFLINE_CAP_SECONDS * 50.0)

	assert_eq(report.seconds_away, FastTuning.OFFLINE_CAP_SECONDS * 50.0)
	assert_eq(report.seconds_counted, FastTuning.OFFLINE_CAP_SECONDS)
	assert_eq(report.clock_problem, Farm.OFFLINE_TIME_CAPPED)
	var summary := _message(Farm.AWAY_SUMMARY, _farm.take_messages())
	var minutes: int = summary.values["minutes"]
	assert_eq(minutes, ceili(FastTuning.OFFLINE_CAP_SECONDS / 60.0))


func test_the_offline_cap_limits_growth_too() -> void:
	var tuning := FastTuning.table()
	tuning.offline_cap_seconds = _offline_for(10.0)
	var farm := Farm.new(tuning)
	farm.plant(0)

	farm.resume_offline(100000.0)

	assert_almost_eq(farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0, 0.001)


## A Farm where work adds Exhaustion, with `plants` plots planted (10 Exhaustion each).
func _tired_farm(plants: int) -> Farm:
	var farm := Farm.new(FastTuning.exhausting_table())
	for index in plants:
		farm.plant(index)
	farm.take_messages()
	return farm


func test_exhaustion_recovers_offline_at_the_tuning_rate() -> void:
	var farm := _tired_farm(4)

	var report := farm.resume_offline(1000.0)

	# 36 an hour is 10 in 1000 seconds.
	assert_almost_eq(farm.exhaustion(), 30.0, 0.001)
	assert_almost_eq(report.exhaustion_recovered, 10.0, 0.001)


func test_offline_recovery_never_goes_below_the_floor() -> void:
	var farm := _tired_farm(1)
	# The Shift's end raises the floor to 5; its missed Quota's Study Session is served away.
	farm.advance(FastTuning.SHIFT_SECONDS)

	var report := farm.resume_offline(1000.0)

	assert_eq(farm.exhaustion(), FastTuning.EXHAUSTION_FLOOR_RISE)
	assert_almost_eq(report.exhaustion_recovered, 5.0, 0.001)


func test_the_away_summary_says_how_much_exhaustion_recovered() -> void:
	var farm := _tired_farm(4)

	farm.resume_offline(1000.0)

	var summary := _message(Farm.AWAY_SUMMARY, farm.take_messages())
	var recovered: int = summary.values["exhaustion_recovered"]
	assert_eq(recovered, 10)


func test_a_rest_waits_offline_like_the_shift() -> void:
	var farm := _tired_farm(0)
	farm.plant(0)
	farm.plant(1)
	farm.run_generator()
	farm.advance(FastTuning.GROW_SECONDS)
	farm.pick(0)
	farm.pick(1)
	farm.buy_privilege(Farm.REST_HOUR)

	farm.resume_offline(100.0)

	assert_eq(farm.rest_hour().seconds_left, FastTuning.REST_HOUR_SECONDS)
	assert_eq(farm.worker().activity, WorkerView.Activity.RESTING)
