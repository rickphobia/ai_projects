extends GutTest
## Spreading Fertiliser, through the Farm's public interface: only on a Seedling that isn't
## fertilised, using up one from the stock, with plain refusals; the crop growing faster online
## and offline until it leaves the Plot; and saving which Plots are fertilised. With the fast
## table a crop ripens in 30 seconds of running (each Stage 10), and Fertiliser doubles that
## crop's growth.

const HOLDS := 0.99
const FACTOR := FastTuning.FERTILISER_GROWTH_FACTOR

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return HOLDS)
	farm.take_messages()
	return farm


## Buys `count` Fertiliser with Labour Points given for them.
func _stock_up(count: int) -> void:
	for bought in count:
		_farm.debug_add_labour_points(100)
		_farm.buy_supply(Farm.FERTILISER)
	_farm.take_messages()


func _held() -> int:
	for item in _farm.store():
		if item.id == Farm.FERTILISER:
			return item.held
	return -1


func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_fertiliser_goes_on_a_seedling_and_uses_one_up() -> void:
	_stock_up(2)
	_farm.plant(0)

	var result := _farm.fertilise(0)

	assert_true(result.happened)
	assert_true(_farm.plot(0).fertilised)
	assert_false(_farm.plot(1).fertilised)
	assert_eq(_held(), 1)


func test_with_none_held_it_is_refused() -> void:
	_farm.plant(0)

	var result := _farm.fertilise(0)

	assert_eq(result.reason, Farm.NONE_HELD)
	assert_false(_farm.plot(0).fertilised)


func test_an_empty_plot_is_the_wrong_stage() -> void:
	_stock_up(1)

	var result := _farm.fertilise(0)

	assert_eq(result.reason, Farm.WRONG_STAGE)
	assert_eq(_held(), 1)


func test_a_crop_past_its_seedling_stage_is_the_wrong_stage() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS / 3.0)

	var result := _farm.fertilise(0)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.FLOWERING)
	assert_eq(result.reason, Farm.WRONG_STAGE)
	assert_eq(_held(), 1)


func test_a_fertilised_seedling_is_refused_a_second_time() -> void:
	_stock_up(2)
	_farm.plant(0)
	_farm.fertilise(0)

	var result := _farm.fertilise(0)

	assert_eq(result.reason, Farm.ALREADY_FERTILISED)
	assert_eq(_held(), 1)


func test_a_plot_that_does_not_exist_is_refused() -> void:
	_stock_up(1)

	var result := _farm.fertilise(FastTuning.FIRST_PLOTS)

	assert_eq(result.reason, Farm.NO_SUCH_PLOT)


func test_fertiliser_cannot_be_spread_in_a_study_session() -> void:
	_stock_up(1)
	_farm.plant(0)
	HandingIn.finish_shift(_farm)

	var result := _farm.fertilise(0)

	assert_true(_farm.in_study_session())
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)


func test_spreading_it_brings_the_worker_back_from_the_generator() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.run_generator()

	_farm.fertilise(0)

	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD)


func test_a_fertilised_crop_ripens_faster_while_he_runs() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.plant(1)
	_farm.fertilise(0)
	_farm.run_generator()

	_farm.advance(FastTuning.GROW_SECONDS / FACTOR)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_eq(_farm.plot(1).stage, PlotView.Stage.FLOWERING)


func test_it_speeds_only_the_rest_of_the_growth() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(5.0)
	_farm.fertilise(0)
	_farm.run_generator()

	_farm.advance((FastTuning.GROW_SECONDS - 5.0) / FACTOR - 1.0)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.BOLL)
	_farm.advance(1.0)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)


func test_the_time_left_counts_the_faster_growth() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.fertilise(0)

	assert_almost_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS / FACTOR, 0.001)


func test_it_combines_with_the_generator_upgrade() -> void:
	_stock_up(1)
	_farm.debug_add_labour_points(FastTuning.GENERATOR_PRICES[0])
	_farm.buy_upgrade(Farm.GENERATOR)
	_farm.plant(0)
	_farm.fertilise(0)
	_farm.run_generator()

	var multiplier := FastTuning.GENERATOR_MULTIPLIERS[0] * FACTOR
	_farm.advance(FastTuning.GROW_SECONDS / multiplier)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)


func test_a_fertilised_crop_grows_faster_offline_too() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.plant(1)
	_farm.fertilise(0)

	var offline_rate := FastTuning.OFFLINE_GROWTH_RATE * FACTOR
	var report := _farm.resume_offline(FastTuning.GROW_SECONDS / offline_rate)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_eq(_farm.plot(1).stage, PlotView.Stage.FLOWERING)
	assert_eq(report.ripened, 1)


func test_it_ends_when_the_crop_leaves_the_plot() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.fertilise(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS / FACTOR)
	_farm.pick(0)

	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS / FACTOR)

	assert_false(_farm.plot(0).fertilised)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.FLOWERING)


func test_it_ends_when_a_withered_crop_is_cleared() -> void:
	_farm = _new_farm(FastTuning.withering_table())
	_stock_up(1)
	_farm.plant(0)
	_farm.fertilise(0)
	_farm.resume_offline(FastTuning.OFFLINE_CAP_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())

	_farm.clear(0)

	assert_false(_farm.plot(0).fertilised)


func test_a_fertilised_crop_does_not_raise_the_quota() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.fertilise(0)

	HandingIn.finish_shift(_farm)

	assert_eq(_farm.shift().quota, FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE)


func test_fertilised_plots_are_saved() -> void:
	_stock_up(1)
	_farm.plant(1)
	_farm.fertilise(1)
	var restored := _new_farm(FastTuning.table())

	var problems := restored.restore(_through_json(_farm.to_save()))
	_farm = restored

	assert_eq(problems, [] as Array[String])
	assert_true(_farm.plot(1).fertilised)
	assert_false(_farm.plot(0).fertilised)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS / FACTOR)
	assert_eq(_farm.plot(1).stage, PlotView.Stage.RIPE)


func test_a_save_marking_an_empty_plot_fertilised_is_damaged() -> void:
	var save := _farm.to_save()
	save["crops"]["fertilised"][0] = true

	var problems := _farm.restore(_through_json(save))

	assert_has(problems, "crops.fertilised marks a Plot with no crop growing")
