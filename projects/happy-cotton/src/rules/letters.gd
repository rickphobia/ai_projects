class_name Letters
extends RefCounted
## The Children's letters: which have arrived and how many letter Shifts have passed. The next
## letter is the one at that count in the list, not the one after the last received, so a
## letter that came due while the letters were stopped is skipped for good. When the list runs
## out no new letters come. Whether they are stopped is the Ledger's "school fees unpaid", so
## Farm passes it in. Farm owns this; tested through Farm, not on its own.

var _ids: Array[StringName]
var _letter_shifts := 0
var _received: Array[StringName] = []


## `ids` is every letter in the order they are written to arrive.
func _init(ids: Array[StringName], letter_shifts := 0, received: Array[StringName] = []) -> void:
	_ids = ids
	_letter_shifts = letter_shifts
	_received = received.duplicate()


## Shift `shift` has begun. Returns the id of the letter that arrives with it, or &"" for none:
## it isn't a letter Shift, the letters are stopped, or the list has run out.
func start_shift(shift: int, every: int, stopped: bool) -> StringName:
	if shift % every != 0:
		return &""
	_letter_shifts += 1
	var index := _letter_shifts - 1
	if stopped or index >= _ids.size():
		return &""
	_received.append(_ids[index])
	return _ids[index]


func letter_shifts() -> int:
	return _letter_shifts


func received() -> Array[StringName]:
	return _received.duplicate()
