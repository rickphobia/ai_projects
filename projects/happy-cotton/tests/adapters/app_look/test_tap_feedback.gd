extends GutTest
## Tap feedback: an App button squishes on press and springs back, only without reduced motion,
## and its press reaches whoever listens at once.

var _feedback: TapFeedback
var _button: Button


func before_each() -> void:
	_feedback = TapFeedback.new()
	_button = AppLook.button("Buy")
	add_child_autofree(_button)
	_feedback.attach_all(self)


func test_a_pressed_button_squishes_and_springs_back() -> void:
	var tweens_before := get_tree().get_processed_tweens().size()

	_button.button_down.emit()

	assert_gt(get_tree().get_processed_tweens().size(), tweens_before, "the press starts a tween")
	await wait_seconds(TapFeedback.SQUISH_SECONDS * 2)
	assert_lt(_button.scale.x, 1.0, "squished")
	_button.button_up.emit()
	await wait_seconds(TapFeedback.SPRING_SECONDS * 2)
	assert_eq(_button.scale, Vector2.ONE, "sprung back")


func test_with_reduced_motion_a_pressed_button_starts_no_tween() -> void:
	_feedback.reduced_motion = true
	var tweens_before := get_tree().get_processed_tweens().size()

	_button.button_down.emit()
	_button.button_up.emit()

	assert_eq(get_tree().get_processed_tweens().size(), tweens_before)
	assert_eq(_button.scale, Vector2.ONE)


func test_the_press_reaches_its_listener_at_once() -> void:
	watch_signals(_button)

	_button.button_down.emit()
	_button.pressed.emit()

	assert_signal_emitted(_button, "pressed")


func test_attaching_twice_squishes_once() -> void:
	_feedback.attach_all(self)

	assert_eq(_button.button_down.get_connections().size(), 1)


func test_a_button_that_is_not_the_apps_keeps_still() -> void:
	var pencil := Button.new()
	pencil.add_to_group(TapFeedback.NOT_APP)
	add_child_autofree(pencil)
	_feedback.attach_all(self)

	assert_eq(pencil.button_down.get_connections().size(), 0)
