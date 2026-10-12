class_name Bollworms
extends RefCounted
## Bollworms on the Plots. Every bollworm_check_seconds of the time it is given, each growing
## Plot without them gets them by chance; from then they eat the crop when bollworm_eat_seconds
## more have passed, unless picked off first, and the Plot empties. Farm gives it only online
## time outside Study Sessions, so nothing comes or eats offline or in one, and punishes a crop
## eaten. A Plot sprayed with Pesticide is protected: none come to it until the crop in it, or
## the next one planted, is picked or Withers (Farm says when it is picked). Arrivals go to
## Farm's App message queue. Tested through Farm, not on its own.

## Bollworms came: values plots (how many), plot_indexes (which, for the log).
const BOLLWORMS_ARRIVED := &"bollworms_arrived"
## Bollworms ate crops at the same moment, logged as Negligence: values plots, plot_indexes,
## points (Labour Points docked). A Study Session for the Negligence follows at once.
const CROP_EATEN := &"crop_eaten"
## pick_off_bollworms() was given a Plot without them.
const NO_BOLLWORMS := &"no_bollworms"
## The crop can't be picked until its Bollworms are picked off, nor the Plot sprayed.
const BOLLWORMS_ON_PLOT := &"bollworms_on_plot"
## Pesticide was sprayed on the Plot already.
const ALREADY_PROTECTED := &"already_protected"

var _tuning: Tuning
var _roll: Callable
## Farm's App message queue, shared.
var _messages: Array[AppMessage]
## Seconds until the Bollworms on each Plot eat its crop; 0 when it has none.
var _eat_left: Array[float] = []
## Each Plot sprayed with Pesticide whose crop (or the next one planted) hasn't left yet.
var _protected: Array[bool] = []
## Seconds since the last check.
var _since_check := 0.0


func _init(tuning: Tuning, plot_count: int, roll: Callable, messages: Array[AppMessage]) -> void:
	_tuning = tuning
	_roll = roll
	_messages = messages
	_eat_left.resize(plot_count)
	_eat_left.fill(0.0)
	_protected.resize(plot_count)
	_protected.fill(false)


## Plot indexes as a plain list for message values, so the log shows them as [0, 1].
static func plain(plots: Array[int]) -> Array:
	var indexes: Array = []
	indexes.assign(plots)
	return indexes


func add_plot() -> void:
	_eat_left.append(0.0)
	_protected.append(false)


func has(index: int) -> bool:
	return _eat_left[index] > 0.0


## Seconds until they eat the crop; 0 when the Plot has none.
func seconds_left(index: int) -> float:
	return _eat_left[index]


func is_protected(index: int) -> bool:
	return _protected[index]


## Why Pesticide can't be sprayed on plot `index`, or &"" when it can.
func spray_refusal(index: int) -> StringName:
	if has(index):
		return BOLLWORMS_ON_PLOT
	if _protected[index]:
		return ALREADY_PROTECTED
	return &""


## Pesticide was sprayed on plot `index`. Callers check spray_refusal() first.
func protect(index: int) -> void:
	_protected[index] = true


## The crop on plot `index` left it, so its protection ends.
func crop_left(index: int) -> void:
	_protected[index] = false
	remove(index)


## They were picked off, or the crop left the Plot.
func remove(index: int) -> void:
	_eat_left[index] = 0.0


## Seconds until the next check or the next crop eaten, whichever comes first.
func seconds_until_next() -> float:
	var soonest := _tuning.bollworm_check_seconds - _since_check
	for left in _eat_left:
		if left > 0.0:
			soonest = minf(soonest, left)
	return soonest


## Counts `seconds` of `crops`' time towards the next check and the Bollworms towards eating;
## they leave the `withered` Plots first, and the protection there ends. Callers step no
## further than seconds_until_next(). The crops they eat leave their Plots; returns those Plots.
## At a check, each growing Plot without them or protection gets them by chance.
func tend(seconds: float, crops: Crops, withered: Array[int]) -> Array[int]:
	for index in withered:
		crop_left(index)
	_since_check += seconds
	var eaten: Array[int] = []
	for index in _eat_left.size():
		if _eat_left[index] <= 0.0:
			continue
		_eat_left[index] -= seconds
		if _eat_left[index] <= 0.0:
			_eat_left[index] = 0.0
			crops.empty(index)
			crop_left(index)
			eaten.append(index)
	if _since_check >= _tuning.bollworm_check_seconds:
		_check(crops.growing())
	return eaten


## Bollworms come at once to each of `plots` without them that isn't protected.
func arrive(plots: Array[int]) -> void:
	var arrived: Array[int] = []
	for index in plots:
		if not has(index) and not _protected[index]:
			_eat_left[index] = _tuning.bollworm_eat_seconds
			arrived.append(index)
	if not arrived.is_empty():
		var values := {"plots": arrived.size(), "plot_indexes": plain(arrived)}
		_messages.append(AppMessage.new(BOLLWORMS_ARRIVED, values))


func to_save() -> Dictionary:
	return {
		"eat_left": _eat_left.duplicate(),
		"since_check": _since_check,
		"protected": _protected.duplicate(),
	}


## Takes the Bollworms from a save, their times held to what the tuning table allows now, in
## case it shortened them since the save was written. A save from before Pesticide
## (`has_pesticide` false) has no Plot protected.
func restore(reader: SaveReader, has_pesticide: bool) -> void:
	_eat_left = reader.numbers("eat_left", _eat_left.size())
	for index in _eat_left.size():
		_eat_left[index] = minf(_eat_left[index], _tuning.bollworm_eat_seconds)
	_since_check = minf(reader.number("since_check"), _tuning.bollworm_check_seconds)
	if has_pesticide:
		_protected = reader.flags("protected", _eat_left.size())


## Each of the `growing` Plots without Bollworms or protection gets them by chance, and the
## next check starts counting.
func _check(growing: Array[int]) -> void:
	_since_check = 0.0
	var chance := _tuning.bollworm_chance
	var struck: Array[int] = []
	for index in growing:
		# No roll is drawn when they can't come, so other rules' rolls are left as they were.
		var open_to_them := not has(index) and not _protected[index]
		var roll: float = _roll.call() if chance > 0.0 and open_to_them else 1.0
		if roll < chance:
			struck.append(index)
	arrive(struck)
