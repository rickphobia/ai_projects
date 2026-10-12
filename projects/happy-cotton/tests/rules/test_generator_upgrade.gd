extends GutTest
## The Generator Upgrade, through the Farm's public interface: a tier bought makes every
## second of running grow more cotton at once, and its Quota rise starts with the next Shift.
## With the fast table the first tier costs 10 (two picks), doubles growth and raises the Quota
## by 1; the second costs 20, triples growth and raises it by 2 more.

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


func test_buying_a_generator_tier_spends_its_price_and_moves_to_the_next_tier() -> void:
	_earn(2)

	var result := _farm.buy_upgrade(Farm.GENERATOR)

	assert_true(result.happened)
	assert_eq(_farm.labour_points(), 0)
	var generator := _item(Farm.GENERATOR)
	assert_eq(generator.tier, 1)
	assert_eq(generator.price, FastTuning.GENERATOR_PRICES[1])
	assert_eq(generator.current_effect, FastTuning.GENERATOR_MULTIPLIERS[0])


func test_a_bought_tier_multiplies_growth_per_second_of_running_at_once() -> void:
	_earn(2)
	_farm.buy_upgrade(Farm.GENERATOR)
	_farm.plant(1)
	_farm.run_generator()

	_farm.advance(FastTuning.GROW_SECONDS / FastTuning.GENERATOR_MULTIPLIERS[0])

	assert_eq(_farm.plot(1).stage, PlotView.Stage.RIPE)


func test_time_left_on_a_plot_counts_the_faster_growth() -> void:
	_earn(2)
	_farm.buy_upgrade(Farm.GENERATOR)
	_farm.plant(1)

	assert_eq(
		_farm.plot(1).seconds_left, FastTuning.GROW_SECONDS / FastTuning.GENERATOR_MULTIPLIERS[0]
	)


func test_without_running_an_upgraded_generator_grows_nothing() -> void:
	_earn(2)
	_farm.buy_upgrade(Farm.GENERATOR)
	_farm.plant(1)

	_farm.advance(10.0)

	assert_eq(_farm.plot(1).stage, PlotView.Stage.SEEDLING)
	assert_eq(_farm.plot(1).seconds_left, 15.0)


func test_buying_a_tier_is_celebrated_with_its_tier_price_and_quota_rise() -> void:
	_earn(2)
	_farm.take_messages()

	_farm.buy_upgrade(Farm.GENERATOR)

	var message := _message(Farm.GENERATOR_UPGRADED)
	assert_not_null(message)
	var expected := {
		"tier": 1,
		"price": FastTuning.GENERATOR_PRICES[0],
		"multiplier": FastTuning.GENERATOR_MULTIPLIERS[0],
		"quota_rise": FastTuning.GENERATOR_QUOTA_RISES[0],
	}
	assert_eq(message.values, expected)


func test_the_current_shift_quota_does_not_change_when_a_tier_is_bought() -> void:
	_earn(2)

	_farm.buy_upgrade(Farm.GENERATOR)

	assert_eq(_farm.shift().quota, FastTuning.FIRST_QUOTA)


func test_the_next_shift_quota_includes_the_quota_rise() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_earn(2)
	_farm.buy_upgrade(Farm.GENERATOR)

	_farm.advance(FastTuning.SHIFT_SECONDS)

	var expected := (
		FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE + FastTuning.GENERATOR_QUOTA_RISES[0]
	)
	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.shift().quota, expected)


func test_every_later_shift_keeps_the_rise_of_every_tier_bought_before_it() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_farm.debug_add_labour_points(100)
	_farm.buy_upgrade(Farm.GENERATOR)
	# Shift 1 ends with the Quota missed; its 20-second Study Session is served.
	_farm.advance(FastTuning.SHIFT_SECONDS + FastTuning.STUDY_SESSION_SECONDS)
	_farm.buy_upgrade(Farm.GENERATOR)
	assert_eq(
		_farm.shift().quota,
		FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE + FastTuning.GENERATOR_QUOTA_RISES[0]
	)

	_farm.advance(FastTuning.SHIFT_SECONDS)

	var rises := FastTuning.GENERATOR_QUOTA_RISES[0] + FastTuning.GENERATOR_QUOTA_RISES[1]
	assert_eq(_farm.shift().number, 3)
	assert_eq(_farm.shift().quota, FastTuning.FIRST_QUOTA + 2 * FastTuning.QUOTA_RISE + rises)


func test_an_upgrade_stays_bought_after_a_missed_quota() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_farm.debug_add_labour_points(100)
	_farm.buy_upgrade(Farm.GENERATOR)

	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_true(_farm.in_study_session(), "the Quota was missed")
	assert_eq(_item(Farm.GENERATOR).tier, 1)
