extends GutTest
## Buying land a Plot at a time, through the Farm's public interface: the store's land item,
## the fixed order (a column on the right, then a row at the back), each strip's first Plot
## widening the Farm, prices rising, the refusals, the Quota rise from the next Shift, new
## Plots working like the first ones, and saving. With the fast table the Farm starts at
## 2 × 2 and grows to 3 × 3: the first Plot costs 10 Labour Points, each one after costs 5
## more, and each raises the Quota by 1.

const PLOTS := FastTuning.FIRST_PLOTS
## The cells the five Plots for sale take, in the order they are sold: the right-hand column
## from the front, then the back row from the left.
const ORDER: Array[Vector2i] = [
	Vector2i(2, 0), Vector2i(2, 1), Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)
]

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning)
	farm.take_messages()
	return farm


func _land_item() -> StoreItemView:
	for item in _farm.store():
		if item.id == Farm.LAND:
			return item
	return null


func _price(bought: int) -> int:
	return FastTuning.FIRST_PLOT_PRICE + bought * FastTuning.PLOT_PRICE_RISE


## Gives the Worker exactly enough Labour Points for the next Plot, and buys it.
func _buy() -> CommandResult:
	_farm.debug_add_labour_points(_land_item().price)
	return _farm.buy_plot()


func _cells(land: LandView) -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for index in land.plot_count():
		cells.append(land.cell_of(index))
	return cells


func _keys() -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	return keys


func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_the_store_sells_the_next_plot_with_its_price_and_quota_rise() -> void:
	var item := _land_item()

	assert_not_null(item)
	assert_eq(item.kind, StoreItemView.Kind.LAND)
	assert_eq(item.price, FastTuning.FIRST_PLOT_PRICE)
	assert_eq(item.quota_rise, FastTuning.PLOT_QUOTA_RISE)
	assert_false(item.is_fully_bought())
	assert_eq(item.refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)


func test_land_comes_after_the_upgrades_and_before_the_privileges() -> void:
	var ids: Array[StringName] = []
	for item in _farm.store():
		ids.append(item.id)

	assert_eq(ids, [Farm.GENERATOR, Farm.TOOLS, Farm.LAND, Farm.REST_HOUR, Farm.CALL_HOME])


func test_buying_a_plot_spends_its_price_and_adds_a_plot() -> void:
	_farm.debug_add_labour_points(FastTuning.FIRST_PLOT_PRICE + 3)

	assert_true(_farm.buy_plot().happened)

	assert_eq(_farm.labour_points(), 3)
	assert_eq(_farm.land().plot_count(), PLOTS + 1)
	assert_eq(_farm.plots().size(), PLOTS + 1)


func test_plots_are_bought_a_column_on_the_right_then_a_row_at_the_back() -> void:
	for plot in ORDER.size():
		assert_true(_buy().happened, "Plot %d" % plot)

	var cells := _cells(_farm.land())
	assert_eq(cells.slice(PLOTS), ORDER)
	assert_eq(_farm.land().columns, FastTuning.LARGEST_LAND_COLUMNS)
	assert_eq(_farm.land().rows, FastTuning.LARGEST_LAND_ROWS)


func test_the_first_plots_keep_their_numbers_and_cells() -> void:
	var before := _cells(_farm.land())

	_buy()
	_buy()

	assert_eq(_cells(_farm.land()).slice(0, PLOTS), before)


func test_a_strips_first_plot_takes_in_the_whole_strip() -> void:
	_buy()

	var land := _farm.land()
	assert_eq(land.columns, FastTuning.FIRST_LAND_COLUMNS + 1, "the new column is fenced in")
	assert_eq(land.rows, FastTuning.FIRST_LAND_ROWS)
	assert_eq(land.plot_count(), PLOTS + 1, "the rest of the column is unworked ground")

	_buy()
	_buy()

	assert_eq(_farm.land().rows, FastTuning.FIRST_LAND_ROWS + 1, "the back row is fenced in")


func test_each_plot_costs_more_than_the_last() -> void:
	for bought in ORDER.size():
		assert_eq(_land_item().price, _price(bought))
		_buy()


