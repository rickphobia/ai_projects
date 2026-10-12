extends GutTest
## Heatwaves, through the Farm's public interface: rolled at the start of every Shift after the
## first that has no Sandstorm, on their own chance, with the same warning, strike and passing
## as a Sandstorm (see test_sandstorm.gd); while one lasts, Exhaustion from running is
## multiplied, and the debug command brings one at once.

const WARNING := FastTuning.DISASTER_WARNING_SECONDS
const LENGTH := FastTuning.DISASTER_SECONDS
const FACTOR := FastTuning.HEATWAVE_EXHAUSTION_FACTOR
## Exhaustion from a second of running with no Heatwave, on the exhausting table.
const PER_SECOND := FastTuning.EXHAUSTION_PER_LAP / FastTuning.LAP_SECONDS
## With every roll at 0.5 it strikes 45 seconds into the Shift, as a Sandstorm does.
const STRIKES_AT := 45.0

## The source of chance every roll returns.
var _roll_value := 0.5
var _farm: Farm


func before_each() -> void:
	_roll_value = 0.5
	_farm = _new_farm(FastTuning.with_heatwaves(FastTuning.exhausting_table()))


func _new_farm(tuning: Tuning) -> Farm:
	return Farm.new(tuning, func() -> float: return _roll_value)


## Plays the first Shift out without a crop, serves the missed Quota's Study Session and so
## starts the clock of the second, emptying the messages.
func _to_second_shift(farm: Farm) -> void:
	HandingIn.finish_shift(farm)
	farm.advance(farm.study_session_seconds_left())
	farm.take_messages()


func _keys(messages: Array[AppMessage]) -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in messages:
		keys.append(message.key)
	return keys


func _disaster(farm: Farm) -> DisasterView:
	return farm.shift().disaster


## The Exhaustion `farm` gains running for `seconds` from now.
func _exhaustion_running(farm: Farm, seconds: float) -> float:
	farm.run_generator()
	var before := farm.exhaustion()
	farm.advance(seconds)
	return farm.exhaustion() - before


func test_the_first_shift_has_no_heatwave() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_does_not_have(_keys(_farm.take_messages()), Farm.HEATWAVE_WARNED)


func test_a_heatwave_is_warned_of_then_strikes_then_passes() -> void:
	_to_second_shift(_farm)

	_farm.advance(STRIKES_AT - WARNING)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.WARNED)
	assert_eq(_disaster(_farm).kind, Farm.HEATWAVE)
	assert_eq(_keys(_farm.take_messages()), [Farm.HEATWAVE_WARNED] as Array[StringName])

	_farm.advance(WARNING)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.STRIKING)
	assert_eq(_keys(_farm.take_messages()), [Farm.HEATWAVE_STRUCK] as Array[StringName])

	_farm.advance(LENGTH)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.NONE)
	assert_eq(_keys(_farm.take_messages()), [Farm.DISASTER_PASSED] as Array[StringName])


func test_a_sandstorm_rolled_first_leaves_no_heatwave() -> void:
	var farm := _new_farm(FastTuning.with_sandstorms(FastTuning.with_heatwaves(FastTuning.table())))
	_to_second_shift(farm)

	farm.advance(STRIKES_AT)

	assert_eq(_disaster(farm).kind, Farm.SANDSTORM)


func test_a_heatwave_comes_on_its_own_chance_when_no_sandstorm_is_rolled() -> void:
	var tuning := FastTuning.with_heatwaves(FastTuning.table())
	tuning.sandstorm_chance = 0.4
	tuning.heatwave_chance = 0.6
	var farm := _new_farm(tuning)
	_to_second_shift(farm)

	farm.advance(STRIKES_AT)

	assert_eq(_disaster(farm).kind, Farm.HEATWAVE)


func test_no_heatwave_when_its_roll_misses() -> void:
	var tuning := FastTuning.with_heatwaves(FastTuning.table())
	tuning.heatwave_chance = 0.4
	var farm := _new_farm(tuning)
	_to_second_shift(farm)

	farm.advance(STRIKES_AT)

	assert_eq(_disaster(farm).phase, DisasterView.Phase.NONE)
	assert_eq(farm.take_messages(), [] as Array[AppMessage])


func test_running_in_a_heatwave_tires_the_worker_faster() -> void:
	var calm := _new_farm(FastTuning.exhausting_table())
	for farm: Farm in [_farm, calm]:
		_to_second_shift(farm)
		farm.advance(STRIKES_AT)

	assert_almost_eq(_exhaustion_running(calm, LENGTH), PER_SECOND * LENGTH, 0.001)
	assert_almost_eq(_exhaustion_running(_farm, LENGTH), PER_SECOND * LENGTH * FACTOR, 0.001)


func test_exhaustion_is_back_to_normal_once_it_passes() -> void:
	_to_second_shift(_farm)
	_farm.advance(STRIKES_AT + LENGTH)

	assert_almost_eq(_exhaustion_running(_farm, 10.0), PER_SECOND * 10.0, 0.001)


func test_a_heatwave_never_touches_growth() -> void:
	_to_second_shift(_farm)
	_farm.advance(STRIKES_AT)
	_farm.plant(0)
	_farm.run_generator()

	_farm.advance(10.0)

	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0)


func test_the_debug_command_brings_a_heatwave_at_once() -> void:
	_to_second_shift(_farm)

	_farm.debug_disaster_now(Farm.HEATWAVE)

	assert_eq(_disaster(_farm).phase, DisasterView.Phase.STRIKING)
	assert_eq(_disaster(_farm).kind, Farm.HEATWAVE)
	assert_eq(_keys(_farm.take_messages()), [Farm.HEATWAVE_STRUCK] as Array[StringName])
