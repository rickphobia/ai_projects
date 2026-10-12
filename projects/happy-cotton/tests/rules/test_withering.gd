extends GutTest
## Withering and Negligence, through the Farm's public interface: ripe cotton left unpicked for
## the wither time, counted outside Study Sessions, online or offline, Withers. Each Withered
## plot is logged as Negligence: Labour Points are docked (never below zero) and a Study
## Session starts that is longer than one for a missed Quota. A Withered plot must be cleared
## before it can be planted again.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.withering_table())
	_farm.take_messages()


func _stage(index: int) -> PlotView.Stage:
	return _farm.plot(index).stage


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


## Seconds offline that ripen a crop planted just now.
func _offline_ripen_seconds() -> float:
	return FastTuning.GROW_SECONDS / FastTuning.OFFLINE_GROWTH_RATE


## Plants the given plots and runs the Worker on the Generator until they are ripe.
func _ripen_online(indexes: Array[int]) -> void:
	for index in indexes:
		_farm.plant(index)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)


func test_ripe_cotton_withers_offline_at_exactly_the_wither_time_and_not_before() -> void:
	_farm.plant(0)
	_farm.resume_offline(_offline_ripen_seconds())

	_farm.resume_offline(FastTuning.WITHER_SECONDS - 1.0)
	assert_eq(_stage(0), PlotView.Stage.RIPE, "not Withered a second early")

	_farm.resume_offline(1.0)
	assert_eq(_stage(0), PlotView.Stage.WITHERED)
	assert_eq(_farm.plot(0).seconds_left, 0.0)


func test_ripe_cotton_withers_online_even_off_the_generator() -> void:
	_ripen_online([0])
	_farm.plant(1)
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD)

	_farm.advance(FastTuning.WITHER_SECONDS - 1.0)
	assert_eq(_stage(0), PlotView.Stage.RIPE)

	_farm.advance(1.0)
	assert_eq(_stage(0), PlotView.Stage.WITHERED)
	assert_eq(_stage(1), PlotView.Stage.SEEDLING, "the plot that never ripened stays as it was")


func test_one_long_step_withers_at_the_wither_time_and_serves_the_rest_as_study() -> void:
	_farm.plant(0)
	_farm.run_generator()

	_farm.advance(FastTuning.GROW_SECONDS + FastTuning.WITHER_SECONDS + 10.0)

	assert_eq(_stage(0), PlotView.Stage.WITHERED)
	assert_eq(
		_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS - 10.0
	)


func test_cotton_ripening_partway_through_an_absence_withers_from_when_it_ripened() -> void:
	_farm.plant(0)

	_farm.resume_offline(_offline_ripen_seconds() + FastTuning.WITHER_SECONDS - 1.0)
	assert_eq(_stage(0), PlotView.Stage.RIPE)

	_farm.resume_offline(1.0)
	assert_eq(_stage(0), PlotView.Stage.WITHERED)


## A short Shift and a long first Study Session, so ripe cotton sits through one that is
## longer than what is left of its wither time.
func _farm_with_ripe_cotton_in_a_study_session() -> Farm:
	var tuning := FastTuning.withering_table()
	tuning.shift_seconds = 10.0
	tuning.study_session_seconds = 45.0
	var farm := Farm.new(tuning)
	farm.plant(0)
	farm.resume_offline(_offline_ripen_seconds())
	farm.advance(10.0)
	assert_true(farm.in_study_session(), "the Quota was missed")
	return farm


func test_nothing_withers_during_an_online_study_session() -> void:
	var farm := _farm_with_ripe_cotton_in_a_study_session()

	farm.advance(45.0)
	assert_false(farm.in_study_session())
	assert_eq(farm.plot(0).stage, PlotView.Stage.RIPE)

	farm.resume_offline(FastTuning.WITHER_SECONDS - 10.0 - 1.0)
	assert_eq(farm.plot(0).stage, PlotView.Stage.RIPE)
	farm.resume_offline(1.0)
	assert_eq(farm.plot(0).stage, PlotView.Stage.WITHERED, "10 s before the session, 40 after")


func test_nothing_withers_during_a_study_session_served_offline() -> void:
	var farm := _farm_with_ripe_cotton_in_a_study_session()

	farm.resume_offline(45.0 + FastTuning.WITHER_SECONDS - 10.0 - 1.0)
	assert_eq(farm.plot(0).stage, PlotView.Stage.RIPE)

	farm.resume_offline(1.0)
	assert_eq(farm.plot(0).stage, PlotView.Stage.WITHERED)


