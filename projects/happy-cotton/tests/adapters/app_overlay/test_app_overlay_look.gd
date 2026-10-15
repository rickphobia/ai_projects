extends GutTest
## The App wears the App look: its parts take the bright theme's font and styles, the text size
## rescales it, every App button is big enough for a thumb, the always-visible parts fit a
## 1280×720 screen without covering each other, and buttons squish only without reduced motion.

const SCREEN := Rect2(0, 0, 1280, 720)

var _overlay: AppOverlay


func before_each() -> void:
	# A base-sized screen of its own, whatever size the test runner's window is.
	var screen := SubViewport.new()
	screen.size = Vector2i(SCREEN.size)
	add_child_autofree(screen)
	_overlay = AppOverlay.new()
	screen.add_child(_overlay)
	var items: Array[StoreItemView] = [
		StoreItemView.supply(Farm.FERTILISER, Vector2i(3, 4), Vector2i(2, 5), &""),
		StoreItemView.supply(Farm.PESTICIDE, Vector2i(3, 4), Vector2i(1, 5), &""),
		StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, &""),
	]
	_overlay.show_store(items, 30)
	_overlay.show_shift(ShiftView.new(12, 120, 85, 299.0, 13), 1234)
	_overlay.show_exhaustion(55.0)
	_overlay.say("Every pick lifts the Quota! Every lap powers the nation! Keep going, Worker!")


func _find(node_name: String) -> Control:
	return _overlay.find_child(node_name, true, false) as Control


func _app_buttons() -> Array[Button]:
	var buttons: Array[Button] = []
	for node in _overlay.find_children("*", "Button", true, false):
		if not (node as Button).is_in_group(TapFeedback.NOT_APP):
			buttons.append(node as Button)
	return buttons


func test_the_apps_root_and_parts_use_the_bright_theme() -> void:
	var bright := AppLook.colours(AppLook.Palette.BRIGHT)
	var store_button := _find("StoreButton") as Button

	assert_not_null(_find("AppRoot").theme)
	var font := store_button.get_theme_font(&"font") as FontVariation
	assert_eq(font.base_font, AppLook.FONT_FILE)
	var style := store_button.get_theme_stylebox(&"normal") as StyleBoxFlat
	assert_eq(style.bg_color, bright[&"primary"])


func test_no_app_part_overrides_its_own_colours_or_styles() -> void:
	for node in _find("AppRoot").find_children("*", "Control", true, false):
		var control := node as Control
		if control is StudyRoom or control.get_parent() is StudyRoom:
			continue
		# Godot's own internal nodes (a scroll bar's, say) are named with a leading "_".
		if control.is_in_group(TapFeedback.NOT_APP) or control.name.begins_with("_"):
			continue
		for colour: StringName in [&"font_color", &"font_outline_color"]:
			assert_false(control.has_theme_color_override(colour), "%s %s" % [control, colour])
		for style: StringName in [&"panel", &"normal", &"pressed", &"disabled"]:
			assert_false(control.has_theme_stylebox_override(style), "%s %s" % [control, style])
		assert_false(control.has_theme_font_size_override(&"font_size"), str(control))


func test_the_text_size_rescales_the_theme() -> void:
	var store_button := _find("StoreButton") as Button

	_overlay.scale_text(1.25)

	assert_eq(store_button.get_theme_font_size(&"font_size"), roundi(AppLook.BODY * 1.25))


func test_every_app_button_is_at_least_88_base_pixels_in_its_short_side() -> void:
	_overlay.open_store()
	await wait_process_frames(2)

	var buttons := _app_buttons()
	assert_gt(buttons.size(), 5, "the top bar, Store, supplies, store row and close buttons")
	for button in buttons:
		var shortest := minf(button.size.x, button.size.y)
		assert_gte(shortest, float(AppLook.TAP_TARGET), "%s is %s" % [button.name, button.size])


func test_the_top_bar_bubble_and_supplies_bar_fit_the_screen_without_overlapping() -> void:
	# The longest top bar: in Debt and on watch.
	_overlay.show_shift(ShiftView.new(12, 120, 85, 299.0, 13), 0, 1234, 2)
	await wait_process_frames(2)
	var parts: Dictionary[String, Rect2] = {
		"top bar": _find("TopBar").get_global_rect(),
		"bubble": _speech_bubble().get_global_rect(),
		"supplies bar": (_find("SuppliesBar").get_child(1) as Control).get_global_rect(),
		"Store button": _find("StoreButton").get_global_rect(),
	}

	for part: String in parts:
		var rect := parts[part]
		assert_true(SCREEN.encloses(rect), "%s %s is on screen" % [part, rect])
		for other: String in parts:
			if other != part:
				assert_false(rect.intersects(parts[other]), "%s clear of %s" % [part, other])


func test_a_pressed_app_button_squishes_only_without_reduced_motion() -> void:
	var store_button := _find("StoreButton") as Button
	var tweens_before := get_tree().get_processed_tweens().size()

	_overlay.set_reduced_motion(true)
	store_button.button_down.emit()
	store_button.button_up.emit()
	assert_eq(get_tree().get_processed_tweens().size(), tweens_before, "still")

	_overlay.set_reduced_motion(false)
	store_button.button_down.emit()
	assert_gt(get_tree().get_processed_tweens().size(), tweens_before, "squishes")


func test_store_rows_added_later_squish_too() -> void:
	var buy := _overlay.store_panel().row(Farm.REST_HOUR).button()
	var tweens_before := get_tree().get_processed_tweens().size()

	buy.button_down.emit()

	assert_gt(get_tree().get_processed_tweens().size(), tweens_before)


func _speech_bubble() -> Control:
	for node in _overlay.find_children("*", "Label", true, false):
		if (node as Label).text.begins_with("Every pick"):
			return (node as Control).get_parent() as Control
	return null
