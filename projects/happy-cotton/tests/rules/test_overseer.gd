extends GutTest
## The Overseer at the Generator, through the Farm's public interface: when the Worker stops to
## breathe, the Overseer whistles after a set time and whips after a further set time, and he
## runs again; advance() returns these events. With the fast table he stops after 100 seconds
## of running, the whistle comes 3 seconds later and the whip 2 seconds after that.

const PLOTS := FastTuning.FIRST_PLOTS
const RUN_SECONDS := FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH
const NONE: Array[StringName] = []
const WHISTLE: Array[StringName] = [Farm.OVERSEER_WHISTLE]
const WHIP: Array[StringName] = [Farm.OVERSEER_WHIP]
const WHISTLE_THEN_WHIP: Array[StringName] = [Farm.OVERSEER_WHISTLE, Farm.OVERSEER_WHIP]

var _farm: Farm


func before_each() -> void:
	_farm = _long_shift_farm(FastTuning.table())


## A Farm whose Shift is long enough for several runs and breaths without a Quota check.
func _long_shift_farm(tuning: Tuning) -> Farm:
	tuning.shift_seconds = 1000.0
	return Farm.new(tuning)


## Runs him until he has just stopped to breathe.
func _run_until_breath() -> void:
	_farm.run_generator()
	_farm.advance(RUN_SECONDS)


func test_no_overseer_events_while_he_runs() -> void:
	_farm.run_generator()

	assert_eq(_farm.advance(RUN_SECONDS - 1.0), NONE)


func test_the_overseer_whistles_after_the_set_time() -> void:
	_run_until_breath()

	assert_eq(_farm.advance(FastTuning.WHISTLE_AFTER_SECONDS - 0.5), NONE)
	assert_eq(_farm.advance(0.5), WHISTLE)
	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)


func test_the_overseer_whips_after_a_further_set_time_and_he_runs_again() -> void:
	_run_until_breath()
	_farm.advance(FastTuning.WHISTLE_AFTER_SECONDS)

	assert_eq(_farm.advance(FastTuning.WHIP_AFTER_SECONDS - 0.5), NONE)
	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)
	assert_eq(_farm.advance(0.5), WHIP)
	assert_eq(_farm.worker().activity, WorkerView.Activity.RUNNING)


func test_one_long_step_gives_the_whistle_then_the_whip_in_order() -> void:
	_run_until_breath()

	assert_eq(_farm.advance(FastTuning.BREATH_SECONDS + 1.0), WHISTLE_THEN_WHIP)


func test_the_whip_changes_no_numbers() -> void:
	_farm = _long_shift_farm(FastTuning.exhausting_table())
	_farm.run_generator()
	while _farm.worker().activity != WorkerView.Activity.BREATHING:
		_farm.advance(1.0)
	_farm.advance(FastTuning.BREATH_SECONDS - 0.01)
	var exhaustion_before := _farm.exhaustion()
	var points_before := _farm.labour_points()
	var laps_before := _farm.worker().laps_left

	assert_eq(_farm.advance(0.01), WHIP)
	assert_almost_eq(_farm.exhaustion(), exhaustion_before, 0.0001)
	assert_eq(_farm.labour_points(), points_before)
	assert_eq(_farm.worker().laps_left, laps_before)


func test_off_the_generator_the_overseer_waits_for_his_return() -> void:
	_run_until_breath()
	_farm.plant(0)

	assert_eq(_farm.advance(FastTuning.BREATH_SECONDS * 2.0), NONE)
	_farm.run_generator()
	assert_eq(_farm.advance(FastTuning.BREATH_SECONDS), WHISTLE_THEN_WHIP)


func test_whistle_and_whip_times_come_from_the_tuning_table() -> void:
	var tuning := FastTuning.table()
	tuning.whistle_after_seconds = 7.0
	tuning.whip_after_seconds = 4.0
	_farm = _long_shift_farm(tuning)
	_run_until_breath()

	assert_eq(_farm.advance(6.9), NONE)
	assert_eq(_farm.advance(0.1), WHISTLE)
	assert_eq(_farm.advance(3.9), NONE)
	assert_eq(_farm.advance(0.1), WHIP)
