class_name DebugPanel
extends CanvasLayer
## Debug mode's controls: Skip time buttons that ask to jump ahead by a set time, a button
## that asks for Labour Points to try the store, and one that asks for a Harmony Audit this
## Shift. They only ask; the entrypoint feeds skipped time through the same offline resume as
## a real absence, and adds the points and plans the audit through the rules' debug commands.
## The entrypoint adds this only in debug mode, so players never see it.

signal skip_requested(seconds: float)
signal labour_points_requested(points: int)
signal audit_requested

## Button label to seconds skipped.
const CHOICES: Dictionary[String, float] = {
	"Skip +1 hour": 3600.0,
	"Skip +8 hours": 28800.0,
}
const LABOUR_POINTS_ADDED := 100
const LABOUR_POINTS_LABEL := "+%d Labour Points"
const AUDIT_LABEL := "Audit this Shift"
const MARGIN := 16
const TOP_OFFSET := 96
const FONT_SIZE := 24


func _ready() -> void:
	# Above The App, so its buttons stay tappable.
	layer = 20
	var column := VBoxContainer.new()
	column.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE)
	column.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	column.offset_right = -MARGIN
	column.offset_top = TOP_OFFSET
	for label: String in CHOICES:
		column.add_child(_button(label, skip_requested.emit.bind(CHOICES[label])))
	var add_points := labour_points_requested.emit.bind(LABOUR_POINTS_ADDED)
	column.add_child(_button(LABOUR_POINTS_LABEL % LABOUR_POINTS_ADDED, add_points))
	column.add_child(_button(AUDIT_LABEL, audit_requested.emit))
	add_child(column)


func _button(label: String, on_pressed: Callable) -> Button:
	var button := Button.new()
	button.text = label
	button.add_theme_font_size_override("font_size", FONT_SIZE)
	button.pressed.connect(on_pressed)
	return button
