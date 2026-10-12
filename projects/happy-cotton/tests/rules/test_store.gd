extends GutTest
## The store, through the Farm's public interface: what it lists and in what order, each item's
## price, effect and Quota rise, the reason an item can't be bought (not enough Labour Points,
## in a Study Session, Privileges taken away, already resting, fully upgraded), the rest hour
## bought as a Privilege, and the debug command that adds Labour Points. With the fast table
## the first Generator tier costs 10 (two picks), doubles growth and raises the Quota by 1; the
## second costs 20, triples growth and raises it by 2 more.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = _farm_with_shift(1000.0)


func _farm_with_shift(shift_seconds: float) -> Farm:
	var tuning := FastTuning.table()
	tuning.shift_seconds = shift_seconds
	var farm := Farm.new(tuning)
	farm.take_messages()
	return farm


## Grows and picks `picks` plots, a crop at a time, at whatever growth the Generator has.
func _earn(picks: int) -> void:
	for pick in picks:
		_farm.plant(0)
		_farm.run_generator()
		_farm.advance(FastTuning.GROW_SECONDS)
		_farm.pick(0)


func _item(id: StringName) -> StoreItemView:
	for item in _farm.store():
		if item.id == id:
			return item
	return null


func _keys() -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	return keys


func _message(key: StringName) -> AppMessage:
	for message in _farm.take_messages():
		if message.key == key:
			return message
	return null


func test_the_store_lists_the_generator_as_an_upgrade_and_the_rest_hour_as_a_privilege() -> void:
	var generator := _item(Farm.GENERATOR)
	var rest_hour := _item(Farm.REST_HOUR)

	assert_eq(generator.kind, StoreItemView.Kind.UPGRADE)
	assert_eq(rest_hour.kind, StoreItemView.Kind.PRIVILEGE)
	assert_eq(_farm.store()[0].id, Farm.GENERATOR, "Upgrades come first")


func test_the_generator_shows_its_next_tier_price_effect_and_quota_rise() -> void:
	var generator := _item(Farm.GENERATOR)

	assert_eq(generator.tier, 0)
	assert_eq(generator.top_tier, FastTuning.GENERATOR_PRICES.size())
	assert_eq(generator.price, FastTuning.GENERATOR_PRICES[0])
	assert_eq(generator.effect, FastTuning.GENERATOR_MULTIPLIERS[0])
	assert_eq(generator.current_effect, 1.0)
	assert_eq(generator.quota_rise, FastTuning.GENERATOR_QUOTA_RISES[0])


func test_the_rest_hour_shows_its_price() -> void:
	assert_eq(_item(Farm.REST_HOUR).price, FastTuning.REST_HOUR_PRICE)


func test_it_is_refused_when_he_cannot_afford_it() -> void:
	_earn(1)

	var result := _farm.buy_upgrade(Farm.GENERATOR)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(_farm.labour_points(), FastTuning.LABOUR_POINTS_PER_PICK)
	assert_eq(_item(Farm.GENERATOR).tier, 0)
	assert_eq(_item(Farm.GENERATOR).refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)


func test_it_is_refused_in_a_study_session() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_farm.debug_add_labour_points(100)
	_farm.advance(FastTuning.SHIFT_SECONDS)

	var result := _farm.buy_upgrade(Farm.GENERATOR)

	assert_eq(result.reason, Farm.IN_STUDY_SESSION)
	assert_eq(_item(Farm.GENERATOR).refusal, Farm.IN_STUDY_SESSION)
	assert_eq(_farm.labour_points(), 100)


func test_the_top_tier_is_marked_and_buying_past_it_is_refused() -> void:
	_earn(2)
	_farm.buy_upgrade(Farm.GENERATOR)
	_earn(4)
	_farm.buy_upgrade(Farm.GENERATOR)
	_earn(2)

	var result := _farm.buy_upgrade(Farm.GENERATOR)

	assert_eq(result.reason, Farm.FULLY_UPGRADED)
	var generator := _item(Farm.GENERATOR)
	assert_eq(generator.tier, generator.top_tier)
	assert_true(generator.is_fully_upgraded())
	assert_eq(generator.refusal, Farm.FULLY_UPGRADED)
	assert_eq(generator.current_effect, FastTuning.GENERATOR_MULTIPLIERS[1])
	assert_eq(_farm.labour_points(), 2 * FastTuning.LABOUR_POINTS_PER_PICK)


func test_an_upgrade_the_store_does_not_sell_is_refused() -> void:
	var result := _farm.buy_upgrade(&"golden_hoe")

	assert_eq(result.reason, Farm.NO_SUCH_UPGRADE)


func test_an_affordable_tier_has_no_refusal() -> void:
	_earn(2)

	assert_eq(_item(Farm.GENERATOR).refusal, &"")
	assert_eq(_item(Farm.REST_HOUR).refusal, &"")


func test_the_rest_hour_shows_why_it_cannot_be_bought() -> void:
	assert_eq(_item(Farm.REST_HOUR).refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)

	_earn(2)
	_farm.buy_privilege(Farm.REST_HOUR)

	assert_eq(_item(Farm.REST_HOUR).refusal, Farm.RESTING)


func test_the_rest_hour_shows_it_was_taken_away_after_a_missed_quota() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.advance(FastTuning.STUDY_SESSION_SECONDS)

	assert_eq(_item(Farm.REST_HOUR).refusal, Farm.PRIVILEGES_TAKEN_AWAY)


func test_the_rest_hour_bought_from_the_store_is_a_privilege_purchase() -> void:
	_earn(2)
	_farm.take_messages()

	var result := _farm.buy_privilege(_item(Farm.REST_HOUR).id)

	assert_true(result.happened)
	assert_has(_keys(), Farm.REST_STARTED)


func test_the_debug_command_adds_labour_points() -> void:
	_farm.debug_add_labour_points(100)

	assert_eq(_farm.labour_points(), 100)
	assert_eq(_item(Farm.GENERATOR).refusal, &"")
