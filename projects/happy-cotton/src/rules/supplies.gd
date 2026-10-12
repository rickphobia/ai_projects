class_name Supplies
extends RefCounted
## The supplies the Worker holds, bought in the store into a small stock of each and used from
## the supplies bar in the field. Fertiliser's price is its first price plus a rise for every
## Shift after the first, so it follows from the Shift number and is never saved. Which crops
## are fertilised is the crops' business (see Crops). Farm owns this, checks the Worker can pay
## and decides when; tested through Farm, not on its own.

## The supplies the store sells and the field uses.
const FERTILISER := &"fertiliser"
const KINDS: Array[StringName] = [FERTILISER]
## A supply was bought: values kind, price, next_price (in the next Shift), held (now).
const SUPPLY_BOUGHT := &"supply_bought"
## The Worker already holds the most of this supply he can.
const STOCK_FULL := &"stock_full"
## buy_supply() was given a supply the Farm does not sell.
const NO_SUCH_SUPPLY := &"no_such_supply"
## Why a supply can't be used on a Plot: he holds none, the crop isn't at the Stage it goes on,
## or the crop already has it.
const NONE_HELD := &"none_held"
const WRONG_STAGE := &"wrong_stage"
const ALREADY_FERTILISED := &"already_fertilised"

var _tuning: Tuning
var _held: Dictionary[StringName, int] = {}


func _init(tuning: Tuning) -> void:
	_tuning = tuning
	for kind in KINDS:
		_held[kind] = 0


func held(kind: StringName) -> int:
	return _held[kind]


func most_held() -> int:
	return roundi(_tuning.most_supplies_held)


func is_full(kind: StringName) -> bool:
	return _held[kind] >= most_held()


## What Fertiliser costs in Shift `shift_number`.
func fertiliser_price(shift_number: int) -> int:
	var rises := maxi(shift_number - 1, 0)
	return roundi(_tuning.fertiliser_first_price + rises * _tuning.fertiliser_price_rise)


## Adds one to the stock. Callers check is_full() first.
func add(kind: StringName) -> void:
	_held[kind] += 1


## Why Fertiliser can't go on a crop at `stage` that is `fertilised` or not, or &"" when it can.
func fertiliser_refusal(stage: PlotView.Stage, fertilised: bool) -> StringName:
	if _held[FERTILISER] == 0:
		return NONE_HELD
	if stage != PlotView.Stage.SEEDLING:
		return WRONG_STAGE
	if fertilised:
		return ALREADY_FERTILISED
	return &""


## Takes one from the stock. Callers check it holds one first.
func use(kind: StringName) -> void:
	_held[kind] -= 1


func to_save() -> Dictionary:
	var held_now := {}
	for kind in KINDS:
		held_now[String(kind)] = _held[kind]
	return {"held": held_now}


## Takes the stock from a save, held to the most the tuning table allows now, in case it was
## lowered since the save was written.
func restore(reader: SaveReader) -> void:
	var held_section := reader.section("held")
	for kind in KINDS:
		_held[kind] = mini(held_section.whole(String(kind)), most_held())
