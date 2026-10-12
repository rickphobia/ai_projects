class_name Crops
extends RefCounted
## The plots and the cotton in them: how far each crop has grown, how long it has sat ripe,
## whether it has Withered, and whether it is fertilised: a fertilised crop grows faster by the
## Fertiliser factor until it leaves the Plot. Farm owns this and decides when time passes and at
## what growth rate; this only keeps the plots' arithmetic, so Farm stays about the Worker, the
## Shift and the punishments. Tested through Farm, not on its own.

## Marks a plot with nothing planted in _grown.
const EMPTY := -1.0
## The stages a crop passes through before it is ripe, each an equal share of the grow time.
const GROWING: Array[PlotView.Stage] = [
	PlotView.Stage.SEEDLING,
	PlotView.Stage.FLOWERING,
	PlotView.Stage.BOLL,
]

var _grow_seconds: float
var _wither_seconds: float
## Seconds of growth per plot, capped at the grow time; EMPTY when nothing is planted.
var _grown: Array[float] = []
## Seconds each ripe plot has sat unpicked outside Study Sessions; 0 until it is ripe.
var _ripe_for: Array[float] = []
var _withered: Array[bool] = []
var _fertilised: Array[bool] = []
var _fertiliser_factor: float


func _init(
	grow_seconds: float, wither_seconds: float, plot_count: int, fertiliser_factor: float
) -> void:
	_grow_seconds = grow_seconds
	_wither_seconds = wither_seconds
	_fertiliser_factor = fertiliser_factor
	_grown.resize(plot_count)
	_grown.fill(EMPTY)
	_ripe_for.resize(plot_count)
	_ripe_for.fill(0.0)
	_withered.resize(plot_count)
	_withered.fill(false)
	_fertilised.resize(plot_count)
	_fertilised.fill(false)


func count() -> int:
	return _grown.size()


## A new, empty plot after the last one.
func add_plot() -> void:
	_grown.append(EMPTY)
	_ripe_for.append(0.0)
	_withered.append(false)
	_fertilised.append(false)


func exists(index: int) -> bool:
	return index >= 0 and index < _grown.size()


func is_empty(index: int) -> bool:
	return _grown[index] == EMPTY


func is_ripe(index: int) -> bool:
	return _grown[index] >= _grow_seconds and not _withered[index]


func is_withered(index: int) -> bool:
	return _withered[index]


func is_fertilised(index: int) -> bool:
	return _fertilised[index]


func plant(index: int) -> void:
	_grown[index] = 0.0
	_ripe_for[index] = 0.0
	_withered[index] = false
	_fertilised[index] = false


## Empties a plot, whether its cotton was picked or it had Withered and is cleared. Its
## Fertiliser goes with the crop.
func empty(index: int) -> void:
	_grown[index] = EMPTY
	_ripe_for[index] = 0.0
	_withered[index] = false
	_fertilised[index] = false


## The crop in plot `index` grows faster from now until it leaves the Plot.
func fertilise(index: int) -> void:
	_fertilised[index] = true


## Seconds until the next crop Withers if time passes at this growth rate outside a Study
## Session; INF when none would.
func seconds_until_wither(growth_rate: float) -> float:
	var soonest := INF
	for index in _living():
		var until_ripe := _seconds_until_ripe(index, growth_rate)
		soonest = minf(soonest, until_ripe + _wither_seconds - _ripe_for[index])
	return soonest


## Time in a Study Session: crops grow by `seconds` at `growth_rate`, but ripe cotton doesn't
## age towards Withering.
func grow(seconds: float, growth_rate: float) -> void:
	for index in _living():
		_grow_plot(index, seconds, growth_rate)


## Time outside a Study Session: crops grow by `seconds` at `growth_rate` and ripe cotton ages
## towards Withering. Returns the plots that Withered.
func tend(seconds: float, growth_rate: float) -> Array[int]:
	var withered: Array[int] = []
	for index in _living():
		var until_ripe := _grow_plot(index, seconds, growth_rate)
		if seconds < until_ripe:
			continue
		var aged := seconds - until_ripe
		if aged >= _wither_seconds - _ripe_for[index]:
			_withered[index] = true
			withered.append(index)
		else:
			_ripe_for[index] += aged
	return withered


