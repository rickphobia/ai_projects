class_name Shifts
extends RefCounted
## The Shift's clock and its end. Online play counts the Shift down; at its end the Quota is
## checked, the Bills are charged, the Exhaustion floor rises and the next Shift starts at once
## with a higher Quota. A missed Quota starts a Study Session, which doubles with each miss in a
## row, and takes every Privilege away for the next Shift; the Shift's clock waits while a Study
## Session runs. Negligence starts a Study Session of its own.
## What The App should say goes on the Farm's message queue, and the Children's side on its
## Family event queue, in the order it happens. Farm owns this and decides when time passes;
## tested through Farm, not on its own.

## App message keys (see Farm.MESSAGE_KEYS). A Shift began: values shift, quota.
const SHIFT_STARTED := &"shift_started"
## The Quota was met (or beaten) at the end of a Shift: values shift, picked, quota.
const QUOTA_MET := &"quota_met"
## The Quota was missed at the end of a Shift: values shift, picked, quota. The key grows
## colder with each miss in a row: the first, the second, then every one after.
const QUOTA_MISSED := &"quota_missed"
const QUOTA_MISSED_AGAIN := &"quota_missed_again"
const QUOTA_MISSED_REPEATEDLY := &"quota_missed_repeatedly"
## The Quota-missed key for the first, second and every later miss in a row.
const MISSED_KEYS: Array[StringName] = [QUOTA_MISSED, QUOTA_MISSED_AGAIN, QUOTA_MISSED_REPEATEDLY]
## A Study Session began: values seconds, minutes (rounded up), in_a_row (Quotas missed in a
## row so far: 1 for the first since the last met Quota, unchanged by Negligence).
const STUDY_SESSION_STARTED := &"study_session_started"
## A Study Session ended: values in_a_row.
const STUDY_SESSION_ENDED := &"study_session_ended"
## The Bills were charged at the end of a Shift: values shift, earned (by work this Shift),
## laps, electricity, electricity_covered, rent, rent_covered (whether the balance covered each
## Bill) and balance (Labour Points left, negative for Debt).
const PAY_SLIP := &"pay_slip"
## A Bill left the Worker in Debt when he wasn't: values debt.
const FELL_INTO_DEBT := &"fell_into_debt"
## Family events (FamilyEvent kinds). A letter arrived at the start of a Shift: id is one of
## Farm.LETTER_IDS.
const LETTER_ARRIVED := &"letter_arrived"
## A school-fees Bill left a shortfall, so no letters come until the Debt is cleared.
const LETTERS_STOPPED := &"letters_stopped"

var _tuning: Tuning
var _ledger: Ledger
var _exhaustion: Exhaustion
var _toil: Toil
var _store: Store
var _land: Land
var _letters: Letters
## The Farm's queues, shared so messages keep the order things happened in.
var _messages: Array[AppMessage]
var _family_events: Array[FamilyEvent]
var _number := 1
## Seconds of online play into the current Shift.
var _elapsed := 0.0
## Cotton picked this Shift. Starts from zero each Shift: a surplus carries no credit.
var _picked := 0
## The Quota rise of the Upgrades and Plots bought before this Shift began; later ones wait
## for the next.
var _bought_rise := 0
## Seconds left in the current Study Session; 0 when the Worker is on the field.
var _study_left := 0.0
## Quotas missed since the last met one; it sets the next Study Session's length.
var _misses_in_a_row := 0
## Set by a missed Quota for the whole of the next Shift.
var _privileges_taken_away := false


func _init(
	tuning: Tuning,
	ledger: Ledger,
	exhaustion: Exhaustion,
	toil: Toil,
	store: Store,
	land: Land,
	letters: Letters,
	messages: Array[AppMessage],
	family_events: Array[FamilyEvent]
) -> void:
	_tuning = tuning
	_ledger = ledger
	_exhaustion = exhaustion
	_toil = toil
	_store = store
	_land = land
	_letters = letters
	_messages = messages
	_family_events = family_events


## Starts the current Shift: the first of a new game, or the next one at a Shift's end.
func start() -> void:
	_picked = 0
	_bought_rise = _store.quota_rise() + _land.quota_rise()
	_messages.append(AppMessage.new(SHIFT_STARTED, {"shift": _number, "quota": _quota()}))
	var every := roundi(_tuning.letter_every_shifts)
	var letter := _letters.start_shift(_number, every, _ledger.fees_unpaid())
	if letter != &"":
		_family_events.append(FamilyEvent.new(LETTER_ARRIVED, letter))


## Seconds of online play until the Quota is checked.
func seconds_left() -> float:
	return _tuning.shift_seconds - _elapsed


## Counts some seconds of online play; when they cover what is left, the Shift ends.
func run(seconds: float) -> void:
	if seconds >= seconds_left():
		_elapsed = 0.0
		_end()
	else:
		_elapsed += seconds


