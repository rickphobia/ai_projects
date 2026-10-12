class_name StorePanel
extends Control
## The App's store: a bright card over the field, in four sections, Upgrades, Land, Supplies
## and Privileges, each item a StoreRow. It covers the whole screen while open so a tap meant for
## it never reaches the field. It shows what it is given and only asks: the rules decide each
## purchase.
## Close sits at the bottom of the card, clear of debug mode's buttons at the top right.

## A buy button was pressed: an Upgrade, a supply or a Privilege, by its Farm id, or the next
## Plot.
signal upgrade_pressed(id: StringName)
signal privilege_pressed(id: StringName)
signal supply_pressed(id: StringName)
signal land_pressed
## An item's tin button was pressed: buy it with hidden savings, by its Farm id.
signal savings_pressed(id: StringName)

const BACKDROP := Color(0.1, 0.05, 0.08, 0.55)
const CARD_COLOUR := Color(1.0, 0.98, 0.9)
const TITLE_COLOUR := Color(1.0, 0.42, 0.62)
const HEADING_COLOUR := Color(0.3, 0.12, 0.22)
const TITLE_FONT_SIZE := 34
const HEADING_FONT_SIZE := 28
## The card's share of the screen, so it fits a phone held sideways.
const CARD_SHARE := Vector2(0.8, 0.82)
const MARGIN := 24

var _upgrades: VBoxContainer
var _land: VBoxContainer
var _supplies: VBoxContainer
var _privileges: VBoxContainer
var _rows: Dictionary[StringName, StoreRow] = {}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var backdrop := ColorRect.new()
	backdrop.color = BACKDROP
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	var card := PanelContainer.new()
	card.anchor_left = (1.0 - CARD_SHARE.x) / 2.0
	card.anchor_right = 1.0 - card.anchor_left
	card.anchor_top = (1.0 - CARD_SHARE.y) / 2.0
	card.anchor_bottom = 1.0 - card.anchor_top
	var style := StyleBoxFlat.new()
	style.bg_color = CARD_COLOUR
	style.set_corner_radius_all(28)
	style.set_content_margin_all(MARGIN)
	card.add_theme_stylebox_override("panel", style)
	add_child(card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	card.add_child(column)
	column.add_child(_title())
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var sections := VBoxContainer.new()
	sections.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sections.add_theme_constant_override("separation", 16)
	scroll.add_child(sections)
	_upgrades = _section(sections, AppText.STORE_UPGRADES)
	_land = _section(sections, AppText.STORE_LAND)
	_supplies = _section(sections, AppText.STORE_SUPPLIES)
	_privileges = _section(sections, AppText.STORE_PRIVILEGES)
	column.add_child(_build_close_button())


## Shows every item the store sells, each in its section. Returns true when it added rows (the
## first time an item is shown), so their text can be scaled to the player's setting. With
## `hidden_savings` above zero each item offers to be paid from the tin too.
func show_items(items: Array[StoreItemView], labour_points: int, hidden_savings := 0) -> bool:
	var added := false
	for item in items:
		if not _rows.has(item.id):
			_add_row(item)
			added = true
		_rows[item.id].show_item(item, labour_points, hidden_savings)
	return added


## The row for an item, or null before the item is first shown.
func row(id: StringName) -> StoreRow:
	return _rows.get(id)


func _add_row(item: StoreItemView) -> void:
	var new_row := StoreRow.new(item.id)
	new_row.savings_pressed.connect(savings_pressed.emit)
	if item.kind == StoreItemView.Kind.UPGRADE:
		new_row.buy_pressed.connect(upgrade_pressed.emit)
		_upgrades.add_child(new_row)
	elif item.kind == StoreItemView.Kind.LAND:
		new_row.buy_pressed.connect(func(_id: StringName) -> void: land_pressed.emit())
		_land.add_child(new_row)
	elif item.kind == StoreItemView.Kind.SUPPLY:
		new_row.buy_pressed.connect(supply_pressed.emit)
		_supplies.add_child(new_row)
	else:
		new_row.buy_pressed.connect(privilege_pressed.emit)
		_privileges.add_child(new_row)
	_rows[item.id] = new_row


func _title() -> Label:
	var title := Label.new()
	title.text = AppText.STORE_TITLE
	title.add_theme_font_size_override("font_size", TITLE_FONT_SIZE)
	title.add_theme_color_override("font_color", TITLE_COLOUR)
	return title


func _build_close_button() -> Button:
	var close := Button.new()
	close.name = "CloseButton"
	close.text = AppText.STORE_CLOSE
	close.custom_minimum_size = Vector2(180, 56)
	close.size_flags_horizontal = Control.SIZE_SHRINK_END
	close.add_theme_font_size_override("font_size", HEADING_FONT_SIZE)
	close.pressed.connect(hide)
	return close


## A heading and the box its rows go in.
func _section(parent: Control, heading: String) -> VBoxContainer:
	var label := Label.new()
	label.text = heading
	label.add_theme_font_size_override("font_size", HEADING_FONT_SIZE)
	label.add_theme_color_override("font_color", HEADING_COLOUR)
	parent.add_child(label)
	var rows := VBoxContainer.new()
	rows.add_theme_constant_override("separation", 14)
	parent.add_child(rows)
	return rows
