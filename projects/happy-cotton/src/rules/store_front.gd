class_name StoreFront
extends RefCounted
## What the store sells right now: each item's price and why it can't be bought, with Labour
## Points and with hidden savings. It reads the Ledger, the Upgrades owned (Store), the land and
## the tuning table, and is told what else holds the Worker up; it changes nothing. Farm makes
## one whenever it needs it and keeps its own names for the ids; tested through Farm, not on its
## own.

## The store's items: the Upgrades, the land, and the Privileges.
const GENERATOR := &"generator"
const TOOLS := &"tools"
const LAND := &"land"
const REST_HOUR := &"rest_hour"
const CALL_HOME := &"call_home"
## The Upgrade has no tier left to buy.
const FULLY_UPGRADED := &"fully_upgraded"
## The land is at its largest: no Plot is left to buy.
const FULLY_BOUGHT := &"fully_bought"

var _tuning: Tuning
var _ledger: Ledger
var _store: Store
var _land: Land
var _held_up: StringName
var _privileges_blocked: StringName


## `held_up` is why nothing can be bought right now (an open Hand-in, a Study Session), and
## `privileges_blocked` why no Privilege can on top of that (taken away, resting, on a call);
## each &"" when there is none.
func _init(
	tuning: Tuning,
	ledger: Ledger,
	store: Store,
	land: Land,
	held_up: StringName,
	privileges_blocked: StringName
) -> void:
	_tuning = tuning
	_ledger = ledger
	_store = store
	_land = land
	_held_up = held_up
	_privileges_blocked = privileges_blocked


## The next Plot's price: the first Plot's, and a rise for every one bought since.
func plot_price() -> int:
	return roundi(_tuning.first_plot_price + _land.plots_bought() * _tuning.plot_price_rise)


func rest_hour_price() -> int:
	return roundi(_tuning.rest_hour_price)


func call_home_price() -> int:
	return roundi(_tuning.call_home_price)


## Why the item `id` can't be bought with `pay_with` right now, or &"" when it can. Sold out
## comes first, then whatever holds the Worker up, then what pays.
func refusal(id: StringName, pay_with: Ledger.PayWith) -> StringName:
	if id == GENERATOR or id == TOOLS:
		var tier: Resource = (
			_store.next_generator_tier() if id == GENERATOR else _store.next_tools_tier()
		)
		if tier == null:
			return FULLY_UPGRADED
		var tier_price: float = tier.get("price")
		return _purchase_refusal(roundi(tier_price), pay_with)
	if id == LAND:
		if _land.is_fully_bought():
			return FULLY_BOUGHT
		return _purchase_refusal(plot_price(), pay_with)
	if _held_up == &"" and _privileges_blocked != &"":
		return _privileges_blocked
	var price := rest_hour_price() if id == REST_HOUR else call_home_price()
	return _purchase_refusal(price, pay_with)


## Everything the store sells, Upgrades first, then land, then Privileges, each with its price
## and why it can't be bought right now with Labour Points, and with hidden savings.
func items() -> Array[StoreItemView]:
	var pays := Ledger.PayWith.LABOUR_POINTS
	var generator_next := _store.next_generator_tier()
	var generator := StoreItemView.next_tier(
		GENERATOR,
		Vector2i(_store.generator_tier(), _store.generator_top_tier()),
		generator_next,
		generator_next.growth_multiplier if generator_next != null else 0.0,
		_store.growth_multiplier(),
		refusal(GENERATOR, pays)
	)
	var tools_next := _store.next_tools_tier()
	var tools := StoreItemView.next_tier(
		TOOLS,
		Vector2i(_store.tools_tier(), _store.tools_top_tier()),
		tools_next,
		tools_next.work_share if tools_next != null else 0.0,
		_store.work_share(),
		refusal(TOOLS, pays)
	)
	var land := StoreItemView.land(LAND, 0, 0, true, FULLY_BOUGHT)
	if not _land.is_fully_bought():
		var rise := _land.quota_rise_per_plot()
		land = StoreItemView.land(LAND, plot_price(), rise, false, refusal(LAND, pays))
	var privilege := StoreItemView.Kind.PRIVILEGE
	var rest_hour := StoreItemView.new(
		REST_HOUR, privilege, rest_hour_price(), refusal(REST_HOUR, pays)
	)
	var call_home := StoreItemView.new(
		CALL_HOME, privilege, call_home_price(), refusal(CALL_HOME, pays)
	)
	var all_items: Array[StoreItemView] = [generator, tools, land, rest_hour, call_home]
	for item in all_items:
		item.set_savings_refusal(refusal(item.id, Ledger.PayWith.HIDDEN_SAVINGS))
	return all_items


## Whatever holds the Worker up, then whether `pay_with` covers `price`.
func _purchase_refusal(price: int, pay_with: Ledger.PayWith) -> StringName:
	if _held_up != &"":
		return _held_up
	return _ledger.payment_refusal(price, pay_with)
