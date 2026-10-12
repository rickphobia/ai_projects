extends GutTest
## The Mascot's speech bubble closes by itself after a few seconds, or at any tap or click,
## and that tap still reaches whatever was under it.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func test_the_speech_bubble_closes_by_itself_after_a_few_seconds() -> void:
	_overlay.say("Shift 1 begins!")

	_overlay._process(AppOverlay.SPEECH_SECONDS - 0.1)
	assert_true(_overlay.is_speaking())
	_overlay._process(0.2)
	assert_false(_overlay.is_speaking())


func test_new_words_get_the_full_time_again() -> void:
	_overlay.say("Shift 1 begins!")
	_overlay._process(AppOverlay.SPEECH_SECONDS - 1.0)

	_overlay.say("Cotton dropped!")
	_overlay._process(AppOverlay.SPEECH_SECONDS - 0.1)

	assert_true(_overlay.is_speaking())


func test_a_tap_or_click_anywhere_closes_the_speech_bubble() -> void:
	var touch := InputEventScreenTouch.new()
	touch.pressed = true
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true

	for press: InputEvent in [touch, click]:
		_overlay.say("Shift 1 begins!")
		_overlay._input(press)
		assert_false(_overlay.is_speaking())


func test_moving_or_letting_go_does_not_close_the_speech_bubble() -> void:
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	_overlay.say("Shift 1 begins!")

	_overlay._input(release)
	_overlay._input(InputEventMouseMotion.new())

	assert_true(_overlay.is_speaking())


func test_the_closing_tap_is_not_used_up() -> void:
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	_overlay.say("Shift 1 begins!")

	_overlay._input(click)

	assert_false(get_viewport().is_input_handled())
