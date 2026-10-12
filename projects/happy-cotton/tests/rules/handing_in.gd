class_name HandingIn
extends RefCounted
## Plays a Farm through its Hand-ins for tests about other rules: at every Shift's end the
## Worker hands in all his cotton at once, so time runs on as it did before the Hand-in made
## the Farm wait. Tests about the Hand-in itself call Farm.advance() and Farm.hand_in().


## Plays `seconds` of online time as Farm.advance() does, handing in at every Hand-in on the
## way. Returns the Overseer's events, oldest first.
static func advance(farm: Farm, seconds: float) -> Array[StringName]:
	var events: Array[StringName] = []
	var remaining := seconds
	while remaining > 0.0:
		# Stepping exactly to the Hand-in means no time is lost while it waits. Negligence
		# starting within the step pushes the Hand-in later, so then the step plays out whole.
		var step := minf(remaining, seconds_to_hand_in(farm))
		events.append_array(farm.advance(step))
		remaining -= step
		if farm.hand_in_open():
			farm.hand_in()
	return events


## Plays on to the end of the Shift (and any Study Session before it) and hands in.
static func finish_shift(farm: Farm) -> void:
	farm.advance(seconds_to_hand_in(farm))
	farm.hand_in()


## Online seconds until the Hand-in opens, if no new Study Session starts first.
static func seconds_to_hand_in(farm: Farm) -> float:
	return farm.study_session_seconds_left() + farm.shift().seconds_left
