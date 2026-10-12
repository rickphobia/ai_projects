extends GutTest
## The App overlay shows what it is given: the Quota, the Shift's time left, Labour Points and
## the Mascot's words, and the Study Session room.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func _label_texts() -> Array[String]:
	var texts: Array[String] = []
	for node in _overlay.find_children("*", "Label", true, false):
		texts.append((node as Label).text)
	return texts


func test_the_clock_reads_minutes_and_seconds_rounded_up() -> void:
	assert_eq(AppOverlay.clock_text(600.0), "10:00")
	assert_eq(AppOverlay.clock_text(59.2), "1:00")
	assert_eq(AppOverlay.clock_text(0.4), "0:01")
	assert_eq(AppOverlay.clock_text(0.0), "0:00")
	assert_eq(AppOverlay.clock_text(-3.0), "0:00")


func test_it_shows_the_quota_the_time_left_and_the_labour_points() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 30)

	var texts := _label_texts()
	assert_has(texts, "Quota 5 / 12")
	assert_has(texts, "Shift 2  ·  1:30 left  ·  School fees after Shift 3")
	assert_has(texts, "30 Labour Points")


func _card() -> PaySlipCard:
	return _overlay.find_child("PaySlipCard", true, false) as PaySlipCard


func _badge() -> BalanceBadge:
	return _overlay.find_child("BalanceBadge", true, false) as BalanceBadge


func test_debt_shows_in_red_where_the_labour_points_are() -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 0, 14)

	assert_has(_label_texts(), "Debt 14 Labour Points")
	assert_does_not_have(_label_texts(), "0 Labour Points")
	assert_true(_badge().shows_debt())

	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3), 3, 0)

	assert_has(_label_texts(), "3 Labour Points")
	assert_false(_badge().shows_debt())


func test_the_pay_slip_card_lists_each_bill_and_what_is_left() -> void:
	var slip := {"shift": 3, "earned": 20, "laps": 12, "electricity": 6, "rent": 6, "balance": 8}

	_overlay.show_pay_slip(slip)

	var card := _card()
	assert_true(card.visible)
	assert_has(_label_texts(), "Pay slip  ·  Shift 3")
	var expected: Array[String] = [
		"Earned this Shift: +20",
		"Electricity, 12 laps: −6. Thanks for the power!",
		"Dormitory rent: −6. A warm bed, kindly provided!",
		"Yours to keep: 8 Labour Points",
	]
	assert_eq(card.row_texts(), expected)


func test_a_negative_balance_on_the_pay_slip_reads_as_debt() -> void:
	var slip := {"shift": 1, "earned": 0, "laps": 0, "electricity": 0, "rent": 6, "balance": -6}

	var rows := PaySlipCard.rows(slip)

	assert_eq(rows[-1], "Owed to the Farm: 6 Labour Points. We will settle it together!")
	assert_true(PaySlipCard.in_debt(slip))


func test_the_pay_slip_card_is_put_away_by_its_button() -> void:
	_overlay.show_pay_slip({"shift": 1, "balance": 0})
	var close: Button = _card().find_child("PaySlipClose", true, false)

	close.pressed.emit()

	assert_false(_card().visible)


func test_the_mascot_says_what_it_is_given() -> void:
	_overlay.say("Shift 1 begins!")

	assert_eq(_overlay.speech(), "Shift 1 begins!")
	assert_true(_overlay.is_speaking())


func test_celebrating_does_not_fail_before_or_after_a_shift_is_shown() -> void:
	_overlay.celebrate()
	_overlay.show_shift(ShiftView.new(1, 3, 4, 10.0, 3), 0)

	assert_has(_label_texts(), "Quota 4 / 3", "a surplus is shown, the bar just stays full")


func test_there_is_no_study_room_on_the_field() -> void:
	assert_false(_overlay.in_study_room())


func test_a_study_session_shows_the_room_and_its_time_left() -> void:
	_overlay.show_study_session(299.5)

	assert_true(_overlay.in_study_room())
	assert_has(_label_texts(), "Study Session  ·  5:00 left")


func test_the_room_covers_the_whole_screen() -> void:
	_overlay.show_study_session(10.0)
	await wait_process_frames(1)

	var room: StudyRoom = _overlay.find_children("*", "StudyRoom", true, false)[0]
	assert_eq(room.size, room.get_viewport_rect().size, "a 0x0 room draws nothing")


func test_the_room_goes_away_when_the_study_session_ends() -> void:
	_overlay.show_study_session(10.0)

	_overlay.show_study_session(0.0)

	assert_false(_overlay.in_study_room())


func test_it_shows_the_exhaustion_as_a_whole_percentage() -> void:
	_overlay.show_exhaustion(42.6)

	assert_has(_label_texts(), "Exhaustion 43%")


func test_the_app_dims_while_the_generator_stands_still_and_brightens_when_it_turns() -> void:
	_overlay.show_powered(false)
	assert_eq(
		(_overlay.find_child("StoreButton", true, false) as Button).modulate, AppOverlay.UNPOWERED
	)
	assert_false(_overlay.is_powered())

	_overlay.show_powered(true)

	assert_eq((_overlay.find_child("StoreButton", true, false) as Button).modulate, Color.WHITE)
	assert_true(_overlay.is_powered())


func test_the_study_room_does_not_dim_with_the_app() -> void:
	_overlay.show_powered(false)

	var room := _overlay.find_children("*", "StudyRoom", true, false)[0] as CanvasItem
	assert_eq(room.modulate, Color.WHITE)


func test_a_met_quota_brings_confetti() -> void:
	_overlay.celebrate()

	assert_true(_overlay.is_celebrating())


func test_with_reduced_motion_a_met_quota_brings_no_confetti() -> void:
	_overlay.set_reduced_motion(true)
	_overlay.celebrate()

	assert_false(_overlay.is_celebrating())


func test_the_text_scales_with_the_text_size() -> void:
	_overlay.say("Bigger")
	_overlay.scale_text(1.5)

	var speech: Label
	for node in _overlay.find_children("*", "Label", true, false):
		if (node as Label).text == "Bigger":
			speech = node
	assert_eq(speech.get_theme_font_size("font_size"), roundi(AppOverlay.FONT_SIZE * 1.5))
	_overlay.scale_text(1.0)
	assert_eq(speech.get_theme_font_size("font_size"), AppOverlay.FONT_SIZE)


func test_the_settings_button_asks_for_settings() -> void:
	watch_signals(_overlay)
	(_overlay.find_child("SettingsButton", true, false) as Button).pressed.emit()

	assert_signal_emitted(_overlay, "settings_pressed")
