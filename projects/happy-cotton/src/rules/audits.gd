class_name Audits
extends RefCounted
## Harmony Audits. It remembers the last few Shifts (audit_memory_shifts): what the Worker kept
## back, what his Plots should have yielded, and the hidden savings he spent in the state's
## store (never what Bills took from them). At the start of each Shift after the first an audit
## is rolled: the likelier the larger the kept share of those Shifts and the more he spent, and
## likelier still on watch. A planned audit shows a tell near the Shift's end, is announced
## when the Hand-in opens, and at the Hand-in looks at the kept share with this Shift included:
## above the tolerance (zero on watch) he is caught. Being caught takes all hidden savings,
## puts him on watch for a set number of Shifts and wipes the record, so lying low on watch can
## get him through; Shifts decides the Study Session. A second catch says so with its own key,
## for the story to build the Caught ending on. Farm owns this and Shifts drives it; tested
## through Farm, not on its own.

## App message keys (see Farm.MESSAGE_KEYS). The Hand-in opened with an audit planned: values
## shift.
const AUDIT_ANNOUNCED := &"audit_announced"
## The audit found nothing: values shift, kept_share and tolerance (both for the log only).
const AUDIT_PASSED := &"audit_passed"
## The audit caught him, the first time: values shift, income_recovered (the hidden savings
## taken, in The App's words), minutes (of the caught Study Session, rounded up), watch_shifts,
## times_caught, kept_share and tolerance (log only).
const CAUGHT := &"caught"
## Every catch after the first, with the same values.
const CAUGHT_AGAIN := &"caught_again"
## The last Shift on watch ended.
const ON_WATCH_ENDED := &"on_watch_ended"

var _tuning: Tuning
var _ledger: Ledger
var _messages: Array[AppMessage]
var _roll: Callable
## The remembered Shifts, oldest first, one entry per Shift in each list.
var _kept: Array[int] = []
var _yielded: Array[int] = []
var _spent: Array[int] = []
## Hidden savings spent in the store so far this Shift.
var _spent_this_shift := 0
var _planned := false
## Shifts left on watch, counting the current one; 0 when not on watch.
var _watch_left := 0
var _times_caught := 0


## `roll` is the Farm's source of chance; `messages` its App message queue.
func _init(tuning: Tuning, ledger: Ledger, messages: Array[AppMessage], roll: Callable) -> void:
	_tuning = tuning
	_ledger = ledger
	_messages = messages
	_roll = roll


## Rolls this Shift's audit and returns the chance it had. Nothing is rolled at a chance of 0,
## so a Farm that never audits draws no more on its source of chance than before audits.
func plan() -> float:
	var chance := chance()
	var roll: float = _roll.call() if chance > 0.0 else 1.0
	_planned = roll < chance
	return chance


## The chance an audit is planned at the start of the next Shift, from the remembered Shifts.
func chance() -> float:
	var spent := 0
	for amount in _spent:
		spent += amount
	var raised := (
		_tuning.audit_base_chance
		+ kept_share() * _tuning.audit_chance_per_kept_share
		+ spent * _tuning.audit_chance_per_savings_spent
	)
	if on_watch():
		raised *= _tuning.on_watch_chance_factor
	return minf(raised, 1.0)


## Cotton kept back over the remembered Shifts, against what the Plots should have yielded.
func kept_share() -> float:
	var kept := 0
	var yielded := 0
	for index in _kept.size():
		kept += _kept[index]
		yielded += _yielded[index]
	return 0.0 if yielded <= 0 else float(kept) / yielded


## The debug command's audit for this Shift.
func plan_now() -> void:
	_planned = true


func planned() -> bool:
	return _planned


## What the Worker can see, with `seconds_left` of the Shift: the tell (an audit planned and
## the Shift within audit_tell_seconds of its end), Shifts left on watch, and times caught.
func view(seconds_left: float) -> AuditView:
	var tell := _planned and seconds_left <= _tuning.audit_tell_seconds
	return AuditView.new(tell, _watch_left, _times_caught)


func on_watch() -> bool:
	return _watch_left > 0


## Hidden savings paid for something in the state's store: the store sees it.
func note_savings_spent(amount: int) -> void:
	_spent_this_shift += maxi(amount, 0)


## The Hand-in opened: The App announces a planned audit.
func announce(shift: int) -> void:
	if _planned:
		_messages.append(AppMessage.new(AUDIT_ANNOUNCED, {"shift": shift}))


## Remembers the Shift just handed in, then runs its audit if one was planned and counts a Shift
## on watch off. Returns true when he was caught, so Shifts starts the caught Study Session.
func end_shift(shift: int, kept: int, should_yield: int) -> bool:
	_kept.append(kept)
	_yielded.append(should_yield)
	_spent.append(_spent_this_shift)
	_spent_this_shift = 0
	while _kept.size() > roundi(_tuning.audit_memory_shifts):
		_kept.pop_front()
		_yielded.pop_front()
		_spent.pop_front()
	var caught := false
	if _planned:
		_planned = false
		caught = _audit(shift)
	if not caught and on_watch():
		_watch_left -= 1
		if not on_watch():
			_messages.append(AppMessage.new(ON_WATCH_ENDED, {}))
	return caught


## Finds nothing, or catches him: any cut on watch, otherwise one above the tolerance.
func _audit(shift: int) -> bool:
	var share := kept_share()
	var tolerance := 0.0 if on_watch() else _tuning.audit_tolerance
	var values := {"shift": shift, "kept_share": share, "tolerance": tolerance}
	if share <= tolerance:
		_messages.append(AppMessage.new(AUDIT_PASSED, values))
		return false
	_times_caught += 1
	_watch_left = roundi(_tuning.on_watch_shifts)
	_kept.clear()
	_yielded.clear()
	_spent.clear()
	values["income_recovered"] = _ledger.take_hidden_savings()
	values["minutes"] = ceili(_tuning.caught_study_session_seconds / 60.0)
	values["watch_shifts"] = _watch_left
	values["times_caught"] = _times_caught
	_messages.append(AppMessage.new(CAUGHT if _times_caught == 1 else CAUGHT_AGAIN, values))
	return true


func to_save() -> Dictionary:
	return {
		"kept": _kept,
		"yielded": _yielded,
		"spent": _spent,
		"spent_this_shift": _spent_this_shift,
		"planned": _planned,
		"watch_left": _watch_left,
		"times_caught": _times_caught,
	}


## Takes back what to_save() wrote. The remembered lists must be the same length; a save from
## a longer memory keeps only its newest Shifts, and one on watch longer than the tuning allows
## now is held to it.
func restore(reader: SaveReader) -> void:
	var remembered := reader.wholes("kept")
	var yielded := reader.wholes("yielded", remembered.size())
	var spent := reader.wholes("spent", remembered.size())
	var memory := roundi(_tuning.audit_memory_shifts)
	var start := maxi(remembered.size() - memory, 0)
	_kept = remembered.slice(start)
	_yielded = yielded.slice(start)
	_spent = spent.slice(start)
	_spent_this_shift = reader.whole("spent_this_shift")
	_planned = reader.flag("planned")
	_watch_left = mini(reader.whole("watch_left"), roundi(_tuning.on_watch_shifts))
	_times_caught = reader.whole("times_caught")
