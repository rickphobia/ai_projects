class_name AuditView
extends RefCounted
## A read-only snapshot of the Harmony Audits as the Worker can see them: the tell, being on
## watch, and how often he has been caught. Changing the Farm never changes a view already
## handed out; ask the Farm for a new one.

## Whether the Overseer is watching the scale: an audit is planned and the Shift is in its
## last audit_tell_seconds, or over.
var tell: bool:
	get:
		return _tell
## Shifts left on watch ("Harmony Support"), counting this one; 0 when not on watch.
var watch_shifts_left: int:
	get:
		return _watch_shifts_left
## How many times an audit has caught him keeping back.
var times_caught: int:
	get:
		return _times_caught

var _tell: bool
var _watch_shifts_left: int
var _times_caught: int


func _init(audit_tell: bool, watch_left: int, caught: int) -> void:
	_tell = audit_tell
	_watch_shifts_left = watch_left
	_times_caught = caught
