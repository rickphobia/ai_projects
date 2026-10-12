extends GutTest
## The crop counter and the Hand-in, through the Farm's public interface. Each pick that keeps
## its cotton goes on the crop counter, which fills the Quota bar; nothing is paid at a pick.
## When the Shift's time runs out the Hand-in opens and the Farm waits: online time moves
## nothing and every other command is refused, though offline time works as usual. Handing in
## pays Labour Points for the cotton handed in, checks the Quota on it, charges the Bills, raises
## the Exhaustion floor and starts the next Shift with the counter at zero.
## With the fast table a Shift lasts 100 seconds, the first Quota is 3 and a pick earns 5.

const PLOTS := FastTuning.FIRST_PLOTS
## Never under the dropped-cotton chance, and always under it.
const HOLDS := 0.9
const DROPS := 0.0

var _farm: Farm
var _roll := HOLDS


func before_each() -> void:
	_roll = HOLDS
	_farm = _new_farm(FastTuning.table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning, func() -> float: return _roll)
	farm.take_messages()
	return farm


## Plants `count` plots, runs the Generator until they ripen and picks them all.
func _pick_cotton(count: int) -> void:
	for index in count:
		_farm.plant(index)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	for index in count:
		_farm.pick(index)


## Plays on to the end of the Shift's time, leaving the Hand-in open.
func _run_out_the_shift() -> void:
	_farm.advance(_farm.shift().seconds_left)


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


## The save as the store writes and reads it back.
func _through_json(save: Dictionary) -> Dictionary:
	var parsed: Variant = JSON.parse_string(JSON.stringify(save, "", true, true))
	return parsed


func test_each_pick_goes_on_the_crop_counter_and_pays_nothing() -> void:
	_pick_cotton(2)

	assert_eq(_farm.shift().picked, 2, "the counter, and the Quota bar with it")
	assert_eq(_farm.labour_points(), 0)


func test_a_pick_that_drops_its_cotton_is_not_counted() -> void:
	var tuning := FastTuning.exhausting_table()
	# Two plants take him past the mistake threshold.
	tuning.exhaustion_per_plant = 45.0
	_farm = _new_farm(tuning)
	_farm.plant(0)
	_farm.plant(1)
	_farm.run_generator()
	# Long enough for both to ripen, breaths and all.
	_farm.advance(FastTuning.GROW_SECONDS * 2.0)
	_farm.pick(0)
	_farm.advance(FastTuning.SLOW_ACTION_SECONDS)
	_roll = DROPS

	_farm.pick(1)

	assert_eq(_farm.plot(1).stage, PlotView.Stage.EMPTY)
	assert_eq(_farm.shift().picked, 1, "only the pick that kept its cotton")


func test_the_hand_in_opens_when_the_shifts_time_runs_out() -> void:
	_pick_cotton(2)
	_farm.take_messages()

	_run_out_the_shift()

	var shift := _farm.shift()
	assert_true(_farm.hand_in_open())
	assert_true(shift.hand_in_open)
	assert_eq(shift.number, 1, "the Shift isn't over until he hands in")
	assert_eq(shift.seconds_left, 0.0)
	var messages := _farm.take_messages()
	assert_eq(_keys(messages), [Farm.HAND_IN_OPENED] as Array[StringName])
	var values := {"shift": 1, "in_hand": 2, "quota": FastTuning.FIRST_QUOTA}
	assert_eq(messages[0].values, values)


func test_online_time_moves_nothing_while_the_hand_in_is_open() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.SHIFT_SECONDS - 5.0)
	_farm.plant(1)
	_farm.run_generator()
	_farm.advance(5.0)
	var plot := _farm.plot(1)
	var worker := _farm.worker()

	var overseer := _farm.advance(FastTuning.SHIFT_SECONDS)

	assert_eq(overseer, [] as Array[StringName])
	assert_eq(_farm.plot(1).seconds_left, plot.seconds_left, "crops wait")
	assert_eq(_farm.worker().lap_progress, worker.lap_progress, "his lap waits")
	assert_eq(_farm.worker().laps_left, worker.laps_left)
	assert_eq(_farm.shift().number, 1)
	assert_eq(_farm.take_messages().size(), 1, "only the Hand-in opening")


func test_a_long_step_stops_where_the_hand_in_opens() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS + 30.0)
	_farm.hand_in()

	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS, "no time carries over")


func test_every_other_command_is_refused_while_the_hand_in_is_open() -> void:
	_farm.debug_add_labour_points(100)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_run_out_the_shift()

	assert_eq(_farm.pick(0).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.plant(1).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.clear(0).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.run_generator().reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.buy_upgrade(Farm.GENERATOR).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.buy_upgrade(Farm.TOOLS).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.buy_plot().reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.buy_privilege(Farm.REST_HOUR).reason, Farm.HAND_IN_OPEN)
	assert_eq(_farm.buy_privilege(Farm.CALL_HOME).reason, Farm.HAND_IN_OPEN)
	for item in _farm.store():
		assert_eq(item.refusal, Farm.HAND_IN_OPEN, String(item.id))
	assert_eq(_farm.labour_points(), 100, "nothing was bought")


