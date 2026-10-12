class_name PlotView
extends RefCounted
## A read-only snapshot of one plot, for the field and The App to show. Changing the Farm
## never changes a view already handed out; ask the Farm for a new one.

## WITHERED: ripe cotton left unpicked too long; it must be cleared before replanting.
enum Stage { EMPTY, SEEDLING, FLOWERING, BOLL, RIPE, WITHERED }

var stage: Stage:
	get:
		return _stage
## Seconds of play until the cotton is ripe; 0 when ripe, Withered or empty.
var seconds_left: float:
	get:
		return _seconds_left
## Fertiliser was spread on the crop in it; false once the crop leaves the Plot.
var fertilised: bool:
	get:
		return _fertilised

var _stage: Stage
var _seconds_left: float
var _fertilised: bool


func _init(plot_stage: Stage, plot_seconds_left: float, is_fertilised := false) -> void:
	_stage = plot_stage
	_seconds_left = plot_seconds_left
	_fertilised = is_fertilised
