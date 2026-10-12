extends GutTest
## Study Sessions, through the Farm's public interface: a missed Quota takes the Worker off the
## field for a stretch of time that doubles for each one in a row, up to a cap. Time moves only
## when the test calls advance.

## Enough plots to meet the third Shift's Quota (7) with one crop.
const PLOTS := 8

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.with_land(FastTuning.table(), 4, 2))
	_farm.take_messages()


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


## Lets the whole Shift pass with nothing picked, then serves the Study Session that follows.
func _miss_and_serve() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.advance(_farm.study_session_seconds_left())


## Picks `count` cotton (at most PLOTS) and lets the rest of the Shift run out.
func _finish_shift_with(count: int) -> void:
	var shift_left := _farm.shift().seconds_left
	for index in count:
		_farm.plant(index)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	for index in count:
		_farm.pick(index)
	_farm.advance(shift_left - FastTuning.GROW_SECONDS)


func test_there_is_no_study_session_at_the_start() -> void:
	assert_eq(_farm.study_session_seconds_left(), 0.0)


func test_a_missed_quota_starts_a_study_session_of_the_first_length() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.study_session_seconds_left(), FastTuning.STUDY_SESSION_SECONDS)
	var expected: Array[StringName] = [
		Farm.QUOTA_MISSED, Farm.STUDY_SESSION_STARTED, Farm.PAY_SLIP, Farm.SHIFT_STARTED
	]
	var messages := _farm.take_messages()
	assert_eq(_keys(messages), expected)
	var values := {"seconds": FastTuning.STUDY_SESSION_SECONDS, "minutes": 1, "in_a_row": 1}
	assert_eq(messages[1].values, values)


func test_a_met_quota_starts_no_study_session() -> void:
	_finish_shift_with(FastTuning.FIRST_QUOTA)

	assert_eq(_farm.study_session_seconds_left(), 0.0)
	assert_null(_message(Farm.STUDY_SESSION_STARTED, _farm.take_messages()))


func test_planting_is_refused_during_a_study_session() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)

	var result := _farm.plant(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.EMPTY)


func test_picking_ripe_cotton_is_refused_during_a_study_session() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.SHIFT_SECONDS)

	var result := _farm.pick(0)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.IN_STUDY_SESSION)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_eq(_farm.labour_points(), 0)


func test_the_study_session_counts_down_and_ends_with_a_message() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.take_messages()

	_farm.advance(FastTuning.STUDY_SESSION_SECONDS - 1.0)
	assert_eq(_farm.study_session_seconds_left(), 1.0)
	assert_eq(_farm.take_messages(), [] as Array[AppMessage], "no end before the time is up")
	_farm.advance(1.0)

	assert_eq(_farm.study_session_seconds_left(), 0.0)
	var messages := _farm.take_messages()
	assert_eq(_keys(messages), [Farm.STUDY_SESSION_ENDED] as Array[StringName])
	assert_eq(messages[0].values, {"in_a_row": 1})


func test_the_worker_can_plant_again_once_it_ends() -> void:
	_miss_and_serve()

	assert_true(_farm.plant(0).happened)


func test_the_shift_clock_waits_while_the_worker_is_in_a_study_session() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS)

	_farm.advance(FastTuning.STUDY_SESSION_SECONDS + 5.0)

	assert_eq(_farm.shift().number, 2)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS - 5.0)


func test_crops_halt_during_a_study_session_and_the_worker_picks_after_it() -> void:
	# Planted 20 seconds before the Shift ends, so it has 10 seconds left when the Session starts.
	_farm.advance(FastTuning.SHIFT_SECONDS - 20.0)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(20.0)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.BOLL)

	_farm.advance(FastTuning.STUDY_SESSION_SECONDS)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.BOLL, "no one ran the Generator")
	_farm.run_generator()
	_farm.advance(10.0)
	assert_true(_farm.pick(0).happened)


func test_each_study_session_in_a_row_doubles_up_to_the_cap() -> void:
	var lengths: Array[float] = []
	for _miss in 4:
		_farm.advance(FastTuning.SHIFT_SECONDS)
		lengths.append(_farm.study_session_seconds_left())
		_farm.advance(_farm.study_session_seconds_left())

	assert_eq(lengths, [20.0, 40.0, 50.0, 50.0] as Array[float])


func test_the_escalation_count_is_in_the_messages() -> void:
	_miss_and_serve()
	_farm.take_messages()

	_farm.advance(FastTuning.SHIFT_SECONDS)

	var started := _message(Farm.STUDY_SESSION_STARTED, _farm.take_messages())
	assert_eq(started.values, {"seconds": 40.0, "minutes": 1, "in_a_row": 2})


func test_a_met_quota_resets_the_escalation() -> void:
	_miss_and_serve()
	_miss_and_serve()
	_finish_shift_with(PLOTS)
	_farm.take_messages()

	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.study_session_seconds_left(), FastTuning.STUDY_SESSION_SECONDS)
	var started := _message(Farm.STUDY_SESSION_STARTED, _farm.take_messages())
	var in_a_row: int = started.values["in_a_row"]
	assert_eq(in_a_row, 1)


func test_the_quota_message_grows_colder_with_each_miss_in_a_row() -> void:
	var keys: Array[StringName] = []
	for _miss in 4:
		_farm.advance(FastTuning.SHIFT_SECONDS)
		keys.append(_farm.take_messages()[0].key)
		_farm.advance(_farm.study_session_seconds_left())
		_farm.take_messages()

	var expected: Array[StringName] = [
		Farm.QUOTA_MISSED,
		Farm.QUOTA_MISSED_AGAIN,
		Farm.QUOTA_MISSED_REPEATEDLY,
		Farm.QUOTA_MISSED_REPEATEDLY,
	]
	assert_eq(keys, expected)


func test_a_met_quota_warms_the_next_miss_back_up() -> void:
	_miss_and_serve()
	_finish_shift_with(PLOTS)
	_farm.take_messages()

	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.take_messages()[0].key, Farm.QUOTA_MISSED)


func test_one_long_step_serves_the_study_session_and_carries_on_with_the_shift() -> void:
	_farm.advance(FastTuning.SHIFT_SECONDS + FastTuning.STUDY_SESSION_SECONDS + 30.0)

	var expected: Array[StringName] = [
		Farm.QUOTA_MISSED,
		Farm.STUDY_SESSION_STARTED,
		Farm.PAY_SLIP,
		Farm.SHIFT_STARTED,
		Farm.STUDY_SESSION_ENDED,
	]
	assert_eq(_keys(_farm.take_messages()), expected)
	assert_eq(_farm.study_session_seconds_left(), 0.0)
	assert_eq(_farm.shift().seconds_left, FastTuning.SHIFT_SECONDS - 30.0)