## A pick that kept its cotton: it counts towards the Quota.
func count_pick() -> void:
	_picked += 1


func view() -> ShiftView:
	return ShiftView.new(_number, _quota(), _picked, seconds_left(), _ledger.next_fees_shift())


func privileges_taken_away() -> bool:
	return _privileges_taken_away


func in_study_session() -> bool:
	return _study_left > 0.0


func study_session_seconds_left() -> float:
	return _study_left


## Counts the Study Session down by up to `seconds`, ending it if they cover what is left.
## Returns the seconds served: 0 when there is no Study Session.
func serve_study_session(seconds: float) -> float:
	var served := minf(seconds, _study_left)
	if served <= 0.0:
		return 0.0
	if served >= _study_left:
		_study_left = 0.0
		_messages.append(AppMessage.new(STUDY_SESSION_ENDED, {"in_a_row": _misses_in_a_row}))
	else:
		_study_left -= served
	return served


## Negligence's Study Session. One already under way runs on if it is the longer.
func start_negligence_study_session() -> void:
	_begin_study_session(maxf(_study_left, _tuning.negligence_study_session_seconds))


func to_save() -> Dictionary:
	return {
		"shift_number": _number,
		"shift_elapsed": _elapsed,
		"picked": _picked,
		"study_left": _study_left,
		"misses_in_a_row": _misses_in_a_row,
		# Named before every Privilege was taken away, not only the rest hour; kept for old saves.
		"rest_taken_away": _privileges_taken_away,
		"shift_upgrade_quota_rise": _bought_rise,
	}


## Takes back what to_save() wrote, read by the Farm: it reads the whole save in one order, so
## a damaged save's problems are listed in it. The Shift's time is held to what the tuning
## table allows now.
func restore(
	shift_number: int,
	elapsed: float,
	picked: int,
	study_left: float,
	misses_in_a_row: int,
	privileges_taken_away: bool,
	bought_rise: int
) -> void:
	_number = shift_number
	_elapsed = minf(elapsed, _tuning.shift_seconds)
	_picked = picked
	_study_left = study_left
	_misses_in_a_row = misses_in_a_row
	_privileges_taken_away = privileges_taken_away
	_bought_rise = bought_rise


## The Quota only ever rises: a fixed step every Shift, met or missed, and the rise of every
## Upgrade and Plot bought before this Shift began.
func _quota() -> int:
	var rise := (_number - 1) * _tuning.quota_rise
	return roundi(_tuning.first_quota + rise) + _bought_rise


## The Shift end, in order: the Quota check (and a Study Session if missed), the Bills, the
## Exhaustion floor rise, then the next Shift.
func _end() -> void:
	var values := {"shift": _number, "picked": _picked, "quota": _quota()}
	if _picked >= _quota():
		_misses_in_a_row = 0
		_privileges_taken_away = false
		_messages.append(AppMessage.new(QUOTA_MET, values))
	else:
		_misses_in_a_row += 1
		_privileges_taken_away = true
		var key := MISSED_KEYS[mini(_misses_in_a_row, MISSED_KEYS.size()) - 1]
		_messages.append(AppMessage.new(key, values))
		_start_missed_quota_study_session()
	_charge_bills()
	_exhaustion.raise_floor(_tuning.exhaustion_floor_rise)
	_number += 1
	start()


## The pay slip, and word of the Worker falling into Debt if the Bills put him there.
func _charge_bills() -> void:
	var was_in_debt := _ledger.in_debt()
	var were_stopped := _ledger.fees_unpaid()
	var slip := _ledger.settle_shift(_number, _toil.take_laps_run(), _tuning)
	_messages.append(AppMessage.new(PAY_SLIP, slip))
	if _ledger.in_debt() and not was_in_debt:
		_messages.append(AppMessage.new(FELL_INTO_DEBT, {"debt": _ledger.debt()}))
	if _ledger.fees_unpaid() and not were_stopped:
		_family_events.append(FamilyEvent.new(LETTERS_STOPPED))


## Doubles for each miss in a row, up to the cap.
func _start_missed_quota_study_session() -> void:
	var doublings := _misses_in_a_row - 1
	_begin_study_session(
		minf(_tuning.study_session_seconds * pow(2.0, doublings), _tuning.study_session_cap_seconds)
	)


## Takes the Worker off the Generator. The Farm cuts any rest hour or call home short.
func _begin_study_session(seconds: float) -> void:
	_study_left = seconds
	_toil.bring_back()
	var values := {
		"seconds": _study_left,
		"minutes": ceili(_study_left / 60.0),
		"in_a_row": _misses_in_a_row,
	}
	_messages.append(AppMessage.new(STUDY_SESSION_STARTED, values))
