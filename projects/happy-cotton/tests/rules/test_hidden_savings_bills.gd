extends GutTest
## Hidden savings against the state's claims, through the Farm's public interface: Bills draw
## on Labour Points, then hidden savings, and only the rest becomes Debt. Debt blocks every
## purchase whatever pays, savings never pay existing Debt, Negligence never touches them, and
## they are saved.
## With the fast table a Shift lasts 100 seconds, the first Quota is 3, a pick handed in earns 5
## Labour Points and a pick kept back 8 hidden savings.

const LABOUR_POINTS := FastTuning.LABOUR_POINTS_PER_PICK
const SAVINGS := FastTuning.HIDDEN_SAVINGS_PER_KEPT_PICK
## Never under the dropped-cotton chance.
const HOLDS := 0.9

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return HOLDS)
	farm.take_messages()
	return farm


## Plants `count` plots, runs the Generator until they ripen and picks them all.
func _pick_cotton(count: int) -> void:
	for index in count:
		_farm.plant(index)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	for index in count:
		_farm.pick(index)


## Picks `count`, plays out the Shift (and any Study Session) and hands in `handed_in` of them.
func _keep_back(count: int, handed_in: int) -> void:
	_pick_cotton(count)
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.hand_in(handed_in)
	_farm.advance(_farm.study_session_seconds_left())


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


func _store_item(id: StringName) -> StoreItemView:
	for item in _farm.store():
		if item.id == id:
			return item
	return null


## The save as the store writes and reads it back.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_a_bill_draws_on_labour_points_then_hidden_savings() -> void:
	var tuning := FastTuning.table()
	tuning.rent_per_shift = 12
	_farm = _new_farm(tuning)
	_pick_cotton(3)
	_farm.advance(_farm.shift().seconds_left)
	_farm.take_messages()

	_farm.hand_in(1)

	# 5 Labour Points and 16 hidden savings: the rent of 12 takes the 5, then 7 of the savings.
	assert_eq(_farm.labour_points(), 0)
	assert_eq(_farm.debt(), 0)
	assert_eq(_farm.hidden_savings(), LABOUR_POINTS + 2 * SAVINGS - 12)
	var slip := _message(Farm.PAY_SLIP, _farm.take_messages())
	var covered: bool = slip.values["rent_covered"]
	var from_savings: int = slip.values["rent_from_savings"]
	assert_true(covered)
	assert_eq(from_savings, 12 - LABOUR_POINTS)


func test_only_what_hidden_savings_cannot_cover_becomes_debt() -> void:
	var tuning := FastTuning.table()
	tuning.rent_per_shift = 12
	_farm = _new_farm(tuning)
	_keep_back(1, 0)
	assert_eq(_farm.debt(), 12 - SAVINGS, "the savings paid what they could")
	assert_eq(_farm.hidden_savings(), 0)


func test_hidden_savings_never_pay_existing_debt() -> void:
	var tuning := FastTuning.table()
	tuning.rent_per_shift = 4
	_farm = _new_farm(tuning)
	HandingIn.finish_shift(_farm)
	_farm.advance(_farm.study_session_seconds_left())
	assert_eq(_farm.debt(), 4)
	tuning.rent_per_shift = 0

	_keep_back(2, 0)

	assert_eq(_farm.debt(), 4)
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS)


func test_hidden_savings_pay_a_new_bill_while_in_debt() -> void:
	var tuning := FastTuning.table()
	tuning.rent_per_shift = 4
	_farm = _new_farm(tuning)
	HandingIn.finish_shift(_farm)
	_farm.advance(_farm.study_session_seconds_left())

	_keep_back(2, 0)

	assert_eq(_farm.debt(), 4, "the new rent came out of the savings, not into the Debt")
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS - 4)


func test_debt_blocks_purchases_paid_with_hidden_savings() -> void:
	var tuning := FastTuning.table()
	tuning.rent_per_shift = 4
	_farm = _new_farm(tuning)
	HandingIn.finish_shift(_farm)
	_farm.advance(_farm.study_session_seconds_left())
	_keep_back(3, 0)

	assert_eq(_farm.buy_upgrade(Farm.GENERATOR, Farm.PAY_HIDDEN_SAVINGS).reason, Farm.IN_DEBT)
	assert_eq(_farm.buy_plot(Farm.PAY_HIDDEN_SAVINGS).reason, Farm.IN_DEBT)
	assert_eq(_store_item(Farm.GENERATOR).savings_refusal, Farm.IN_DEBT)


func test_negligence_never_touches_hidden_savings() -> void:
	_farm = _new_farm(FastTuning.withering_table())
	_keep_back(1, 0)
	_farm.debug_add_labour_points(100)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)

	_farm.resume_offline(FastTuning.WITHER_SECONDS)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.WITHERED)
	assert_lt(_farm.labour_points(), 100, "Negligence docked the Labour Points")
	assert_eq(_farm.hidden_savings(), SAVINGS)


func test_hidden_savings_survive_a_save() -> void:
	_keep_back(2, 0)
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(_through_json(_farm.to_save())), [] as Array[String])

	assert_eq(restored.hidden_savings(), 2 * SAVINGS)


func test_a_save_of_this_version_without_hidden_savings_is_damaged() -> void:
	var save := _through_json(_farm.to_save())
	save.erase("hidden_savings")

	assert_eq(_farm.restore(save).size(), 1)


func test_a_save_from_before_hidden_savings_restores_with_none() -> void:
	_farm.debug_add_labour_points(7)
	var save := _through_json(_farm.to_save())
	save["version"] = 10
	save.erase("hidden_savings")
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(save), [] as Array[String])

	assert_eq(restored.hidden_savings(), 0)
	assert_eq(restored.labour_points(), 7)
