class_name Disasters
extends RefCounted
## The Shift's Disaster. At the start of every Shift after the first a Sandstorm is rolled, and
## if one comes, when in the Shift it strikes: never so early that the warning can't come
## first, nor so late that it can't pass before the Shift ends. The App warns of it
## disaster_warning_seconds before; it then lasts disaster_seconds, and while it does a
## Sandstorm multiplies growth per second of running by sandstorm_growth_factor. At most one a
## Shift. Its clock is the Shift's online time, so it waits with the Shift (in a Study Session,
## offline, at an open Hand-in). Nothing of it is saved: a restored Shift has none, so closing
## the game ends it. The Quota never changes for it. Shifts plans it and counts its time; Farm
## reads its growth factor. Tested through Farm, not on its own.

## The Disaster kinds.
const SANDSTORM := &"sandstorm"
## App message keys (see Farm.MESSAGE_KEYS). The App warns of a Sandstorm: values kind, seconds
## (until it strikes).
const SANDSTORM_WARNED := &"sandstorm_warned"
## A Sandstorm struck: values kind, seconds (how long it lasts).
const SANDSTORM_STRUCK := &"sandstorm_struck"
## The Disaster passed: values kind, seconds (how long it lasted).
const DISASTER_PASSED := &"disaster_passed"
## Each kind's warning and strike keys.
const WARNED_KEYS: Dictionary[StringName, StringName] = {SANDSTORM: SANDSTORM_WARNED}
const STRUCK_KEYS: Dictionary[StringName, StringName] = {SANDSTORM: SANDSTORM_STRUCK}

var _tuning: Tuning
var _roll: Callable
## Farm's App message queue, shared.
var _messages: Array[AppMessage]
## The Disaster planned or striking this Shift; &"" with none, or once it has passed.
var _kind := &""
var _warned := false
## Seconds of Shift time until it strikes; 0 once it has.
var _until_strike := 0.0
## How long it lasts, and the seconds of that left once it has struck.
var _length := 0.0
var _left := 0.0


## `roll` is the Farm's source of chance; `messages` its App message queue.
func _init(tuning: Tuning, roll: Callable, messages: Array[AppMessage]) -> void:
	_tuning = tuning
	_roll = roll
	_messages = messages


## Plans Shift `shift_number`'s Disaster, dropping anything left of the last Shift's. Returns
## the plan for the log only (it is secret): kind (&"" for none), strikes_at (seconds into
## the Shift) and seconds (how long it lasts). Nothing is rolled at a chance of 0, so other
## rules' rolls are left as they were.
func plan(shift_number: int) -> Dictionary:
	_kind = &""
	_warned = false
	_left = 0.0
	var chance := _tuning.sandstorm_chance if shift_number > 1 else 0.0
	var roll: float = _roll.call() if chance > 0.0 else 1.0
	if roll >= chance:
		return {"kind": _kind, "strikes_at": 0.0, "seconds": 0.0}
	var earliest := _tuning.disaster_warning_seconds
	var latest := _tuning.shift_seconds - _tuning.disaster_seconds
	var when: float = _roll.call()
	_kind = SANDSTORM
	_length = _tuning.disaster_seconds
	_until_strike = lerpf(earliest, latest, when)
	if _until_strike <= _tuning.disaster_warning_seconds:
		_warn()
	return {"kind": _kind, "strikes_at": _until_strike, "seconds": _length}


## The debug command's Disaster of `kind`: it strikes at once, cut to the `shift_left` seconds
## of the Shift so it still passes within it. Nothing happens with no Shift time left or with
## one already striking.
func strike_now(kind: StringName, shift_left: float) -> void:
	if shift_left <= 0.0 or is_striking():
		return
	_kind = kind
	_warned = true
	_until_strike = 0.0
	_length = minf(_tuning.disaster_seconds, shift_left)
	_strike()


func is_striking() -> bool:
	return _kind != &"" and _until_strike <= 0.0


## What growth per second of running is multiplied by now: below 1 while a Sandstorm strikes.
func growth_factor() -> float:
	return _tuning.sandstorm_growth_factor if is_striking() and _kind == SANDSTORM else 1.0


## Seconds of Shift time until it is warned of, strikes or passes; INF with none.
func seconds_until_next() -> float:
	if _kind == &"":
		return INF
	if not _warned:
		return _until_strike - _tuning.disaster_warning_seconds
	if _until_strike > 0.0:
		return _until_strike
	return _left


## Counts `seconds` of online Shift time. Callers step no further than seconds_until_next(), so
## at most one turn (warning, strike or passing) happens in a step, landing exactly on it.
func pass_time(seconds: float) -> void:
	if _kind == &"":
		return
	if seconds < seconds_until_next():
		if _until_strike > 0.0:
			_until_strike -= seconds
		else:
			_left -= seconds
		return
	if not _warned:
		_until_strike = _tuning.disaster_warning_seconds
		_warn()
	elif _until_strike > 0.0:
		_until_strike = 0.0
		_strike()
	else:
		_messages.append(AppMessage.new(DISASTER_PASSED, {"kind": _kind, "seconds": _length}))
		_kind = &""
		_left = 0.0


func view() -> DisasterView:
	if _kind == &"" or not _warned:
		return DisasterView.new()
	if _until_strike > 0.0:
		return DisasterView.new(DisasterView.Phase.WARNED, _kind, _until_strike)
	return DisasterView.new(DisasterView.Phase.STRIKING, _kind, _left)


func _warn() -> void:
	_warned = true
	var values := {"kind": _kind, "seconds": _until_strike}
	_messages.append(AppMessage.new(WARNED_KEYS[_kind], values))


func _strike() -> void:
	_left = _length
	_messages.append(AppMessage.new(STRUCK_KEYS[_kind], {"kind": _kind, "seconds": _length}))
