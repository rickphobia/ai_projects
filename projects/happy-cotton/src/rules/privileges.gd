class_name Privileges
extends RefCounted
## The Privilege under way, if any: a rest hour or a call home. Either takes the Worker off the
## Generator while the Shift counts on, and keeps him from field work and other Privileges until
## it ends. A rest hour lowers his Exhaustion towards its floor a little at a time; a call home
## takes none away. A Study Session cuts either short. Farm owns this, sells them and decides
## when time passes; tested through Farm, not on its own.

## Why a Privilege under way keeps him from work (see Farm.STORE_REFUSALS).
const RESTING := &"resting"
const ON_A_CALL := &"on_a_call"
## App message key: a rest hour ran its course. A Study Session cuts one short without this.
const REST_ENDED := &"rest_ended"

var _tuning: Tuning
var _exhaustion: Exhaustion
var _toil: Toil
## The Farm's message queue, shared so messages keep the order things happened in.
var _messages: Array[AppMessage]
## Seconds left of a rest hour; 0 when he isn't resting.
var _rest_left := 0.0
## Seconds left of a call home; 0 when he isn't on one.
var _call_left := 0.0


func _init(tuning: Tuning, exhaustion: Exhaustion, toil: Toil, messages: Array[AppMessage]) -> void:
	_tuning = tuning
	_exhaustion = exhaustion
	_toil = toil
	_messages = messages


func rest_left() -> float:
	return _rest_left


func call_left() -> float:
	return _call_left


func is_resting() -> bool:
	return _rest_left > 0.0


## RESTING or ON_A_CALL while one keeps him from work, or &"" when none does.
func away_reason() -> StringName:
	if is_resting():
		return RESTING
	if _call_left > 0.0:
		return ON_A_CALL
	return &""


## Starts a rest hour (`rest` true) or a call home, and takes him off the Generator. Returns its
## length in seconds.
func start(rest: bool) -> float:
	_toil.bring_back()
	if rest:
		_rest_left = _tuning.rest_hour_seconds
		return _rest_left
	_call_left = _tuning.call_home_seconds
	return _call_left


## Seconds until the Privilege under way ends; INF when none is.
func seconds_until_end() -> float:
	if is_resting():
		return _rest_left
	if _call_left > 0.0:
		return _call_left
	return INF


## Some seconds of online play, never past the Privilege's end: a rest takes Exhaustion away a
## little at a time and, at its end, sends him back to the Generator's breath count rested.
func pass_time(seconds: float) -> void:
	_call_left = maxf(0.0, _call_left - seconds)
	if not is_resting():
		return
	_exhaustion.recover(_tuning.rest_hour_recovery * seconds / _tuning.rest_hour_seconds)
	if seconds >= _rest_left:
		_rest_left = 0.0
		_toil.rested()
		_messages.append(AppMessage.new(REST_ENDED, {}))
	else:
		_rest_left -= seconds


func cut_short() -> void:
	_rest_left = 0.0
	_call_left = 0.0


## Its part of the Farm's save, at the save's top level.
func to_save() -> Dictionary:
	return {"rest_left": _rest_left, "call_left": _call_left}


## Takes the timers from a save, held to what the tuning table allows now. A save from before
## the call home (`has_call` false) restores with none under way.
func restore(reader: SaveReader, has_call: bool) -> void:
	_rest_left = minf(reader.number("rest_left"), _tuning.rest_hour_seconds)
	if has_call:
		_call_left = minf(reader.number("call_left"), _tuning.call_home_seconds)
