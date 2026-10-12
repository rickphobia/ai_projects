class_name Shifts
extends RefCounted
## The Shift's clock and its end. Online play counts the Shift down; at its end the Hand-in
## opens and the Shift's clock waits until the Worker hands in his cotton. Handing in checks the
## Quota on what was handed in, charges the Bills, raises the Exhaustion floor and starts the
## next Shift with a higher Quota. A missed Quota starts a Study Session, which doubles with each
## miss in a row, and takes every Privilege away for the next Shift; the Shift's clock waits while
## a Study Session runs. Negligence starts a Study Session of its own. Each Shift after the first
## rolls a Harmony Audit (see Audits); the Shift's end runs it after the Quota check, and being
## caught starts the caught Study Session in place of a missed Quota's. Each Shift after the
## first also rolls its Disaster (see Disasters), whose clock is the Shift's.
## What The App should say goes on the Farm's message queue, and the Children's side on its
## Family event queue, in the order it happens. Farm owns this and decides when time passes;
## tested through Farm, not on its own.

## App message keys (see Farm.MESSAGE_KEYS). A Shift began: values shift, quota, and for the
## log only (the plans are secret) audit_chance, audit_planned and disaster (Disasters.plan()).
const SHIFT_STARTED := &"shift_started"
## The Shift's time ran out and The App asks for the cotton: values shift, in_hand, quota.
const HAND_IN_OPENED := &"hand_in_opened"
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
var _audits: Audits
var _disasters: Disasters
## The Farm's queues, shared so messages keep the order things happened in.
var _messages: Array[AppMessage]
var _family_events: Array[FamilyEvent]
var _number := 1
## Seconds of online play into the current Shift.
var _elapsed := 0.0
## The crop counter: cotton picked this Shift and so in hand. Starts from zero each Shift: a
## surplus carries no credit.
var _picked := 0
## Set from the moment the Shift's time runs out until the Worker hands in.
var _hand_in_open := false
## The Quota rise of the Upgrades and Plots bought before this Shift began; later ones wait
## for the next.
var _bought_rise := 0
## Seconds left in the current Study Session; 0 when the Worker is on the field.
var _study_left := 0.0
## Quotas missed since the last met one; it sets the next Study Session's length.
var _misses_in_a_row := 0
## Set by a missed Quota for the whole of the next Shift.
var _privileges_taken_away := false


