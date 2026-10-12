extends GutTest
## Keeping cotton back at the Hand-in and the hidden savings it becomes, through the Farm's
## public interface. Only cotton handed in counts towards the Quota and earns Labour Points;
## kept cotton adds hidden savings, a second balance never below zero, and the store takes
## either. Bills, Debt and saves are in test_hidden_savings_bills.gd.
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


func test_handing_in_with_no_amount_hands_in_everything() -> void:
	_pick_cotton(3)
	_farm.advance(_farm.shift().seconds_left)

	_farm.hand_in()

	assert_eq(_farm.labour_points(), 3 * LABOUR_POINTS)
	assert_eq(_farm.hidden_savings(), 0)


func test_cotton_kept_back_earns_nothing_and_becomes_hidden_savings() -> void:
	_pick_cotton(3)
	_farm.advance(_farm.shift().seconds_left)

	_farm.hand_in(1)

	assert_eq(_farm.labour_points(), LABOUR_POINTS)
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS)


func test_cotton_kept_back_does_not_count_towards_the_quota() -> void:
	_pick_cotton(FastTuning.FIRST_QUOTA)
	_farm.advance(_farm.shift().seconds_left)
	_farm.take_messages()

	_farm.hand_in(FastTuning.FIRST_QUOTA - 1)

	var messages := _farm.take_messages()
	assert_null(_message(Farm.QUOTA_MET, messages))
	var missed := _message(Farm.QUOTA_MISSED, messages)
	assert_not_null(missed)
	var picked: int = missed.values["picked"]
	assert_eq(picked, FastTuning.FIRST_QUOTA - 1)
	assert_true(_farm.in_study_session())


func test_the_hand_in_message_says_what_was_handed_in_and_kept() -> void:
	_pick_cotton(3)
	_farm.advance(_farm.shift().seconds_left)
	_farm.take_messages()

	_farm.hand_in(2)

	var handed_in := _message(Farm.HANDED_IN, _farm.take_messages())
	assert_eq(
		handed_in.values, {"shift": 1, "handed_in": 2, "kept": 1, "earned": 2 * LABOUR_POINTS}
	)


func test_an_amount_over_the_cotton_in_hand_hands_in_all_of_it() -> void:
	_pick_cotton(2)
	_farm.advance(_farm.shift().seconds_left)

	_farm.hand_in(5)

	assert_eq(_farm.labour_points(), 2 * LABOUR_POINTS)
	assert_eq(_farm.hidden_savings(), 0)


func test_keeping_everything_back_hands_in_nothing() -> void:
	_keep_back(2, 0)

	assert_eq(_farm.labour_points(), 0)
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS)


func test_hidden_savings_build_up_over_shifts() -> void:
	_keep_back(1, 0)
	_keep_back(2, 0)

	assert_eq(_farm.hidden_savings(), 3 * SAVINGS)


func test_an_upgrade_can_be_paid_for_with_hidden_savings() -> void:
	_keep_back(2, 0)
	_farm.debug_add_labour_points(3)

	var result := _farm.buy_upgrade(Farm.GENERATOR, Farm.PAY_HIDDEN_SAVINGS)

	assert_true(result.happened)
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS - FastTuning.GENERATOR_PRICES[0])
	assert_eq(_farm.labour_points(), 3, "Labour Points untouched")


func test_a_plot_can_be_paid_for_with_hidden_savings() -> void:
	_keep_back(2, 0)

	var result := _farm.buy_plot(Farm.PAY_HIDDEN_SAVINGS)

	assert_true(result.happened)
	assert_eq(_farm.hidden_savings(), 2 * SAVINGS - FastTuning.FIRST_PLOT_PRICE)


func test_a_privilege_can_be_paid_for_with_hidden_savings() -> void:
	var tuning := FastTuning.table()
	tuning.rest_hour_price = SAVINGS - 1
	_farm = _new_farm(tuning)
	# Meets the Quota, so the Privileges stay, and keeps one back.
	_keep_back(FastTuning.FIRST_QUOTA + 1, FastTuning.FIRST_QUOTA)

	var result := _farm.buy_privilege(Farm.REST_HOUR, Farm.PAY_HIDDEN_SAVINGS)

	assert_true(result.happened)
	assert_eq(_farm.hidden_savings(), 1)
	assert_eq(_farm.labour_points(), FastTuning.FIRST_QUOTA * LABOUR_POINTS)


func test_too_few_hidden_savings_are_refused() -> void:
	_keep_back(1, 0)
	_farm.debug_add_labour_points(100)

	var result := _farm.buy_upgrade(Farm.TOOLS, Farm.PAY_HIDDEN_SAVINGS)

	assert_eq(result.reason, Farm.NOT_ENOUGH_HIDDEN_SAVINGS)
	assert_eq(_farm.hidden_savings(), SAVINGS)
	assert_eq(_farm.store()[1].tier, 0)


func test_the_store_says_why_each_way_of_paying_is_refused() -> void:
	_keep_back(2, 0)

	var generator := _store_item(Farm.GENERATOR)

	assert_eq(generator.refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(generator.savings_refusal, &"")
	_farm.buy_upgrade(Farm.GENERATOR, Farm.PAY_HIDDEN_SAVINGS)
	var dearer := _store_item(Farm.GENERATOR)
	assert_eq(dearer.savings_refusal, Farm.NOT_ENOUGH_HIDDEN_SAVINGS)


func test_hidden_savings_are_never_below_zero() -> void:
	_farm.debug_add_labour_points(100)

	var result := _farm.buy_upgrade(Farm.GENERATOR, Farm.PAY_HIDDEN_SAVINGS)

	assert_eq(result.reason, Farm.NOT_ENOUGH_HIDDEN_SAVINGS)
	assert_eq(_farm.hidden_savings(), 0)
