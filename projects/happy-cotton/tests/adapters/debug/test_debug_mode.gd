extends GutTest
## Debug mode is on only with ?debug=1 in the page URL or --debug after `--` on the command
## line, and its panel asks for +1 hour or +8 hours of Skip time, or +100 Labour Points.


func test_debug_mode_is_off_by_default() -> void:
	assert_false(DebugMode.asked_for("", PackedStringArray()))


func test_debug_1_in_the_page_url_turns_it_on() -> void:
	assert_true(DebugMode.asked_for("?debug=1", PackedStringArray()))
	assert_true(DebugMode.asked_for("?lang=en&debug=1", PackedStringArray()))


func test_other_url_values_leave_it_off() -> void:
	assert_false(DebugMode.asked_for("?debug=0", PackedStringArray()))
	assert_false(DebugMode.asked_for("?debug=10", PackedStringArray()))
	assert_false(DebugMode.asked_for("?nodebug=1", PackedStringArray()))


func test_debug_on_the_command_line_turns_it_on() -> void:
	assert_true(DebugMode.asked_for("", PackedStringArray(["--debug"])))
	assert_false(DebugMode.asked_for("", PackedStringArray(["--verbose"])))


func test_the_panel_offers_one_hour_eight_hours_a_hundred_labour_points_and_an_audit() -> void:
	var panel: DebugPanel = add_child_autofree(DebugPanel.new())
	watch_signals(panel)
	var buttons := panel.find_children("*", "Button", true, false)
	assert_eq(buttons.size(), 4)

	for node in buttons:
		(node as Button).pressed.emit()

	assert_signal_emitted_with_parameters(panel, "skip_requested", [3600.0], 0)
	assert_signal_emitted_with_parameters(panel, "skip_requested", [28800.0], 1)
	assert_signal_emitted_with_parameters(panel, "labour_points_requested", [100])
	assert_eq((buttons[2] as Button).text, "+100 Labour Points")
	assert_signal_emitted(panel, "audit_requested")
	assert_eq((buttons[3] as Button).text, "Audit this Shift")
