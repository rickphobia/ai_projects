class_name TapFeedback
extends RefCounted
## The App's buttons squish a little when pressed and spring back when let go, about their
## centre. With reduced motion nothing moves. It only animates: the button's own pressed signal
## reaches the rules exactly as before, never held back by the animation.
## Buttons in the NOT_APP group (the tin's pencil-drawn button) are the Worker's, not The App's,
## and keep still.

const NOT_APP := &"not_app_button"
## How small a pressed button gets, and how long the squish and the spring back take.
const SQUISHED := Vector2(0.92, 0.92)
const SQUISH_SECONDS := 0.06
const SPRING_SECONDS := 0.25
## Marks a button that already squishes, so attaching twice doesn't double the animation.
const ATTACHED := &"tap_feedback"

var reduced_motion := false


## Makes every App button under `root` squish on press, including ones added since last time.
func attach_all(root: Node) -> void:
	for node in root.find_children("*", "Button", true, false):
		var found := node as Button
		if found.has_meta(ATTACHED) or found.is_in_group(NOT_APP):
			continue
		found.set_meta(ATTACHED, true)
		found.button_down.connect(_squish.bind(found))
		found.button_up.connect(_spring_back.bind(found))


func _squish(pressed: Button) -> void:
	if reduced_motion:
		return
	pressed.pivot_offset = pressed.size / 2.0
	pressed.create_tween().tween_property(pressed, "scale", SQUISHED, SQUISH_SECONDS)


func _spring_back(released: Button) -> void:
	if reduced_motion:
		released.scale = Vector2.ONE
		return
	var tween := released.create_tween()
	tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(released, "scale", Vector2.ONE, SPRING_SECONDS)
