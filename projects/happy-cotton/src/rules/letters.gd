class_name Letters
extends RefCounted
## The Children's letters: which have arrived and how many letter Shifts have passed. The next
## letter is the one at that count in the list, not the one after the last received, so a
## letter that came due while the letters were stopped is skipped for good. When the list runs
## out no new letters come. Whether they are stopped is the Ledger's "school fees unpaid", so
## Farm passes it in. Farm owns this; tested through Farm, not on its own.

## Every call home the Family text table must have lines for, in the order the Children's tone
## changes. The first is for a call before any letter has come.
const CALL_IDS: Array[StringName] = [&"call_01", &"call_02", &"call_03", &"call_04"]
## The call that follows each letter, so a call sounds like the latest letter received.
const CALLS: Dictionary[StringName, StringName] = {
	&"letter_01": &"call_01",
	&"letter_02": &"call_01",
	&"letter_03": &"call_02",
	&"letter_04": &"call_02",
	&"letter_05": &"call_03",
	&"letter_06": &"call_03",
	&"letter_07": &"call_04",
	&"letter_08": &"call_04",
}
## Every letter, in the order they arrive; the Family text table must have text for each. Their
## tone moves from warm and homesick to distant and full of school slogans. Saves hold these
## ids, and one that holds an unknown id is damaged, so add new letters at the end and never
## rename or remove one.
const IDS: Array[StringName] = [
	&"letter_01",
	&"letter_02",
	&"letter_03",
	&"letter_04",
	&"letter_05",
	&"letter_06",
	&"letter_07",
	&"letter_08",
]

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


## The letters from a Farm save. One from before the letters (`has_letters` false) has none
## received and no letter Shifts passed.
static func restored(reader: SaveReader, has_letters: bool) -> Letters:
	if not has_letters:
		return Letters.new(IDS)
	var section := reader.section("letters")
	return Letters.new(IDS, section.whole("letter_shifts"), section.ids("received", IDS))


func to_save() -> Dictionary:
	return {"letter_shifts": _letter_shifts, "received": received()}


func letter_shifts() -> int:
	return _letter_shifts


func received() -> Array[StringName]:
	return _received.duplicate()


## The call that follows the latest letter received, or the first call before any letter.
func next_call() -> StringName:
	if _received.is_empty():
		return CALL_IDS[0]
	return CALLS.get(_received.back(), CALL_IDS[0])
