extends GutTest
## The Shift, the Quota and Labour Points, through the Farm's public interface. Time moves
## only when the test calls advance.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.table())


## Plants `count` plots (at most PLOTS), runs the Generator until they ripen and picks them
## all: `count` picks in one grow time of play.
func _pick_cotton(count: int) -> void:
	for index in count:
		_farm.plant(index)
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.GROW_SECONDS)
	for index in count:
		_farm.pick(index)


func _keys(messages: Array[AppMessage]) -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in messages:
		keys.append(message.key)
	return keys


func test_a_new_farm_starts_the_first_shift_with_the_first_quota_and_no_points() -> void:
	var shift := _farm.shift()

	assert_eq(shift.number, 1)
	assert_eq(shift.quota, FastTuning.FIRST_QUOTA)
	assert_eq(shift.picked, 0)
	assert_eq(shift.seconds_left, FastTuning.SHIFT_SECONDS)
	assert_eq(_farm.labour_points(), 0)


func test_a_new_farm_tells_of_the_children_then_announces_the_first_shift() -> void:
	var messages := _farm.take_messages()

	var expected: Array[StringName] = [Farm.CHILDREN_AT_SCHOOL, Farm.SHIFT_STARTED]
	assert_eq(_keys(messages), expected)
	# The first Shift never rolls an audit.
	var started := {
		"shift": 1, "quota": FastTuning.FIRST_QUOTA, "audit_chance": 0.0, "audit_planned": false
	}
	assert_eq(messages[1].values, started)


func test_taking_messages_empties_the_queue() -> void:
	_farm.take_messages()

	assert_eq(_farm.take_messages(), [] as Array[AppMessage])


func test_the_shift_counts_down_with_online_play() -> void:
	HandingIn.advance(_farm, 40.0)

	assert_eq(_farm.shift().seconds_left, 60.0)


func test_negative_time_does_not_wind_the_shift_back() -> void:
	HandingIn.advance(_farm, 40.0)
	HandingIn.advance(_farm, -10.0)

	assert_eq(_farm.shift().seconds_left, 60.0)


func test_each_pick_counts_towards_the_quota_and_earns_labour_points_at_the_hand_in() -> void:
	_pick_cotton(2)

	assert_eq(_farm.shift().picked, 2)
	assert_eq(_farm.labour_points(), 0, "nothing is paid at a pick")
	HandingIn.finish_shift(_farm)
	assert_eq(_farm.labour_points(), 2 * FastTuning.LABOUR_POINTS_PER_PICK)


func test_a_refused_pick_earns_nothing() -> void:
	_farm.plant(0)
	_farm.pick(0)

	assert_eq(_farm.shift().picked, 0)
	assert_eq(_farm.labour_points(), 0)


func test_a_met_quota_is_praised_at_the_end_of_the_shift_and_not_before() -> void:
	_pick_cotton(3)
	_farm.take_messages()

	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS - 1.0)
	assert_eq(_farm.take_messages(), [] as Array[AppMessage], "no check before the end")
	HandingIn.advance(_farm, 1.0)

	var messages := _farm.take_messages()
	var expected: Array[StringName] = [
		Farm.HAND_IN_OPENED, Farm.HANDED_IN, Farm.QUOTA_MET, Farm.PAY_SLIP, Farm.SHIFT_STARTED
	]
	assert_eq(_keys(messages), expected)
	assert_eq(messages[2].values, {"shift": 1, "picked": 3, "quota": 3})


func test_a_missed_quota_is_reported_at_the_end_of_the_shift() -> void:
	_pick_cotton(2)
	_farm.take_messages()

	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS)

	var messages := _farm.take_messages()
	var expected: Array[StringName] = [
		Farm.HAND_IN_OPENED,
		Farm.HANDED_IN,
		Farm.QUOTA_MISSED,
		Farm.STUDY_SESSION_STARTED,
		Farm.PAY_SLIP,
		Farm.SHIFT_STARTED,
	]
	assert_eq(_keys(messages), expected)
	assert_eq(messages[2].values, {"shift": 1, "picked": 2, "quota": 3})


func test_the_next_shift_starts_at_once_with_a_higher_quota() -> void:
	_farm.take_messages()

	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)

	var shift := _farm.shift()
	var raised := FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE
	assert_eq(shift.number, 2)
	assert_eq(shift.quota, raised)
	assert_eq(shift.seconds_left, FastTuning.SHIFT_SECONDS)
	var started := {"shift": 2, "quota": raised, "audit_chance": 0.0, "audit_planned": false}
	assert_eq(_farm.take_messages()[-1].values, started)


func test_time_past_the_end_of_a_shift_carries_into_the_next() -> void:
	_pick_cotton(3)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS + 25.0)

	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS - 25.0)


