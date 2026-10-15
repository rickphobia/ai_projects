extends GutTest
## The App look: both palettes set every colour token and build a whole theme, the player's
## text size scales every font size, buttons it makes are big enough for a thumb, and panels
## and buttons are glossy.

const PALETTES: Array[AppLook.Palette] = [AppLook.Palette.BRIGHT, AppLook.Palette.MUTED]
const LABEL_VARIATIONS: Array[StringName] = [
	AppLook.BAR_LABEL,
	AppLook.BAR_SMALL_LABEL,
	AppLook.TITLE_LABEL,
	AppLook.SMALL_LABEL,
	AppLook.QUOTA_RISE_LABEL,
	AppLook.REFUSAL_LABEL,
	AppLook.DEBT_LABEL,
	AppLook.HINT_LABEL,
	AppLook.COUNT_LABEL,
]
const PANEL_VARIATIONS: Array[StringName] = [
	AppLook.BAR_PANEL,
	AppLook.BUBBLE_PANEL,
	AppLook.BADGE_PANEL,
	AppLook.DEBT_BADGE_PANEL,
	AppLook.WARNED_PANEL,
	AppLook.STRIKING_PANEL,
]
const BUTTON_STATES: Array[StringName] = [&"normal", &"hover", &"pressed", &"disabled", &"focus"]


func test_both_palettes_set_every_token() -> void:
	for palette in PALETTES:
		var tokens := AppLook.colours(palette)
		for token in AppLook.TOKENS:
			assert_true(tokens.has(token), "palette %d sets %s" % [palette, token])
		assert_eq(tokens.size(), AppLook.TOKENS.size(), "palette %d has no extra tokens" % palette)


func test_both_themes_set_the_font_every_style_and_every_button_state() -> void:
	for palette in PALETTES:
		var theme := AppLook.theme(palette)
		assert_eq((theme.default_font as FontVariation).base_font, AppLook.FONT_FILE)
		assert_eq(theme.default_font_size, AppLook.BODY)
		for variation in LABEL_VARIATIONS:
			assert_true(theme.has_color(&"font_color", variation), "%s colour" % variation)
			assert_true(theme.has_font_size(&"font_size", variation), "%s size" % variation)
		for variation in PANEL_VARIATIONS:
			assert_true(theme.has_stylebox(&"panel", variation), "%s style" % variation)
		for type: StringName in [&"Button", AppLook.CHOSEN_BUTTON]:
			for state in BUTTON_STATES:
				assert_true(theme.has_stylebox(state, type), "%s %s" % [type, state])


func test_the_palettes_differ_but_share_the_layout() -> void:
	var bright := AppLook.theme(AppLook.Palette.BRIGHT)
	var muted := AppLook.theme(AppLook.Palette.MUTED)

	var bright_button := bright.get_stylebox(&"normal", &"Button") as StyleBoxFlat
	var muted_button := muted.get_stylebox(&"normal", &"Button") as StyleBoxFlat
	assert_ne(bright_button.bg_color, muted_button.bg_color)
	assert_eq(bright_button.corner_radius_top_left, muted_button.corner_radius_top_left)
	assert_eq(bright_button.content_margin_left, muted_button.content_margin_left)


func test_the_text_size_scales_every_font_size() -> void:
	var normal := AppLook.theme(AppLook.Palette.BRIGHT)
	var bigger := AppLook.theme(AppLook.Palette.BRIGHT, 1.5)

	assert_eq(bigger.default_font_size, roundi(normal.default_font_size * 1.5))
	for variation in LABEL_VARIATIONS:
		var size := normal.get_font_size(&"font_size", variation)
		assert_eq(bigger.get_font_size(&"font_size", variation), roundi(size * 1.5), variation)


func test_no_font_size_is_below_the_smallest() -> void:
	var theme := AppLook.theme(AppLook.Palette.BRIGHT)

	for variation in LABEL_VARIATIONS:
		assert_gte(theme.get_font_size(&"font_size", variation), AppLook.SMALL, variation)


func test_panels_and_buttons_are_glossy() -> void:
	var theme := AppLook.theme(AppLook.Palette.BRIGHT)
	var boxes: Array[StyleBoxFlat] = [
		theme.get_stylebox(&"panel", &"PanelContainer"),
		theme.get_stylebox(&"panel", AppLook.BUBBLE_PANEL),
		theme.get_stylebox(&"normal", &"Button"),
	]

	for box in boxes:
		assert_gt(box.border_width_top, 0, "a highlight along the top")
		assert_gt(box.border_color.get_luminance(), box.bg_color.get_luminance(), "it is lighter")
		assert_gt(box.shadow_size, 0, "a soft shadow")


func test_meaning_bearing_colours_are_tokens() -> void:
	var tokens := AppLook.colours(AppLook.Palette.BRIGHT)
	var theme := AppLook.theme(AppLook.Palette.BRIGHT)

	assert_eq(theme.get_color(&"font_color", AppLook.DEBT_LABEL), tokens[&"debt"])
	var debt_badge := theme.get_stylebox(&"panel", AppLook.DEBT_BADGE_PANEL) as StyleBoxFlat
	assert_eq(debt_badge.bg_color, tokens[&"debt"])
	var chosen := theme.get_stylebox(&"normal", AppLook.CHOSEN_BUTTON) as StyleBoxFlat
	assert_eq(chosen.bg_color, tokens[&"accent"])
	var warned := theme.get_stylebox(&"panel", AppLook.WARNED_PANEL) as StyleBoxFlat
	assert_eq(warned.bg_color, tokens[&"warned"])


func test_a_button_it_makes_is_big_enough_for_a_thumb() -> void:
	var button := AppLook.button("Go")
	add_child_autofree(button)

	assert_eq(button.text, "Go")
	var smallest := button.get_combined_minimum_size()
	assert_gte(minf(smallest.x, smallest.y), 88.0)
