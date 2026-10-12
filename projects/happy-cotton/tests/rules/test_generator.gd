extends GutTest
## The Generator and Toil, through the Farm's public interface: crops grow only while the
## Worker runs, and after a set number of laps he stops to breathe. Time moves only when the
## test calls advance. With the fast table a lap takes 10 seconds and he runs 10 laps (100
## seconds) before he stops to breathe for 5.

const PLOTS := FastTuning.FIRST_PLOTS
const RUN_SECONDS := FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.table())


## A Farm whose Shift is long enough for several runs and breaths without a Quota check.
func _long_shift_farm() -> Farm:
	var tuning := FastTuning.table()
	tuning.shift_seconds = 1000.0
	return Farm.new(tuning)


func _activity() -> WorkerView.Activity:
	return _farm.worker().activity


func test_the_worker_starts_in_the_field() -> void:
	assert_eq(_activity(), WorkerView.Activity.IN_FIELD)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)


func test_sending_him_to_the_generator_sets_him_running() -> void:
	var result := _farm.run_generator()

	assert_true(result.happened)
	assert_eq(_activity(), WorkerView.Activity.RUNNING)


func test_crops_do_not_grow_while_he_is_in_the_field() -> void:
	_farm.plant(0)

	HandingIn.advance(_farm, 20.0)

	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS)


func test_crops_grow_while_he_runs() -> void:
	_farm.plant(0)
	_farm.run_generator()

	HandingIn.advance(_farm, 20.0)

	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 20.0)


func test_planting_brings_him_back_to_the_field_and_halts_growth() -> void:
	_farm.plant(0)
	_farm.run_generator()
	HandingIn.advance(_farm, 10.0)

	assert_true(_farm.plant(1).happened)

	assert_eq(_activity(), WorkerView.Activity.IN_FIELD)
	HandingIn.advance(_farm, 10.0)
	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0)


func test_picking_brings_him_back_to_the_field() -> void:
	_farm.plant(0)
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.GROW_SECONDS)

	assert_true(_farm.pick(0).happened)

	assert_eq(_activity(), WorkerView.Activity.IN_FIELD)


func test_a_refused_command_leaves_him_running() -> void:
	_farm.plant(0)
	_farm.run_generator()

	assert_false(_farm.pick(0).happened)

	assert_eq(_activity(), WorkerView.Activity.RUNNING)


func test_each_lap_brings_him_closer_to_stopping() -> void:
	_farm.run_generator()

	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * 3 + 1.0)

	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH - 3)


func test_after_the_set_laps_he_stops_to_breathe_and_growth_halts() -> void:
	_farm = _long_shift_farm()
	_farm.plant(0)
	_farm.run_generator()
	HandingIn.advance(_farm, RUN_SECONDS - FastTuning.GROW_SECONDS + 10.0)
	_farm.plant(1)
	_farm.run_generator()

	HandingIn.advance(_farm, FastTuning.GROW_SECONDS - 11.0)
	assert_eq(_activity(), WorkerView.Activity.RUNNING, "not a second early")
	HandingIn.advance(_farm, 1.0)
	assert_eq(_activity(), WorkerView.Activity.BREATHING)

	HandingIn.advance(_farm, FastTuning.BREATH_SECONDS - 1.0)
	assert_eq(_farm.plot(1).seconds_left, 10.0, "no growth while he breathes")
	assert_eq(_activity(), WorkerView.Activity.BREATHING)


func test_after_his_breath_he_runs_again_and_crops_grow_again() -> void:
	_farm = _long_shift_farm()
	_farm.plant(0)
	_farm.run_generator()
	HandingIn.advance(_farm, RUN_SECONDS - 10.0)
	_farm.plant(1)
	_farm.run_generator()
	HandingIn.advance(_farm, 10.0 + FastTuning.BREATH_SECONDS)

	assert_eq(_activity(), WorkerView.Activity.RUNNING)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)
	HandingIn.advance(_farm, 5.0)
	assert_eq(_farm.plot(1).seconds_left, FastTuning.GROW_SECONDS - 15.0)


func test_leaving_the_generator_does_not_rest_him() -> void:
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * 4)
	_farm.plant(0)
	HandingIn.advance(_farm, 20.0)

	_farm.run_generator()

	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH - 4)


func test_one_long_step_covers_runs_and_breaths_in_turn() -> void:
	_farm = _long_shift_farm()
	_farm.plant(0)
	_farm.run_generator()

	# Two full runs and two breaths, then 5 seconds into the third run.
	HandingIn.advance(_farm, (RUN_SECONDS + FastTuning.BREATH_SECONDS) * 2 + 5.0)

	assert_eq(_activity(), WorkerView.Activity.RUNNING)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)


func test_the_shift_counts_down_whatever_he_is_doing() -> void:
	_farm = _long_shift_farm()
	HandingIn.advance(_farm, 10.0)
	_farm.run_generator()

	HandingIn.advance(_farm, RUN_SECONDS + FastTuning.BREATH_SECONDS)

	assert_eq(_farm.shift().seconds_left, 1000.0 - 10.0 - RUN_SECONDS - FastTuning.BREATH_SECONDS)


func test_a_study_session_takes_him_off_the_generator_and_crops_halt() -> void:
	_farm.plant(0)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - 20.0)
	_farm.run_generator()
	HandingIn.advance(_farm, 20.0)

	assert_true(_farm.in_study_session())
	assert_eq(_activity(), WorkerView.Activity.IN_FIELD)
	HandingIn.advance(_farm, FastTuning.STUDY_SESSION_SECONDS)
	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 20.0)


func test_he_cannot_be_sent_to_the_generator_during_a_study_session() -> void:
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)

	var result := _farm.run_generator()

	assert_false(result.happened)
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)
	assert_eq(_activity(), WorkerView.Activity.IN_FIELD)


func test_sending_him_again_while_he_runs_changes_nothing() -> void:
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS)

	assert_true(_farm.run_generator().happened)

	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH - 1)


func test_laps_and_breath_come_from_the_tuning_table() -> void:
	var tuning := FastTuning.table()
	tuning.lap_seconds = 2.0
	tuning.laps_before_breath = 3.0
	tuning.whistle_after_seconds = 4.0
	tuning.whip_after_seconds = 3.0
	var farm := Farm.new(tuning)
	farm.run_generator()

	HandingIn.advance(farm, 6.0)
	assert_eq(farm.worker().activity, WorkerView.Activity.BREATHING)
	HandingIn.advance(farm, 6.0)
	assert_eq(farm.worker().activity, WorkerView.Activity.BREATHING)
	HandingIn.advance(farm, 1.0)
	assert_eq(farm.worker().activity, WorkerView.Activity.RUNNING)


func test_a_worker_view_does_not_change_when_the_farm_does() -> void:
	var before := _farm.worker()

	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS)

	assert_eq(before.activity, WorkerView.Activity.IN_FIELD)
	assert_eq(before.laps_left, FastTuning.LAPS_BEFORE_BREATH)
