extends GutTest
## Saving the Farm, through its public interface: to_save() gives plain data with a format
## version, and a Farm restored from it (after a trip through JSON, as the save store does)
## plays on exactly as the saved one: through the next rest hour, Shift and Study Session.
## A save that can't be read names what is wrong and leaves the Farm as it was.

const PLOTS := 4
## Never under the dropped-cotton chance, so picks never drop and both Farms roll alike.
const NO_DROPS := 0.9


func _new_farm() -> Farm:
	var farm := Farm.new(FastTuning.exhausting_table(), PLOTS, func() -> float: return NO_DROPS)
	farm.take_messages()
	return farm


## The save as the store writes and reads it back.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


## Two plots picked (the price of a rest hour, one short of the Quota), one growing, one
## ripe, and the Worker part way through a lap on the Generator, tired enough that field work
## is slow.
func _played_farm() -> Farm:
	var farm := _new_farm()
	for index in 3:
		farm.plant(index)
	farm.run_generator()
	farm.advance(FastTuning.GROW_SECONDS + 5.0)
	farm.pick(0)
	farm.advance(FastTuning.SLOW_ACTION_SECONDS)
	farm.pick(1)
	farm.advance(FastTuning.SLOW_ACTION_SECONDS)
	farm.plant(0)
	farm.run_generator()
	farm.advance(12.0)
	farm.take_messages()
	assert_eq(farm.labour_points(), FastTuning.REST_HOUR_PRICE, "enough for a rest hour")
	return farm


## Everything a player could see of the Farm, and what The App was told.
func _seen(farm: Farm) -> Dictionary:
	var plots := []
	for view in farm.plots():
		plots.append([view.stage, view.seconds_left])
	var shift := farm.shift()
	var worker := farm.worker()
	var messages := []
	for message in farm.take_messages():
		messages.append([message.key, message.values])
	var family_events := []
	for event in farm.take_family_events():
		family_events.append([event.kind, event.id])
	return {
		"plots": plots,
		"shift": [shift.number, shift.quota, shift.picked, shift.seconds_left],
		"labour_points": farm.labour_points(),
		"debt": farm.debt(),
		"worker": [worker.activity, worker.laps_left, worker.exhaustion],
		"exhaustion_floor": farm.exhaustion_floor(),
		"study_session_seconds_left": farm.study_session_seconds_left(),
		"rest": [farm.rest_hour().seconds_left, farm.rest_hour().taken_away],
		"store": _store_seen(farm),
		"messages": messages,
		"letters": [farm.letters_received(), farm.letters_stopped()],
		"family_events": family_events,
	}


func _store_seen(farm: Farm) -> Array:
	var items := []
	for item in farm.store():
		items.append([item.id, item.tier, item.price, item.quota_rise, item.refusal])
	return items


## The same play on both Farms, checking after each step that a player sees the same.
func _assert_play_alike(saved: Farm, restored: Farm, step: Callable, what: String) -> void:
	step.call(saved)
	step.call(restored)
	assert_eq(_seen(restored), _seen(saved), what)


func test_the_save_is_plain_data_with_the_format_version() -> void:
	var save := _played_farm().to_save()

	var version: int = save["version"]
	assert_eq(version, Farm.SAVE_VERSION)
	assert_eq(_through_json(save).size(), save.size(), "every field survives JSON")


func test_a_restored_farm_plays_on_exactly_as_the_saved_one() -> void:
	var saved := _played_farm()
	var restored := _new_farm()

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(_seen(restored), _seen(saved), "as restored")
	var rest := func(farm: Farm) -> void:
		farm.buy_privilege(Farm.REST_HOUR)
		farm.advance(FastTuning.REST_HOUR_SECONDS + 3.0)
	_assert_play_alike(saved, restored, rest, "through the rest hour")
	assert_eq(saved.labour_points(), 0, "the rest hour was bought")
	var work := func(farm: Farm) -> void:
		farm.plant(1)
		farm.advance(FastTuning.SLOW_ACTION_SECONDS)
		farm.plant(3)
		farm.run_generator()
		farm.advance(20.0)
	_assert_play_alike(saved, restored, work, "planting and running")
	var end_shift := func(farm: Farm) -> void: farm.advance(farm.shift().seconds_left)
	_assert_play_alike(saved, restored, end_shift, "through the end of the Shift")
	assert_true(saved.in_study_session(), "the Quota was missed")
	var study := func(farm: Farm) -> void:
		farm.advance(FastTuning.STUDY_SESSION_SECONDS / 2.0)
		farm.resume_offline(FastTuning.STUDY_SESSION_SECONDS)
		farm.advance(5.0)
	_assert_play_alike(saved, restored, study, "through the Study Session, part offline")
	assert_eq(restored.to_save(), saved.to_save(), "nothing hidden differs either")


