class_name AppLook
extends RefCounted
## The App's look in one place: colour tokens, the font and its sizes, an 8-pixel spacing scale,
## corner radii, and glossy panel and button styles, built into a Godot Theme in code so every
## value is reviewed in diffs. Two palettes share one layout: BRIGHT is The App, slightly too
## cheerful; MUTED is the calm frame around it (title screen, Settings, the Study Session
## room's text). A part picks a style by its theme type variation, never by its own colours.
## "Glossy" is a flat box with a light band along its top edge and a soft shadow beneath.

enum Palette { BRIGHT, MUTED }

## Type variations a part sets on a Control to pick one of the theme's styles.
const BAR_PANEL := &"BarPanel"
const BUBBLE_PANEL := &"BubblePanel"
const BADGE_PANEL := &"BadgePanel"
const DEBT_BADGE_PANEL := &"DebtBadgePanel"
const WARNED_PANEL := &"WarnedPanel"
const STRIKING_PANEL := &"StrikingPanel"
const BACKDROP_PANEL := &"BackdropPanel"
const BAR_LABEL := &"BarLabel"
const BAR_SMALL_LABEL := &"BarSmallLabel"
const TITLE_LABEL := &"TitleLabel"
const SMALL_LABEL := &"SmallLabel"
const QUOTA_RISE_LABEL := &"QuotaRiseLabel"
const REFUSAL_LABEL := &"RefusalLabel"
const DEBT_LABEL := &"DebtLabel"
const HINT_LABEL := &"HintLabel"
const COUNT_LABEL := &"CountLabel"
const CHOSEN_BUTTON := &"ChosenButton"

## Every colour token; both palettes set each one. Meaning-bearing colours (Debt, a Disaster's
## warning and strike, the chosen supply) are tokens like the rest.
const TOKENS: Array[StringName] = [
	&"primary",
	&"on_primary",
	&"surface",
	&"ink",
	&"accent",
	&"track",
	&"debt",
	&"warned",
	&"striking",
	&"quota_rise",
	&"quiet",
	&"off",
	&"backdrop",
	&"shadow",
]
const BRIGHT_COLOURS: Dictionary[StringName, Color] = {
	&"primary": Color(1.0, 0.36, 0.6),
	&"on_primary": Color(1.0, 1.0, 1.0),
	&"surface": Color(1.0, 0.98, 0.9),
	&"ink": Color(0.3, 0.12, 0.22),
	&"accent": Color(1.0, 0.85, 0.16),
	&"track": Color(1.0, 0.8, 0.88),
	&"debt": Color(0.78, 0.05, 0.1),
	&"warned": Color(0.97, 0.6, 0.12),
	&"striking": Color(0.88, 0.32, 0.08),
	&"quota_rise": Color(0.75, 0.2, 0.35),
	&"quiet": Color(0.45, 0.4, 0.42),
	&"off": Color(0.78, 0.7, 0.74),
	&"backdrop": Color(0.1, 0.05, 0.08, 0.55),
	&"shadow": Color(0.3, 0.05, 0.15, 0.3),
}
## Today's calm title-screen colours: dust, ink and paper.
const MUTED_COLOURS: Dictionary[StringName, Color] = {
	&"primary": Color(0.36, 0.34, 0.3),
	&"on_primary": Color(0.95, 0.92, 0.83),
	&"surface": Color(0.72, 0.69, 0.6),
	&"ink": Color(0.16, 0.14, 0.12),
	&"accent": Color(0.85, 0.78, 0.55),
	&"track": Color(0.6, 0.57, 0.5),
	&"debt": Color(0.55, 0.12, 0.1),
	&"warned": Color(0.7, 0.5, 0.25),
	&"striking": Color(0.6, 0.32, 0.15),
	&"quota_rise": Color(0.45, 0.2, 0.15),
	&"quiet": Color(0.4, 0.38, 0.34),
	&"off": Color(0.6, 0.58, 0.54),
	&"backdrop": Color(0.08, 0.07, 0.06, 0.55),
	&"shadow": Color(0.1, 0.08, 0.05, 0.25),
}
## The tint over The App while the Generator stands still.
const UNPOWERED := Color(0.45, 0.45, 0.45)
## The App's confetti pieces.
const CONFETTI_COLOURS: Array[Color] = [
	Color(1.0, 0.3, 0.4),
	Color(1.0, 0.85, 0.2),
	Color(0.3, 0.8, 0.5),
	Color(0.3, 0.6, 1.0),
	Color(1.0, 0.5, 0.9),
]

## Nunito (SIL OFL 1.1), one variable file, drawn at a single friendly weight.
const FONT_FILE: FontFile = preload("res://assets/nunito/Nunito.woff2")
const FONT_WEIGHT := 750
## Font sizes before the player's text size is applied. Nothing in The App is smaller than SMALL.
const SMALL := 22
const BODY := 28
const TITLE := 34
const DISPLAY := 40

