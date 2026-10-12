extends GutTest
## Buying supplies, through the Farm's public interface: the store's Fertiliser item, its price
## rising every Shift and tomorrow's shown, the stock capped at the most held, the refusals,
## paying with hidden savings, and saving what is held. With the fast table Fertiliser first
## costs 5 Labour Points, 2 more every Shift after the first, and he holds at most 2.

## The roll the Farm sees: never under a chance, so nothing is dropped.
const HOLDS := 0.99

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return HOLDS)
	farm.take_messages()
	return farm


func _fertiliser() -> StoreItemView:
	for item in _farm.store():
		if item.id == Farm.FERTILISER:
			return item
	return null


## Gives the Worker exactly enough Labour Points for one Fertiliser, and buys it.
func _buy() -> CommandResult:
	_farm.debug_add_labour_points(_fertiliser().price)
	return _farm.buy_supply(Farm.FERTILISER)


func _price_in_shift(shift: int) -> int:
	return FastTuning.FERTILISER_FIRST_PRICE + (shift - 1) * FastTuning.FERTILISER_PRICE_RISE


func _message(key: StringName) -> AppMessage:
	for message in _farm.take_messages():
		if message.key == key:
			return message
	return null


func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_the_store_sells_fertiliser_with_todays_and_tomorrows_price() -> void:
	var item := _fertiliser()

	assert_not_null(item)
	assert_eq(item.kind, StoreItemView.Kind.SUPPLY)
	assert_eq(item.price, _price_in_shift(1))
	assert_eq(item.next_price, _price_in_shift(2))
	assert_eq(item.held, 0)
	assert_eq(item.most_held, FastTuning.MOST_SUPPLIES_HELD)
	assert_eq(item.quota_rise, 0)
	assert_eq(item.refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)


func test_supplies_come_after_the_land_and_before_the_privileges() -> void:
	var ids: Array[StringName] = []
	for item in _farm.store():
		ids.append(item.id)

	assert_eq(ids.find(Farm.FERTILISER), ids.find(Farm.LAND) + 1)
	assert_lt(ids.find(Farm.FERTILISER), ids.find(Farm.REST_HOUR))


func test_buying_fertiliser_adds_it_to_the_stock_and_costs_its_price() -> void:
	_farm.debug_add_labour_points(_price_in_shift(1) + 1)

	var result := _farm.buy_supply(Farm.FERTILISER)

	assert_true(result.happened)
	assert_eq(_farm.labour_points(), 1)
	assert_eq(_fertiliser().held, 1)


func test_buying_says_what_was_bought_and_tomorrows_price() -> void:
	_buy()

	var bought := _message(Farm.SUPPLY_BOUGHT)

	assert_not_null(bought)
	var expected := {
		"kind": Farm.FERTILISER, "price": _price_in_shift(1), "next_price": _price_in_shift(2)
	}
	expected["held"] = 1
	assert_eq(bought.values, expected)


func test_the_stock_is_capped_at_the_most_held() -> void:
	for bought in FastTuning.MOST_SUPPLIES_HELD:
		assert_true(_buy().happened)
	_farm.debug_add_labour_points(100)

	var result := _farm.buy_supply(Farm.FERTILISER)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.STOCK_FULL)
	assert_eq(_fertiliser().refusal, Farm.STOCK_FULL)
	assert_eq(_fertiliser().held, FastTuning.MOST_SUPPLIES_HELD)
	assert_eq(_farm.labour_points(), 100)


func test_the_price_rises_every_shift_and_never_falls() -> void:
	HandingIn.finish_shift(_farm)
	assert_eq(_fertiliser().price, _price_in_shift(2))
	assert_eq(_fertiliser().next_price, _price_in_shift(3))
	HandingIn.finish_shift(_farm)
	_farm.advance(_farm.study_session_seconds_left())

	assert_eq(_fertiliser().price, _price_in_shift(3))


func test_buying_fertiliser_does_not_raise_the_quota() -> void:
	_buy()

	HandingIn.finish_shift(_farm)

	assert_eq(_farm.shift().quota, FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE)


func test_too_few_labour_points_are_refused() -> void:
	_farm.debug_add_labour_points(_price_in_shift(1) - 1)

	var result := _farm.buy_supply(Farm.FERTILISER)

	assert_eq(result.reason, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(_fertiliser().held, 0)


func test_supplies_cannot_be_bought_while_the_hand_in_is_open() -> void:
	_farm.debug_add_labour_points(100)
	_farm.advance(FastTuning.SHIFT_SECONDS)

	var result := _farm.buy_supply(Farm.FERTILISER)

	assert_eq(result.reason, Farm.HAND_IN_OPEN)


func test_a_supply_the_farm_does_not_sell_is_refused() -> void:
	_farm.debug_add_labour_points(100)

	var result := _farm.buy_supply(&"magic_beans")

	assert_eq(result.reason, Farm.NO_SUCH_SUPPLY)
	assert_eq(_farm.labour_points(), 100)


func test_fertiliser_can_be_paid_for_with_hidden_savings() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.pick(0)
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.hand_in(0)
	_farm.advance(_farm.study_session_seconds_left())

	var result := _farm.buy_supply(Farm.FERTILISER, Farm.PAY_HIDDEN_SAVINGS)

	assert_true(result.happened)
	var left := FastTuning.HIDDEN_SAVINGS_PER_KEPT_PICK - _price_in_shift(2)
	assert_eq(_farm.hidden_savings(), left)
	assert_eq(_fertiliser().held, 1)


func test_supplies_held_are_saved() -> void:
	_buy()
	var restored := _new_farm(FastTuning.table())

	var problems := restored.restore(_through_json(_farm.to_save()))
	_farm = restored

	assert_eq(problems, [] as Array[String])
	assert_eq(_fertiliser().held, 1)


func test_a_save_from_before_supplies_restores_with_none_held() -> void:
	_buy()
	var save := _farm.to_save()
	save["version"] = 12
	save.erase("supplies")
	var crops: Dictionary = save["crops"]
	crops.erase("fertilised")

	var problems := _farm.restore(_through_json(save))

	assert_eq(problems, [] as Array[String])
	assert_eq(_fertiliser().held, 0)


func test_a_save_holding_more_than_the_most_held_keeps_only_that_many() -> void:
	var save := _farm.to_save()
	save["supplies"]["held"][Farm.FERTILISER] = FastTuning.MOST_SUPPLIES_HELD + 3

	var problems := _farm.restore(_through_json(save))

	assert_eq(problems, [] as Array[String])
	assert_eq(_fertiliser().held, FastTuning.MOST_SUPPLIES_HELD)


func test_a_save_with_a_bad_supply_count_is_damaged() -> void:
	var save := _farm.to_save()
	save["supplies"]["held"][Farm.FERTILISER] = -1

	var problems := _farm.restore(_through_json(save))

	assert_has(problems, "supplies.held.fertiliser is below 0.0")


func test_supplies_are_refused_in_debt() -> void:
	var tuning := FastTuning.table()
	tuning.first_quota = 0
	tuning.rent_per_shift = FastTuning.RENT_PER_SHIFT
	_farm = _new_farm(tuning)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)
	assert_gt(_farm.debt(), 0)

	assert_eq(_farm.buy_supply(Farm.FERTILISER).reason, Farm.IN_DEBT)
	assert_eq(_fertiliser().refusal, Farm.IN_DEBT)