# The Shift's end runs on every one of these parts in turn, so each comes in here.
# gdlint: ignore=function-arguments-number
func _init(
	tuning: Tuning,
	ledger: Ledger,
	exhaustion: Exhaustion,
	toil: Toil,
	store: Store,
	land: Land,
	letters: Letters,
	audits: Audits,
	disasters: Disasters,
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
	_audits = audits
	_disasters = disasters
	_messages = messages
	_family_events = family_events


## Starts the current Shift: the first of a new game, or the next one at a Shift's end.
func start() -> void:
	_picked = 0
	_bought_rise = _store.quota_rise() + _land.quota_rise()
	var chance := _audits.plan() if _number > 1 else 0.0
	var values := {"shift": _number, "quota": _quota(), "audit_chance": chance}
	values["audit_planned"] = _audits.planned()
	values["disaster"] = _disasters.plan(_number)
	_messages.append(AppMessage.new(SHIFT_STARTED, values))
	var every := roundi(_tuning.letter_every_shifts)
	var letter := _letters.start_shift(_number, every, _ledger.fees_unpaid())
	if letter != &"":
		_family_events.append(FamilyEvent.new(LETTER_ARRIVED, letter))


## Seconds of online play until the Hand-in opens; 0 while it is open.
func seconds_left() -> float:
	return _tuning.shift_seconds - _elapsed


## Counts some seconds of online play, and the Disaster's time with them; when they cover what
## is left, the Hand-in opens. The Farm stops counting while it is open.
func run(seconds: float) -> void:
	_disasters.pass_time(seconds)
	if seconds >= seconds_left():
		_elapsed = _tuning.shift_seconds
		_hand_in_open = true
		var values := {"shift": _number, "in_hand": _picked, "quota": _quota()}
		_messages.append(AppMessage.new(HAND_IN_OPENED, values))
		_audits.announce(_number)
	else:
		_elapsed += seconds


func hand_in_open() -> bool:
	return _hand_in_open


## A pick that kept its cotton: it is in hand, to be handed in at the Shift's end.
func count_pick() -> void:
	_picked += 1


func cotton_in_hand() -> int:
	return _picked


## Closes the Hand-in with `handed_in` of the cotton in hand and `kept` kept back, and runs the
## rest of the Shift end. The Farm has already paid the Labour Points and hidden savings for
## it, so the pay slip shows them and an audit can take the savings.
func hand_in(handed_in: int, kept: int) -> void:
	_hand_in_open = false
	_elapsed = 0.0
	_end(handed_in, kept)


func view() -> ShiftView:
	return ShiftView.new(
		_number,
		_quota(),
		_picked,
		seconds_left(),
		_ledger.next_fees_shift(),
		_hand_in_open,
		_disasters.view()
	)


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


## Logs the plots lost at one moment, Withered or eaten (`key`, Farm.NEGLIGENCE_LOGGED or
## Bollworms.CROP_EATEN), as Negligence: docks Labour Points for each, never below zero, and
## starts the Negligence Study Session. Plots lost together share one, and one already under
## way runs on if it is the longer. An eaten crop's message also says which Plots, for the log.
func log_negligence(lost_plots: Array[int], key: StringName) -> void:
	if lost_plots.is_empty():
		return
	var docked := _ledger.dock(lost_plots.size() * roundi(_tuning.negligence_labour_points))
	var values := {"plots": lost_plots.size(), "points": docked}
	if key == Bollworms.CROP_EATEN:
		values["plot_indexes"] = Bollworms.plain(lost_plots)
	_messages.append(AppMessage.new(key, values))
	_begin_study_session(maxf(_study_left, _tuning.negligence_study_session_seconds))


func to_save() -> Dictionary:
	return {
		"shift_number": _number,
		"shift_elapsed": _elapsed,
		"picked": _picked,
		"hand_in_open": _hand_in_open,
		"study_left": _study_left,
		"misses_in_a_row": _misses_in_a_row,
		# Named before every Privilege was taken away, not only the rest hour; kept for old saves.
		"rest_taken_away": _privileges_taken_away,
		"shift_upgrade_quota_rise": _bought_rise,
	}


## Takes back what to_save() wrote, read by the Farm: it reads the whole save in one order, so
## a damaged save's problems are listed in it. The Shift's time is held to what the tuning
## table allows now; an open Hand-in has used all of it.
func restore(
	shift_number: int,
	elapsed: float,
	picked: int,
	hand_in_is_open: bool,
	study_left: float,
	misses_in_a_row: int,
	privileges_taken_away: bool,
	bought_rise: int
) -> void:
	_number = shift_number
	_elapsed = _tuning.shift_seconds if hand_in_is_open else minf(elapsed, _tuning.shift_seconds)
	_picked = picked
	_hand_in_open = hand_in_is_open
	_study_left = study_left
	_misses_in_a_row = misses_in_a_row
	_privileges_taken_away = privileges_taken_away
	_bought_rise = bought_rise


## The Quota only ever rises: a fixed step every Shift, met or missed, and the rise of every
## Upgrade and Plot bought before this Shift began.
func _quota() -> int:
	var rise := (_number - 1) * _tuning.quota_rise
	return roundi(_tuning.first_quota + rise) + _bought_rise


## The Shift end after the Hand-in, in order: the Quota check on what was handed in, the audit
## if one was planned, one Study Session (the caught one if he was caught, else a missed
## Quota's), the Bills, the Exhaustion floor rise, then the next Shift.
func _end(handed_in: int, kept: int) -> void:
	var values := {"shift": _number, "picked": handed_in, "quota": _quota()}
	var met := handed_in >= _quota()
	if met:
		_misses_in_a_row = 0
		_privileges_taken_away = false
		_messages.append(AppMessage.new(QUOTA_MET, values))
	else:
		_misses_in_a_row += 1
		_privileges_taken_away = true
		var key := MISSED_KEYS[mini(_misses_in_a_row, MISSED_KEYS.size()) - 1]
		_messages.append(AppMessage.new(key, values))
	var should_yield := _land.plot_count() * roundi(_tuning.plot_yield_per_shift)
	if _audits.end_shift(_number, kept, should_yield):
		_begin_study_session(maxf(_study_left, _tuning.caught_study_session_seconds))
	elif not met:
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


## Doubles for each miss in a row, up to the cap. A longer one already under way (Negligence
## at the moment the Hand-in opened) runs on.
func _start_missed_quota_study_session() -> void:
	var doublings := _misses_in_a_row - 1
	var seconds := minf(
		_tuning.study_session_seconds * pow(2.0, doublings), _tuning.study_session_cap_seconds
	)
	_begin_study_session(maxf(_study_left, seconds))


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
