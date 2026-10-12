class_name SuppliesBar
extends VBoxContainer
## The App's supplies bar over the field: a button per supply the store sells, with how many
## the Worker holds. Pressing one picks it, like a tool in Hay Day, and a hint says to tap a
## Seedling; the next tap on the field uses it (take_chosen()), and taps after that work as
## normal again. Pressing the picked one again puts it back. It shows what it is given and
## never decides anything: the rules say whether the supply goes on.

const FONT_SIZE := 24
const BUTTON_COLOUR := Color(1.0, 0.42, 0.62)
## A picked supply's button, bright so it is plain which one the next tap uses.
const CHOSEN_COLOUR := Color(0.98, 0.84, 0.2)
const TEXT := Color(1.0, 1.0, 1.0)
const HINT_TEXT := Color(0.3, 0.12, 0.22)
const HINT_COLOUR := Color(1.0, 0.98, 0.9)

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
	_hint.add_theme_font_size_override("font_size", FONT_SIZE)
	_hint.add_theme_color_override("font_color", HINT_TEXT)
	_hint.add_theme_stylebox_override("normal", _rounded(HINT_COLOUR))
	add_child(_hint)
	_row = HBoxContainer.new()
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.alignment = BoxContainer.ALIGNMENT_END
	_row.add_theme_constant_override("separation", 12)
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
	var supply_button := Button.new()
	supply_button.name = "Supply_%s" % id
	supply_button.add_theme_font_size_override("font_size", FONT_SIZE)
	supply_button.add_theme_color_override("font_color", TEXT)
	_paint(supply_button, BUTTON_COLOUR)
	supply_button.pressed.connect(choose.bind(id))
	_row.add_child(supply_button)
	_buttons[id] = supply_button


func _show_chosen() -> void:
	for id in _buttons:
		_paint(_buttons[id], CHOSEN_COLOUR if id == _chosen else BUTTON_COLOUR)
	_hint.visible = _chosen != &""
	if _hint.visible:
		_hint.text = AppText.fill(AppText.SUPPLY_CHOSEN, {"name": _name_of(_chosen)})


func _name_of(id: StringName) -> String:
	return AppText.STORE_NAMES.get(id, String(id))


func _paint(supply_button: Button, colour: Color) -> void:
	for state: String in ["normal", "hover", "pressed", "focus"]:
		supply_button.add_theme_stylebox_override(state, _rounded(colour))


func _rounded(colour: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.set_corner_radius_all(20)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	return style
