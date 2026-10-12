class_name Supplies
extends RefCounted
## The supplies the Worker holds, bought in the store into a small stock of each and used from
## the supplies bar in the field. Pesticide's price is fixed; Fertiliser's is its first price
## plus a rise for every Shift after the first, so it follows from the Shift number and is never
## saved. Which crops are fertilised is the crops' business (see Crops), and which Plots are
## protected the Bollworms' (see Bollworms). Farm owns this, checks the Worker can pay and
## decides when; tested through Farm, not on its own.

## The supplies the store sells and the field uses.
const FERTILISER := &"fertiliser"
const PESTICIDE := &"pesticide"
const KINDS: Array[StringName] = [FERTILISER, PESTICIDE]
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


## What `kind` costs in Shift `shift_number`.
func price(kind: StringName, shift_number: int) -> int:
	if kind == FERTILISER:
		return fertiliser_price(shift_number)
	return roundi(_tuning.pesticide_price)


## Adds one to the stock. Callers check is_full() first.
func add(kind: StringName) -> void:
	_held[kind] += 1


## Why `kind` can't be used on plot `index` of `crops`, or &"" when it can. Fertiliser goes only
## on a Seedling not fertilised yet; Pesticide goes wherever the Bollworms allow
## (`spray_refusal`, see Bollworms).
func use_refusal(
	kind: StringName, crops: Crops, index: int, spray_refusal: StringName
) -> StringName:
	if _held[kind] == 0:
		return NONE_HELD
	if kind == PESTICIDE:
		return spray_refusal
	if crops.view(index).stage != PlotView.Stage.SEEDLING:
		return WRONG_STAGE
	if crops.is_fertilised(index):
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


## The stock from a save, or none held when it is from before supplies (`has_supplies` false).
static func restored(tuning: Tuning, reader: SaveReader, has_supplies: bool) -> Supplies:
	var supplies := Supplies.new(tuning)
	if has_supplies:
		supplies.restore(reader.section("supplies"))
	return supplies


## Takes the stock from a save, held to the most the tuning table allows now, in case it was
## lowered since the save was written.
func restore(reader: SaveReader) -> void:
	var held_section := reader.section("held")
	for kind in KINDS:
		_held[kind] = mini(held_section.whole(String(kind)), most_held())