func ripe_count() -> int:
	var ripe := 0
	for index in _grown.size():
		if is_ripe(index):
			ripe += 1
	return ripe


## The plots as plain data for a save.
func to_save() -> Dictionary:
	return {
		"grown": _grown.duplicate(),
		"ripe_for": _ripe_for.duplicate(),
		"withered": _withered.duplicate(),
		"fertilised": _fertilised.duplicate(),
	}


## Takes the plots from a save. Ripe cotton is held to the wither time, in case the tuning
## table shortened it since the save was written. A save from before Fertiliser
## (`has_fertiliser` false) restores with nothing fertilised.
func restore(reader: SaveReader, has_fertiliser: bool) -> void:
	var plots := count()
	_grown = reader.numbers("grown", plots, EMPTY)
	_ripe_for = reader.numbers("ripe_for", plots)
	_withered = reader.flags("withered", plots)
	if has_fertiliser:
		_fertilised = reader.flags("fertilised", plots)
	for index in plots:
		if _grown[index] < 0.0 and _grown[index] != EMPTY:
			_grown[index] = EMPTY
			reader.problems().append("crops.grown has a negative growth that isn't empty")
		_ripe_for[index] = minf(_ripe_for[index], _wither_seconds)
	for index in plots:
		if _fertilised[index] and _grown[index] == EMPTY:
			reader.problems().append("crops.fertilised marks a Plot with no crop growing")
			break


## The time left it shows is in seconds of growth at `growth_rate` (and the Fertiliser's
## factor, if the crop has it).
func view(index: int, growth_rate := 1.0) -> PlotView:
	var grown := _grown[index]
	var fertilised := _fertilised[index]
	if grown == EMPTY:
		return PlotView.new(PlotView.Stage.EMPTY, 0.0)
	if _withered[index]:
		return PlotView.new(PlotView.Stage.WITHERED, 0.0, fertilised)
	if grown >= _grow_seconds:
		return PlotView.new(PlotView.Stage.RIPE, 0.0, fertilised)
	var stage_index := floori(grown * GROWING.size() / _grow_seconds)
	var seconds_left := (_grow_seconds - grown) / _rate_of(index, growth_rate)
	return PlotView.new(GROWING[stage_index], seconds_left, fertilised)


## Plots with a crop still growing: planted, not yet ripe.
func growing() -> Array[int]:
	var plots: Array[int] = []
	for index in _living():
		if _grown[index] < _grow_seconds:
			plots.append(index)
	return plots


## Plots with a crop that hasn't Withered.
func _living() -> Array[int]:
	var living: Array[int] = []
	for index in _grown.size():
		if _grown[index] != EMPTY and not _withered[index]:
			living.append(index)
	return living


## Grows one crop, ripe at most. Returns the seconds it took to ripen: more than `seconds` when
## it is still growing.
func _grow_plot(index: int, seconds: float, growth_rate: float) -> float:
	var until_ripe := _seconds_until_ripe(index, growth_rate)
	if seconds < until_ripe:
		_grown[index] += seconds * _rate_of(index, growth_rate)
	else:
		_grown[index] = _grow_seconds
	return until_ripe


## 0 when ripe; INF when the crop isn't growing at this rate.
func _seconds_until_ripe(index: int, growth_rate: float) -> float:
	var left := _grow_seconds - _grown[index]
	if left <= 0.0:
		return 0.0
	if growth_rate <= 0.0:
		return INF
	return left / _rate_of(index, growth_rate)


## How fast plot `index` grows when crops grow at `growth_rate`.
func _rate_of(index: int, growth_rate: float) -> float:
	return growth_rate * _fertiliser_factor if _fertilised[index] else growth_rate
