extends GutTest
## Letters from the Children, through the Farm's public interface. With the test table a letter
## arrives at the start of every second Shift (2, 4, 6...). With the fees table the only Bill is
## the school fees, 15 at the end of Shift 3, so a Worker who earned nothing falls 15 into Debt
## there and the letters stop; three picks (15) clear it and they start again.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.table())


func _fees_table() -> Tuning:
	var tuning := FastTuning.billing_table()
	tuning.electricity_per_lap = 0.0
	tuning.rent_per_shift = 0.0
	tuning.school_fees = 15.0
	return tuning


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning)
	farm.take_family_events()
	return farm


## Grows and picks `picks` crops one at a time.
func _earn(picks: int) -> void:
	for pick in picks:
		_farm.plant(0)
		_farm.run_generator()
		_farm.advance(FastTuning.GROW_SECONDS)
		_farm.pick(0)


## Ends the Shift and serves any Study Session a missed Quota started, so the next Shift runs.
func _end_shift() -> void:
	_farm.advance(_farm.shift().seconds_left)
	_farm.advance(_farm.study_session_seconds_left())


func _end_shifts(count: int) -> void:
	for shift in count:
		_end_shift()


func _letters_arrived(events: Array[FamilyEvent]) -> Array[StringName]:
	var ids: Array[StringName] = []
	for event in events:
		if event.kind == Farm.LETTER_ARRIVED:
			ids.append(event.id)
	return ids


func _kinds(events: Array[FamilyEvent]) -> Array[StringName]:
	var kinds: Array[StringName] = []
	for event in events:
		kinds.append(event.kind)
	return kinds


func test_a_new_game_has_no_letters() -> void:
	assert_eq(_farm.letters_received(), [] as Array[StringName])
	assert_false(_farm.letters_stopped())


func test_the_first_letter_arrives_at_the_start_of_the_second_shift() -> void:
	_end_shift()

	assert_eq(_farm.shift().number, 2)
	assert_eq(_letters_arrived(_farm.take_family_events()), [Farm.LETTER_IDS[0]])
	assert_eq(_farm.letters_received(), [Farm.LETTER_IDS[0]])


func test_no_letter_comes_between_letter_shifts() -> void:
	_end_shift()
	_farm.take_family_events()

	_end_shift()

	assert_eq(_farm.shift().number, 3)
	assert_eq(_farm.take_family_events(), [] as Array[FamilyEvent])


func test_letters_come_in_order_every_second_shift() -> void:
	_end_shifts(6)

	var expected: Array[StringName] = [Farm.LETTER_IDS[0], Farm.LETTER_IDS[1], Farm.LETTER_IDS[2]]
	assert_eq(_letters_arrived(_farm.take_family_events()), expected)
	assert_eq(_farm.letters_received(), expected)


func test_letters_are_not_app_messages() -> void:
	_end_shift()

	for message in _farm.take_messages():
		assert_false(str(message.key).contains("letter"), "%s is not a letter" % message.key)


func test_when_the_list_runs_out_no_new_letters_come() -> void:
	_end_shifts(Farm.LETTER_IDS.size() * FastTuning.LETTER_EVERY_SHIFTS)
	_farm.take_family_events()

	_end_shifts(4)

	assert_eq(_farm.take_family_events(), [] as Array[FamilyEvent])
	assert_eq(_farm.letters_received(), Farm.LETTER_IDS)


func test_unpaid_school_fees_stop_the_letters() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(2)
	_farm.take_family_events()

	_end_shift()

	assert_true(_farm.letters_stopped())
	assert_eq(_kinds(_farm.take_family_events()), [Farm.LETTERS_STOPPED])


func test_no_letter_comes_while_they_are_stopped() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(2)
	_farm.take_family_events()

	# Shift 3 ends with the fees unpaid, and Shift 4, a letter Shift, begins.
	_end_shift()

	assert_eq(_farm.shift().number, 4)
	assert_eq(_letters_arrived(_farm.take_family_events()), [] as Array[StringName])
	assert_eq(_farm.letters_received(), [Farm.LETTER_IDS[0]])


func test_clearing_the_debt_starts_the_letters_again() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(3)
	_farm.take_family_events()

	_earn(3)

	assert_eq(_farm.debt(), 0)
	assert_false(_farm.letters_stopped())
	assert_eq(_kinds(_farm.take_family_events()), [Farm.LETTERS_STARTED_AGAIN])


func test_paying_only_part_of_the_debt_keeps_the_letters_stopped() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(3)
	_farm.take_family_events()

	_earn(1)

	assert_gt(_farm.debt(), 0)
	assert_true(_farm.letters_stopped())
	assert_eq(_farm.take_family_events(), [] as Array[FamilyEvent])


func test_letters_missed_while_stopped_are_skipped_for_good() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(4)
	_earn(3)
	_farm.take_family_events()

	_end_shift()

	# Shift 4's letter was missed; Shift 6 brings the third letter, not the second.
	assert_eq(_farm.shift().number, 6)
	assert_eq(_letters_arrived(_farm.take_family_events()), [Farm.LETTER_IDS[2]])
	assert_eq(_farm.letters_received(), [Farm.LETTER_IDS[0], Farm.LETTER_IDS[2]])


func test_debt_that_is_not_from_school_fees_never_stops_the_letters() -> void:
	var tuning := _fees_table()
	tuning.rent_per_shift = FastTuning.RENT_PER_SHIFT
	tuning.school_fees = 0.0
	_farm = _new_farm(tuning)

	_end_shifts(2)

	assert_gt(_farm.debt(), 0)
	assert_false(_farm.letters_stopped())
	assert_eq(_letters_arrived(_farm.take_family_events()), [Farm.LETTER_IDS[0]])


func test_the_debug_labour_points_can_start_the_letters_again() -> void:
	_farm = _new_farm(_fees_table())
	_end_shifts(3)
	_farm.take_family_events()

	_farm.debug_add_labour_points(100)

	assert_false(_farm.letters_stopped())
	assert_eq(_kinds(_farm.take_family_events()), [Farm.LETTERS_STARTED_AGAIN])


func test_letter_ids_are_unique() -> void:
	var seen := {}
	for id in Farm.LETTER_IDS:
		assert_false(seen.has(id), "%s appears once" % id)
		seen[id] = true
