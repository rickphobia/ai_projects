extends GutTest
## The rest hour, the first Privilege, through the Farm's public interface: it costs Labour
## Points, takes the Worker off the Generator, and lowers Exhaustion towards its floor but
## never below it. A missed Quota takes it away for the next Shift. With the exhausting test
## table it costs 10 Labour Points (two picks) and lasts 20 seconds, taking away 2 Exhaustion a
## second.

const PLOTS := FastTuning.FIRST_PLOTS
const RECOVERY_PER_SECOND := FastTuning.REST_HOUR_RECOVERY / FastTuning.REST_HOUR_SECONDS

var _farm: Farm


func before_each() -> void:
	_farm = _farm_with_shift(1000.0)


func _farm_with_shift(shift_seconds: float) -> Farm:
	var tuning := FastTuning.exhausting_table()
	tuning.shift_seconds = shift_seconds
	var farm := Farm.new(tuning)
	farm.take_messages()
	return farm


## Plants, grows and picks two plots: the price of a rest hour, and 43 Exhaustion (two plants,
## three laps, two picks).
func _earn_a_rest_hour() -> void:
	_farm.plant(0)
	_farm.plant(1)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.pick(0)
	_farm.pick(1)
	assert_eq(_farm.labour_points(), FastTuning.REST_HOUR_PRICE)


func _keys() -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in _farm.take_messages():
		keys.append(message.key)
	return keys


func test_buying_a_rest_hour_spends_its_price_and_sets_him_resting() -> void:
	_earn_a_rest_hour()
	_farm.take_messages()

	var result := _farm.buy_privilege(Farm.REST_HOUR)

	assert_true(result.happened)
	assert_eq(_farm.labour_points(), 0)
	assert_eq(_farm.worker().activity, WorkerView.Activity.RESTING)
	assert_eq(_farm.rest_hour().seconds_left, FastTuning.REST_HOUR_SECONDS)
	assert_has(_keys(), Farm.REST_STARTED)


func test_it_is_refused_when_he_cannot_afford_it() -> void:
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.pick(0)

	var result := _farm.buy_privilege(Farm.REST_HOUR)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NOT_ENOUGH_LABOUR_POINTS)
	assert_eq(_farm.labour_points(), FastTuning.LABOUR_POINTS_PER_PICK)
	assert_eq(_farm.rest_hour().seconds_left, 0.0)


func test_resting_lowers_exhaustion_a_little_at_a_time() -> void:
	_earn_a_rest_hour()
	var before := _farm.exhaustion()
	_farm.buy_privilege(Farm.REST_HOUR)

	_farm.advance(5.0)

	assert_almost_eq(_farm.exhaustion(), before - RECOVERY_PER_SECOND * 5.0, 0.001)


func test_a_whole_rest_hour_takes_away_its_recovery_then_sends_him_to_the_field() -> void:
	_earn_a_rest_hour()
	_farm.plant(0)
	var before := _farm.exhaustion()
	_farm.buy_privilege(Farm.REST_HOUR)
	_farm.take_messages()

	_farm.advance(FastTuning.REST_HOUR_SECONDS)

	assert_almost_eq(_farm.exhaustion(), before - FastTuning.REST_HOUR_RECOVERY, 0.001)
	assert_eq(_farm.rest_hour().seconds_left, 0.0)
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD)
	assert_has(_keys(), Farm.REST_ENDED)


func test_rest_never_brings_exhaustion_below_the_floor() -> void:
	# A short Shift with a Quota of one pick, so the floor rises without a Study Session.
	var tuning := FastTuning.exhausting_table()
	tuning.first_quota = 1
	tuning.exhaustion_floor_rise = 30.0
	tuning.rest_hour_price = FastTuning.LABOUR_POINTS_PER_PICK
	_farm = Farm.new(tuning)
	_farm.plant(0)
	_farm.run_generator()
	_farm.advance(FastTuning.GROW_SECONDS)
	_farm.pick(0)
	_farm.advance(FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS)
	assert_eq(_farm.exhaustion_floor(), 30.0)

	assert_true(_farm.buy_privilege(Farm.REST_HOUR).happened)
	_farm.advance(FastTuning.REST_HOUR_SECONDS)

	assert_eq(_farm.exhaustion(), 30.0)


