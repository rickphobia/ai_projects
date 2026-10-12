extends GutTest
## Pesticide, through the Farm's public interface: the store sells it at a fixed price; sprayed
## on a Plot without Bollworms that isn't protected yet, empty or growing, it uses up one from
## the stock and keeps Bollworms off until the crop in it, or the next one planted, is picked,
## eaten or Withered; plain refusals otherwise; and protected Plots are saved. With
## with_bollworms() Bollworms come to every growing Plot open to them at each 10-second check.

const HOLDS := 0.99
const CHECK := FastTuning.BOLLWORM_CHECK_SECONDS

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(FastTuning.with_bollworms(tuning), func() -> float: return HOLDS)
	farm.take_messages()
	return farm


## Buys `count` Pesticide with Labour Points given for them.
func _stock_up(count: int) -> void:
	for bought in count:
		_farm.debug_add_labour_points(FastTuning.PESTICIDE_PRICE)
		_farm.buy_supply(Farm.PESTICIDE)
	_farm.take_messages()


func _pesticide() -> StoreItemView:
	for item in _farm.store():
		if item.id == Farm.PESTICIDE:
			return item
	return null


func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_the_store_sells_pesticide_at_the_same_price_every_shift() -> void:
	var item := _pesticide()
	assert_eq(item.kind, StoreItemView.Kind.SUPPLY)
	assert_eq(item.price, FastTuning.PESTICIDE_PRICE)
	assert_eq(item.next_price, FastTuning.PESTICIDE_PRICE)

	HandingIn.finish_shift(_farm)

	assert_eq(_pesticide().price, FastTuning.PESTICIDE_PRICE)


func test_buying_pesticide_costs_its_price_into_the_capped_stock() -> void:
	_farm.debug_add_labour_points(FastTuning.PESTICIDE_PRICE + 1)

	assert_true(_farm.buy_supply(Farm.PESTICIDE).happened)

	assert_eq(_farm.labour_points(), 1)
	assert_eq(_pesticide().held, 1)
	_stock_up(FastTuning.MOST_SUPPLIES_HELD - 1)
	_farm.debug_add_labour_points(FastTuning.PESTICIDE_PRICE)
	var refused := _farm.buy_supply(Farm.PESTICIDE)
	assert_eq(refused.reason, Farm.STOCK_FULL)


func test_spraying_a_growing_plot_uses_one_and_keeps_bollworms_off() -> void:
	_stock_up(2)
	_farm.plant(0)
	_farm.plant(1)

	assert_true(_farm.spray(0).happened)
	HandingIn.advance(_farm, CHECK)

	assert_true(_farm.plot(0).protected)
	assert_false(_farm.plot(0).bollworms, "protected")
	assert_true(_farm.plot(1).bollworms, "not protected")
	assert_eq(_pesticide().held, 1)


func test_spraying_an_empty_plot_protects_the_next_crop_planted() -> void:
	_stock_up(1)
	assert_true(_farm.spray(0).happened)
	assert_true(_farm.plot(0).protected)

	_farm.plant(0)
	HandingIn.advance(_farm, CHECK)

	assert_false(_farm.plot(0).bollworms)
	assert_true(_farm.plot(0).protected)


func test_bollworms_brought_by_debug_mode_spare_a_protected_plot() -> void:
	_stock_up(1)
	_farm.plant(0)
	_farm.plant(1)
	_farm.spray(0)

	_farm.debug_bollworms_now()

	assert_false(_farm.plot(0).bollworms)
	assert_true(_farm.plot(1).bollworms)


func test_the_protection_ends_when_the_crop_is_picked() -> void:
	var farm := _new_farm(FastTuning.table())
	farm.debug_add_labour_points(FastTuning.PESTICIDE_PRICE)
	farm.buy_supply(Farm.PESTICIDE)
	farm.plant(0)
	farm.spray(0)
	farm.resume_offline(FastTuning.GROW_SECONDS / FastTuning.OFFLINE_GROWTH_RATE)
	assert_eq(farm.plot(0).stage, PlotView.Stage.RIPE)

	assert_true(farm.pick(0).happened)

	assert_false(farm.plot(0).protected)
	farm.plant(0)
	HandingIn.advance(farm, CHECK)
	assert_true(farm.plot(0).bollworms, "the next crop is not covered")


func test_the_protection_ends_when_the_crop_withers() -> void:
	_farm = _new_farm(FastTuning.withering_table())
	_stock_up(1)
	_farm.plant(0)
	_farm.spray(0)

	_farm.resume_offline(FastTuning.OFFLINE_CAP_SECONDS)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.WITHERED)
	assert_false(_farm.plot(0).protected)


func test_with_none_held_it_is_refused() -> void:
	var result := _farm.spray(0)

	assert_eq(result.reason, Farm.NONE_HELD)
	assert_false(_farm.plot(0).protected)


func test_a_plot_with_bollworms_is_refused() -> void:
	_stock_up(1)
	_farm.plant(0)
	HandingIn.advance(_farm, CHECK)

	var result := _farm.spray(0)

	assert_eq(result.reason, Farm.BOLLWORMS_ON_PLOT)
	assert_eq(_pesticide().held, 1, "none used")


func test_a_protected_plot_is_refused_a_second_spray() -> void:
	_stock_up(2)
	_farm.spray(0)

	var result := _farm.spray(0)

	assert_eq(result.reason, Farm.ALREADY_PROTECTED)
	assert_eq(_pesticide().held, 1)


func test_a_plot_that_does_not_exist_is_refused() -> void:
	_stock_up(1)

	assert_eq(_farm.spray(99).reason, Farm.NO_SUCH_PLOT)


func test_pesticide_cannot_be_sprayed_in_a_study_session() -> void:
	_stock_up(1)
	HandingIn.finish_shift(_farm)

	var result := _farm.spray(0)

	assert_true(_farm.in_study_session())
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)


func test_protected_plots_are_saved() -> void:
	_stock_up(1)
	_farm.spray(2)
	var restored := _new_farm(FastTuning.table())

	var problems := restored.restore(_through_json(_farm.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_true(restored.plot(2).protected)
	assert_false(restored.plot(0).protected)


func test_a_save_from_before_pesticide_restores_with_no_plot_protected() -> void:
	_stock_up(1)
	_farm.spray(0)
	var save := _farm.to_save()
	save["version"] = 14
	var bollworms: Dictionary = save["bollworms"]
	bollworms.erase("protected")
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(_through_json(save)), [] as Array[String])

	assert_false(restored.plot(0).protected)
