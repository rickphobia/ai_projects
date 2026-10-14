class_name HandInCard
extends PanelContainer
## The App's Hand-in: a bright card in the middle of the screen from the moment a Shift's time
## runs out until the Worker hands in. A slider sets how much of the cotton in hand he hands in,
## starting at all of it each time the Hand-in opens, so keeping some back is always his choice;
## the line above it compares that with the Quota as it moves. It catches taps only on itself.
## It shows what it is given and decides nothing: the rules decide what handing in does.

## The hand-in button was pressed, to hand in `amount` of the cotton in hand.
signal hand_in_pressed(amount: int)

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
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", AppLook.SPACE)
	add_child(column)
	_title = _label(AppLook.TITLE_LABEL)
	column.add_child(_title)
	_cotton = _label(&"")
	column.add_child(_cotton)
	_slider = HSlider.new()
	_slider.name = "HandInSlider"
	_slider.step = 1.0
	_slider.custom_minimum_size = Vector2(0, AppLook.SPACE * 6)
	_slider.value_changed.connect(func(_value: float) -> void: _show_amount())
	column.add_child(_slider)
	var button := AppLook.button(AppText.HAND_IN_BUTTON)
	button.name = "HandInButton"
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


func _label(variation: StringName) -> Label:
	var label := Label.new()
	label.theme_type_variation = variation
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label
