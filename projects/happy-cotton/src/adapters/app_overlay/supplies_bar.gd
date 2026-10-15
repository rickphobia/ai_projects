class_name SuppliesBar
extends VBoxContainer
## The App's supplies bar over the field: a button per supply the store sells, with how many
## the Worker holds. Pressing one picks it, like a tool in Hay Day, and a hint says to tap a
## Seedling; the next tap on the field uses it (take_chosen()), and taps after that work as
## normal again. Pressing the picked one again puts it back. It shows what it is given and
## never decides anything: the rules say whether the supply goes on.

var _buttons: Dictionary[StringName, Button] = {}
var _row: HBoxContainer
var _hint: Label
var _chosen: StringName = &""


func _init() -> void:
	name = "SuppliesBar"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	alignment = BoxContainer.ALIGNMENT_END
	_hint = Label.new()
	_hint.name = "SupplyHint"
	_hint.visible = false
	_hint.theme_type_variation = AppLook.HINT_LABEL
	add_child(_hint)
	_row = HBoxContainer.new()
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.alignment = BoxContainer.ALIGNMENT_END
	_row.add_theme_constant_override("separation", AppLook.SPACE * 2)
	add_child(_row)


## Shows a button for each supply among the store's items, with how many he holds. Returns
## true when it added a button (the first time a supply is shown), so its text can be scaled to
## the player's setting.
func show_supplies(items: Array[StoreItemView]) -> bool:
	var added := false
	for item in items:
		if item.kind != StoreItemView.Kind.SUPPLY:
			continue
		if not _buttons.has(item.id):
			_add_button(item.id)
			added = true
		var values := {"name": _name_of(item.id), "held": item.held}
		_buttons[item.id].text = AppText.fill(AppText.SUPPLY_BUTTON, values)
	return added


## Picks `id` for the next tap, or puts it back when it is already picked.
func choose(id: StringName) -> void:
	_chosen = &"" if _chosen == id else id
	_show_chosen()


## The supply picked for this tap, or &"" for none. Taking it puts it back, so the tap after
## works as normal.
func take_chosen() -> StringName:
	var taken := _chosen
	_chosen = &""
	_show_chosen()
	return taken


func chosen() -> StringName:
	return _chosen


func button(id: StringName) -> Button:
	return _buttons.get(id)


func hint() -> Label:
	return _hint


func _add_button(id: StringName) -> void:
	var supply_button := AppLook.button()
	supply_button.name = "Supply_%s" % id
	supply_button.pressed.connect(choose.bind(id))
	_row.add_child(supply_button)
	_buttons[id] = supply_button


func _show_chosen() -> void:
	for id in _buttons:
		# The picked one is bright so it is plain which supply the next tap uses.
		_buttons[id].theme_type_variation = AppLook.CHOSEN_BUTTON if id == _chosen else &""
	_hint.visible = _chosen != &""
	if _hint.visible:
		var hint: String = AppText.SUPPLY_CHOSEN.get(_chosen, "")
		_hint.text = AppText.fill(hint, {"name": _name_of(_chosen)})


func _name_of(id: StringName) -> String:
	return AppText.STORE_NAMES.get(id, String(id))
