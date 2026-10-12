class_name HandInCard
extends PanelContainer
## The App's Hand-in: a bright card in the middle of the screen from the moment a Shift's time
## runs out until the Worker hands in. A slider sets how much of the cotton in hand he hands in,
## starting at all of it each time the Hand-in opens, so keeping some back is always his choice;
## the line above it compares that with the Quota as it moves. It catches taps only on itself.
## It shows what it is given and decides nothing: the rules decide what handing in does.

## The hand-in button was pressed, to hand in `amount` of the cotton in hand.
signal hand_in_pressed(amount: int)

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
var _slider: HSlider
var _quota := 0
## The Shift whose Hand-in the slider was last set for, so it starts at everything only once.
var _slider_shift := 0


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
	_slider = HSlider.new()
	_slider.name = "HandInSlider"
	_slider.step = 1.0
	_slider.custom_minimum_size = Vector2(0, MARGIN * 2.0)
	_slider.value_changed.connect(func(_value: float) -> void: _show_amount())
	column.add_child(_slider)
	var button := Button.new()
	button.name = "HandInButton"
	button.text = AppText.HAND_IN_BUTTON
	button.add_theme_font_size_override("font_size", FONT_SIZE)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(state, _rounded(BUTTON_COLOUR, 20, MARGIN / 2.0))
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(func() -> void: hand_in_pressed.emit(amount()))
	column.add_child(button)


## Up while the Shift's Hand-in is open, with its cotton in hand and Quota; hidden otherwise.
## The slider goes back to all of the cotton in hand the first time a Shift's Hand-in shows.
func show_shift(shift: ShiftView) -> void:
	visible = shift.hand_in_open
	_title.text = AppText.HAND_IN_TITLE.format({"shift": shift.number})
	_quota = shift.quota
	if shift.hand_in_open and (_slider_shift != shift.number or _slider.max_value != shift.picked):
		_slider_shift = shift.number
		_slider.max_value = shift.picked
		_slider.set_value_no_signal(shift.picked)
	_show_amount()


## How much of the cotton in hand the slider hands in.
func amount() -> int:
	return roundi(_slider.value)


func slider() -> HSlider:
	return _slider


func cotton_text() -> String:
	return _cotton.text


func _show_amount() -> void:
	var values := {"handed_in": amount(), "in_hand": roundi(_slider.max_value), "quota": _quota}
	_cotton.text = AppText.HAND_IN_COTTON.format(values)


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
