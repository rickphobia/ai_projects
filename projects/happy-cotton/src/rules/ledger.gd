class_name Ledger
extends RefCounted
## The Worker's Labour Points and Debt as one signed balance: a negative balance is Debt, so
## earnings pay Debt down before anything is left to spend. At the end of a Shift it charges
## the Bills in a fixed order (electricity, then rent, then school fees every few Shifts) and
## builds the pay slip. A school-fees Bill that leaves a shortfall marks the fees unpaid until
## the Debt is cleared, and counts towards the unpaid-in-a-row count. Negligence docks
## the balance but never below zero, so docking can never create Debt.
## Beside the balance it keeps the Worker's hidden savings, never below zero. A Bill draws on
## Labour Points first, then hidden savings, and only what both can't cover becomes Debt; the
## savings never pay Debt that already exists. A store purchase draws on whichever the Worker
## chose, and Debt blocks it either way. Farm owns this and decides when; tested through Farm,
## not on its own.

## What a store purchase is paid with.
enum PayWith { LABOUR_POINTS, HIDDEN_SAVINGS }

## Why a purchase can't be paid for (see Farm.STORE_REFUSALS).
const IN_DEBT := &"in_debt"
const NOT_ENOUGH_LABOUR_POINTS := &"not_enough_labour_points"
const NOT_ENOUGH_HIDDEN_SAVINGS := &"not_enough_hidden_savings"
## The lowest balance a save can hold: Debt can grow, but not without end.
const LEAST_SAVED_BALANCE := -1000000000

var _balance := 0
## Labour Points earned by work this Shift, for the pay slip.
var _earned := 0
## The Shift whose end charges the next school fees.
var _next_fees_shift := 0
## Set by a school-fees Bill that left a shortfall; cleared when the Debt reaches zero.
var _fees_unpaid := false
## School-fees Bills in a row that left a shortfall; a covered one resets it.
var _fees_unpaid_in_a_row := 0
## What cotton kept back sold for, under the Worker's mattress. Never below zero.
var _savings := 0


func _init(
	balance := 0,
	earned := 0,
	next_fees_shift := 0,
	fees_unpaid := false,
	fees_unpaid_in_a_row := 0,
	savings := 0
) -> void:
	_balance = balance
	_earned = earned
	_next_fees_shift = next_fees_shift
	_fees_unpaid = fees_unpaid
	_fees_unpaid_in_a_row = fees_unpaid_in_a_row
	_savings = maxi(savings, 0)


## The Ledger from the top level of a Farm save at `version`. One from before the Bills
## (version 3 or older) has nothing earned this Shift; one from before the school fees (4 or
## older) has them paid up and next due at the end of Shift `fees_shift`; one from before hidden
## savings (10 or older) has none. A negative balance restores as Debt.
static func restored(reader: SaveReader, version: int, fees_shift: int) -> Ledger:
	var balance := reader.whole("labour_points", LEAST_SAVED_BALANCE)
	var earned_this_shift := reader.whole("shift_earned") if version >= 4 else 0
	var savings := reader.whole("hidden_savings") if version >= 11 else 0
	if version < 5:
		return Ledger.new(balance, earned_this_shift, fees_shift, false, 0, savings)
	return Ledger.new(
		balance,
		earned_this_shift,
		reader.whole("school_fees_shift", 1),
		reader.flag("school_fees_unpaid"),
		reader.whole("school_fees_unpaid_in_a_row"),
		savings
	)


## Its part of the Farm's save, at the save's top level.
func to_save() -> Dictionary:
	return {
		"labour_points": _balance,
		"hidden_savings": _savings,
		"shift_earned": _earned,
		"school_fees_shift": _next_fees_shift,
		"school_fees_unpaid": _fees_unpaid,
		"school_fees_unpaid_in_a_row": _fees_unpaid_in_a_row,
	}


## Labour Points and Debt as one number: negative when in Debt.
func balance() -> int:
	return _balance


func labour_points() -> int:
	return maxi(_balance, 0)


func debt() -> int:
	return maxi(-_balance, 0)


func in_debt() -> bool:
	return _balance < 0


