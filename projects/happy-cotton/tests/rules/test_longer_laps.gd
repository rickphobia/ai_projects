extends GutTest
## Longer laps on a bigger Farm, through the Farm's public interface. With the fast table a lap
## of the first 2 × 2 Farm takes 10 seconds and each new column or row adds 5. The Plot bought
## first opens a column (15-second laps), the second fills it, the third opens a row (20).

const LAP := FastTuning.LAP_SECONDS
const LONGER_LAP := FastTuning.LAP_SECONDS + FastTuning.LAP_SECONDS_PER_STRIP

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	tuning.shift_seconds = 1000.0
	var farm := Farm.new(tuning)
	farm.take_messages()
	return farm


func _buy_plots(count: int) -> void:
	for bought in count:
		_farm.debug_add_labour_points(1000)
		assert_true(_farm.buy_plot().happened)


func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_a_lap_of_the_first_farm_takes_lap_seconds() -> void:
	assert_eq(_farm.worker().lap_seconds, LAP)


func test_the_lap_in_progress_keeps_its_length_and_the_next_one_is_longer() -> void:
	_farm.run_generator()
	_farm.advance(LAP * 0.5)

	_buy_plots(1)

	assert_eq(_farm.worker().lap_seconds, LAP, "the lap he is on keeps its length")
	assert_almost_eq(_farm.worker().lap_progress, 0.5, 0.0001)
	_farm.advance(LAP * 0.5)
	assert_eq(_farm.worker().lap_seconds, LONGER_LAP)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH - 1)
	_farm.advance(LONGER_LAP * 0.5)
	assert_almost_eq(_farm.worker().lap_progress, 0.5, 0.0001)


func test_each_new_column_or_row_adds_to_the_lap_but_filling_one_does_not() -> void:
	_farm.run_generator()

	_buy_plots(2)
	_farm.advance(LAP)
	assert_eq(_farm.worker().lap_seconds, LONGER_LAP, "the second Plot fills the same column")

	_buy_plots(1)
	_farm.advance(LONGER_LAP)
	assert_eq(_farm.worker().lap_seconds, LAP + 2 * FastTuning.LAP_SECONDS_PER_STRIP)


func test_running_costs_the_same_exhaustion_a_second_so_a_longer_lap_costs_more() -> void:
	_farm = _new_farm(FastTuning.exhausting_table())
	_buy_plots(1)
	_farm.run_generator()
	_farm.advance(LAP)
	var after_first_lap := _farm.exhaustion()
	assert_almost_eq(after_first_lap, FastTuning.EXHAUSTION_PER_LAP, 0.0001)

	_farm.advance(LONGER_LAP)

	var per_second := FastTuning.EXHAUSTION_PER_LAP / LAP
	assert_almost_eq(_farm.exhaustion() - after_first_lap, per_second * LONGER_LAP, 0.0001)


func test_he_runs_as_many_laps_before_a_breath_on_a_bigger_farm() -> void:
	_buy_plots(1)
	_farm.run_generator()
	var laps := FastTuning.LAPS_BEFORE_BREATH
	var run_seconds := LAP + (laps - 1) * LONGER_LAP

	_farm.advance(run_seconds - 0.5)
	assert_eq(_farm.worker().activity, WorkerView.Activity.RUNNING)
	assert_eq(_farm.worker().laps_left, 1)

	_farm.advance(1.0)
	assert_eq(_farm.worker().activity, WorkerView.Activity.BREATHING)


func test_his_next_run_after_a_breath_starts_at_the_new_length() -> void:
	_farm.run_generator()
	_farm.advance(LAP * FastTuning.LAPS_BEFORE_BREATH - 1.0)
	_buy_plots(1)
	_farm.advance(1.0 + FastTuning.BREATH_SECONDS)

	assert_eq(_farm.worker().activity, WorkerView.Activity.RUNNING)
	assert_eq(_farm.worker().lap_seconds, LONGER_LAP)
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)


func test_a_save_keeps_the_lap_in_progress_and_the_next_length() -> void:
	_farm.run_generator()
	_farm.advance(LAP * 0.5)
	_buy_plots(1)
	var save := _through_json(_farm.to_save())
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(save), [] as Array[String])

	assert_eq(restored.worker().lap_seconds, LAP)
	assert_almost_eq(restored.worker().lap_progress, 0.5, 0.0001)
	restored.run_generator()
	restored.advance(LAP * 0.5)
	assert_eq(restored.worker().lap_seconds, LONGER_LAP)


func test_a_save_from_before_longer_laps_restores_its_run_on_first_farm_laps() -> void:
	_farm.run_generator()
	_farm.advance(LAP * 2.25)
	var save := _through_json(_farm.to_save())
	save["version"] = 8
	OldSaves.before_longer_laps(save)
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(save), [] as Array[String])

	assert_eq(restored.worker().lap_seconds, LAP)
	assert_eq(restored.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH - 2)
	assert_almost_eq(restored.worker().lap_progress, 0.25, 0.0001)
