extends GutTest
## Harmony Audits through the Farm's public interface: the chance each Shift starts with, the
## tell before a planned audit, and what an audit finds. Being caught, on watch and saves are
## in test_audits_caught.gd.
## With the fast table the Farm has 4 Plots that should yield 2 picks each, 8 a Shift; an audit
## looks back 3 Shifts and lets a kept share of a quarter (2 of 8) pass. The first Quota is 3.

## The source of chance every roll returns; tests set it to decide whether an audit comes.
var _roll_value := 0.0
var _farm: Farm


func before_each() -> void:
	_roll_value = 0.0


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return _roll_value)
	farm.take_messages()
	return farm


## Plants the 4 Plots, runs the Generator until they ripen and picks them all, `rounds` times.
func _pick_cotton(rounds: int = 1) -> void:
	for round_picked in rounds:
		for index in FastTuning.FIRST_PLOTS:
			_farm.plant(index)
		_farm.run_generator()
		_farm.advance(FastTuning.GROW_SECONDS)
		for index in FastTuning.FIRST_PLOTS:
			_farm.pick(index)


## Picks, plays out the Shift and hands in all but `kept`; returns the messages from the
## Hand-in opening to the next Shift's start. Any Study Session is served after.
func _play_shift(kept: int, rounds: int = 1) -> Array[AppMessage]:
	_pick_cotton(rounds)
	_farm.take_messages()
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.hand_in(_farm.shift().picked - kept)
	var messages := _farm.take_messages()
	_farm.advance(_farm.study_session_seconds_left())
	_farm.take_messages()
	return messages


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


func _keys(messages: Array[AppMessage]) -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in messages:
		keys.append(message.key)
	return keys


func _next_chance(messages: Array[AppMessage]) -> float:
	return _fraction(_message(Farm.SHIFT_STARTED, messages), "audit_chance")


func _next_planned(messages: Array[AppMessage]) -> bool:
	return _message(Farm.SHIFT_STARTED, messages).values["audit_planned"]


func _whole(message: AppMessage, key: String) -> int:
	var value: int = message.values[key]
	return value


func _fraction(message: AppMessage, key: String) -> float:
	var value: float = message.values[key]
	return value


func test_the_first_shift_has_no_audit() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 1.0
	_farm = _new_farm(tuning)

	_pick_cotton()
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))

	assert_false(Farm.AUDIT_ANNOUNCED in _keys(_farm.take_messages()))
	assert_false(_farm.audit().tell)


func test_an_audit_can_come_when_nothing_was_kept_back() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 0.1
	_farm = _new_farm(tuning)

	var messages := _play_shift(0)

	assert_almost_eq(_next_chance(messages), 0.1, 0.0001)


func test_the_chance_rises_with_the_kept_share() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 0.1
	tuning.audit_chance_per_kept_share = 2.0
	_farm = _new_farm(tuning)

	# 2 kept of the 8 the Plots should yield: a share of 0.25, adding 0.5.
	var messages := _play_shift(2)

	assert_almost_eq(_next_chance(messages), 0.6, 0.0001)


func test_the_chance_falls_as_kept_shifts_drop_out_of_memory() -> void:
	var tuning := FastTuning.table()
	tuning.audit_chance_per_kept_share = 1.0
	_farm = _new_farm(tuning)
	_play_shift(2)
	_play_shift(0)

	var third := _play_shift(0)
	var fourth := _play_shift(0)

	# Shifts 1 to 3 hold 2 kept of 24; once Shift 1 drops out, nothing is kept.
	assert_almost_eq(_next_chance(third), 2.0 / 24.0, 0.0001)
	assert_eq(_next_chance(fourth), 0.0)


func test_hidden_savings_spent_in_the_store_raise_the_chance_a_little() -> void:
	var tuning := FastTuning.table()
	tuning.audit_chance_per_savings_spent = 0.01
	_farm = _new_farm(tuning)
	# Two rounds, so the Quota is met and the call home isn't taken away.
	_play_shift(2, 2)

	_pick_cotton()
	_farm.buy_privilege(Farm.CALL_HOME, Farm.PAY_HIDDEN_SAVINGS)
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.hand_in()

	assert_almost_eq(_next_chance(_farm.take_messages()), FastTuning.CALL_HOME_PRICE * 0.01, 0.0001)


