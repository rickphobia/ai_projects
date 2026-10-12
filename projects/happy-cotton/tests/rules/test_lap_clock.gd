extends GutTest
## The lap clock, through the Farm's public interface: how far through his current lap the
## Worker is, which the field uses to keep him in step on the track. With the fast table a lap
## takes 10 seconds and he runs 10 laps before he stops to breathe for 5.

const PLOTS := FastTuning.FIRST_PLOTS
const RUN_SECONDS := FastTuning.LAP_SECONDS * FastTuning.LAPS_BEFORE_BREATH

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.table())


func test_the_lap_clock_shows_how_far_through_his_lap_he_is() -> void:
	assert_eq(_farm.worker().lap_progress, 0.0)
	_farm.run_generator()

	_farm.advance(FastTuning.LAP_SECONDS * 2.25)

	assert_almost_eq(_farm.worker().lap_progress, 0.25, 0.0001)


func test_the_lap_clock_waits_at_the_lap_line_while_he_breathes() -> void:
	var tuning := FastTuning.table()
	tuning.shift_seconds = 1000.0
	_farm = Farm.new(tuning)
	_farm.run_generator()

	_farm.advance(RUN_SECONDS + 1.0)

	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)
	assert_eq(_farm.worker().lap_progress, 0.0)


func test_the_lap_clock_carries_over_when_he_leaves_the_generator() -> void:
	_farm.run_generator()
	_farm.advance(FastTuning.LAP_SECONDS * 1.5)
	_farm.plant(0)
	_farm.advance(20.0)

	assert_almost_eq(_farm.worker().lap_progress, 0.5, 0.0001)
