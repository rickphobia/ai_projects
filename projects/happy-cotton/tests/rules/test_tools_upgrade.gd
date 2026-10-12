extends GutTest
## The tools Upgrade, through the Farm's public interface: a tier bought makes a slow pick
## shorter and an exhausted pick less likely to drop its cotton, at once, and its Quota rise
## starts with the next Shift, like the Generator's. With the fast exhausting table a pick above
## 50 Exhaustion takes 2 seconds and one above 80 drops its cotton when the roll comes up under
## 0.5. The first tools tier costs 10 and halves both (1 second, under 0.25) and raises the
## Quota by 1; the second costs 20 and leaves a quarter of each. The test sets the roll.

const PLOTS := 12
const SHIFT_SECONDS := 1000.0

var _farm: Farm
var _roll := 0.99


func before_each() -> void:
	_roll = 0.99
	var tuning := FastTuning.exhausting_table()
	tuning.shift_seconds = SHIFT_SECONDS
	_farm = Farm.new(FastTuning.with_land(tuning, 4, 3), func() -> float: return _roll)
	_farm.take_messages()


## Plants plot after plot until Exhaustion passes `level`, waiting out each slow action, then
## ripens them all on the Generator.
func _plant_and_ripen_until(level: float) -> void:
	var index := 0
	while _farm.exhaustion() <= level:
		assert_true(_farm.plant(index).happened, "plant %d" % index)
		_farm.advance(FastTuning.SLOW_ACTION_SECONDS)
		index += 1
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)


func _buy_tools(tiers: int) -> void:
	for tier in tiers:
		_farm.debug_add_labour_points(FastTuning.TOOLS_PRICES[tier])
		assert_true(_farm.buy_upgrade(Farm.TOOLS).happened, "tools tier %d" % (tier + 1))


func _item(id: StringName) -> StoreItemView:
	for item in _farm.store():
		if item.id == id:
			return item
	return null


func _message(key: StringName) -> AppMessage:
	for message in _farm.take_messages():
		if message.key == key:
			return message
	return null


func test_the_store_sells_tools_with_price_effect_and_quota_rise() -> void:
	var tools := _item(Farm.TOOLS)

	assert_eq(tools.kind, StoreItemView.Kind.UPGRADE)
	assert_eq(tools.tier, 0)
	assert_eq(tools.top_tier, FastTuning.TOOLS_PRICES.size())
	assert_eq(tools.price, FastTuning.TOOLS_PRICES[0])
	assert_eq(tools.effect, FastTuning.TOOLS_WORK_SHARES[0])
	assert_eq(tools.current_effect, Tuning.NO_UPGRADE_WORK_SHARE)
	assert_eq(tools.quota_rise, FastTuning.TOOLS_QUOTA_RISES[0])
	assert_eq(tools.refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)


func test_buying_a_tools_tier_spends_its_price_and_is_celebrated() -> void:
	_farm.debug_add_labour_points(FastTuning.TOOLS_PRICES[0])

	assert_true(_farm.buy_upgrade(Farm.TOOLS).happened)

	assert_eq(_farm.labour_points(), 0)
	var tools := _item(Farm.TOOLS)
	assert_eq(tools.tier, 1)
	assert_eq(tools.price, FastTuning.TOOLS_PRICES[1])
	assert_eq(tools.current_effect, FastTuning.TOOLS_WORK_SHARES[0])
	var expected := {
		"tier": 1,
		"price": FastTuning.TOOLS_PRICES[0],
		"share": FastTuning.TOOLS_WORK_SHARES[0],
		"quota_rise": FastTuning.TOOLS_QUOTA_RISES[0],
	}
	assert_eq(_message(Farm.TOOLS_UPGRADED).values, expected)


func test_a_tools_tier_shortens_a_slow_pick_at_once() -> void:
	_plant_and_ripen_until(FastTuning.SLOW_EXHAUSTION)
	_buy_tools(1)
	var shortened := FastTuning.SLOW_ACTION_SECONDS * FastTuning.TOOLS_WORK_SHARES[0]

	_farm.pick(0)
	_farm.advance(shortened - 0.1)
	var too_soon := _farm.pick(1)
	_farm.advance(0.1)
	var in_time := _farm.pick(1)

	assert_eq(too_soon.reason, Farm.WORKER_BUSY)
	assert_true(in_time.happened)


func test_tools_leave_planting_as_slow_as_before() -> void:
	_plant_and_ripen_until(FastTuning.SLOW_EXHAUSTION)
	_buy_tools(1)
	var next := PLOTS - 1

	_farm.plant(next - 1)
	_farm.advance(FastTuning.SLOW_ACTION_SECONDS - 0.5)

	assert_eq(_farm.plant(next).reason, Farm.WORKER_BUSY)


func test_a_tools_tier_lowers_the_share_of_cotton_dropped() -> void:
	_plant_and_ripen_until(FastTuning.MISTAKE_EXHAUSTION)
	# A roll that drops the cotton with no tools, but not with the first tier.
	_roll = FastTuning.DROPPED_COTTON_CHANCE * FastTuning.TOOLS_WORK_SHARES[0]
	_buy_tools(1)

	_farm.pick(0)

	assert_eq(_farm.shift().picked, 1)
	assert_null(_message(Farm.COTTON_DROPPED))


func test_with_tools_an_unlucky_pick_still_drops_its_cotton() -> void:
	_plant_and_ripen_until(FastTuning.MISTAKE_EXHAUSTION)
	_buy_tools(2)
	_roll = FastTuning.DROPPED_COTTON_CHANCE * FastTuning.TOOLS_WORK_SHARES[1] - 0.01

	_farm.pick(0)

	assert_eq(_farm.shift().picked, 0)
	assert_not_null(_message(Farm.COTTON_DROPPED))


func test_its_quota_rise_starts_with_the_next_shift_as_the_generators_does() -> void:
	_buy_tools(1)
	var quota := _farm.shift().quota

	_farm.advance(SHIFT_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())

	assert_eq(quota, FastTuning.FIRST_QUOTA, "the current Shift keeps its Quota")
	assert_eq(
		_farm.shift().quota,
		FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE + FastTuning.TOOLS_QUOTA_RISES[0]
	)


func test_the_generator_and_tools_quota_rises_add_up() -> void:
	_buy_tools(1)
	_farm.debug_add_labour_points(FastTuning.GENERATOR_PRICES[0])
	_farm.buy_upgrade(Farm.GENERATOR)

	_farm.advance(SHIFT_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())

	var rises := FastTuning.TOOLS_QUOTA_RISES[0] + FastTuning.GENERATOR_QUOTA_RISES[0]
	assert_eq(_farm.shift().quota, FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE + rises)


func test_fully_upgraded_tools_are_marked_and_refused() -> void:
	_buy_tools(FastTuning.TOOLS_PRICES.size())
	_farm.debug_add_labour_points(100)

	var tools := _item(Farm.TOOLS)

	assert_true(tools.is_fully_upgraded())
	assert_eq(tools.price, 0)
	assert_eq(tools.quota_rise, 0)
	assert_eq(tools.effect, FastTuning.TOOLS_WORK_SHARES[1])
	assert_eq(_farm.buy_upgrade(Farm.TOOLS).reason, Farm.FULLY_UPGRADED)


func test_tools_cannot_be_bought_in_a_study_session() -> void:
	_farm.advance(SHIFT_SECONDS)
	_farm.debug_add_labour_points(FastTuning.TOOLS_PRICES[0])

	assert_eq(_farm.buy_upgrade(Farm.TOOLS).reason, Farm.IN_STUDY_SESSION)