func test_a_restored_farm_drops_the_messages_queued_before_it() -> void:
	var farm := Farm.new(FastTuning.table(), PLOTS)

	farm.restore(_through_json(_played_farm().to_save()))

	assert_eq(farm.take_messages(), [] as Array[AppMessage])


func test_a_save_of_another_version_is_refused_and_the_farm_left_as_it_was() -> void:
	var save := _through_json(_played_farm().to_save())
	save["version"] = Farm.SAVE_VERSION + 1
	var farm := _new_farm()
	var fresh := farm.to_save()

	var problems := farm.restore(save)

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "version %d" % (Farm.SAVE_VERSION + 1))
	assert_eq(farm.to_save(), fresh)


func test_a_damaged_save_names_every_bad_field_and_changes_nothing() -> void:
	var save := _through_json(_played_farm().to_save())
	save.erase("labour_points")
	save["picked"] = 1.5
	var crops: Dictionary = save["crops"]
	crops["withered"] = ["no", false, false, false]
	var toil: Dictionary = save["toil"]
	toil["breath_left"] = -1.0
	var farm := _new_farm()
	var fresh := farm.to_save()

	var problems := farm.restore(save)

	assert_eq(
		problems,
		(
			[
				"crops.withered holds something other than true or false",
				"toil.breath_left is below 0.0",
				"picked is not a whole number",
				"labour_points is missing or not a number",
			]
			as Array[String]
		)
	)
	assert_eq(farm.to_save(), fresh)


func test_a_save_for_another_number_of_plots_is_refused() -> void:
	var farm := Farm.new(FastTuning.exhausting_table(), PLOTS + 1)

	var problems := farm.restore(_through_json(_played_farm().to_save()))

	assert_has(problems, "crops.grown has 4 entries, not 5")


func test_a_save_that_is_not_a_farm_is_refused() -> void:
	var problems := _new_farm().restore({"hello": "world"})

	assert_has(problems, "version is missing or not a number")
	assert_has(problems, "crops is missing or not a section")


func test_timers_longer_than_the_tuning_now_allows_are_cut_to_it() -> void:
	var save := _through_json(_played_farm().to_save())
	save["rest_left"] = FastTuning.REST_HOUR_SECONDS * 10.0
	var farm := _new_farm()

	farm.restore(save)

	assert_eq(farm.rest_hour().seconds_left, FastTuning.REST_HOUR_SECONDS)


func test_upgrade_tiers_and_the_quota_rise_still_to_come_survive_a_save() -> void:
	var saved := _played_farm()
	saved.debug_add_labour_points(FastTuning.GENERATOR_PRICES[0])
	saved.buy_upgrade(Farm.GENERATOR)
	saved.take_messages()
	var restored := _new_farm()

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(_seen(restored), _seen(saved), "as restored")
	assert_eq(restored.store()[0].tier, 1)
	var end_shift := func(farm: Farm) -> void: farm.advance(farm.shift().seconds_left)
	_assert_play_alike(saved, restored, end_shift, "through the end of the Shift")
	var quota := (
		FastTuning.FIRST_QUOTA + FastTuning.QUOTA_RISE + FastTuning.GENERATOR_QUOTA_RISES[0]
	)
	assert_eq(restored.shift().quota, quota, "the rise counts from the next Shift")


func test_a_save_from_before_the_store_restores_with_no_upgrades() -> void:
	var saved := _played_farm()
	var save := _through_json(saved.to_save())
	save["version"] = 1
	save.erase("store")
	save.erase("shift_upgrade_quota_rise")
	var restored := _new_farm()

	var problems := restored.restore(save)

	assert_eq(problems, [] as Array[String])
	assert_eq(_seen(restored), _seen(saved))
	assert_eq(restored.store()[0].tier, 0)


func test_tools_tiers_survive_a_save() -> void:
	var saved := _played_farm()
	saved.debug_add_labour_points(FastTuning.TOOLS_PRICES[0])
	saved.buy_upgrade(Farm.TOOLS)
	saved.take_messages()
	var restored := _new_farm()

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(_seen(restored), _seen(saved), "as restored")
	assert_eq(_tools(restored).tier, 1)
	var end_shift := func(farm: Farm) -> void: farm.advance(farm.shift().seconds_left)
	_assert_play_alike(saved, restored, end_shift, "through the end of the Shift")


func test_a_save_from_before_the_tools_restores_with_none() -> void:
	var saved := _played_farm()
	saved.debug_add_labour_points(FastTuning.GENERATOR_PRICES[0])
	saved.buy_upgrade(Farm.GENERATOR)
	var save := _through_json(saved.to_save())
	save["version"] = 2
	var store: Dictionary = save["store"]
	store.erase("tools_tier")
	var restored := _new_farm()

	var problems := restored.restore(save)

	assert_eq(problems, [] as Array[String])
	assert_eq(_tools(restored).tier, 0)
	assert_eq(restored.store()[0].tier, 1, "the Generator tier is kept")