func test_handing_in_with_none_open_is_refused() -> void:
	var result := _farm.hand_in()

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NO_HAND_IN)
	assert_eq(_farm.shift().number, 1)


func test_offline_time_works_as_usual_behind_an_open_hand_in() -> void:
	_farm.plant(0)
	_run_out_the_shift()

	_farm.resume_offline(FastTuning.GROW_SECONDS / FastTuning.OFFLINE_GROWTH_RATE)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_true(_farm.hand_in_open(), "still waiting for him")


func test_handing_in_pays_labour_points_for_the_cotton_handed_in() -> void:
	_pick_cotton(2)
	_run_out_the_shift()
	_farm.take_messages()

	assert_true(_farm.hand_in().happened)

	var earned := 2 * FastTuning.LABOUR_POINTS_PER_PICK
	assert_eq(_farm.labour_points(), earned)
	var messages := _farm.take_messages()
	var handed_in := _message(Farm.HANDED_IN, messages)
	assert_eq(handed_in.values, {"shift": 1, "handed_in": 2, "earned": earned})
	var slip := _message(Farm.PAY_SLIP, messages)
	var slip_earned: int = slip.values["earned"]
	assert_eq(slip_earned, earned, "the pay slip shows the wages")


func test_handing_in_runs_the_shift_end_in_order() -> void:
	_farm = _new_farm(FastTuning.billing_table())
	_pick_cotton(3)
	_run_out_the_shift()
	_farm.take_messages()

	_farm.hand_in()

	var expected: Array[StringName] = [
		Farm.HANDED_IN, Farm.QUOTA_MET, Farm.PAY_SLIP, Farm.SHIFT_STARTED
	]
	assert_eq(_keys(_farm.take_messages()), expected)
	assert_false(_farm.hand_in_open())
	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS)


func test_the_quota_is_checked_on_what_was_handed_in() -> void:
	_pick_cotton(3)
	_run_out_the_shift()
	_farm.take_messages()

	_farm.hand_in()

	var met := _message(Farm.QUOTA_MET, _farm.take_messages())
	assert_not_null(met)
	assert_eq(met.values, {"shift": 1, "picked": 3, "quota": FastTuning.FIRST_QUOTA})
	assert_false(_farm.in_study_session())


func test_too_little_handed_in_misses_the_quota() -> void:
	_pick_cotton(2)
	_run_out_the_shift()

	_farm.hand_in()

	assert_true(_farm.in_study_session())
	assert_eq(_farm.study_session_seconds_left(), FastTuning.STUDY_SESSION_SECONDS)


func test_handing_in_raises_the_exhaustion_floor() -> void:
	_farm = _new_farm(FastTuning.exhausting_table())
	_run_out_the_shift()
	assert_eq(_farm.exhaustion_floor(), 0.0, "not before he hands in")

	_farm.hand_in()

	assert_eq(_farm.exhaustion_floor(), FastTuning.EXHAUSTION_FLOOR_RISE)


func test_the_crop_counter_goes_back_to_zero_with_the_next_shift() -> void:
	_pick_cotton(3)
	HandingIn.finish_shift(_farm)

	assert_eq(_farm.shift().picked, 0)


func test_negligence_as_the_hand_in_opens_keeps_its_longer_study_session() -> void:
	_farm = _new_farm(FastTuning.withering_table())
	_farm.run_generator()
	_farm.advance(20.0)
	_farm.plant(0)
	_farm.run_generator()
	# It ripens 30 seconds later and Withers 50 after that, just as the Shift's time runs out.
	_farm.advance(FastTuning.SHIFT_SECONDS - 20.0)
	assert_true(_farm.hand_in_open())
	assert_eq(_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS)

	_farm.hand_in()

	assert_true(_farm.study_session_seconds_left() > FastTuning.STUDY_SESSION_SECONDS)
	assert_eq(_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS)


func test_an_open_hand_in_and_the_counter_survive_a_save() -> void:
	_pick_cotton(2)
	_run_out_the_shift()
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(_through_json(_farm.to_save())), [] as Array[String])

	assert_true(restored.hand_in_open())
	assert_eq(restored.shift().picked, 2)
	assert_eq(restored.shift().seconds_left, 0.0)
	restored.advance(10.0)
	assert_true(restored.hand_in_open(), "still waiting after the restore")
	restored.hand_in()
	assert_eq(restored.labour_points(), 2 * FastTuning.LABOUR_POINTS_PER_PICK)


func test_a_save_of_this_version_without_the_hand_in_is_damaged() -> void:
	var save := _through_json(_farm.to_save())
	save.erase("hand_in_open")

	var problems := _farm.restore(save)

	assert_eq(problems.size(), 1)


func test_a_save_from_before_the_hand_in_carries_its_picks_on_as_cotton_in_hand() -> void:
	_pick_cotton(2)
	var save := _through_json(_farm.to_save())
	save["version"] = 9
	save.erase("hand_in_open")
	var restored := _new_farm(FastTuning.table())

	assert_eq(restored.restore(save), [] as Array[String])

	assert_false(restored.hand_in_open())
	assert_eq(restored.shift().picked, 2)
	HandingIn.finish_shift(restored)
	assert_eq(restored.labour_points(), 2 * FastTuning.LABOUR_POINTS_PER_PICK)
