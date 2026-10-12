extends GutTest
## The App's crop counter, the "+1" rising from a picked Plot, and the Hand-in card: shown
## while the Hand-in is open, with the cotton in hand against the Quota, and a button that asks
## to hand in.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func _label_texts() -> Array[String]:
	var texts: Array[String] = []
	for node in _overlay.find_children("*", "Label", true, false):
		texts.append((node as Label).text)
	return texts


func _card() -> HandInCard:
	return _overlay.find_child("HandInCard", true, false) as HandInCard


func test_the_crop_counter_shows_the_cotton_in_hand_beside_the_labour_points() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30)

	assert_has(_label_texts(), "5 cotton")


func test_a_counted_pick_brings_a_rising_plus_one_that_goes_away() -> void:
	_overlay.show_crop_counted(Vector2(300, 400))

	var rising := _overlay.find_children("*", "RisingCount", true, false)
	assert_eq(rising.size(), 1)
	assert_eq((rising[0] as Label).text, "+1")
	await wait_seconds(RisingCount.SECONDS + 0.2)
	assert_eq(_overlay.find_children("*", "RisingCount", true, false).size(), 0)


func test_the_hand_in_card_shows_only_while_the_hand_in_is_open() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30)
	assert_false(_card().visible)

	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)

	assert_true(_card().visible)
	assert_eq(_card().cotton_text(), "Handing in 9 of 9 cotton  ·  Quota: 12")


func test_the_hand_in_button_asks_to_hand_in() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)
	watch_signals(_overlay)

	var button: Button = _overlay.find_child("HandInButton", true, false)
	button.pressed.emit()

	assert_signal_emitted(_overlay, "hand_in_pressed")


func test_the_slider_starts_at_all_the_cotton_in_hand() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)

	assert_eq(_card().amount(), 9)
	assert_eq(_card().slider().max_value, 9.0)


func test_moving_the_slider_compares_what_is_handed_in_with_the_quota() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)

	_card().slider().value = 4

	assert_eq(_card().amount(), 4)
	assert_eq(_card().cotton_text(), "Handing in 4 of 9 cotton  ·  Quota: 12")


func test_the_slider_keeps_its_place_while_the_hand_in_stays_open() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)
	_card().slider().value = 4

	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)

	assert_eq(_card().amount(), 4)


func test_the_next_shifts_hand_in_starts_at_everything_again() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)
	_card().slider().value = 4
	_overlay.show_shift(ShiftView.new(3, 14, 0, 100.0, 3), 30)

	_overlay.show_shift(ShiftView.new(3, 14, 9, 0.0, 3, true), 30)

	assert_eq(_card().amount(), 9)


func test_the_hand_in_button_asks_to_hand_in_the_slider_amount() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 9, 0.0, 3, true), 30)
	_card().slider().value = 6
	watch_signals(_overlay)

	var button: Button = _overlay.find_child("HandInButton", true, false)
	button.pressed.emit()

	assert_signal_emitted_with_parameters(_overlay, "hand_in_pressed", [6])