func test_a_save_of_this_version_without_the_tools_tier_is_damaged() -> void:
	var save := _through_json(_played_farm().to_save())
	var store: Dictionary = save["store"]
	store.erase("tools_tier")

	var problems := _new_farm().restore(save)

	assert_eq(problems.size(), 1)
	assert_string_contains(problems[0], "tools_tier")


func _tools(farm: Farm) -> StoreItemView:
	for item in farm.store():
		if item.id == Farm.TOOLS:
			return item
	return null


func test_a_save_of_this_version_without_the_store_is_damaged() -> void:
	var save := _through_json(_played_farm().to_save())
	save.erase("store")

	var problems := _new_farm().restore(save)

	assert_eq(problems, ["store is missing or not a section"] as Array[String])


func test_upgrade_tiers_beyond_the_tuning_now_are_cut_to_its_top_tier() -> void:
	var save := _through_json(_played_farm().to_save())
	var store: Dictionary = save["store"]
	store["generator_tier"] = 9
	var farm := _new_farm()

	farm.restore(save)

	assert_eq(farm.store()[0].tier, FastTuning.GENERATOR_PRICES.size())


func test_debt_survives_a_save() -> void:
	var saved := Farm.new(FastTuning.billing_table(), PLOTS)
	saved.advance(FastTuning.SHIFT_SECONDS)
	var restored := Farm.new(FastTuning.billing_table(), PLOTS)

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(restored.debt(), FastTuning.RENT_PER_SHIFT)
	assert_eq(restored.labour_points(), 0)


func test_a_save_from_before_the_bills_restores_with_nothing_earned_or_run_this_shift() -> void:
	var saved := _played_farm()
	var save := _through_json(saved.to_save())
	save["version"] = 3
	save.erase("shift_earned")
	var toil: Dictionary = save["toil"]
	var laps_before_save: int = toil["laps_run"]
	toil.erase("laps_run")
	var restored := _new_farm()

	var problems := restored.restore(save)

	assert_eq(problems, [] as Array[String])
	var saved_slip := _end_shift_slip(saved)
	var restored_slip := _end_shift_slip(restored)
	var saved_laps: int = saved_slip["laps"]
	var restored_laps: int = restored_slip["laps"]
	var restored_earned: int = restored_slip["earned"]
	assert_gt(laps_before_save, 0, "laps were run before the save")
	assert_eq(restored_laps, saved_laps - laps_before_save, "only laps after the restore count")
	assert_eq(restored_earned, 0)


## Plays to the end of the Shift and returns the pay slip's values.
func _end_shift_slip(farm: Farm) -> Dictionary:
	farm.take_messages()
	farm.advance(farm.shift().seconds_left)
	for message in farm.take_messages():
		if message.key == Farm.PAY_SLIP:
			return message.values
	return {}


func test_the_school_fees_survive_a_save() -> void:
	var saved := Farm.new(FastTuning.billing_table(), PLOTS)
	_miss_shifts(saved, 3)
	var restored := Farm.new(FastTuning.billing_table(), PLOTS)

	var problems := restored.restore(_through_json(saved.to_save()))

	assert_eq(problems, [] as Array[String])
	assert_eq(restored.shift().school_fees_shift, saved.shift().school_fees_shift)
	assert_true(restored.school_fees_unpaid())
	assert_eq(restored.school_fees_unpaid_in_a_row(), 1)


func test_a_save_from_before_the_school_fees_has_them_due_three_shifts_on() -> void:
	var saved := Farm.new(FastTuning.billing_table(), PLOTS)
	_miss_shifts(saved, 4)
	var save := _through_json(saved.to_save())
	save["version"] = 4
	save.erase("school_fees_shift")
	save.erase("school_fees_unpaid")
	save.erase("school_fees_unpaid_in_a_row")
	var restored := Farm.new(FastTuning.billing_table(), PLOTS)

	var problems := restored.restore(save)

	assert_eq(problems, [] as Array[String])
	var shift := restored.shift()
	assert_eq(shift.school_fees_shift, shift.number + FastTuning.SCHOOL_FEES_EVERY_SHIFTS)
	assert_false(restored.school_fees_unpaid())
	assert_eq(restored.school_fees_unpaid_in_a_row(), 0)


## Ends `shifts` Shifts with nothing picked, serving each Study Session that follows.
func _miss_shifts(farm: Farm, shifts: int) -> void:
	for shift in shifts:
		farm.advance(farm.shift().seconds_left)
		farm.advance(farm.study_session_seconds_left())