## The spacing scale: every margin and gap is a multiple of SPACE.
const SPACE := 8
const RADIUS_SMALL := 12
const RADIUS := 20
const RADIUS_LARGE := 28
## The shortest side of any App button, about 44 px on a phone held sideways.
const TAP_TARGET := 88
## The top bar's height: one App button and the bar's margins.
const TOP_BAR_HEIGHT := TAP_TARGET + SPACE * 2
## The light band along a glossy box's top edge, and its soft shadow.
const HIGHLIGHT_WIDTH := 4
const HIGHLIGHT_LIGHTEN := 0.45
const SHADOW_SIZE := 8
const SHADOW_OFFSET := Vector2(0, 4)


static func colours(palette: Palette) -> Dictionary[StringName, Color]:
	return BRIGHT_COLOURS if palette == Palette.BRIGHT else MUTED_COLOURS


static func font() -> FontVariation:
	var variation := FontVariation.new()
	variation.base_font = FONT_FILE
	var weight := TextServerManager.get_primary_interface().name_to_tag("weight")
	variation.variation_opentype = {weight: FONT_WEIGHT}
	return variation


## A font size after the player's text size.
static func scaled(font_size: int, text_scale: float) -> int:
	return roundi(font_size * text_scale)


## The whole theme for `palette`, with every font size scaled by `text_scale`.
static func theme(palette: Palette, text_scale := 1.0) -> Theme:
	var tokens := colours(palette)
	var built := Theme.new()
	built.default_font = font()
	built.default_font_size = scaled(BODY, text_scale)
	_add_labels(built, tokens, text_scale)
	_add_panels(built, tokens)
	_add_buttons(built, tokens)
	_add_bars(built, tokens)
	return built


## A new App button: at least TAP_TARGET on each side, in the theme's button style.
static func button(text := "") -> Button:
	var made := Button.new()
	made.text = text
	made.custom_minimum_size = Vector2(TAP_TARGET, TAP_TARGET)
	return made


static func _add_labels(
	built: Theme, tokens: Dictionary[StringName, Color], text_scale: float
) -> void:
	built.set_color(&"font_color", &"Label", tokens[&"ink"])
	_add_label(built, BAR_LABEL, tokens[&"on_primary"], scaled(BODY, text_scale))
	_add_label(built, BAR_SMALL_LABEL, tokens[&"on_primary"], scaled(SMALL, text_scale))
	_add_label(built, TITLE_LABEL, tokens[&"primary"], scaled(TITLE, text_scale))
	_add_label(built, SMALL_LABEL, tokens[&"ink"], scaled(SMALL, text_scale))
	_add_label(built, QUOTA_RISE_LABEL, tokens[&"quota_rise"], scaled(SMALL, text_scale))
	_add_label(built, REFUSAL_LABEL, tokens[&"quiet"], scaled(SMALL, text_scale))
	_add_label(built, DEBT_LABEL, tokens[&"debt"], scaled(BODY, text_scale))
	_add_label(built, HINT_LABEL, tokens[&"ink"], scaled(BODY, text_scale))
	_add_label(built, COUNT_LABEL, tokens[&"accent"], scaled(DISPLAY, text_scale))
	built.set_stylebox(&"normal", HINT_LABEL, glossy(tokens[&"surface"], tokens, RADIUS, SPACE * 2))
	built.set_color(&"font_outline_color", COUNT_LABEL, tokens[&"ink"])
	built.set_constant(&"outline_size", COUNT_LABEL, SPACE)


static func _add_label(built: Theme, variation: StringName, colour: Color, size: int) -> void:
	built.set_type_variation(variation, &"Label")
	built.set_color(&"font_color", variation, colour)
	built.set_font_size(&"font_size", variation, size)


static func _add_panels(built: Theme, tokens: Dictionary[StringName, Color]) -> void:
	var card := glossy(tokens[&"surface"], tokens, RADIUS_LARGE, SPACE * 3)
	built.set_stylebox(&"panel", &"PanelContainer", card)
	var bar := glossy(tokens[&"primary"], tokens, 0, SPACE * 2)
	bar.content_margin_top = SPACE
	bar.content_margin_bottom = SPACE
	bar.corner_radius_bottom_left = RADIUS
	bar.corner_radius_bottom_right = RADIUS
	var panels: Dictionary[StringName, StyleBoxFlat] = {
		BAR_PANEL: bar,
		BUBBLE_PANEL: glossy(tokens[&"surface"], tokens, RADIUS, SPACE * 2),
		BADGE_PANEL: _flat(Color.TRANSPARENT, RADIUS, SPACE * 2),
		DEBT_BADGE_PANEL: glossy(tokens[&"debt"], tokens, RADIUS, SPACE * 2),
		WARNED_PANEL: glossy(tokens[&"warned"], tokens, RADIUS, SPACE * 2),
		STRIKING_PANEL: glossy(tokens[&"striking"], tokens, RADIUS, SPACE * 2),
	}
	for variation: StringName in panels:
		built.set_type_variation(variation, &"PanelContainer")
		built.set_stylebox(&"panel", variation, panels[variation])
	built.set_type_variation(BACKDROP_PANEL, &"Panel")
	built.set_stylebox(&"panel", BACKDROP_PANEL, _flat(tokens[&"backdrop"], 0, 0))


