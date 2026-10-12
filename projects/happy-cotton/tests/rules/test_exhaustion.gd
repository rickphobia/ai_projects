extends GutTest
## Exhaustion, through the Farm's public interface: plant, pick and running on the Generator
## wear the Worker down; above one threshold his field work is slow, above a higher one a pick
## can drop its cotton, and he manages fewer laps before he stops to breathe. Its floor rises at
## the end of every Shift. With the exhausting test table each plant and pick adds 10 and each
## lap 1; work above 50 takes 2 seconds and a pick above 80 drops its cotton when the roll comes
## up under 0.5. The test sets the roll, so nothing here is left to chance.

const PLOTS := 12
## Long enough for a run and a breath without a Quota check in the way.
const SHIFT_SECONDS := 1000.0
## Rolls that always drop cotton (when Exhaustion allows it), and never do.
const DROPS := 0.0
const HOLDS := 0.99

var _farm: Farm
var _roll := HOLDS


func before_each() -> void:
	_roll = HOLDS
	var tuning := FastTuning.exhausting_table()
	tuning.shift_seconds = SHIFT_SECONDS
	_farm = Farm.new(FastTuning.with_land(tuning, 4, 3), func() -> float: return _roll)
	_farm.take_messages()


## Plants plot after plot until Exhaustion reaches `level`, waiting out each slow action.
## Returns the next plot left empty.
func _plant_until(level: float) -> int:
	var index := 0
	while _farm.exhaustion() < level:
		assert_true(_farm.plant(index).happened, "plant %d" % index)
		HandingIn.advance(_farm, FastTuning.SLOW_ACTION_SECONDS)
		index += 1
	return index


## Grows every planted plot to ripe on the Generator, and brings the Worker back.
func _ripen_all() -> void:
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.GROW_SECONDS)


func _keys() -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	return keys


func test_the_worker_starts_rested() -> void:
	assert_eq(_farm.exhaustion(), 0.0)
	assert_eq(_farm.exhaustion_floor(), 0.0)
	assert_eq(_farm.worker().exhaustion, 0.0)


func test_planting_and_picking_add_exhaustion() -> void:
	_farm.plant(0)
	assert_eq(_farm.exhaustion(), FastTuning.EXHAUSTION_PER_PLANT)

	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.GROW_SECONDS)
	var after_running := _farm.exhaustion()
	_farm.pick(0)

	assert_eq(_farm.exhaustion(), after_running + FastTuning.EXHAUSTION_PER_PICK)


func test_a_refused_command_adds_no_exhaustion() -> void:
	_farm.pick(0)

	assert_eq(_farm.exhaustion(), 0.0)


func test_running_adds_exhaustion_lap_by_lap() -> void:
	_farm.run_generator()

	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * 3)

	assert_almost_eq(_farm.exhaustion(), FastTuning.EXHAUSTION_PER_LAP * 3, 0.001)


func test_breathing_and_standing_in_the_field_add_none() -> void:
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH)
	var at_breath := _farm.exhaustion()

	HandingIn.advance(_farm, FastTuning.BREATH_SECONDS / 2.0)
	assert_eq(_farm.exhaustion(), at_breath)
	_farm.plant(0)
	var after_plant := _farm.exhaustion()
	HandingIn.advance(_farm, 30.0)

	assert_eq(_farm.exhaustion(), after_plant)


func test_exhaustion_never_passes_its_most() -> void:
	_plant_until(Exhaustion.MOST)

	assert_eq(_farm.exhaustion(), Exhaustion.MOST)


func test_at_the_slow_threshold_field_work_is_still_instant() -> void:
	var next := _plant_until(FastTuning.SLOW_EXHAUSTION)

	assert_true(_farm.plant(next).happened)
	assert_true(_farm.plant(next + 1).happened)


