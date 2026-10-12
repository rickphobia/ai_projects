class_name StoreItemView
extends RefCounted
## A read-only snapshot of one item in the store, for The App to show. Changing the Farm never
## changes a view already handed out; ask the Farm for a new one.

enum Kind { UPGRADE, LAND, PRIVILEGE }

## Which item: an Upgrade (Farm.GENERATOR, Farm.TOOLS), land (Farm.LAND) or a Privilege
## (Farm.REST_HOUR, Farm.CALL_HOME).
var id: StringName:
	get:
		return _id
var kind: Kind:
	get:
		return _kind
## Upgrade tiers owned, from 0; always 0 for a Privilege.
var tier: int:
	get:
		return _tier
## How many tiers the Upgrade has; 0 for a Privilege.
var top_tier: int:
	get:
		return _top_tier
## Labour Points the next tier (or Plot, or the Privilege) costs; 0 when fully upgraded or
## fully bought.
var price: int:
	get:
		return _price
## What the next tier does (the Generator's growth multiplier, the tools' work share); the
## owned tier's when fully upgraded. 0 for a Privilege.
var effect: float:
	get:
		return _effect
## What the owned tier does now (1 for no Upgrade). 0 for a Privilege.
var current_effect: float:
	get:
		return _current_effect
## How many more picks the Quota demands from the next Shift if the next tier or Plot is
## bought; 0 when fully upgraded or fully bought, and for a Privilege.
var quota_rise: int:
	get:
		return _quota_rise
## Why it can't be bought right now with Labour Points (one of Farm's reason keys), or &""
## when it can.
var refusal: StringName:
	get:
		return _refusal
## Why it can't be bought right now with hidden savings, or &"" when it can.
var savings_refusal: StringName:
	get:
		return _savings_refusal

var _id: StringName
var _kind: Kind
var _tier := 0
var _top_tier := 0
var _price: int
var _effect := 0.0
var _current_effect := 0.0
var _quota_rise := 0
var _refusal: StringName
var _savings_refusal: StringName
var _fully_bought := false


func _init(item_id: StringName, item_kind: Kind, item_price: int, why_not: StringName) -> void:
	_id = item_id
	_kind = item_kind
	_price = item_price
	_refusal = why_not


## A view of an Upgrade: its tiers owned and in all, the next tier's effect and Quota rise, and
## the owned tier's effect.
static func upgrade(
	item_id: StringName,
	tiers: Vector2i,
	item_price: int,
	effects: Vector2,
	rise: int,
	why_not: StringName
) -> StoreItemView:
	var view := StoreItemView.new(item_id, Kind.UPGRADE, item_price, why_not)
	view._tier = tiers.x
	view._top_tier = tiers.y
	view._effect = effects.x
	view._current_effect = effects.y
	view._quota_rise = rise
	return view


## A view of an Upgrade from its `next` tier (a GeneratorTier or ToolsTier) and that tier's
## effect. Fully upgraded (`next` null), it shows the owned tier's effect, no price and no Quota
## rise.
static func next_tier(
	item_id: StringName,
	tiers: Vector2i,
	next: Resource,
	next_effect: float,
	current: float,
	why_not: StringName
) -> StoreItemView:
	var item_price := 0
	var effect := current
	var rise := 0
	if next != null:
		var next_price: float = next.get("price")
		var next_rise: float = next.get("quota_rise")
		item_price = roundi(next_price)
		effect = next_effect
		rise = roundi(next_rise)
	return upgrade(item_id, tiers, item_price, Vector2(effect, current), rise, why_not)


## A view of the land: the next Plot's price and Quota rise, or none when `fully_bought`.
static func land(
	item_id: StringName, item_price: int, rise: int, fully_bought: bool, why_not: StringName
) -> StoreItemView:
	var view := StoreItemView.new(item_id, Kind.LAND, item_price, why_not)
	view._quota_rise = rise
	view._fully_bought = fully_bought
	return view


## Only the Farm calls this, as it builds the view.
func set_savings_refusal(why_not: StringName) -> void:
	_savings_refusal = why_not


func is_fully_upgraded() -> bool:
	return _kind == Kind.UPGRADE and _tier >= _top_tier


## The land is at its largest: no Plot is left to buy.
func is_fully_bought() -> bool:
	return _kind == Kind.LAND and _fully_bought