## Ready, hover, pressed, off and focus, the same for every App button; the chosen supply's
## button is the accent colour so it is plain which one the next tap uses.
static func _add_buttons(built: Theme, tokens: Dictionary[StringName, Color]) -> void:
	_add_button_states(built, &"Button", tokens[&"primary"], tokens[&"on_primary"], tokens)
	built.set_type_variation(CHOSEN_BUTTON, &"Button")
	_add_button_states(built, CHOSEN_BUTTON, tokens[&"accent"], tokens[&"ink"], tokens)


static func _add_button_states(
	built: Theme,
	type: StringName,
	fill: Color,
	text: Color,
	tokens: Dictionary[StringName, Color],
) -> void:
	built.set_stylebox(&"normal", type, _button_box(fill, tokens))
	built.set_stylebox(&"hover", type, _button_box(fill.lightened(0.1), tokens))
	var pressed := _button_box(fill.darkened(0.12), tokens)
	pressed.shadow_size = SHADOW_SIZE / 2
	pressed.shadow_offset = SHADOW_OFFSET / 2.0
	built.set_stylebox(&"pressed", type, pressed)
	built.set_stylebox(&"hover_pressed", type, pressed)
	var off := _flat(tokens[&"off"], RADIUS, SPACE * 3)
	off.content_margin_top = SPACE
	off.content_margin_bottom = SPACE
	built.set_stylebox(&"disabled", type, off)
	var focus := StyleBoxFlat.new()
	focus.draw_center = false
	focus.set_corner_radius_all(RADIUS)
	focus.set_border_width_all(HIGHLIGHT_WIDTH)
	focus.border_color = tokens[&"accent"] if type == &"Button" else tokens[&"primary"]
	focus.set_expand_margin_all(HIGHLIGHT_WIDTH)
	built.set_stylebox(&"focus", type, focus)
	for role: StringName in [
		&"font_color", &"font_hover_color", &"font_pressed_color", &"font_focus_color"
	]:
		built.set_color(role, type, text)
	built.set_color(&"font_hover_pressed_color", type, text)
	built.set_color(&"font_disabled_color", type, tokens[&"on_primary"])


static func _add_bars(built: Theme, tokens: Dictionary[StringName, Color]) -> void:
	built.set_stylebox(&"background", &"ProgressBar", _flat(tokens[&"track"], RADIUS, 0))
	built.set_stylebox(&"fill", &"ProgressBar", glossy(tokens[&"accent"], tokens, RADIUS, 0))
	var track := _flat(tokens[&"track"], RADIUS_SMALL, 0)
	track.content_margin_top = SPACE
	track.content_margin_bottom = SPACE
	built.set_stylebox(&"slider", &"HSlider", track)
	var filled := _flat(tokens[&"primary"], RADIUS_SMALL, 0)
	built.set_stylebox(&"grabber_area", &"HSlider", filled)
	built.set_stylebox(&"grabber_area_highlight", &"HSlider", filled)


## A glossy box: `fill`, rounded by `radius`, with a light band along the top edge and a soft
## shadow beneath, and `margin` around its content.
static func glossy(
	fill: Color, tokens: Dictionary[StringName, Color], radius: int, margin: int
) -> StyleBoxFlat:
	var style := _flat(fill, radius, margin)
	style.border_width_top = HIGHLIGHT_WIDTH
	style.border_color = fill.lightened(HIGHLIGHT_LIGHTEN)
	style.shadow_color = tokens[&"shadow"]
	style.shadow_size = SHADOW_SIZE
	style.shadow_offset = SHADOW_OFFSET
	return style


static func _button_box(fill: Color, tokens: Dictionary[StringName, Color]) -> StyleBoxFlat:
	var style := glossy(fill, tokens, RADIUS, SPACE * 3)
	style.content_margin_top = SPACE
	style.content_margin_bottom = SPACE
	return style


static func _flat(fill: Color, radius: int, margin: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.set_corner_radius_all(radius)
	style.set_content_margin_all(margin)
	return style
