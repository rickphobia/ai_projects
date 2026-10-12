class_name SaveReader
extends RefCounted
## Reads one section of a saved Farm, checking each field's type and range. It collects every
## problem instead of stopping at the first, so the log names each bad field of a damaged
## save. A save comes back through JSON, so whole numbers may arrive as floats. A field that
## can't be read gives a harmless default; the caller must not use what it read when
## problems() isn't empty.

var _data: Dictionary
## Where this section sits in the save, such as "crops", for the problem messages.
var _where: String
## Shared by a reader and the sections it opens, so one list holds every problem.
var _problems: Array[String]


func _init(data: Dictionary, where: String = "", problems: Array[String] = []) -> void:
	_data = data
	_where = where
	_problems = problems


func problems() -> Array[String]:
	return _problems


func number(key: String, least: float = 0.0) -> float:
	var value: Variant = _data.get(key)
	if not _is_number(value):
		_problem(key, "is missing or not a number")
		return least
	var read: float = value
	if read < least:
		_problem(key, "is below %s" % least)
		return least
	return read


func whole(key: String, least: int = 0) -> int:
	var read := number(key, least)
	if read != floorf(read):
		_problem(key, "is not a whole number")
	return int(read)


func flag(key: String) -> bool:
	var value: Variant = _data.get(key)
	if not value is bool:
		_problem(key, "is missing or not true or false")
		return false
	return value


## A list of `size` numbers, each `least` or more. A missing list or one of the wrong length
## is one problem, and bad entries are one more, however many there are.
func numbers(key: String, size: int, least: float = 0.0) -> Array[float]:
	var read: Array[float] = []
	read.resize(size)
	read.fill(least)
	var all_good := true
	var list := _list(key, size)
	for index in list.size():
		var value: Variant = list[index]
		var found: float = value if _is_number(value) else least - 1.0
		all_good = all_good and found >= least
		read[index] = maxf(found, least)
	if not all_good:
		_problem(key, "holds something other than a number of %s or more" % least)
	return read


## A list of whole numbers, each `least` or more, read as numbers() reads them: `size` long, or
## any length when `size` is -1.
func wholes(key: String, size: int = -1, least: int = 0) -> Array[int]:
	var length := size
	if length < 0:
		var value: Variant = _data.get(key)
		var list: Array = value if value is Array else []
		length = list.size()
	var read: Array[int] = []
	var all_whole := true
	for number_read in numbers(key, length, least):
		all_whole = all_whole and number_read == floorf(number_read)
		read.append(int(number_read))
	if not all_whole:
		_problem(key, "holds something other than a whole number")
	return read


## A list of `size` true or false values, its problems counted as numbers() counts them.
func flags(key: String, size: int) -> Array[bool]:
	var read: Array[bool] = []
	read.resize(size)
	read.fill(false)
	var all_good := true
	var list := _list(key, size)
	for index in list.size():
		var value: Variant = list[index]
		all_good = all_good and value is bool
		read[index] = value if value is bool else false
	if not all_good:
		_problem(key, "holds something other than true or false")
	return read


## A list of any length whose entries are each one of `allowed`, kept in order. Entries that
## aren't are dropped and make one problem, however many there are.
func ids(key: String, allowed: Array[StringName]) -> Array[StringName]:
	var read: Array[StringName] = []
	var value: Variant = _data.get(key)
	if not value is Array:
		_problem(key, "is missing or not a list")
		return read
	var list: Array = value
	var all_good := true
	for entry: Variant in list:
		var text: String = entry if entry is String else ""
		var known := StringName(text) in allowed
		all_good = all_good and known
		if known:
			read.append(StringName(text))
	if not all_good:
		_problem(key, "holds something other than one of %s" % [allowed])
	return read


## The dictionary under `key`, read with the same problem list when it is there.
func section(key: String) -> SaveReader:
	var value: Variant = _data.get(key)
	if not value is Dictionary:
		_problem(key, "is missing or not a section")
		# Its own list: every field of a missing section would only repeat this problem.
		var unheard: Array[String] = []
		return SaveReader.new({}, _path(key), unheard)
	var found: Dictionary = value
	return SaveReader.new(found, _path(key), _problems)


## The list under `key` if it has `size` entries; otherwise an empty list and a problem.
func _list(key: String, size: int) -> Array:
	var value: Variant = _data.get(key)
	if not value is Array:
		_problem(key, "is missing or not a list")
		return []
	var list: Array = value
	if list.size() != size:
		_problem(key, "has %d entries, not %d" % [list.size(), size])
		return []
	return list


func _is_number(value: Variant) -> bool:
	return value is float or value is int


func _problem(key: String, what: String) -> void:
	_problems.append("%s %s" % [_path(key), what])


func _path(key: String) -> String:
	return key if _where.is_empty() else "%s.%s" % [_where, key]