func test_above_the_slow_threshold_field_work_takes_longer() -> void:
	var next := _plant_until(FastTuning.SLOW_EXHAUSTION + 1.0)
	_farm.plant(next)

	var too_soon := _farm.plant(next + 1)
	HandingIn.advance(_farm, FastTuning.SLOW_ACTION_SECONDS - 0.5)
	var still_too_soon := _farm.plant(next + 1)
	HandingIn.advance(_farm, 0.5)
	var in_time := _farm.plant(next + 1)

	assert_eq(too_soon.reason, Farm.WORKER_BUSY)
	assert_eq(still_too_soon.reason, Farm.WORKER_BUSY)
	assert_true(in_time.happened)


func test_a_look_at_a_growing_plot_is_not_held_up_by_slow_work() -> void:
	var next := _plant_until(FastTuning.SLOW_EXHAUSTION + 1.0)
	_farm.plant(next)

	assert_eq(_farm.pick(0).reason, Farm.NOT_RIPE)


func test_above_the_mistake_threshold_a_pick_can_drop_its_cotton() -> void:
	_plant_until(FastTuning.MISTAKE_EXHAUSTION + 1.0)
	_ripen_all()
	_farm.take_messages()
	_roll = DROPS

	var result := _farm.pick(0)

	assert_true(result.happened)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.EMPTY)
	assert_eq(_farm.shift().picked, 0)
	assert_eq(_farm.labour_points(), 0)
	assert_has(_keys(), Farm.COTTON_DROPPED)


func test_above_the_mistake_threshold_a_lucky_pick_still_counts() -> void:
	_plant_until(FastTuning.MISTAKE_EXHAUSTION + 1.0)
	_ripen_all()
	_farm.take_messages()
	_roll = FastTuning.DROPPED_COTTON_CHANCE

	_farm.pick(0)

	assert_eq(_farm.shift().picked, 1)
	assert_does_not_have(_keys(), Farm.COTTON_DROPPED)
	HandingIn.finish_shift(_farm)
	assert_eq(_farm.labour_points(), FastTuning.LABOUR_POINTS_PER_PICK, "paid at the Hand-in")


func test_below_the_mistake_threshold_no_cotton_is_dropped() -> void:
	_farm.plant(0)
	_ripen_all()
	_roll = DROPS

	_farm.pick(0)

	assert_eq(_farm.shift().picked, 1)


func test_the_floor_rises_at_the_end_of_every_shift() -> void:
	HandingIn.advance(_farm, SHIFT_SECONDS)
	assert_eq(_farm.exhaustion_floor(), FastTuning.EXHAUSTION_FLOOR_RISE)

	# The missed Quota's Study Session, then the second Shift.
	HandingIn.advance(_farm, FastTuning.STUDY_SESSION_SECONDS + SHIFT_SECONDS)

	assert_eq(_farm.exhaustion_floor(), FastTuning.EXHAUSTION_FLOOR_RISE * 2)


func test_the_floor_lifts_exhaustion_that_is_below_it() -> void:
	HandingIn.advance(_farm, SHIFT_SECONDS)

	assert_eq(_farm.exhaustion(), FastTuning.EXHAUSTION_FLOOR_RISE)


func test_the_floor_leaves_exhaustion_above_it_alone() -> void:
	_farm.plant(0)

	HandingIn.advance(_farm, SHIFT_SECONDS)

	assert_eq(_farm.exhaustion(), FastTuning.EXHAUSTION_PER_PLANT)


func test_he_manages_fewer_laps_as_exhaustion_rises() -> void:
	# 50 from planting, then a full first run of 10 laps adds 10: 60 when he stops to breathe.
	_plant_until(50.0)
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH)
	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)

	# 10 laps at no Exhaustion, 2 at the most: 60 leaves 10 - 8 * 0.6 = 5.2, so 5.
	assert_eq(_farm.worker().laps_left, 5)
	HandingIn.advance(_farm, FastTuning.BREATH_SECONDS + FastTuning.LAP_SECONDS * 5)
	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)


func test_fully_exhausted_he_still_runs_the_fewest_laps() -> void:
	_plant_until(Exhaustion.MOST)
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH)

	assert_eq(_farm.worker().laps_left, FastTuning.FEWEST_LAPS_BEFORE_BREATH)
