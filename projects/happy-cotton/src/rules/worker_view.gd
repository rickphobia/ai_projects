class_name WorkerView
extends RefCounted
## A read-only snapshot of what the Worker is doing and how worn down he is, for the field to
## show. Changing the Farm never changes a view already handed out; ask the Farm for a new one.

## In the field (planting, picking, or taken off the Generator by a Study Session), running
## on the Generator, stopped on it to breathe, or on a rest hour.
enum Activity { IN_FIELD, RUNNING, BREATHING, RESTING }

var activity: Activity:
	get:
		return _activity
## Laps he will run before he stops to breathe, counting the one he is on.
var laps_left: int:
	get:
		return _laps_left
## From 0 (rested) to Exhaustion.MOST (spent).
var exhaustion: float:
	get:
		return _exhaustion
## How far through his current lap he is, from 0 (at the lap line) to just under 1. Kept
## while he is off the Generator, as his laps carry over; 0 while he breathes.
var lap_progress: float:
	get:
		return _lap_progress
## Seconds the lap he is on takes; longer on a bigger Farm.
var lap_seconds: float:
	get:
		return _lap_seconds

var _activity: Activity
var _laps_left: int
var _exhaustion: float
var _lap_progress: float
var _lap_seconds: float


func _init(
	worker_activity: Activity,
	worker_laps_left: int,
	worker_exhaustion := 0.0,
	worker_lap_progress := 0.0,
	worker_lap_seconds := 0.0
) -> void:
	_activity = worker_activity
	_laps_left = worker_laps_left
	_exhaustion = worker_exhaustion
	_lap_progress = worker_lap_progress
	_lap_seconds = worker_lap_seconds
