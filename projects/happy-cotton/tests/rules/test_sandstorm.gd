extends GutTest
## Sandstorms, through the Farm's public interface: at the start of every Shift after the first
## one may be planned, and if so when it strikes. The App warns of it a set time before; it
## lasts a set time, counted in online Shift time, and ends within the Shift. While it lasts,
## growth per second of running is slowed (see test_sandstorm_effects.gd).

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


func _disaster(farm: Farm) -> DisasterView:
	return farm.shift().disaster


func test_the_first_shift_has_no_sandstorm() -> void:
	var messages: Array[AppMessage] = []
	for second in roundi(FastTuning.SHIFT_SECONDS):
		_farm.advance(1.0)
		assert_eq(_disaster(_farm).phase, DisasterView.Phase.NONE)
	messages.append_array(_farm.take_messages())

	assert_does_not_have(_keys(messages), Farm.SANDSTORM_WARNED)
	assert_does_not_have(_keys(messages), Farm.SANDSTORM_STRUCK)


func test_the_plan_is_secret_until_the_warning() -> void:
	_to_second_shift(_farm)

	_farm.advance(WARNED_AT - 1.0)

	assert_eq(_disaster(_farm).phase, DisasterView.Phase.NONE)
	assert_eq(_disaster(_farm).kind, &"")
	assert_eq(_farm.take_messages(), [] as Array[AppMessage])


func test_the_app_warns_a_set_time_before_it_strikes() -> void:
	_to_second_shift(_farm)

	_farm.advance(WARNED_AT)

	var disaster := _disaster(_farm)
	assert_eq(disaster.phase, DisasterView.Phase.WARNED)
	assert_eq(disaster.kind, Farm.SANDSTORM)
	assert_eq(disaster.seconds_left, WARNING)
	var warned := _message(Farm.SANDSTORM_WARNED, _farm.take_messages())
	assert_not_null(warned, "The App warns of it")
	var seconds: float = warned.values["seconds"]
	assert_eq(seconds, WARNING)


func test_the_warning_counts_down_to_the_strike() -> void:
	_to_second_shift(_farm)
	_farm.advance(WARNED_AT)
	_farm.take_messages()

	_farm.advance(WARNING - 4.0)
	assert_eq(_disaster(_farm).seconds_left, 4.0)

	_farm.advance(4.0)
	var disaster := _disaster(_farm)
	assert_eq(disaster.phase, DisasterView.Phase.STRIKING)
	assert_eq(disaster.seconds_left, LENGTH)
	var struck := _message(Farm.SANDSTORM_STRUCK, _farm.take_messages())
	assert_not_null(struck, "The App cheers")
	var seconds: float = struck.values["seconds"]
	assert_eq(seconds, LENGTH)


func test_it_passes_after_its_length_and_none_comes_again_that_shift() -> void:
	_to_second_shift(_farm)
	_farm.advance(STRIKES_AT)
	_farm.take_messages()

	_farm.advance(LENGTH - 1.0)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.STRIKING)
	assert_eq(_disaster(_farm).seconds_left, 1.0)
	_farm.advance(1.0)

	assert_eq(_disaster(_farm).phase, DisasterView.Phase.NONE)
	var passed := _message(Farm.DISASTER_PASSED, _farm.take_messages())
	assert_not_null(passed, "The App says it passed")
	var kind: StringName = passed.values["kind"]
	assert_eq(kind, Farm.SANDSTORM)
	_farm.advance(_farm.shift().seconds_left)
	assert_eq(_keys(_farm.take_messages()), [Farm.HAND_IN_OPENED] as Array[StringName])


func test_one_long_step_warns_strikes_and_passes_in_order() -> void:
	_to_second_shift(_farm)

	_farm.advance(STRIKES_AT + LENGTH)

	var keys := _keys(_farm.take_messages())
	assert_eq(
		keys,
		[Farm.SANDSTORM_WARNED, Farm.SANDSTORM_STRUCK, Farm.DISASTER_PASSED] as Array[StringName]
	)


func test_the_roll_decides_whether_one_comes() -> void:
	var tuning := FastTuning.table()
	tuning.sandstorm_chance = 0.5
	var farm := _new_farm(tuning)
	_to_second_shift(farm)

	farm.advance(FastTuning.SHIFT_SECONDS)

	assert_does_not_have(_keys(farm.take_messages()), Farm.SANDSTORM_WARNED, "0.5 is not under 0.5")
	_roll_value = 0.49
	farm.hand_in()
	farm.take_messages()
	farm.advance(FastTuning.SHIFT_SECONDS)
	assert_has(_keys(farm.take_messages()), Farm.SANDSTORM_STRUCK, "0.49 is")


func test_the_earliest_strike_is_warned_of_as_the_shift_starts() -> void:
	_roll_value = 0.0
	HandingIn.finish_shift(_farm)

	var disaster := _disaster(_farm)
	assert_eq(disaster.phase, DisasterView.Phase.WARNED)
	assert_eq(disaster.seconds_left, WARNING)
	assert_has(_keys(_farm.take_messages()), Farm.SANDSTORM_WARNED)


func test_the_latest_strike_passes_as_the_shift_ends() -> void:
	_roll_value = 0.999999
	_to_second_shift(_farm)

	_farm.advance(FastTuning.SHIFT_SECONDS)

	var keys := _keys(_farm.take_messages())
	assert_has(keys, Farm.DISASTER_PASSED)
	assert_lt(keys.find(Farm.DISASTER_PASSED), keys.find(Farm.HAND_IN_OPENED), "before the Hand-in")


func test_its_clock_waits_while_a_study_session_holds_the_shift() -> void:
	HandingIn.finish_shift(_farm)
	assert_true(_farm.in_study_session(), "the missed Quota sends him to one")

	_farm.advance(FastTuning.STUDY_SESSION_SECONDS + WARNED_AT - 1.0)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.NONE)
	_farm.advance(1.0)
	assert_eq(_disaster(_farm).phase, DisasterView.Phase.WARNED)


func test_offline_time_moves_it_no_closer() -> void:
	_to_second_shift(_farm)
	_farm.advance(WARNED_AT)

	_farm.resume_offline(500.0)

	assert_eq(_disaster(_farm).phase, DisasterView.Phase.WARNED)
	assert_eq(_disaster(_farm).seconds_left, WARNING)


func test_the_shift_start_carries_the_plan_for_the_log() -> void:
	_farm.take_messages()
	HandingIn.finish_shift(_farm)

	var started := _message(Farm.SHIFT_STARTED, _farm.take_messages())
	var plan: Dictionary = started.values["disaster"]
	var kind: StringName = plan["kind"]
	var strikes_at: float = plan["strikes_at"]
	var seconds: float = plan["seconds"]
	assert_eq(kind, Farm.SANDSTORM)
	assert_eq(strikes_at, STRIKES_AT)
	assert_eq(seconds, LENGTH)
