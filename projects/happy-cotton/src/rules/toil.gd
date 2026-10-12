class_name Toil
extends RefCounted
## The Worker on the Generator: whether he is on it, how far into his run he is, and his breath
## when he stops. Running adds Exhaustion lap by lap, and how many laps a run lasts is set by
## his Exhaustion when it starts, so a tired Worker stops sooner. His breath ends with the
## Overseer: a whistle after a set time, then the whip after a further set time, and he runs
## again. Farm owns this and decides when time passes and when he is sent or brought back;
## tested through Farm, not on its own.

## What pass_time() returns: the Overseer blew his whistle at the Worker stopped to breathe,
## used the whip (and the Worker runs again), or did nothing.
const WHISTLE := &"overseer_whistle"
const WHIP := &"overseer_whip"
const NO_EVENT := &""

var _tuning: Tuning
var _exhaustion: Exhaustion
var _on_generator := false
## Laps finished since his last breath or rest, and seconds into the one he is on. Leaving
## the Generator doesn't reset these.
var _laps_done := 0
var _into_lap := 0.0
## How long the lap he is on takes, and how long the ones after it will: a bigger Farm makes
## the next lap longer, never the one in progress.
var _lap_seconds: float
var _next_lap_seconds: float
## Seconds left of his breath; while above 0 on the Generator, he stands and crops halt. The
## whistle comes when it falls to whip_after_seconds, the whip when it reaches 0.
var _breath_left := 0.0
## Laps this run lasts, set when it starts.
var _laps_this_run: int
## Laps finished since take_laps_run() last emptied the count: the electricity Bill's laps.
var _laps_run := 0


func _init(tuning: Tuning, exhaustion: Exhaustion, lap_seconds: float) -> void:
	_tuning = tuning
	_exhaustion = exhaustion
	_laps_this_run = exhaustion.laps_before_breath()
	_lap_seconds = lap_seconds
	_next_lap_seconds = lap_seconds


## The track changed length: laps from his next one on take this long.
func set_next_lap_seconds(seconds: float) -> void:
	_next_lap_seconds = seconds


func send() -> void:
	_on_generator = true


func bring_back() -> void:
	_on_generator = false


## A rest is a real break: his next run starts fresh, as long as his Exhaustion now allows.
func rested() -> void:
	_start_run()
	_breath_left = 0.0


func to_save() -> Dictionary:
	return {
		"on_generator": _on_generator,
		"laps_done": _laps_done,
		"into_lap": _into_lap,
		"lap_seconds": _lap_seconds,
		"breath_left": _breath_left,
		"laps_this_run": _laps_this_run,
		"laps_run": _laps_run,
	}


## Takes his place and run from a save. The run and breath are held to what the tuning table
## allows now, in case it shortened them since the save was written. A save from before the
## Bills (`has_laps_run` false) restores with no laps counted. One from before longer laps
## (`has_lap_seconds` false) kept only the seconds run, all of them on first-Farm laps.
func restore(reader: SaveReader, has_laps_run: bool, has_lap_seconds: bool) -> void:
	_on_generator = reader.flag("on_generator")
	_laps_this_run = reader.whole("laps_this_run", 1)
	if has_lap_seconds:
		_lap_seconds = reader.number("lap_seconds", _tuning.lap_seconds)
		_laps_done = reader.whole("laps_done")
		_into_lap = reader.number("into_lap")
	else:
		var run_since_breath := reader.number("run_since_breath")
		_lap_seconds = _tuning.lap_seconds
		_laps_done = floori(run_since_breath / _lap_seconds)
		_into_lap = fmod(run_since_breath, _lap_seconds)
	if _laps_done >= _laps_this_run:
		_laps_done = _laps_this_run - 1
		_into_lap = _lap_seconds
	_into_lap = minf(_into_lap, _lap_seconds)
	_breath_left = minf(reader.number("breath_left"), _breath_seconds())
	if has_laps_run:
		_laps_run = reader.whole("laps_run")


