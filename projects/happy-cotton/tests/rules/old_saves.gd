class_name OldSaves
extends RefCounted
## Turns a save of this version back into the shape older versions wrote, for tests of
## restoring them.


## Before version 9 the Worker's run was only the seconds run since his breath, every lap
## taking lap_seconds.
static func before_longer_laps(save: Dictionary) -> void:
	var toil: Dictionary = save["toil"]
	var laps_done: int = toil["laps_done"]
	var into_lap: float = toil["into_lap"]
	var lap_seconds: float = toil["lap_seconds"]
	toil["run_since_breath"] = laps_done * lap_seconds + into_lap
	toil.erase("laps_done")
	toil.erase("into_lap")
	toil.erase("lap_seconds")