func earned() -> int:
	return _earned


func next_fees_shift() -> int:
	return _next_fees_shift


func fees_unpaid() -> bool:
	return _fees_unpaid


func fees_unpaid_in_a_row() -> int:
	return _fees_unpaid_in_a_row


func hidden_savings() -> int:
	return _savings


## Wages for work: they count on the pay slip. Returns true when they cleared the Debt.
func earn(points: int) -> bool:
	_earned += points
	return credit(points)


## Labour Points that are not wages, such as the debug command's. Returns true when they
## cleared the Debt.
func credit(points: int) -> bool:
	var was_in_debt := in_debt()
	_balance += points
	var cleared := was_in_debt and not in_debt()
	if cleared:
		_fees_unpaid = false
	return cleared


## Adds what cotton kept back sold for. It never touches the balance, so never the Debt.
func save_up(amount: int) -> void:
	_savings += maxi(amount, 0)


## Takes every hidden saving, as a Harmony Audit does when it catches him. Returns how many.
func take_hidden_savings() -> int:
	var taken := _savings
	_savings = 0
	return taken


## Why `price` can't be paid with `pay_with` right now, or &"" when it can. Debt blocks every
## purchase, whatever pays.
func payment_refusal(price: int, pay_with: PayWith) -> StringName:
	if in_debt():
		return IN_DEBT
	if pay_with == PayWith.HIDDEN_SAVINGS:
		return &"" if _savings >= price else NOT_ENOUGH_HIDDEN_SAVINGS
	return &"" if _balance >= price else NOT_ENOUGH_LABOUR_POINTS


## Takes the price off what `pay_with` names. Callers check payment_refusal() first.
func pay(price: int, pay_with: PayWith) -> void:
	if pay_with == PayWith.HIDDEN_SAVINGS:
		_savings -= price
	else:
		_balance -= price


## Docks up to the given points, never taking the balance below zero. Returns what was docked.
## Hidden savings are never docked: the state only takes what it knows about.
func dock(points: int) -> int:
	var docked := clampi(points, 0, maxi(_balance, 0))
	_balance -= docked
	return docked


## Charges the Bills for Shift `shift`: electricity for the `laps` run in it, then rent, then the
## school fees when they are due, and starts the next Shift's earnings from zero. A Bill that
## Labour Points and hidden savings can't cover is charged anyway: the shortfall is Debt.
## Returns the pay slip: shift, earned, laps; for each Bill (electricity, rent, school_fees, 0
## when none are due) its amount, <bill>_covered and <bill>_from_savings; and balance (negative
## for Debt). The App never shows what the savings paid.
func settle_shift(shift: int, laps: int, tuning: Tuning) -> Dictionary:
	var slip := {"shift": shift, "earned": _earned, "laps": laps}
	_charge(slip, "electricity", roundi(laps * tuning.electricity_per_lap))
	_charge(slip, "rent", roundi(tuning.rent_per_shift))
	slip["school_fees"] = 0
	slip["school_fees_covered"] = true
	slip["school_fees_from_savings"] = 0
	if shift >= _next_fees_shift:
		_charge(slip, "school_fees", roundi(tuning.school_fees))
		var covered: bool = slip["school_fees_covered"]
		_fees_unpaid_in_a_row = 0 if covered else _fees_unpaid_in_a_row + 1
		_fees_unpaid = _fees_unpaid or not covered
		_next_fees_shift = shift + roundi(tuning.school_fees_every_shifts)
	slip["balance"] = _balance
	_earned = 0
	return slip


## Charges one Bill, Labour Points first, then hidden savings, then Debt, and writes it on the
## slip: its amount, whether Labour Points and savings covered it, and what the savings paid.
func _charge(slip: Dictionary, bill_name: String, bill: int) -> void:
	var from_points := clampi(bill, 0, maxi(_balance, 0))
	var from_savings := mini(bill - from_points, _savings)
	_savings -= from_savings
	_balance -= bill - from_savings
	slip[bill_name] = bill
	slip[bill_name + "_covered"] = from_points + from_savings >= bill
	slip[bill_name + "_from_savings"] = from_savings
