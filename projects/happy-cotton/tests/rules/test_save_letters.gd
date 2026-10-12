extends GutTest
## Saving the Children's letters, through the Farm's public interface: the letters received,
## the letter Shifts passed and whether they are stopped survive a save, and a save from
## before the letters restores with none. With the test table a letter arrives at the start of
## every second Shift; with the billing table the school fees at the end of Shift 3 go unpaid.

const PLOTS := 4


## The save as the store writes and reads it back.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


## Ends `shifts` Shifts with nothing picked, serving each Study Session that follows.
func _miss_shifts(farm: Farm, shifts: int) -> void:
	for shift in shifts:
		farm.advance(farm.shift().seconds_left)
		farm.advance(farm.study_session_seconds_left())


## What a player could see of the letters, and what the Family sent.
func _seen(farm: Farm) -> Dictionary:
	var family_events := []
	for event in farm.take_family_events():
		family_events.append([event.kind, event.id])
	return {
		"shift": farm.shift().number,
		"letters": [farm.letters_received(), farm.letters_stopped()],
		"family_events": family_events,
	}


## A Farm with the letters played to this point, its queues emptied as a restore empties them.
func _played(tuning: Tuning, shifts: int) -> Farm:
	var farm := Farm.new(tuning, PLOTS)
	_miss_shifts(farm, shifts)
	farm.take_family_events()
	farm.take_messages()
	return farm


func _assert_play_alike(saved: Farm, restored: Farm, shifts: int, what: String) -> void:
	_miss_shifts(saved, shifts)
	_miss_shifts(restored, shifts)
	assert_eq(_seen(restored), _seen(saved), what)


func test_the_letters_survive_a_save_and_the_next_one_still_comes() -> void:
	var saved := _played(FastTuning.table(), 2)
	var restored := Farm.new(FastTuning.table(), PLOTS)

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(restored.letters_received(), [Farm.LETTER_IDS[0]])
	_assert_play_alike(saved, restored, 1, "Shift 4 brings the second letter")


func test_letters_stopped_by_unpaid_fees_stay_stopped_after_a_save() -> void:
	var saved := _played(FastTuning.billing_table(), 3)
	var restored := Farm.new(FastTuning.billing_table(), PLOTS)

	restored.restore(_through_json(saved.to_save()))

	assert_true(restored.letters_stopped())
	_assert_play_alike(saved, restored, 3, "no letter while stopped")


func test_a_save_from_before_the_letters_restores_with_none() -> void:
	var save := _through_json(_played(FastTuning.table(), 2).to_save())
	save["version"] = 5
	save.erase("letters")
	var restored := Farm.new(FastTuning.table(), PLOTS)

	var problems := restored.restore(save)

	assert_eq(problems, [] as Array[String])
	assert_eq(restored.letters_received(), [] as Array[StringName])
	_miss_shifts(restored, 1)
	var arrived := restored.take_family_events()
	assert_eq(arrived.size(), 1)
	assert_eq(arrived[0].id, Farm.LETTER_IDS[0], "the first letter comes first")


func test_a_save_with_an_unknown_letter_is_damaged_and_changes_nothing() -> void:
	var save := _through_json(_played(FastTuning.table(), 2).to_save())
	var letters: Dictionary = save["letters"]
	letters["received"] = ["letter_01", "a_letter_never_written"]
	var farm := Farm.new(FastTuning.table(), PLOTS)
	var fresh := farm.to_save()

	var problems := farm.restore(save)

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "letters.received")
	assert_eq(farm.to_save(), fresh)