func test_negligence_docks_labour_points_for_a_withered_plot() -> void:
	_ripen_online([0, 1, 2])
	_farm.pick(1)
	_farm.pick(2)
	var earned := 2 * FastTuning.LABOUR_POINTS_PER_PICK

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	assert_eq(_farm.labour_points(), earned - FastTuning.NEGLIGENCE_LABOUR_POINTS)


func test_negligence_docks_labour_points_for_each_withered_plot() -> void:
	var tuning := FastTuning.withering_table()
	tuning.negligence_labour_points = 3
	_farm = Farm.new(tuning)
	_ripen_online([0, 1, 2, 3])
	_farm.pick(2)
	_farm.pick(3)

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	assert_eq(_farm.labour_points(), 2 * FastTuning.LABOUR_POINTS_PER_PICK - 2 * 3)


func test_negligence_never_docks_labour_points_below_zero() -> void:
	_ripen_online([0, 1])
	_farm.pick(1)

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	assert_eq(_farm.labour_points(), 0)


func test_negligence_starts_a_study_session_longer_than_one_for_a_missed_quota() -> void:
	_ripen_online([0])
	_farm.take_messages()

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	assert_true(_farm.in_study_session())
	assert_eq(_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS)
	assert_gt(_farm.study_session_seconds_left(), FastTuning.STUDY_SESSION_CAP_SECONDS)
	var started := _message(Farm.STUDY_SESSION_STARTED, _farm.take_messages())
	assert_not_null(started)
	var minutes: int = started.values["minutes"]
	assert_eq(minutes, ceili(FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS / 60.0))


func test_negligence_is_logged_with_the_plots_and_points_docked() -> void:
	_ripen_online([0, 1, 2])
	_farm.pick(2)
	_farm.take_messages()

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	var keys: Array[StringName] = []
	var messages := _farm.take_messages()
	for message in messages:
		keys.append(message.key)
	assert_eq(
		keys,
		[Farm.NEGLIGENCE_LOGGED, Farm.STUDY_SESSION_STARTED, Farm.AWAY_SUMMARY] as Array[StringName]
	)
	var logged := _message(Farm.NEGLIGENCE_LOGGED, messages)
	assert_eq(logged.values, {"plots": 2, "points": FastTuning.LABOUR_POINTS_PER_PICK})


func test_plots_withering_together_start_one_study_session() -> void:
	_ripen_online([0, 1, 2])

	_farm.resume_offline(FastTuning.WITHER_SECONDS + 1.0)

	assert_eq(_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS - 1.0)


func test_the_away_summary_counts_withered_plots_and_what_ripened_before_withering() -> void:
	_farm.plant(0)

	var report := _farm.resume_offline(_offline_ripen_seconds() + FastTuning.WITHER_SECONDS)

	assert_eq(report.ripened, 1)
	assert_eq(report.withered, 1)
	var summary := _message(Farm.AWAY_SUMMARY, _farm.take_messages())
	var ripened: int = summary.values["ripened"]
	var withered: int = summary.values["withered"]
	assert_eq(ripened, 1)
	assert_eq(withered, 1)


func test_a_withered_plot_cannot_be_planted_or_picked() -> void:
	_ripen_online([0])
	_farm.resume_offline(FastTuning.WITHER_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())

	var planted := _farm.plant(0)
	var picked := _farm.pick(0)

	assert_false(planted.happened)
	assert_eq(planted.reason, Farm.WITHERED)
	assert_false(picked.happened)
	assert_eq(picked.reason, Farm.WITHERED)
	assert_eq(_farm.labour_points(), 0, "nothing earned for a Withered plot")


func test_clearing_a_withered_plot_empties_it_for_planting() -> void:
	_ripen_online([0])
	_farm.resume_offline(FastTuning.WITHER_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())
	_farm.run_generator()

	var result := _farm.clear(0)

	assert_true(result.happened)
	assert_eq(_stage(0), PlotView.Stage.EMPTY)
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD, "clearing is field work")
	assert_true(_farm.plant(0).happened)


func test_clearing_is_refused_during_the_negligence_study_session() -> void:
	_ripen_online([0])
	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	var result := _farm.clear(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)
	assert_eq(_stage(0), PlotView.Stage.WITHERED)


func test_clearing_a_plot_that_has_not_withered_is_refused() -> void:
	_ripen_online([0])

	assert_eq(_farm.clear(0).reason, Farm.NOT_WITHERED, "ripe")
	assert_eq(_farm.clear(1).reason, Farm.NOT_WITHERED, "empty")
	assert_eq(_farm.clear(PLOTS).reason, Farm.NO_SUCH_PLOT)
	assert_eq(_stage(0), PlotView.Stage.RIPE)