func test_a_plot_is_refused_without_enough_labour_points() -> void:
	_farm.debug_add_labour_points(FastTuning.FIRST_PLOT_PRICE - 1)

	var result := _farm.buy_plot()

	assert_eq(result.reason, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(_farm.labour_points(), FastTuning.FIRST_PLOT_PRICE - 1)
	assert_eq(_farm.land().plot_count(), PLOTS)


func test_a_plot_is_refused_in_a_study_session() -> void:
	_farm.debug_add_labour_points(FastTuning.FIRST_PLOT_PRICE)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	assert_true(_farm.in_study_session(), "a missed Quota")

	assert_eq(_farm.buy_plot().reason, Farm.IN_STUDY_SESSION)
	assert_eq(_land_item().refusal, Farm.IN_STUDY_SESSION)


func test_a_plot_is_refused_in_debt() -> void:
	var tuning := FastTuning.table()
	tuning.first_quota = 0
	tuning.rent_per_shift = FastTuning.RENT_PER_SHIFT
	_farm = _new_farm(tuning)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	assert_gt(_farm.debt(), 0)

	assert_eq(_farm.buy_plot().reason, Farm.IN_DEBT)
	assert_eq(_land_item().refusal, Farm.IN_DEBT)


func test_the_largest_farm_is_fully_bought() -> void:
	for plot in ORDER.size():
		_buy()
	_farm.debug_add_labour_points(1000)

	assert_eq(_farm.buy_plot().reason, Farm.FULLY_BOUGHT)
	var item := _land_item()
	assert_true(item.is_fully_bought())
	assert_eq(item.price, 0)
	assert_eq(item.quota_rise, 0)
	assert_eq(item.refusal, Farm.FULLY_BOUGHT)
	assert_eq(_farm.land().plot_count(), PLOTS + ORDER.size())


func test_a_farm_already_at_its_largest_has_nothing_to_sell() -> void:
	_farm = _new_farm(FastTuning.with_land(FastTuning.table(), 2, 2))

	assert_true(_land_item().is_fully_bought())


func test_the_app_celebrates_a_new_plot() -> void:
	_buy()

	var messages := _farm.take_messages()
	assert_eq(messages.size(), 1)
	assert_eq(messages[0].key, Farm.PLOT_BOUGHT)
	var expected := {
		"plot": PLOTS + 1,
		"price": FastTuning.FIRST_PLOT_PRICE,
		"quota_rise": FastTuning.PLOT_QUOTA_RISE,
	}
	assert_eq(messages[0].values, expected)


func test_a_new_plots_quota_rise_starts_with_the_next_shift() -> void:
	var quota := _farm.shift().quota

	_buy()
	_buy()

	assert_eq(_farm.shift().quota, quota, "not mid-Shift")
	_farm.debug_add_labour_points(1000)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	assert_eq(_farm.shift().quota, quota + FastTuning.QUOTA_RISE + 2 * FastTuning.PLOT_QUOTA_RISE)


func test_a_new_plot_works_like_the_first_ones() -> void:
	_buy()
	var plot := PLOTS

	assert_true(_farm.plant(plot).happened)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	assert_eq(_farm.plot(plot).stage, PlotView.Stage.RIPE)
	assert_true(_farm.pick(plot).happened)
	assert_eq(_farm.shift().picked, 1)


func test_plots_bought_and_their_crops_survive_a_save() -> void:
	_buy()
	_buy()
	_farm.plant(PLOTS + 1)
	_farm.run_generator()
	_farm.advance(5.0)
	var save := _through_json(_farm.to_save())

	var restored := _new_farm(FastTuning.table())
	assert_eq(restored.restore(save), [] as Array[String])

	assert_eq(_cells(restored.land()), _cells(_farm.land()))
	assert_eq(restored.land().columns, _farm.land().columns)
	assert_eq(restored.plot(PLOTS + 1).stage, _farm.plot(PLOTS + 1).stage)
	assert_eq(restored.store()[2].price, _land_item().price)
	restored.debug_add_labour_points(1000)
	restored.advance(FastTuning.SHIFT_SECONDS)
	_farm.debug_add_labour_points(1000)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	assert_eq(restored.shift().quota, _farm.shift().quota, "the Quota rise comes with it")


func test_a_save_from_before_land_carries_on_with_the_first_plots() -> void:
	var save := _through_json(_farm.to_save())
	save["version"] = 7
	save.erase("plots_bought")
	_buy()

	assert_eq(_farm.restore(save), [] as Array[String])

	assert_eq(_farm.land().plot_count(), PLOTS)
	assert_eq(_land_item().price, FastTuning.FIRST_PLOT_PRICE)


func test_a_save_with_more_plots_than_the_land_holds_is_refused() -> void:
	var save := _through_json(_farm.to_save())
	save["plots_bought"] = ORDER.size() + 1

	var problems := _farm.restore(save)

	assert_has(problems, "plots_bought is 6, but the land holds only 5 more Plots")


func test_a_save_of_this_version_without_the_plots_bought_is_damaged() -> void:
	var save := _through_json(_farm.to_save())
	save.erase("plots_bought")

	assert_has(_farm.restore(save), "plots_bought is missing or not a number")