func test_one_long_step_ends_every_shift_it_covers() -> void:
	_farm.take_messages()

	# Three missed Shifts and the Study Sessions after the first two (20 and 40 seconds).
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS * 3 + 60.0)

	assert_eq(_farm.shift().number, 4)
	var expected: Array[StringName] = [
		Farm.HAND_IN_OPENED,
		Farm.HANDED_IN,
		Farm.QUOTA_MISSED,
		Farm.STUDY_SESSION_STARTED,
		Farm.PAY_SLIP,
		Farm.SHIFT_STARTED,
		Farm.STUDY_SESSION_ENDED,
		Farm.HAND_IN_OPENED,
		Farm.HANDED_IN,
		Farm.QUOTA_MISSED_AGAIN,
		Farm.STUDY_SESSION_STARTED,
		Farm.PAY_SLIP,
		Farm.SHIFT_STARTED,
		Farm.STUDY_SESSION_ENDED,
		Farm.HAND_IN_OPENED,
		Farm.HANDED_IN,
		Farm.QUOTA_MISSED_REPEATEDLY,
		Farm.STUDY_SESSION_STARTED,
		Farm.PAY_SLIP,
		Farm.SHIFT_STARTED,
	]
	assert_eq(_keys(_farm.take_messages()), expected)


func test_the_quota_rises_every_shift_whether_met_or_missed() -> void:
	var quotas: Array[int] = [_farm.shift().quota]
	_pick_cotton(3)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS)
	quotas.append(_farm.shift().quota)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)
	quotas.append(_farm.shift().quota)

	assert_eq(quotas, [3, 5, 7] as Array[int], "met, then missed: it still rises")


func test_picks_above_the_quota_are_praised_but_carry_no_credit_forward() -> void:
	_pick_cotton(4)
	_farm.take_messages()
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS)

	var first_end := _farm.take_messages()
	assert_eq(first_end[2].key, Farm.QUOTA_MET)
	assert_eq(first_end[2].values, {"shift": 1, "picked": 4, "quota": 3})
	assert_eq(_farm.shift().picked, 0, "the new Shift starts from nothing")
	assert_eq(_farm.shift().quota, 5, "the surplus doesn't lower the next Quota")

	_pick_cotton(4)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS)

	var second_end := _farm.take_messages()
	assert_eq(second_end[2].key, Farm.QUOTA_MISSED, "4 + no credit is short of 5")
	assert_eq(second_end[2].values, {"shift": 2, "picked": 4, "quota": 5})


func test_labour_points_are_kept_across_shifts() -> void:
	_pick_cotton(1)

	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.labour_points(), FastTuning.LABOUR_POINTS_PER_PICK)


func test_a_full_shift_of_play() -> void:
	_farm.take_messages()
	for _round in 3:
		_pick_cotton(1)
		HandingIn.advance(_farm, 3.0)

	assert_eq(_farm.shift().seconds_left, 1.0)
	assert_eq(_farm.shift().picked, 3)
	assert_eq(_farm.take_messages(), [] as Array[AppMessage])

	HandingIn.advance(_farm, 1.0)

	assert_eq(_farm.take_messages()[2].key, Farm.QUOTA_MET)
	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.labour_points(), 3 * FastTuning.LABOUR_POINTS_PER_PICK)


func test_a_shift_view_does_not_change_when_the_farm_does() -> void:
	var before := _farm.shift()

	_pick_cotton(1)

	assert_eq(before.picked, 0)
	assert_eq(before.seconds_left, FastTuning.SHIFT_SECONDS)


func test_every_key_the_rules_emit_is_listed() -> void:
	var emitted: Array[StringName] = [
		Farm.SHIFT_STARTED,
		Farm.HAND_IN_OPENED,
		Farm.HANDED_IN,
		Farm.QUOTA_MET,
		Farm.QUOTA_MISSED,
		Farm.QUOTA_MISSED_AGAIN,
		Farm.QUOTA_MISSED_REPEATEDLY,
		Farm.STUDY_SESSION_STARTED,
		Farm.STUDY_SESSION_ENDED,
		Farm.NEGLIGENCE_LOGGED,
		Farm.AWAY_SUMMARY,
		Farm.REST_STARTED,
		Farm.REST_ENDED,
		Farm.CALL_STARTED,
		Farm.COTTON_DROPPED,
		Farm.GENERATOR_UPGRADED,
		Farm.TOOLS_UPGRADED,
		Farm.PLOT_BOUGHT,
		Farm.PAY_SLIP,
		Farm.FELL_INTO_DEBT,
		Farm.DEBT_CLEARED,
		Farm.CHILDREN_AT_SCHOOL,
		Farm.AUDIT_ANNOUNCED,
		Farm.AUDIT_PASSED,
		Farm.CAUGHT,
		Farm.CAUGHT_AGAIN,
		Farm.ON_WATCH_ENDED,
		Farm.SUPPLY_BOUGHT,
		Farm.BOLLWORMS_ARRIVED,
		Farm.CROP_EATEN,
	]
	assert_eq(Farm.MESSAGE_KEYS, emitted)