## The laps he has finished since the last call, and starts counting again from zero.
func take_laps_run() -> int:
	var laps := _laps_run
	_laps_run = 0
	return laps


func is_running() -> bool:
	return _on_generator and _breath_left <= 0.0


func is_breathing() -> bool:
	return _on_generator and _breath_left > 0.0


## Laps he will run before he stops to breathe, counting the one he is on.
func laps_left() -> int:
	return _laps_this_run - _laps_done


## How far through his current lap he is, from 0 up to (not including) 1.
func lap_progress() -> float:
	return _into_lap / _lap_seconds


## Seconds the lap he is on takes.
func lap_seconds() -> float:
	return _lap_seconds


## Seconds until he stops to breathe, the Overseer whistles, or the whip sends him running
## again; INF while he is off the Generator.
func seconds_until_turn() -> float:
	if not _on_generator:
		return INF
	if _breath_left > _tuning.whip_after_seconds:
		return _breath_left - _tuning.whip_after_seconds
	if _breath_left > 0.0:
		return _breath_left
	return _run_seconds_left()


## Some seconds of his time outside a Study Session, never past the next turn. The crops'
## growth for them is the caller's. Returns WHISTLE or WHIP if the
## Overseer acted at the end of them, NO_EVENT otherwise. The whip changes no numbers.
## Exhaustion from running is multiplied by `exhaustion_factor` (a Heatwave's).
func pass_time(seconds: float, exhaustion_factor := 1.0) -> StringName:
	if not _on_generator:
		return NO_EVENT
	if _breath_left > 0.0:
		var whistle_due := _breath_left - _tuning.whip_after_seconds
		if whistle_due > 0.0:
			if seconds >= whistle_due:
				_breath_left = _tuning.whip_after_seconds
				return WHISTLE
			_breath_left -= seconds
			return NO_EVENT
		if seconds >= _breath_left:
			_breath_left = 0.0
			return WHIP
		_breath_left -= seconds
		return NO_EVENT
	_run(seconds, exhaustion_factor)
	return NO_EVENT


## Some seconds running, never past the end of his run, which starts his breath.
func _run(seconds: float, exhaustion_factor: float) -> void:
	# Charged per second at the first Farm's rate, so a longer lap tires him more.
	_exhaustion.add(_tuning.exhaustion_per_lap * seconds / _tuning.lap_seconds * exhaustion_factor)
	if seconds >= _run_seconds_left():
		_laps_run += _laps_this_run - _laps_done
		_start_run()
		_breath_left = _breath_seconds()
		return
	_into_lap += seconds
	while _into_lap >= _lap_seconds and _laps_done < _laps_this_run - 1:
		_into_lap -= _lap_seconds
		_laps_done += 1
		_laps_run += 1
		_lap_seconds = _next_lap_seconds


## His whole breath: until the whistle, then until the whip.
func _breath_seconds() -> float:
	return _tuning.whistle_after_seconds + _tuning.whip_after_seconds


## Seconds until his run ends: the rest of this lap, then the laps left at the next length.
func _run_seconds_left() -> float:
	var later_laps := _laps_this_run - _laps_done - 1
	return _lap_seconds - _into_lap + later_laps * _next_lap_seconds


## A fresh run after a breath or rest: from the lap line, at the newest lap length, as many laps
## as his Exhaustion now allows.
func _start_run() -> void:
	_laps_done = 0
	_into_lap = 0.0
	_lap_seconds = _next_lap_seconds
	_laps_this_run = _exhaustion.laps_before_breath()


## What the Worker is doing, `resting` on a rest hour or not, and how worn down he is.
func worker_view(resting: bool) -> WorkerView:
	var activity := WorkerView.Activity.IN_FIELD
	if resting:
		activity = WorkerView.Activity.RESTING
	elif is_breathing():
		activity = WorkerView.Activity.BREATHING
	elif is_running():
		activity = WorkerView.Activity.RUNNING
	return WorkerView.new(activity, laps_left(), _exhaustion.level(), lap_progress(), lap_seconds())
