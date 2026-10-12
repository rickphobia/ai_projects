class_name StoreRow
extends HBoxContainer
## One item in the store: its name (and tier for an Upgrade), The App's pitch, the Quota rise
## an Upgrade or a Plot brings, why it can't be bought right now, and a button with its price.
## The button is off while the item can't be bought; a fully upgraded Upgrade, or fully bought
## land, says so on it.

## The buy button was pressed for this row's item.
signal buy_pressed(id: StringName)

const FONT_SIZE := 26
const SMALL_FONT_SIZE := 22
const TEXT := Color(0.3, 0.12, 0.22)
const QUOTA_RISE_TEXT := Color(0.75, 0.2, 0.35)
const REFUSAL_TEXT := Color(0.45, 0.4, 0.42)
const BUTTON_COLOUR := Color(1.0, 0.42, 0.62)
const BUTTON_OFF_COLOUR := Color(0.78, 0.7, 0.74)
const BUTTON_WIDTH := 260
const BUTTON_HEIGHT := 64

var _id: StringName
var _title: Label
var _blurb: Label
var _quota_rise: Label
var _refusal: Label
var _button: Button


func _init(item_id: StringName) -> void:
	_id = item_id
	name = "StoreRow_%s" % item_id
	add_theme_constant_override("separation", 16)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title = _label(FONT_SIZE, TEXT)
	_blurb = _label(SMALL_FONT_SIZE, TEXT)
	_quota_rise = _label(SMALL_FONT_SIZE, QUOTA_RISE_TEXT)
	_refusal = _label(SMALL_FONT_SIZE, REFUSAL_TEXT)
	var labels: Array[Label] = [_title, _blurb, _quota_rise, _refusal]
	for label in labels:
		words.add_child(label)
	add_child(words)
	_button = Button.new()
	_button.custom_minimum_size = Vector2(BUTTON_WIDTH, BUTTON_HEIGHT)
	_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_button.add_theme_font_size_override("font_size", FONT_SIZE)
	_button.add_theme_color_override("font_color", Color.WHITE)
	_button.add_theme_color_override("font_disabled_color", Color.WHITE)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		_button.add_theme_stylebox_override(state, _rounded(BUTTON_COLOUR))
	_button.add_theme_stylebox_override("disabled", _rounded(BUTTON_OFF_COLOUR))
	_button.pressed.connect(func() -> void: buy_pressed.emit(_id))
	add_child(_button)


## Shows the item as the store sells it now; `labour_points` fills in a refusal's reason.
func show_item(item: StoreItemView, labour_points: int) -> void:
	var title: String = AppText.STORE_NAMES.get(item.id, String(item.id))
	if item.kind == StoreItemView.Kind.UPGRADE:
		var tier := {"tier": item.tier, "top_tier": item.top_tier}
		title += "  ·  " + AppText.fill(AppText.STORE_TIER, tier)
	_title.text = title
	var effects := {"effect": item.effect, "current": item.current_effect}
	var blurb: String = AppText.STORE_BLURBS.get(item.id, "")
	_blurb.text = AppText.fill(blurb, effects)
	_quota_rise.text = ""
	var sold_out := item.is_fully_upgraded() or item.is_fully_bought()
	if item.kind != StoreItemView.Kind.PRIVILEGE and not sold_out:
		_quota_rise.text = AppText.fill(AppText.STORE_QUOTA_RISE, {"quota_rise": item.quota_rise})
	_quota_rise.visible = not _quota_rise.text.is_empty()
	var values := {"price": item.price, "points": labour_points}
	var reason := item.refusal
	# A sold-out item says so on its button, not twice.
	if sold_out:
		reason = &""
	_refusal.text = AppText.render_store_refusal(reason, values) if reason != &"" else ""
	_refusal.visible = not _refusal.text.is_empty()
	if item.is_fully_upgraded():
		_button.text = AppText.STORE_FULLY_UPGRADED
	elif item.is_fully_bought():
		_button.text = AppText.STORE_FULLY_BOUGHT
	else:
		_button.text = AppText.fill(AppText.STORE_PRICE, {"price": item.price})
	_button.disabled = item.refusal != &""


func button() -> Button:
	return _button


func refusal_text() -> String:
	return _refusal.text


func _label(font_size: int, colour: Color) -> Label:
	var label := Label.new()
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", colour)
	return label


func _rounded(colour: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.set_corner_radius_all(20)
	style.content_margin_left = 12
	style.content_margin_right = 12
	return style
