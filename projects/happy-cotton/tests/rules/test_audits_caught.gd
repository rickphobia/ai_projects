extends GutTest
## Being caught by a Harmony Audit, being on watch after it, and audits in the save, through the
## Farm's public interface. With the fast table the Farm has 4 Plots that should yield 8 picks a
## Shift; an ordinary audit lets 2 kept of 8 pass. Being caught starts a 120-second Study
## Session and puts him on watch for 2 Shifts, when the chance doubles and any cut is found.

const SAVINGS := FastTuning.HIDDEN_SAVINGS_PER_KEPT_PICK

var _roll_value := 0.0
var _farm: Farm


func before_each() -> void:
	_roll_value = 0.0
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return _roll_value)
	farm.take_messages()
	return farm


## Plants the 4 Plots, runs the Generator until they ripen and picks them all, `rounds` times.
func _pick_cotton(rounds: int) -> void:
	for round_picked in rounds:
		for index in FastTuning.FIRST_PLOTS:
			_farm.plant(index)
		_farm.run_generator()
		_farm.advance(FastTuning.GROW_SECONDS)
		for index in FastTuning.FIRST_PLOTS:
			_farm.pick(index)


## Picks `rounds` times, plays out the Shift and hands in all but `kept`, without serving a
## Study Session it starts. Returns the messages from the Hand-in on.
func _hand_in_keeping(kept: int, rounds: int = 2) -> Array[AppMessage]:
	_farm.advance(_farm.study_session_seconds_left())
	_pick_cotton(rounds)
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.take_messages()
	_farm.hand_in(_farm.shift().picked - kept)
	return _farm.take_messages()


## Plans an audit and keeps 3 of 8 back: caught.
func _get_caught() -> Array[AppMessage]:
	_farm.debug_plan_audit()
	return _hand_in_keeping(3)


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


func _count(key: StringName, messages: Array[AppMessage]) -> int:
	var found := 0
	for message in messages:
		if message.key == key:
			found += 1
	return found


func _whole(message: AppMessage, key: String) -> int:
	var value: int = message.values[key]
	return value


func _fraction(message: AppMessage, key: String) -> float:
	var value: float = message.values[key]
	return value


## The save as it comes back from the save store: through JSON.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Dictionary = JSON.parse_string(JSON.stringify(save))
	return parsed


func test_being_caught_takes_all_hidden_savings() -> void:
	_hand_in_keeping(2)

	var caught := _message(Farm.CAUGHT, _get_caught())

	assert_eq(_whole(caught, "income_recovered"), 5 * SAVINGS)
	assert_eq(_farm.hidden_savings(), 0)


func test_being_caught_starts_the_caught_study_session() -> void:
	var messages := _get_caught()

	assert_eq(_farm.study_session_seconds_left(), FastTuning.CAUGHT_STUDY_SESSION_SECONDS)
	var minutes := ceili(FastTuning.CAUGHT_STUDY_SESSION_SECONDS / 60.0)
	assert_eq(_whole(_message(Farm.CAUGHT, messages), "minutes"), minutes)


func test_caught_with_a_missed_quota_starts_only_the_caught_study_session() -> void:
	_farm.debug_plan_audit()

	# 4 picked, 3 kept: 1 handed in misses the Quota of 3.
	var messages := _hand_in_keeping(3, 1)

	assert_not_null(_message(Farm.QUOTA_MISSED, messages))
	assert_eq(_count(Farm.STUDY_SESSION_STARTED, messages), 1)
	assert_eq(_farm.study_session_seconds_left(), FastTuning.CAUGHT_STUDY_SESSION_SECONDS)


func test_being_caught_puts_him_on_watch_and_counts_the_catch() -> void:
	var messages := _get_caught()

	var caught := _message(Farm.CAUGHT, messages)
	assert_eq(_whole(caught, "watch_shifts"), FastTuning.ON_WATCH_SHIFTS)
	assert_eq(_whole(caught, "times_caught"), 1)
	assert_eq(_farm.audit().watch_shifts_left, FastTuning.ON_WATCH_SHIFTS)
	assert_eq(_farm.audit().times_caught, 1)


