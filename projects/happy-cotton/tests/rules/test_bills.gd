extends GutTest
## Bills, the pay slip and Debt, through the Farm's public interface. With the billing table
## every Shift ends with 1 Labour Point of electricity per lap run that Shift, then 4 of rent,
## met Quota or missed. A Bill the Labour Points can't cover becomes Debt: earnings pay it down
## first, and while it lasts no Privilege or Upgrade can be bought. Three picks (90 seconds on
## the Generator, 9 laps) meet the first Quota and earn 15.

const PLOTS := FastTuning.FIRST_PLOTS

var _farm: Farm


func before_each() -> void:
	_farm = _new_farm(FastTuning.billing_table())


func _new_farm(tuning: Tuning) -> Farm:
	var farm := Farm.new(tuning)
	farm.take_messages()
	return farm


## Grows and picks `picks` crops one at a time, each 3 laps on the Generator.
func _earn(picks: int) -> void:
	for pick in picks:
		_farm.plant(0)
		_farm.run_generator()
		HandingIn.advance(_farm, FastTuning.GROW_SECONDS)
		_farm.pick(0)


func _end_shift() -> void:
	HandingIn.advance(_farm, _farm.shift().seconds_left)


## Ends a Shift with nothing picked, then serves the Study Session that follows.
func _miss_shift() -> void:
	_end_shift()
	HandingIn.advance(_farm, _farm.study_session_seconds_left())


func _messages(key: StringName, messages: Array[AppMessage]) -> Array[AppMessage]:
	return messages.filter(func(message: AppMessage) -> bool: return message.key == key)


func _pay_slips() -> Array[AppMessage]:
	return _messages(Farm.PAY_SLIP, _farm.take_messages())


func _whole(values: Dictionary, key: String) -> int:
	var value: int = values[key]
	return value


func _flag(values: Dictionary, key: String) -> bool:
	var value: bool = values[key]
	return value


func _keys(messages: Array[AppMessage]) -> Array[StringName]:
	var keys: Array[StringName] = []
	for message in messages:
		keys.append(message.key)
	return keys


func test_a_met_quota_is_billed_for_its_laps_then_rent_on_the_pay_slip() -> void:
	_earn(3)
	_end_shift()

	var slips := _pay_slips()
	assert_eq(slips.size(), 1)
	var slip := slips[0].values
	assert_eq(_whole(slip, "shift"), 1)
	assert_eq(_whole(slip, "earned"), 3 * FastTuning.LABOUR_POINTS_PER_PICK)
	assert_eq(_whole(slip, "laps"), 9)
	assert_eq(_whole(slip, "electricity"), 9 * FastTuning.ELECTRICITY_PER_LAP)
	assert_eq(_whole(slip, "rent"), FastTuning.RENT_PER_SHIFT)
	assert_eq(_whole(slip, "balance"), 15 - 9 - 4)
	assert_eq(_farm.labour_points(), 2)
	assert_eq(_farm.debt(), 0)


func test_a_missed_quota_is_billed_too() -> void:
	_end_shift()

	var slip := _pay_slips()[0].values
	assert_eq(_whole(slip, "earned"), 0)
	assert_eq(_whole(slip, "laps"), 0)
	assert_eq(_whole(slip, "electricity"), 0)
	assert_eq(_whole(slip, "rent"), FastTuning.RENT_PER_SHIFT)
	assert_eq(_whole(slip, "balance"), -FastTuning.RENT_PER_SHIFT)


func test_bills_come_after_the_quota_check_and_before_the_next_shift() -> void:
	_end_shift()

	var keys := _keys(_farm.take_messages())
	assert_lt(keys.find(Farm.QUOTA_MISSED), keys.find(Farm.PAY_SLIP))
	assert_lt(keys.find(Farm.STUDY_SESSION_STARTED), keys.find(Farm.PAY_SLIP))
	assert_lt(keys.find(Farm.PAY_SLIP), keys.find(Farm.SHIFT_STARTED))


func test_electricity_counts_only_the_laps_run_this_shift() -> void:
	_farm.run_generator()
	HandingIn.advance(_farm, 3 * FastTuning.LAP_SECONDS)
	_farm.plant(0)
	_end_shift()
	HandingIn.advance(_farm, _farm.study_session_seconds_left())
	_farm.run_generator()
	HandingIn.advance(_farm, 2 * FastTuning.LAP_SECONDS)
	_farm.plant(1)
	_farm.take_messages()

	_end_shift()

	var slip := _pay_slips()[0].values
	assert_eq(_whole(slip, "laps"), 2)
	assert_eq(_whole(slip, "electricity"), 2 * FastTuning.ELECTRICITY_PER_LAP)


