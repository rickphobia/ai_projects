class_name SavingsTin
extends CanvasLayer
## The Worker's hidden savings, in a small tin under his mattress: drawn by hand in pencil on
## the field's left edge, with the amount scratched on its lid in handwriting, nothing like The
## App. It is the only place hidden savings appear. It sits under The App, so the store and the
## Study Session room cover it, catches no taps, shows what it is given and decides nothing.
## Its few words are the Worker's, not The App's, so they live here rather than in AppText;
## the store's "pay from the tin" button uses them too.

const TIN_SIZE := Vector2(150, 110)
const MARGIN := 16
const TIN := Color(0.55, 0.58, 0.55)
const TIN_SHADE := Color(0.4, 0.42, 0.4)
const PENCIL := Color(0.18, 0.17, 0.15)
const PAPER := Color(0.95, 0.92, 0.83)
const AMOUNT_FONT_SIZE := 34
const CAPTION_FONT_SIZE := 20
## Pencil lines wobble by up to this much, the same way every time.
const WOBBLE := 2.5
const CAPTION_TEXT := "under the mattress"
## The store's button for paying from the tin, and what it says when there isn't enough.
const PAY_FROM_TIN_TEXT := "{price} from the tin"
const NOT_ENOUGH_TEXT := "Not enough in the tin"

var _drawing: Control
var _amount: Label


func _ready() -> void:
	var root := VBoxContainer.new()
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT, Control.PRESET_MODE_MINSIZE)
	root.offset_left = MARGIN
	root.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(root)
	_drawing = Control.new()
	_drawing.name = "Tin"
	_drawing.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_drawing.custom_minimum_size = TIN_SIZE
	_drawing.draw.connect(_draw_tin)
	root.add_child(_drawing)
	_amount = _handwritten(AMOUNT_FONT_SIZE)
	_amount.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_amount.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_drawing.add_child(_amount)
	var caption := _handwritten(CAPTION_FONT_SIZE)
	caption.text = CAPTION_TEXT
	root.add_child(caption)
	show_savings(0)


func show_savings(amount: int) -> void:
	_amount.text = str(amount)


func savings_text() -> String:
	return _amount.text


## A squat tin with its lid, outlined twice in pencil as if sketched.
func _draw_tin() -> void:
	var body := Rect2(Vector2(8, 26), TIN_SIZE - Vector2(16, 30))
	var lid := Rect2(Vector2(0, 12), Vector2(TIN_SIZE.x, 20))
	_drawing.draw_rect(body, TIN)
	_drawing.draw_rect(lid, TIN_SHADE)
	_drawing.draw_rect(lid.grow(-6), PAPER)
	for pass_number in 2:
		_sketch(body, pass_number)
		_sketch(lid, pass_number + 2)


## Outlines `rect` in pencil, each corner nudged by a wobble that `seed_number` fixes.
func _sketch(rect: Rect2, seed_number: int) -> void:
	var random := RandomNumberGenerator.new()
	random.seed = seed_number
	var corners: Array[Vector2] = [
		rect.position,
		Vector2(rect.end.x, rect.position.y),
		rect.end,
		Vector2(rect.position.x, rect.end.y),
	]
	var points := PackedVector2Array()
	for corner in corners:
		points.append(
			(
				corner
				+ Vector2(random.randf_range(-WOBBLE, WOBBLE), random.randf_range(-WOBBLE, WOBBLE))
			)
		)
	points.append(points[0])
	_drawing.draw_polyline(points, PENCIL, 2.0, true)


func _handwritten(font_size: int) -> Label:
	var label := Label.new()
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", LettersView.HANDWRITING)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", PENCIL)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label
