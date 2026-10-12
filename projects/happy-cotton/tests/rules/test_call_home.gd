extends GutTest
## The call home, the second Privilege, through the Farm's public interface: it costs Labour
## Points and takes the Worker off the Generator for its length, so crops halt, and it sends a
## "called home" Family event whose call follows the latest letter received. Like every
## Privilege it is refused after a missed Quota, in Debt and in a Study Session. With the test
## table it costs 5 Labour Points (one pick) and lasts 10 seconds. Labour Points are paid at the
## Hand-in, so the tests that earn a call first meet a Quota of one pick and hand it in.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	var tuning := FastTuning.table()
	tuning.first_quota = 1
	_farm = _farm_with(tuning)


func _farm_with(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning)
	farm.take_messages()
	farm.take_family_events()
	return farm


## Plants, grows and picks one plot and hands it in at the Shift's end: the price of a call
## home.
func _earn_a_call() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.pick(0)
	HandingIn.finish_shift(_farm)
	assert_eq(_farm.labour_points(), FastTuning.CALL_HOME_PRICE)


## The save as the store writes and reads it back.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func _keys() -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	return keys


func _calls() -> Array[StringName]:
	var ids: Array[StringName] = []
	for event in _farm.take_family_events():
		if event.kind == Farm.CALLED_HOME:
			ids.append(event.id)
	return ids


func test_buying_a_call_spends_its_price_and_takes_him_off_the_generator() -> void:
	_earn_a_call()
	_farm.run_generator()
	_farm.take_messages()

	var result := _farm.buy_privilege(Farm.CALL_HOME)

	assert_true(result.happened)
	assert_eq(_farm.labour_points(), 0)
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD)
	assert_eq(_farm.call_home_seconds_left(), FastTuning.CALL_HOME_SECONDS)
	assert_has(_keys(), Farm.CALL_STARTED)


func test_crops_halt_during_the_call_and_he_can_run_again_after_it() -> void:
	_earn_a_call()
	_farm.plant(1)
	_farm.buy_privilege(Farm.CALL_HOME)
	var growth_left := _farm.plot(1).seconds_left

	assert_eq(_farm.run_generator().reason, Farm.ON_A_CALL)
	assert_eq(_farm.plant(2).reason, Farm.ON_A_CALL)
	HandingIn.advance(_farm, FastTuning.CALL_HOME_SECONDS)

	assert_eq(_farm.plot(1).seconds_left, growth_left)
	assert_eq(_farm.call_home_seconds_left(), 0.0)
	assert_true(_farm.run_generator().happened)


func test_a_call_before_any_letter_is_the_first_call() -> void:
	_earn_a_call()

	_farm.buy_privilege(Farm.CALL_HOME)

	assert_eq(_calls(), [Farm.CALL_IDS[0]] as Array[StringName])


func test_the_call_follows_the_latest_letter_received() -> void:
	var tuning := FastTuning.table()
	tuning.first_quota = 0
	tuning.quota_rise = 0
	_farm = _farm_with(tuning)
	for letter in 5:
		HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS * FastTuning.LETTER_EVERY_SHIFTS)
	var latest: StringName = _farm.letters_received().back()
	assert_eq(latest, Farm.LETTER_IDS[4])
	_farm.take_family_events()
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE)

	_farm.buy_privilege(Farm.CALL_HOME)

	assert_eq(_calls(), [Farm.LETTER_CALLS[latest]] as Array[StringName])


func test_every_letter_has_a_call_to_follow_it() -> void:
	for id in Farm.LETTER_IDS:
		var call: StringName = Farm.LETTER_CALLS.get(id, &"")
		assert_has(Farm.CALL_IDS, call, "%s has a call" % id)


func test_it_is_refused_when_he_cannot_afford_it() -> void:
	var result := _farm.buy_privilege(Farm.CALL_HOME)

	assert_eq(result.reason, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(_calls(), [] as Array[StringName])


func test_it_is_refused_after_a_missed_quota() -> void:
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)
	HandingIn.advance(_farm, _farm.study_session_seconds_left())
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE)

	assert_eq(_farm.buy_privilege(Farm.CALL_HOME).reason, Farm.PRIVILEGES_TAKEN_AWAY)


func test_it_is_refused_in_a_study_session() -> void:
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.buy_privilege(Farm.CALL_HOME).reason, Farm.IN_STUDY_SESSION)


func test_it_is_refused_in_debt() -> void:
	var tuning := FastTuning.table()
	tuning.first_quota = 0
	tuning.rent_per_shift = FastTuning.RENT_PER_SHIFT
	_farm = _farm_with(tuning)
	HandingIn.advance(_farm, FastTuning.SHIFT_SECONDS)
	assert_gt(_farm.debt(), 0)

	assert_eq(_farm.buy_privilege(Farm.CALL_HOME).reason, Farm.IN_DEBT)


func test_a_call_and_a_rest_hour_cannot_overlap() -> void:
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE + FastTuning.REST_HOUR_PRICE)
	_farm.buy_privilege(Farm.CALL_HOME)

	assert_eq(_farm.buy_privilege(Farm.REST_HOUR).reason, Farm.ON_A_CALL)
	assert_eq(_farm.buy_privilege(Farm.CALL_HOME).reason, Farm.ON_A_CALL)


func test_the_store_sells_the_call_with_its_price_and_refusal() -> void:
	var call: StoreItemView = _farm.store().back()

	assert_eq(call.id, Farm.CALL_HOME)
	assert_eq(call.kind, StoreItemView.Kind.PRIVILEGE)
	assert_eq(call.price, FastTuning.CALL_HOME_PRICE)
	assert_eq(call.refusal, Farm.NOT_ENOUGH_LABOUR_POINTS)


func test_a_study_session_cuts_a_call_short() -> void:
	var tuning := FastTuning.table()
	tuning.shift_seconds = 5.0
	_farm = _farm_with(tuning)
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE)
	_farm.buy_privilege(Farm.CALL_HOME)

	HandingIn.advance(_farm, 5.0)

	assert_true(_farm.in_study_session())
	assert_eq(_farm.call_home_seconds_left(), 0.0)


func test_a_call_waits_while_away_and_survives_a_save() -> void:
	_farm.debug_add_labour_points(FastTuning.CALL_HOME_PRICE)
	_farm.buy_privilege(Farm.CALL_HOME)
	HandingIn.advance(_farm, 4.0)
	_farm.resume_offline(100.0)
	var restored := Farm.new(FastTuning.table())

	var save := _through_json(_farm.to_save())
	assert_eq(restored.restore(save), [] as Array[String])

	assert_eq(restored.call_home_seconds_left(), FastTuning.CALL_HOME_SECONDS - 4.0)


func test_a_save_from_before_the_call_restores_with_none_under_way() -> void:
	var save := _through_json(_farm.to_save())
	save["version"] = 6
	OldSaves.before_longer_laps(save)
	save.erase("call_left")
	var restored := Farm.new(FastTuning.table())

	assert_eq(restored.restore(save), [] as Array[String])
	assert_eq(restored.call_home_seconds_left(), 0.0)
