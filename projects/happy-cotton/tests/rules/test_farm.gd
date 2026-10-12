extends GutTest
## The Farm rules through their public interface: plant, grow, look, pick. Crops grow only
## while the Worker runs on the Generator, so the growth tests send him there after planting.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.table())


func _stage(index: int) -> PlotView.Stage:
	return _farm.plot(index).stage


func test_a_new_farm_has_an_empty_plot_in_every_cell_of_its_first_land() -> void:
	assert_eq(_farm.plots().size(), PLOTS)
	for view in _farm.plots():
		assert_eq(view.stage, PlotView.Stage.EMPTY)


func test_planting_an_empty_plot_starts_a_seedling_with_the_full_grow_time_left() -> void:
	var result := _farm.plant(1)

	assert_true(result.happened)
	assert_eq(_stage(1), PlotView.Stage.SEEDLING)
	assert_eq(_farm.plot(1).seconds_left, 30.0)
	assert_eq(_stage(0), PlotView.Stage.EMPTY, "other plots stay empty")


func test_planting_a_planted_plot_is_refused_as_not_empty() -> void:
	_farm.plant(0)

	var result := _farm.plant(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NOT_EMPTY)


func test_cotton_grows_through_each_stage_to_ripe() -> void:
	_farm.plant(0)
	_farm.run_generator()

	_farm.advance(9.0)
	assert_eq(_stage(0), PlotView.Stage.SEEDLING)
	_farm.advance(1.0)
	assert_eq(_stage(0), PlotView.Stage.FLOWERING)
	_farm.advance(10.0)
	assert_eq(_stage(0), PlotView.Stage.BOLL)
	_farm.advance(9.0)
	assert_eq(_stage(0), PlotView.Stage.BOLL, "not ripe a second early")
	assert_eq(_farm.plot(0).seconds_left, 1.0)
	_farm.advance(1.0)
	assert_eq(_stage(0), PlotView.Stage.RIPE)
	assert_eq(_farm.plot(0).seconds_left, 0.0)


func test_ripe_cotton_stays_ripe() -> void:
	_farm.plant(0)
	_farm.run_generator()

	_farm.advance(3600.0)

	assert_eq(_stage(0), PlotView.Stage.RIPE)
	assert_eq(_farm.plot(0).seconds_left, 0.0)


func test_growth_in_small_steps_matches_one_big_step() -> void:
	var stepped := Farm.new(FastTuning.table())
	stepped.plant(0)
	stepped.run_generator()
	_farm.plant(0)
	_farm.run_generator()

	for step in 20:
		stepped.advance(0.5)
	_farm.advance(10.0)

	assert_eq(stepped.plot(0).stage, _stage(0))
	assert_almost_eq(stepped.plot(0).seconds_left, _farm.plot(0).seconds_left, 0.0001)


func test_negative_time_does_not_ungrow_a_plot() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(15.0)

	_farm.advance(-10.0)

	assert_eq(_farm.plot(0).seconds_left, 15.0)


func test_empty_plots_do_not_grow() -> void:
	_farm.advance(100.0)

	assert_eq(_stage(0), PlotView.Stage.EMPTY)
	assert_eq(_farm.plot(0).seconds_left, 0.0)


func test_the_grow_time_comes_from_the_tuning_table() -> void:
	var tuning := FastTuning.table()
	tuning.grow_seconds = 60.0
	var slow := Farm.new(tuning)
	slow.plant(0)
	slow.run_generator()

	slow.advance(30.0)

	assert_eq(slow.plot(0).stage, PlotView.Stage.FLOWERING, "halfway is the middle stage")
	assert_eq(slow.plot(0).seconds_left, 30.0)


func test_picking_a_ripe_plot_clears_it_for_planting_again() -> void:
	_farm.plant(2)
	_farm.run_generator()
	_farm.advance(30.0)

	var result := _farm.pick(2)

	assert_true(result.happened)
	assert_eq(_stage(2), PlotView.Stage.EMPTY)
	assert_true(_farm.plant(2).happened)
	assert_eq(_stage(2), PlotView.Stage.SEEDLING)


func test_picking_an_unripe_plot_is_refused_and_leaves_it_growing() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(29.0)

	var result := _farm.pick(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NOT_RIPE)
	assert_eq(_stage(0), PlotView.Stage.BOLL)
	assert_eq(_farm.plot(0).seconds_left, 1.0)


func test_picking_an_empty_plot_is_refused_as_nothing_planted() -> void:
	var result := _farm.pick(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NOTHING_PLANTED)


func test_commands_on_a_plot_that_does_not_exist_are_refused() -> void:
	for index: int in [-1, PLOTS]:
		assert_eq(_farm.plant(index).reason, Farm.NO_SUCH_PLOT)
		assert_eq(_farm.pick(index).reason, Farm.NO_SUCH_PLOT)


func test_a_command_that_happened_gives_no_reason() -> void:
	assert_eq(_farm.plant(0).reason, &"")
