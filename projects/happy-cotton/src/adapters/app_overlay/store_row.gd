class_name StoreRow
extends HBoxContainer
## One item in the store: its name (and tier for an Upgrade, or how many are held for a supply),
## The App's pitch, the Quota rise an Upgrade or a Plot brings (or a supply's price tomorrow),
## why it can't be bought right now, and a button with its price.
## The button is off while the item can't be bought; a fully upgraded Upgrade, or fully bought
## land, says so on it. While the Worker has hidden savings a second button, drawn by hand like
## his tin and not The App's, pays from them; it says when there isn't enough.

## The buy button was pressed for this row's item.
signal buy_pressed(id: StringName)
## The tin's button was pressed: buy this row's item with hidden savings.
signal savings_pressed(id: StringName)

const BUTTON_WIDTH := AppLook.SPACE * 32

var _id: StringName
var _title: Label
var _blurb: Label
var _quota_rise: Label
var _refusal: Label
var _button: Button
var _savings_button: Button


func _init(item_id: StringName) -> void:
	_id = item_id
	name = "StoreRow_%s" % item_id
	add_theme_constant_override("separation", AppLook.SPACE * 2)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title = _label(&"")
	_blurb = _label(AppLook.SMALL_LABEL)
	_quota_rise = _label(AppLook.QUOTA_RISE_LABEL)
	_refusal = _label(AppLook.REFUSAL_LABEL)
	var labels: Array[Label] = [_title, _blurb, _quota_rise, _refusal]
	for label in labels:
		words.add_child(label)
	add_child(words)
	_button = AppLook.button()
	_button.custom_minimum_size.x = BUTTON_WIDTH
	_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_button.pressed.connect(func() -> void: buy_pressed.emit(_id))
	var buttons := VBoxContainer.new()
	buttons.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	buttons.add_child(_button)
	_savings_button = _build_savings_button()
	buttons.add_child(_savings_button)
	add_child(buttons)


## Shows the item as the store sells it now; `labour_points` fills in a refusal's reason. The
## tin's button shows only while `hidden_savings` is above zero and the item is for sale.
func show_item(item: StoreItemView, labour_points: int, hidden_savings := 0) -> void:
	var title: String = AppText.STORE_NAMES.get(item.id, String(item.id))
	if item.kind == StoreItemView.Kind.UPGRADE:
		var tier := {"tier": item.tier, "top_tier": item.top_tier}
		title += "  ·  " + AppText.fill(AppText.STORE_TIER, tier)
	elif item.kind == StoreItemView.Kind.SUPPLY:
		var stock := {"held": item.held, "most_held": item.most_held}
		title += "  ·  " + AppText.fill(AppText.STORE_HELD, stock)
	_title.text = title
	var effects := {"effect": item.effect, "current": item.current_effect}
	var blurb: String = AppText.STORE_BLURBS.get(item.id, "")
	_blurb.text = AppText.fill(blurb, effects)
	_quota_rise.text = ""
	var sold_out := item.is_fully_upgraded() or item.is_fully_bought()
	var raises_quota := item.kind in [StoreItemView.Kind.UPGRADE, StoreItemView.Kind.LAND]
	if raises_quota and not sold_out:
		_quota_rise.text = AppText.fill(AppText.STORE_QUOTA_RISE, {"quota_rise": item.quota_rise})
	elif item.kind == StoreItemView.Kind.SUPPLY and item.next_price > item.price:
		var tomorrow := {"next_price": item.next_price}
		_quota_rise.text = AppText.fill(AppText.STORE_NEXT_PRICE, tomorrow)
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
	_savings_button.visible = hidden_savings > 0 and not sold_out
	_savings_button.disabled = item.savings_refusal != &""
	_savings_button.text = SavingsTin.PAY_FROM_TIN_TEXT.format({"price": item.price})
	if item.savings_refusal == Farm.NOT_ENOUGH_HIDDEN_SAVINGS:
		_savings_button.text = SavingsTin.NOT_ENOUGH_TEXT


func button() -> Button:
	return _button


func savings_button() -> Button:
	return _savings_button


func refusal_text() -> String:
	return _refusal.text


func _label(variation: StringName) -> Label:
	var label := Label.new()
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.theme_type_variation = variation
	return label


## Pencil on paper, like the tin: nothing like The App's pink buttons, and it doesn't squish.
func _build_savings_button() -> Button:
	var savings := Button.new()
	savings.name = "SavingsButton"
	savings.add_to_group(TapFeedback.NOT_APP)
	savings.visible = false
	savings.custom_minimum_size = Vector2(BUTTON_WIDTH, AppLook.TAP_TARGET)
	savings.add_theme_font_override("font", LettersView.HANDWRITING)
	savings.add_theme_font_size_override("font_size", AppLook.SMALL)
	for colour_name: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		savings.add_theme_color_override(colour_name, SavingsTin.PENCIL)
	savings.add_theme_color_override("font_disabled_color", SavingsTin.TIN_SHADE)
	var paper := StyleBoxFlat.new()
	paper.bg_color = SavingsTin.PAPER
	paper.set_corner_radius_all(4)
	paper.set_border_width_all(2)
	paper.border_color = SavingsTin.PENCIL
	paper.content_margin_left = AppLook.SPACE
	paper.content_margin_right = AppLook.SPACE
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		savings.add_theme_stylebox_override(state, paper)
	savings.pressed.connect(func() -> void: savings_pressed.emit(_id))
	return savings
