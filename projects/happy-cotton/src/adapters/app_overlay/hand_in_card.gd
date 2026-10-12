class_name HandInCard
extends PanelContainer
## The App's Hand-in: a bright card in the middle of the screen from the moment a Shift's time
## runs out until the Worker hands in, with the cotton in hand against the Quota and the button
## that hands it all in. It catches taps only on itself. It shows what it is given and decides
## nothing: the rules decide what handing in does.

## The hand-in button was pressed.
signal hand_in_pressed

const CARD_COLOUR := PaySlipCard.CARD_COLOUR
const TITLE_COLOUR := PaySlipCard.TITLE_COLOUR
const ROW_COLOUR := PaySlipCard.ROW_COLOUR
const BUTTON_COLOUR := PaySlipCard.BUTTON_COLOUR
const TITLE_FONT_SIZE := PaySlipCard.TITLE_FONT_SIZE
const FONT_SIZE := PaySlipCard.FONT_SIZE
const MARGIN := PaySlipCard.MARGIN
const WIDTH := PaySlipCard.WIDTH

var _title: Label
var _cotton: Label


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH
	custom_minimum_size = Vector2(WIDTH, 0)
	add_theme_stylebox_override("panel", _rounded(CARD_COLOUR, 28, MARGIN))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	add_child(column)
	_title = _label(TITLE_COLOUR, TITLE_FONT_SIZE)
	column.add_child(_title)
	_cotton = _label(ROW_COLOUR, FONT_SIZE)
	column.add_child(_cotton)
	var button := Button.new()
	button.name = "HandInButton"
	button.text = AppText.HAND_IN_BUTTON
	button.add_theme_font_size_override("font_size", FONT_SIZE)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(state, _rounded(BUTTON_COLOUR, 20, MARGIN / 2.0))
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(hand_in_pressed.emit)
	column.add_child(button)


## Up while the Shift's Hand-in is open, with its cotton in hand and Quota; hidden otherwise.
func show_shift(shift: ShiftView) -> void:
	visible = shift.hand_in_open
	_title.text = AppText.HAND_IN_TITLE.format({"shift": shift.number})
	_cotton.text = AppText.HAND_IN_COTTON.format({"in_hand": shift.picked, "quota": shift.quota})


func cotton_text() -> String:
	return _cotton.text


func _label(colour: Color, font_size: int) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", colour)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label


func _rounded(colour: Color, corner_radius: int, margin: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.set_corner_radius_all(corner_radius)
	style.set_content_margin_all(margin)
	return style
