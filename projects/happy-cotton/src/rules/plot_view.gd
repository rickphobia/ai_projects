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

## Bollworms are on the crop; tapping the Plot picks them off.
var bollworms: bool:
	get:
		return _bollworm_seconds_left > 0.0
## Seconds of online play outside Study Sessions until they eat the crop; 0 without them.
var bollworm_seconds_left: float:
	get:
		return _bollworm_seconds_left
## Pesticide was sprayed on it: no Bollworms come until the crop in it, or the next one planted,
## leaves the Plot.
var protected: bool:
	get:
		return _protected

var _stage: Stage
var _seconds_left: float
var _fertilised: bool
var _bollworm_seconds_left: float
var _protected: bool


func _init(
	plot_stage: Stage,
	plot_seconds_left: float,
	is_fertilised := false,
	bollworms_seconds_left := 0.0,
	is_protected := false
) -> void:
	_stage = plot_stage
	_seconds_left = plot_seconds_left
	_fertilised = is_fertilised
	_bollworm_seconds_left = bollworms_seconds_left
	_protected = is_protected


## This view with Bollworms that eat the crop in `eat_seconds_left` (0 for none), and
## `is_protected` by Pesticide or not.
func with_bollworms(eat_seconds_left: float, is_protected := false) -> PlotView:
	return PlotView.new(_stage, _seconds_left, _fertilised, eat_seconds_left, is_protected)