func test_electricity_is_charged_before_rent_so_rent_goes_unpaid() -> void:
	_farm.debug_add_labour_points(12)
	_farm.run_generator()

	_end_shift()

	var slip := _pay_slips()[0].values
	assert_eq(_whole(slip, "laps"), 10)
	assert_true(_flag(slip, "electricity_covered"), "12 covers 10 of electricity")
	assert_false(_flag(slip, "rent_covered"), "2 left can't cover 4 of rent")
	assert_eq(_farm.debt(), 2)


func test_a_shortfall_becomes_debt_and_the_app_says_so_once() -> void:
	_end_shift()

	var messages := _farm.take_messages()
	assert_eq(_farm.debt(), FastTuning.RENT_PER_SHIFT)
	assert_eq(_farm.labour_points(), 0, "Labour Points and Debt are never both above zero")
	var fell := _messages(Farm.FELL_INTO_DEBT, messages)
	assert_eq(fell.size(), 1)
	assert_eq(_whole(fell[0].values, "debt"), FastTuning.RENT_PER_SHIFT)

	HandingIn.advance(_farm, _farm.study_session_seconds_left())
	_end_shift()

	assert_eq(_farm.debt(), 2 * FastTuning.RENT_PER_SHIFT, "the Debt grows")
	assert_eq(_messages(Farm.FELL_INTO_DEBT, _farm.take_messages()).size(), 0, "said only once")


func test_earnings_pay_debt_down_first_and_the_app_says_when_it_is_cleared() -> void:
	var tuning := FastTuning.billing_table()
	tuning.electricity_per_lap = 0.0
	tuning.school_fees = 0.0
	# He never stops to breathe, so every crop ripens in one grow time.
	tuning.laps_before_breath = 100
	_farm = _new_farm(tuning)
	_miss_shift()
	_miss_shift()
	_farm.take_messages()

	_earn(1)
	assert_eq(_farm.debt(), 2 * FastTuning.RENT_PER_SHIFT, "nothing is paid at a pick")
	_miss_shift()

	# The pick's Labour Points paid 5 of the 8 owed at the Hand-in, then the rent added 4.
	assert_eq(_farm.debt(), 3 * FastTuning.RENT_PER_SHIFT - FastTuning.LABOUR_POINTS_PER_PICK)
	assert_does_not_have(_keys(_farm.take_messages()), Farm.DEBT_CLEARED)

	_earn(3)
	_end_shift()

	assert_eq(_farm.debt(), 0)
	var left := 3 * FastTuning.LABOUR_POINTS_PER_PICK - 7 - FastTuning.RENT_PER_SHIFT
	assert_eq(_farm.labour_points(), left)
	var keys := _keys(_farm.take_messages())
	assert_has(keys, Farm.DEBT_CLEARED)
	assert_lt(keys.find(Farm.DEBT_CLEARED), keys.find(Farm.PAY_SLIP), "paid before the Bills")


func test_debt_blocks_every_privilege_and_upgrade() -> void:
	var tuning := FastTuning.billing_table()
	tuning.rent_per_shift = 30
	_farm = _new_farm(tuning)
	_earn(3)
	_end_shift()
	_farm.debug_add_labour_points(10)
	assert_eq(_farm.debt(), 14, "met the Quota, then 9 of electricity and 30 of rent")

	for item in _farm.store():
		assert_eq(item.refusal, Farm.IN_DEBT, String(item.id))
	assert_eq(_farm.buy_upgrade(Farm.GENERATOR).reason, Farm.IN_DEBT)
	assert_eq(_farm.buy_upgrade(Farm.TOOLS).reason, Farm.IN_DEBT)
	assert_eq(_farm.buy_privilege(Farm.REST_HOUR).reason, Farm.IN_DEBT)


func test_a_missed_quota_takes_away_every_privilege_for_the_next_shift() -> void:
	_farm = _new_farm(FastTuning.table())
	_farm.debug_add_labour_points(100)

	_miss_shift()

	for item in _farm.store():
		if item.kind == StoreItemView.Kind.PRIVILEGE:
			assert_eq(item.refusal, Farm.PRIVILEGES_TAKEN_AWAY, String(item.id))
			assert_eq(_farm.buy_privilege(item.id).reason, Farm.PRIVILEGES_TAKEN_AWAY)
		else:
			assert_eq(item.refusal, &"", "Upgrades are still for sale")