func test_rest_takes_him_off_the_generator_so_crops_halt() -> void:
	_earn_a_rest_hour()
	_farm.plant(0)
	_farm.run_generator()
	_farm.buy_privilege(Farm.REST_HOUR)

	_farm.advance(10.0)

	assert_eq(_farm.plot(0).seconds_left, FastTuning.GROW_SECONDS)


func test_the_shift_keeps_counting_while_he_rests() -> void:
	_earn_a_rest_hour()
	var before := _farm.shift().seconds_left
	_farm.buy_privilege(Farm.REST_HOUR)

	_farm.advance(10.0)

	assert_eq(_farm.shift().seconds_left, before - 10.0)


func test_he_cannot_work_while_he_rests() -> void:
	_earn_a_rest_hour()
	_farm.buy_privilege(Farm.REST_HOUR)

	assert_eq(_farm.plant(2).reason, Farm.RESTING)
	assert_eq(_farm.run_generator().reason, Farm.RESTING)
	assert_eq(_farm.buy_privilege(Farm.REST_HOUR).reason, Farm.RESTING)


func test_after_his_rest_he_starts_a_fresh_run() -> void:
	_earn_a_rest_hour()
	_farm.buy_privilege(Farm.REST_HOUR)
	_farm.advance(FastTuning.REST_HOUR_SECONDS)

	_farm.run_generator()

	# 43 Exhaustion less 40 rested is 3: 10 - 8 * 0.03 rounds to 10 laps.
	assert_eq(_farm.worker().laps_left, FastTuning.LAPS_BEFORE_BREATH)


func test_a_missed_quota_takes_the_rest_hour_away_for_the_next_shift() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_earn_a_rest_hour()
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.advance(FastTuning.STUDY_SESSION_SECONDS)

	var result := _farm.buy_privilege(Farm.REST_HOUR)

	assert_false(result.happened)
	assert_eq(result.reason, Farm.PRIVILEGES_TAKEN_AWAY)
	assert_true(_farm.rest_hour().taken_away)
	assert_eq(_farm.labour_points(), FastTuning.REST_HOUR_PRICE)


func test_a_met_quota_gives_the_rest_hour_back() -> void:
	var tuning := FastTuning.exhausting_table()
	tuning.first_quota = 1
	tuning.quota_rise = 1
	_farm = Farm.new(tuning)
	_farm.advance(FastTuning.SHIFT_SECONDS)
	_farm.advance(FastTuning.STUDY_SESSION_SECONDS)
	assert_true(_farm.rest_hour().taken_away)

	# Shift 2 asks for two picks.
	_earn_a_rest_hour()
	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_false(_farm.rest_hour().taken_away)
	assert_true(_farm.buy_privilege(Farm.REST_HOUR).happened)


func test_it_is_refused_in_a_study_session() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_farm.advance(FastTuning.SHIFT_SECONDS)

	assert_eq(_farm.buy_privilege(Farm.REST_HOUR).reason, Farm.IN_STUDY_SESSION)


func test_a_study_session_cuts_a_rest_short() -> void:
	_farm = _farm_with_shift(FastTuning.SHIFT_SECONDS)
	_earn_a_rest_hour()
	_farm.advance(FastTuning.SHIFT_SECONDS - FastTuning.GROW_SECONDS - 5.0)
	_farm.buy_privilege(Farm.REST_HOUR)

	_farm.advance(5.0)

	assert_eq(_farm.rest_hour().seconds_left, 0.0)
	assert_true(_farm.in_study_session())
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD)


func test_a_privilege_the_farm_does_not_sell_is_refused_and_costs_nothing() -> void:
	_earn_a_rest_hour()
	var points := _farm.labour_points()

	var result := _farm.buy_privilege(&"day_off")

	assert_false(result.happened)
	assert_eq(result.reason, Farm.NO_SUCH_PRIVILEGE)
	assert_eq(_farm.labour_points(), points)