func test_on_watch_doubles_the_chance() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 0.2
	_roll_value = 0.99
	_farm = _new_farm(tuning)

	var messages := _get_caught()

	var started := _message(Farm.SHIFT_STARTED, messages)
	assert_almost_eq(_fraction(started, "audit_chance"), 0.4, 0.0001)


func test_on_watch_any_cut_is_caught_and_a_second_catch_has_its_own_message() -> void:
	_get_caught()
	_farm.debug_plan_audit()

	var messages := _hand_in_keeping(1)

	assert_null(_message(Farm.CAUGHT, messages))
	var again := _message(Farm.CAUGHT_AGAIN, messages)
	assert_eq(_fraction(again, "tolerance"), 0.0)
	assert_eq(_whole(again, "times_caught"), 2)
	assert_eq(_farm.audit().times_caught, 2)


func test_on_watch_nothing_kept_passes() -> void:
	_get_caught()
	_farm.debug_plan_audit()

	var messages := _hand_in_keeping(0)

	assert_not_null(_message(Farm.AUDIT_PASSED, messages))


func test_the_shift_he_was_caught_for_is_settled() -> void:
	_get_caught()
	_farm.debug_plan_audit()

	# The 3 kept before the catch no longer count against him.
	var messages := _hand_in_keeping(0)

	assert_eq(_fraction(_message(Farm.AUDIT_PASSED, messages), "kept_share"), 0.0)


func test_on_watch_ends_after_its_shifts() -> void:
	_get_caught()

	var first := _hand_in_keeping(0)
	var watch_after_first := _farm.audit().watch_shifts_left
	var second := _hand_in_keeping(0)

	assert_eq(watch_after_first, FastTuning.ON_WATCH_SHIFTS - 1)
	assert_null(_message(Farm.ON_WATCH_ENDED, first))
	assert_not_null(_message(Farm.ON_WATCH_ENDED, second))
	assert_eq(_farm.audit().watch_shifts_left, 0)


func test_a_planned_audit_survives_a_save_and_restore() -> void:
	_farm.debug_plan_audit()
	var restored := _new_farm(FastTuning.table())

	restored.restore(_through_json(_farm.to_save()))
	_farm = restored

	assert_not_null(_message(Farm.CAUGHT, _hand_in_keeping(3)))


func test_the_record_on_watch_and_catches_survive_a_save_and_restore() -> void:
	var tuning := FastTuning.table()
	tuning.audit_chance_per_kept_share = 1.0
	# Only the debug command plans an audit here.
	_roll_value = 0.99
	_farm = _new_farm(tuning)
	_get_caught()
	_hand_in_keeping(2)
	var restored := _new_farm(tuning)

	var problems := restored.restore(_through_json(_farm.to_save()))
	_farm = restored

	assert_eq(problems, [] as Array[String])
	assert_eq(_farm.audit().times_caught, 1)
	assert_eq(_farm.audit().watch_shifts_left, FastTuning.ON_WATCH_SHIFTS - 1)
	var started := _message(Farm.SHIFT_STARTED, _hand_in_keeping(0))
	# 2 of 16 over the two Shifts remembered since the catch; on watch has just ended.
	assert_almost_eq(_fraction(started, "audit_chance"), 2.0 / 16.0, 0.0001)


func test_a_save_from_before_audits_restores_with_a_clean_record() -> void:
	_get_caught()
	var save := _farm.to_save()
	save["version"] = 11
	save.erase("audits")

	var problems := _farm.restore(_through_json(save))

	assert_eq(problems, [] as Array[String])
	assert_eq(_farm.audit().times_caught, 0)
	assert_eq(_farm.audit().watch_shifts_left, 0)


func test_a_save_with_mismatched_audit_lists_is_damaged() -> void:
	var save := _farm.to_save()
	save["audits"]["kept"] = [1, 2]
	save["audits"]["yielded"] = [8]

	var problems := _farm.restore(_through_json(save))

	assert_has(problems, "audits.yielded has 1 entries, not 2")
