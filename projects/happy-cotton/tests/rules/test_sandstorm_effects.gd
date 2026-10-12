extends GutTest
## What a Sandstorm does, through the Farm's public interface: growth per second of running is
## slowed while it lasts, the Quota never changes for it, it is never saved (closing the game
## ends it), and the debug command brings one at once. Its timing is in test_sandstorm.gd.

const WARNING := FastTuning.DISASTER_WARNING_SECONDS
const LENGTH := FastTuning.DISASTER_SECONDS
const FACTOR := FastTuning.SANDSTORM_GROWTH_FACTOR
## With every roll at 0.5, the Sandstorm strikes halfway between the earliest moment (the
## warning's length into the Shift) and the latest (its own length before the end): 45 seconds
## in, warned of at 35.
const STRIKES_AT := 45.0
const WARNED_AT := STRIKES_AT - WARNING

## The source of chance every roll returns.
var _roll_value := 0.5
var _farm: Farm


func before_each() -> void:
	_roll_value = 0.5
	_farm = _new_farm(FastTuning.with_sandstorms(FastTuning.table()))


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


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


## The Farm's save as it comes back from the browser's storage.
func _saved(farm: Farm) -> Dictionary:
	var parsed: Dictionary = JSON.parse_string(JSON.stringify(farm.to_save(), "", true, true))
	return parsed


func _disaster(farm: Farm) -> DisasterView:
	return farm.shift().disaster


func test_a_sandstorm_slows_growth_while_it_lasts() -> void:
	var calm := _new_farm(FastTuning.table())
	for farm: Farm in [_farm, calm]:
		_to_second_shift(farm)
		farm.advance(STRIKES_AT)
		farm.plant(0)
		farm.run_generator()

	_farm.advance(LENGTH)
	calm.advance(LENGTH)

	assert_eq(calm.plot(0).seconds_left, FastTuning.GROW_SECONDS - LENGTH)
	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - LENGTH * FACTOR)


func test_growth_is_back_to_full_speed_once_it_passes() -> void:
	_to_second_shift(_farm)
	_farm.advance(STRIKES_AT + LENGTH)
	_farm.plant(0)
	_farm.run_generator()

	_farm.advance(10.0)

	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0)


func test_the_quota_never_changes_for_it() -> void:
	var calm := _new_farm(FastTuning.table())
	for farm: Farm in [_farm, calm]:
		_to_second_shift(farm)
		farm.advance(STRIKES_AT)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.STRIKING)
	assert_eq(_farm.shift().quota, calm.shift().quota, "while it strikes")

	for farm: Farm in [_farm, calm]:
		HandingIn.finish_shift(farm)
	assert_eq(_farm.shift().quota, calm.shift().quota, "in the next Shift")


func test_a_planned_sandstorm_is_not_saved() -> void:
	_to_second_shift(_farm)
	_farm.advance(WARNED_AT - 5.0)
	var restored := _new_farm(FastTuning.with_sandstorms(FastTuning.table()))

	assert_eq(restored.restore(_saved(_farm)), [])

	restored.advance(restored.shift().seconds_left)
	var keys := _keys(restored.take_messages())
	assert_does_not_have(keys, Farm.SANDSTORM_WARNED)
	assert_does_not_have(keys, Farm.SANDSTORM_STRUCK)


func test_a_running_sandstorm_ends_with_the_game_closed() -> void:
	_to_second_shift(_farm)
	_farm.advance(STRIKES_AT)
	var restored := _new_farm(FastTuning.with_sandstorms(FastTuning.table()))

	assert_eq(restored.restore(_saved(_farm)), [])

	assert_eq(_disaster(restored).phase, DisasterView.Phase.NONE)
	restored.plant(0)
	restored.run_generator()
	restored.advance(10.0)
	assert_eq(restored.plot(0).seconds_left, FastTuning.GROW_SECONDS - 10.0, "full speed")


func test_the_next_shift_after_a_restore_rolls_again() -> void:
	_to_second_shift(_farm)
	var restored := _new_farm(FastTuning.with_sandstorms(FastTuning.table()))
	restored.restore(_saved(_farm))

	_to_second_shift(restored)
	restored.advance(WARNED_AT)

	assert_eq(_disaster(restored).phase, DisasterView.Phase.WARNED)


func test_debug_strikes_one_at_once() -> void:
	var farm := _new_farm(FastTuning.table())

	farm.debug_disaster_now(Farm.SANDSTORM)

	assert_eq(_disaster(farm).phase, DisasterView.Phase.STRIKING)
	assert_eq(_disaster(farm).seconds_left, LENGTH)
	assert_has(_keys(farm.take_messages()), Farm.SANDSTORM_STRUCK)


func test_debug_cuts_it_to_the_shift_left() -> void:
	var farm := _new_farm(FastTuning.table())
	farm.advance(FastTuning.SHIFT_SECONDS - 5.0)

	farm.debug_disaster_now(Farm.SANDSTORM)
	assert_eq(_disaster(farm).seconds_left, 5.0)
	farm.take_messages()
	farm.advance(5.0)

	var keys := _keys(farm.take_messages())
	assert_eq(keys, [Farm.DISASTER_PASSED, Farm.HAND_IN_OPENED] as Array[StringName])


func test_debug_does_nothing_at_an_open_hand_in() -> void:
	var farm := _new_farm(FastTuning.table())
	farm.advance(FastTuning.SHIFT_SECONDS)
	farm.take_messages()

	farm.debug_disaster_now(Farm.SANDSTORM)

	assert_eq(_disaster(farm).phase, DisasterView.Phase.NONE)
	assert_eq(farm.take_messages(), [] as Array[AppMessage])