func test_labour_points_spent_in_the_store_dont_raise_the_chance() -> void:
	var tuning := FastTuning.table()
	tuning.audit_chance_per_savings_spent = 0.01
	_farm = _new_farm(tuning)

	_pick_cotton()
	_farm.advance(HandingIn.seconds_to_hand_in(_farm))
	_farm.hand_in()
	_farm.buy_privilege(Farm.CALL_HOME)
	_farm.advance(FastTuning.CALL_HOME_SECONDS)
	var messages := _play_shift(0)

	assert_eq(_next_chance(messages), 0.0)


func test_bills_paid_from_hidden_savings_dont_raise_the_chance() -> void:
	var tuning := FastTuning.billing_table()
	tuning.audit_chance_per_savings_spent = 0.01
	_farm = _new_farm(tuning)

	# Everything kept back: the rent is paid from hidden savings.
	var messages := _play_shift(FastTuning.FIRST_PLOTS)

	assert_gt(_whole(_message(Farm.PAY_SLIP, messages), "rent_from_savings"), 0)
	assert_eq(_next_chance(messages), 0.0)


func test_the_chance_is_at_most_one() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 0.5
	tuning.audit_chance_per_kept_share = 10.0
	_farm = _new_farm(tuning)

	var messages := _play_shift(2)

	assert_eq(_next_chance(messages), 1.0)


func test_an_audit_is_planned_when_the_roll_comes_up_under_the_chance() -> void:
	var tuning := FastTuning.table()
	tuning.audit_base_chance = 0.5
	_farm = _new_farm(tuning)

	_roll_value = 0.49
	var under := _play_shift(0)
	_roll_value = 0.5
	var at := _play_shift(0)

	assert_true(_next_planned(under))
	assert_false(_next_planned(at))


func test_the_overseer_watches_the_scale_for_the_last_part_of_a_shift_with_an_audit() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_plan_audit()

	_farm.advance(FastTuning.SHIFT_SECONDS - FastTuning.AUDIT_TELL_SECONDS - 1.0)
	var before := _farm.audit().tell
	_farm.advance(1.0)

	assert_false(before)
	assert_true(_farm.audit().tell)


func test_no_tell_without_an_audit() -> void:
	_farm = _new_farm(FastTuning.table())

	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_false(_farm.audit().tell)


func test_the_app_announces_a_planned_audit_at_the_hand_in() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_plan_audit()

	_farm.advance(FastTuning.SHIFT_SECONDS)

	var keys := _keys(_farm.take_messages())
	assert_eq(keys.find(Farm.AUDIT_ANNOUNCED), keys.find(Farm.HAND_IN_OPENED) + 1)


func test_an_audit_finds_nothing_at_or_below_the_tolerance() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_plan_audit()

	var messages := _play_shift(2)

	var passed := _message(Farm.AUDIT_PASSED, messages)
	assert_not_null(passed)
	assert_eq(_fraction(passed, "kept_share"), 0.25)
	assert_eq(_fraction(passed, "tolerance"), FastTuning.AUDIT_TOLERANCE)
	assert_eq(_farm.hidden_savings(), 2 * FastTuning.HIDDEN_SAVINGS_PER_KEPT_PICK)
	assert_eq(_farm.audit().times_caught, 0)
	assert_eq(_farm.audit().watch_shifts_left, 0)
	assert_false(_farm.audit().tell)


func test_an_audit_looks_back_over_the_remembered_shifts() -> void:
	_farm = _new_farm(FastTuning.table())
	_play_shift(3)
	_farm.debug_plan_audit()

	# 3 kept last Shift and 1 now: 4 of 16, a quarter, lets it pass; 3 of 8 alone would not.
	var messages := _play_shift(1, 2)

	assert_not_null(_message(Farm.AUDIT_PASSED, messages))


func test_an_audit_catches_a_cut_above_the_tolerance() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_plan_audit()

	var messages := _play_shift(3, 2)

	assert_not_null(_message(Farm.CAUGHT, messages))
	assert_null(_message(Farm.AUDIT_PASSED, messages))
	assert_eq(_farm.audit().times_caught, 1)


func test_a_planned_audit_is_used_up_by_its_hand_in() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_plan_audit()
	_play_shift(0)

	var messages := _play_shift(3, 2)

	assert_null(_message(Farm.CAUGHT, messages))
	assert_null(_message(Farm.AUDIT_PASSED, messages))


func test_an_audit_planned_from_debug_at_an_open_hand_in_is_announced_at_once() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	_farm.debug_plan_audit()

	assert_eq(_keys(_farm.take_messages()), [Farm.AUDIT_ANNOUNCED] as Array[StringName])
