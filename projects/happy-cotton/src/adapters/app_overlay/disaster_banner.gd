class_name DisasterBanner
extends PanelContainer
## The Disaster countdown under The App's top bar: what is coming and how soon once The App has
## warned of it, then how long it has left while it strikes. Hidden with no Disaster to show.
## It shows what it is given and catches no taps.

const WARNED_COLOUR := Color(0.95, 0.62, 0.18)
const STRIKING_COLOUR := Color(0.85, 0.36, 0.1)
const TEXT_COLOUR := Color(1.0, 1.0, 1.0)
const FONT_SIZE := 28
const MARGIN := 16
## How far below the screen's top edge it sits, clear of the top bar.
const TOP_OFFSET := 72

var _label: Label


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_MINSIZE)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	offset_top = TOP_OFFSET
	_label = Label.new()
	_label.add_theme_font_size_override("font_size", FONT_SIZE)
	_label.add_theme_color_override("font_color", TEXT_COLOUR)
	add_child(_label)
	visible = false


func show_disaster(disaster: DisasterView) -> void:
	if disaster.phase == DisasterView.Phase.NONE:
		visible = false
		return
	var warned := disaster.phase == DisasterView.Phase.WARNED
	var shown := {
		"name": AppText.DISASTER_NAMES.get(disaster.kind, String(disaster.kind)),
		"time": AppOverlay.clock_text(disaster.seconds_left),
	}
	_label.text = (AppText.DISASTER_WARNED if warned else AppText.DISASTER_STRIKING).format(shown)
	_paint(WARNED_COLOUR if warned else STRIKING_COLOUR)
	visible = true


func text() -> String:
	return _label.text


func _paint(colour: Color) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.set_corner_radius_all(20)
	style.content_margin_left = MARGIN
	style.content_margin_right = MARGIN
	style.content_margin_top = MARGIN / 2.0
	style.content_margin_bottom = MARGIN / 2.0
	add_theme_stylebox_override("panel", style)
