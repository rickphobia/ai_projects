class_name DisasterView
extends RefCounted
## A read-only snapshot of the Shift's Disaster, for The App and the field to show: none (or
## one planned but not yet warned of, which is secret), warned of, or striking.

enum Phase { NONE, WARNED, STRIKING }

var phase: Phase:
	get:
		return _phase
## Disasters.SANDSTORM; &"" with no Disaster to show.
var kind: StringName:
	get:
		return _kind
## Seconds of online Shift time until it strikes while warned, or until it passes while
## striking; 0 with none.
var seconds_left: float:
	get:
		return _seconds_left

var _phase: Phase
var _kind: StringName
var _seconds_left: float


func _init(disaster_phase := Phase.NONE, disaster_kind := &"", left := 0.0) -> void:
	_phase = disaster_phase
	_kind = disaster_kind if disaster_phase != Phase.NONE else &""
	_seconds_left = left if disaster_phase != Phase.NONE else 0.0