func test_negligence_never_creates_or_deepens_debt() -> void:
	var tuning := FastTuning.billing_table()
	tuning.wither_seconds = FastTuning.WITHER_SECONDS
	_farm = _new_farm(tuning)
	_miss_shift()
	_farm.plant(0)
	_farm.run_generator()
	_farm.take_messages()

	HandingIn.advance(_farm, FastTuning.GROW_SECONDS + FastTuning.WITHER_SECONDS)

	var logged := _messages(Farm.NEGLIGENCE_LOGGED, _farm.take_messages())
	assert_eq(logged.size(), 1)
	assert_eq(_whole(logged[0].values, "points"), 0)
	assert_eq(_farm.debt(), FastTuning.RENT_PER_SHIFT)


func test_no_bills_are_charged_while_the_game_is_closed() -> void:
	_farm.resume_offline(FastTuning.OFFLINE_CAP_SECONDS)

	assert_does_not_have(_keys(_farm.take_messages()), Farm.PAY_SLIP)
	assert_eq(_farm.debt(), 0)
	assert_eq(_farm.shift().number, 1)


func test_a_fractional_electricity_price_bills_whole_labour_points() -> void:
	var tuning := FastTuning.billing_table()
	tuning.electricity_per_lap = 0.5
	_farm = _new_farm(tuning)
	_farm.run_generator()
	HandingIn.advance(_farm, 3 * FastTuning.LAP_SECONDS)
	_farm.plant(0)

	_end_shift()

	assert_eq(_whole(_pay_slips()[0].values, "electricity"), 2, "3 laps at 0.5 rounds to 2")


func _school_fees(slip: AppMessage) -> int:
	return _whole(slip.values, "school_fees")


func test_a_new_game_says_the_children_are_at_a_state_boarding_school() -> void:
	var farm := Farm.new(FastTuning.billing_table())

	var children := _messages(Farm.CHILDREN_AT_SCHOOL, farm.take_messages())

	assert_eq(children.size(), 1)
	assert_eq(_whole(children[0].values, "school_fees_shift"), 3)
	assert_eq(_whole(children[0].values, "every"), FastTuning.SCHOOL_FEES_EVERY_SHIFTS)


func test_school_fees_are_charged_after_rent_every_third_shift_only() -> void:
	var fees: Array[int] = []
	for shift in 6:
		_farm.debug_add_labour_points(100)
		_miss_shift()
		fees.append(_school_fees(_pay_slips()[0]))

	var expected: Array[int] = [0, 0, FastTuning.SCHOOL_FEES, 0, 0, FastTuning.SCHOOL_FEES]
	assert_eq(fees, expected)


func test_the_shift_view_says_when_the_next_school_fees_are_due() -> void:
	assert_eq(_farm.shift().school_fees_shift, 3)
	for shift in 3:
		_farm.debug_add_labour_points(100)
		_miss_shift()

	assert_eq(_farm.shift().school_fees_shift, 6)


func test_school_fees_that_leave_a_shortfall_are_unpaid_until_the_debt_is_cleared() -> void:
	for shift in 3:
		_miss_shift()

	var slip := _pay_slips()[-1].values
	assert_false(_flag(slip, "school_fees_covered"))
	assert_true(_farm.school_fees_unpaid())
	assert_eq(_farm.school_fees_unpaid_in_a_row(), 1)

	_farm.debug_add_labour_points(_farm.debt() - 1)
	assert_true(_farm.school_fees_unpaid(), "still in Debt")
	_farm.debug_add_labour_points(1)
	assert_false(_farm.school_fees_unpaid())
	assert_eq(_farm.school_fees_unpaid_in_a_row(), 1, "clearing Debt does not reset the count")


func test_unpaid_school_fees_count_up_in_a_row_and_covered_ones_reset_the_count() -> void:
	for shift in 6:
		_miss_shift()
	assert_eq(_farm.school_fees_unpaid_in_a_row(), 2)

	_farm.debug_add_labour_points(_farm.debt() + 100)
	for shift in 3:
		_miss_shift()

	assert_eq(_farm.school_fees_unpaid_in_a_row(), 0)
	assert_false(_farm.school_fees_unpaid())
