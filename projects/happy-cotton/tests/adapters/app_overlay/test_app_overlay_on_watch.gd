extends GutTest
## The App's top bar shows being on watch after a Harmony Audit caught the Worker, in its own
## words: "Harmony Support" and the Shifts left.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func _on_watch() -> Label:
	return _overlay.find_child("OnWatch", true, false)


func test_off_watch_there_is_no_harmony_support() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30)

	assert_false(_on_watch().visible)


func test_on_watch_shows_harmony_support_and_the_shifts_left() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30, 0, 2)

	assert_true(_on_watch().visible)
	assert_eq(_on_watch().text, "Harmony Support  ·  Shifts left: 2")


func test_harmony_support_goes_when_on_watch_ends() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30, 0, 1)

	_overlay.show_shift(ShiftView.new(3, 14, 0, 100.0, 3), 30)

	assert_false(_on_watch().visible)
