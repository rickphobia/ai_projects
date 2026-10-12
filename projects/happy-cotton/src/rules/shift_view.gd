class_name ShiftView
extends RefCounted
## A read-only snapshot of the current Shift, for The App to show. Changing the Farm never
## changes a view already handed out; ask the Farm for a new one.

## Counts from 1.
var number: int:
	get:
		return _number
var quota: int:
	get:
		return _quota
## The crop counter: cotton picked so far this Shift, and so in hand for the Hand-in.
var picked: int:
	get:
		return _picked
## Seconds of online play until the Hand-in opens; 0 while it is open.
var seconds_left: float:
	get:
		return _seconds_left
## Set from the moment the Shift's time runs out until the Worker hands in his cotton.
var hand_in_open: bool:
	get:
		return _hand_in_open
## The Shift's Disaster: none, warned of or striking.
var disaster: DisasterView:
	get:
		return _disaster
## The Shift whose end charges the next school fees.
var school_fees_shift: int:
	get:
		return _school_fees_shift

var _number: int
var _quota: int
var _picked: int
var _seconds_left: float
var _school_fees_shift: int
var _hand_in_open: bool
var _disaster: DisasterView


func _init(
	shift_number: int,
	shift_quota: int,
	shift_picked: int,
	shift_left: float,
	fees_shift: int,
	hand_in_is_open := false,
	shift_disaster: DisasterView = null
) -> void:
	_number = shift_number
	_quota = shift_quota
	_picked = shift_picked
	_seconds_left = shift_left
	_school_fees_shift = fees_shift
	_hand_in_open = hand_in_is_open
	_disaster = shift_disaster if shift_disaster != null else DisasterView.new()
