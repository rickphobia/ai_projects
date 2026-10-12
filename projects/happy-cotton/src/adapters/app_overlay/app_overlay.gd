# gdlint: disable=max-public-methods
# The App is the one overlay main drives, so each part it shows (bar, store, supplies bar, cards,
# Mascot, Study Session room) needs its own public call.
class_name AppOverlay
extends CanvasLayer
## The App: the bright, state-issued overlay over the grim field. A top bar with the Quota bar, the
## Shift's time left, the Worker's Exhaustion, the crop counter (with a "+1" rising from the Plot
## at each counted pick) and Labour Points (or his Debt, in red); the Hand-in card from the end of
## a Shift's time until he hands in (see HandInCard); the Disaster countdown under the bar
## (see DisasterBanner); the Mascot
## with a speech bubble at the bottom; the Store button at the bottom right, which opens the store
## over the field (see StorePanel) and shows the rest time left while he rests; the supplies bar
## above it (see SuppliesBar); the pay slip card at
## the end of each Shift until it is put away; and confetti for a met Quota or a purchase. The
## speech bubble closes by itself after SPEECH_SECONDS, or at the next tap or click anywhere, which
## still goes on to whatever was tapped. During a Study Session the plain room covers the field,
## under the bar and the Mascot. It shows what it is given and never decides anything. Only the
## Store and Settings buttons, the supplies bar's buttons, the pay slip and Hand-in cards, and
## the store while open, catch
## taps, so the field underneath still gets the rest. With reduced motion there is no confetti
## and the "+1" doesn't rise.
## The Generator powers The App: while the Worker isn't running it, the bar, the Mascot, the
## Store button and the store dim; the Study Session room is not The App and stays as it is.

## A store item's buy button was pressed; the rules decide whether he gets it.
signal upgrade_pressed(id: StringName)
signal privilege_pressed(id: StringName)
signal supply_pressed(id: StringName)
signal land_pressed
## A store item's tin button was pressed, to pay with hidden savings; the rules decide.
signal savings_pressed(id: StringName)
## The Hand-in card's button was pressed, to hand in `amount` of the cotton in hand; the rules
## decide what handing in does.
signal hand_in_pressed(amount: int)
## The Settings button was pressed.
signal settings_pressed

const BAR_COLOUR := Color(1.0, 0.42, 0.62)
const BUBBLE_COLOUR := Color(1.0, 0.98, 0.9)
const QUOTA_EMPTY := Color(1.0, 0.8, 0.88)
const QUOTA_FILL := Color(0.98, 0.84, 0.2)
const TEXT_ON_BAR := Color(1.0, 1.0, 1.0)
const TEXT_IN_BUBBLE := Color(0.3, 0.12, 0.22)
## The tint over The App while the Generator stands still.
const UNPOWERED := Color(0.45, 0.45, 0.45)
const FONT_SIZE := 28
const MARGIN := 16
## The player's own button, not one of The App's lines, so it isn't in AppText.
const SETTINGS_BUTTON_TEXT := "Settings"
## How far above the screen's bottom edge the supplies bar sits, clear of the Store button.
const SUPPLIES_BAR_LIFT := 80
## How long the Mascot's words stay up when nobody taps them away.
const SPEECH_SECONDS := 5.0

var _root: Control
var _quota_bar: ProgressBar
var _quota_label: Label
var _shift_label: Label
var _crop_counter: Label
var _balance: BalanceBadge
var _exhaustion_label: Label
var _on_watch_label: Label
var _disaster_banner: DisasterBanner
var _store_button: Button
var _supplies_bar: SuppliesBar
var _store: StorePanel
var _pay_slip: PaySlipCard
var _hand_in: HandInCard
var _text_scale := 1.0
var _speech: Label
var _bubble: PanelContainer
var _speech_seconds_left := 0.0
var _confetti: Confetti
var _study_room: StudyRoom
## The parts of The App that dim with the Generator.
var _powered_parts: Array[CanvasItem] = []
var _powered := true
var _reduced_motion := false


func _ready() -> void:
	layer = 10
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_study_room = StudyRoom.new()
	_study_room.visible = false
	_root.add_child(_study_room)
	var top_bar := _build_top_bar()
	_root.add_child(top_bar)
	_disaster_banner = DisasterBanner.new()
	_disaster_banner.name = "DisasterBanner"
	_root.add_child(_disaster_banner)
	var mascot_corner := _build_mascot_corner()
	_root.add_child(mascot_corner)
	_store_button = _build_store_button()
	_root.add_child(_store_button)
	_supplies_bar = _build_supplies_bar()
	_root.add_child(_supplies_bar)
	_pay_slip = PaySlipCard.new()
	_pay_slip.name = "PaySlipCard"
	_pay_slip.visible = false
	_root.add_child(_pay_slip)
	_hand_in = HandInCard.new()
	_hand_in.name = "HandInCard"
	_hand_in.visible = false
	_hand_in.hand_in_pressed.connect(hand_in_pressed.emit)
	_root.add_child(_hand_in)
	_store = StorePanel.new()
	_store.name = "StorePanel"
	_store.visible = false
	_store.upgrade_pressed.connect(upgrade_pressed.emit)
	_store.privilege_pressed.connect(privilege_pressed.emit)
	_store.land_pressed.connect(land_pressed.emit)
	_store.supply_pressed.connect(supply_pressed.emit)
	_store.savings_pressed.connect(savings_pressed.emit)
	_root.add_child(_store)
	_powered_parts = [
		top_bar,
		_disaster_banner,
		mascot_corner,
		_store_button,
		_supplies_bar,
		_pay_slip,
		_hand_in,
		_store
	]
	_confetti = Confetti.new()
	add_child(_confetti)


func _process(delta: float) -> void:
	if not _bubble.visible:
		return
	_speech_seconds_left -= delta
	if _speech_seconds_left <= 0.0:
		_bubble.visible = false


## Any press closes the bubble. It is read here, before the buttons and the field get it, and
## not marked handled, so the same tap still plants, picks or presses a button.
func _input(event: InputEvent) -> void:
	var touched := event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed
	var clicked := event is InputEventMouseButton and (event as InputEventMouseButton).pressed
	if touched or clicked:
		_bubble.visible = false


## Lit while the Worker runs the Generator, dimmed while it stands still.
func show_powered(powered: bool) -> void:
	_powered = powered
	for part in _powered_parts:
		part.modulate = Color.WHITE if powered else UNPOWERED


func is_powered() -> bool:
	return _powered


## Shows the Shift's Quota progress and crop counter (both the cotton in hand), time left and
## when the next school fees are due, the Hand-in card while it is open, and the Worker's Labour
## Points, or his Debt in red in their place while he owes any.
## `watch_shifts_left` above 0 shows "Harmony Support" and the Shifts left on watch. The
## Shift's Disaster, once warned of, shows under the bar with its countdown.
func show_shift(shift: ShiftView, labour_points: int, debt := 0, watch_shifts_left := 0) -> void:
	_quota_bar.max_value = shift.quota
	_quota_bar.value = mini(shift.picked, shift.quota)
	_quota_label.text = AppText.QUOTA_BAR.format({"picked": shift.picked, "quota": shift.quota})
	var timer := {"shift": shift.number, "time": clock_text(shift.seconds_left)}
	timer["school_fees_shift"] = shift.school_fees_shift
	_shift_label.text = AppText.SHIFT_TIMER.format(timer)
	_crop_counter.text = AppText.CROP_COUNTER.format({"picked": shift.picked})
	_hand_in.show_shift(shift)
	_balance.show_balance(labour_points, debt)
	_on_watch_label.visible = watch_shifts_left > 0
	_on_watch_label.text = AppText.ON_WATCH.format({"shifts": watch_shifts_left})
	_disaster_banner.show_disaster(shift.disaster)


## A "+1" rises from `at`, a point on the screen over the Plot just picked.
func show_crop_counted(at: Vector2) -> void:
	var rising := RisingCount.new(_reduced_motion)
	rising.position = at
	_root.add_child(rising)


## Brings up the pay slip card from a Farm.PAY_SLIP message's values.
func show_pay_slip(values: Dictionary) -> void:
	_pay_slip.show_slip(values)


## Shows the Worker's Exhaustion, from 0 to Exhaustion.MOST, as a whole percentage.
func show_exhaustion(level: float) -> void:
	_exhaustion_label.text = AppText.EXHAUSTION.format({"level": roundi(level)})


## The Store button reads "Store", or how long the rest or the call home has left while he
## is on one.
func show_resting(rest_seconds_left: float, call_seconds_left := 0.0) -> void:
	if rest_seconds_left > 0.0:
		_store_button.text = AppText.RESTING.format({"time": clock_text(rest_seconds_left)})
	elif call_seconds_left > 0.0:
		_store_button.text = AppText.ON_A_CALL.format({"time": clock_text(call_seconds_left)})
	else:
		_store_button.text = AppText.STORE_BUTTON


## Shows what the store sells now, whether it is open or not, so it is ready when opened, and
## the supplies held on the supplies bar. `hidden_savings` only decides whether the tin's buttons
## show: The App never shows the amount.
func show_store(items: Array[StoreItemView], labour_points: int, hidden_savings := 0) -> void:
	if _store.show_items(items, labour_points, hidden_savings):
		SettingsEffects.scale_text(_store, _text_scale)
	if _supplies_bar.show_supplies(items):
		SettingsEffects.scale_text(_supplies_bar, _text_scale)


func open_store() -> void:
	_store.visible = true


func is_store_open() -> bool:
	return _store.visible


func store_panel() -> StorePanel:
	return _store


func supplies_bar() -> SuppliesBar:
	return _supplies_bar


## Shows the Study Session room with the time left while there is any; hides it at 0.
func show_study_session(seconds_left: float) -> void:
	_study_room.visible = seconds_left > 0.0
	_study_room.show_time_left(
		AppText.STUDY_SESSION_TIMER.format({"time": clock_text(seconds_left)})
	)


func in_study_room() -> bool:
	return _study_room.visible


## With reduced motion a met Quota brings no confetti.
func set_reduced_motion(on: bool) -> void:
	_reduced_motion = on


## Scales all of The App's text to `scale` times its normal size.
func scale_text(scale: float) -> void:
	_text_scale = scale
	SettingsEffects.scale_text(_root, scale)


func is_celebrating() -> bool:
	return _confetti.emitting


## The Mascot says this for SPEECH_SECONDS, or until a tap or click closes it.
func say(text: String) -> void:
	_speech.text = text
	_bubble.visible = not text.is_empty()
	_speech_seconds_left = SPEECH_SECONDS


func is_speaking() -> bool:
	return _bubble.visible


## Confetti falls from the whole width of the screen, which can change while playing.
func celebrate() -> void:
	if _reduced_motion:
		return
	var half_width := get_viewport().get_visible_rect().size.x / 2.0
	_confetti.position = Vector2(half_width, -20.0)
	_confetti.emission_rect_extents = Vector2(half_width, 1)
	_confetti.restart()


func speech() -> String:
	return _speech.text


## Whole seconds left as m:ss, rounded up so the timer reads 0:00 only when time is up.
static func clock_text(seconds_left: float) -> String:
	var whole := maxi(ceili(seconds_left), 0)
	return "%d:%02d" % [floori(whole / 60.0), whole % 60]


func _build_top_bar() -> Control:
	var bar := PanelContainer.new()
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("panel", _rounded(BAR_COLOUR, 0))
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 24)
	bar.add_child(row)

	var quota := Control.new()
	quota.mouse_filter = Control.MOUSE_FILTER_IGNORE
	quota.custom_minimum_size = Vector2(380, 44)
	_quota_bar = ProgressBar.new()
	_quota_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_quota_bar.show_percentage = false
	_quota_bar.set_anchors_preset(Control.PRESET_FULL_RECT)
	_quota_bar.add_theme_stylebox_override("background", _rounded(QUOTA_EMPTY, 22))
	_quota_bar.add_theme_stylebox_override("fill", _rounded(QUOTA_FILL, 22))
	quota.add_child(_quota_bar)
	_quota_label = _label(TEXT_IN_BUBBLE)
	_quota_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_quota_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_quota_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	quota.add_child(_quota_label)
	row.add_child(quota)

	_shift_label = _label(TEXT_ON_BAR)
	_shift_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_shift_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	row.add_child(_shift_label)
	_exhaustion_label = _label(TEXT_ON_BAR)
	row.add_child(_exhaustion_label)
	_on_watch_label = _label(TEXT_ON_BAR)
	_on_watch_label.name = "OnWatch"
	_on_watch_label.visible = false
	row.add_child(_on_watch_label)
	_crop_counter = _label(TEXT_ON_BAR)
	_crop_counter.name = "CropCounter"
	row.add_child(_crop_counter)
	_balance = BalanceBadge.new()
	_balance.name = "BalanceBadge"
	row.add_child(_balance)
	var settings := Button.new()
	settings.name = "SettingsButton"
	settings.text = SETTINGS_BUTTON_TEXT
	settings.add_theme_font_size_override("font_size", FONT_SIZE)
	settings.pressed.connect(settings_pressed.emit)
	row.add_child(settings)
	return bar


func _build_store_button() -> Button:
	var button := Button.new()
	button.name = "StoreButton"
	button.text = AppText.STORE_BUTTON
	button.add_theme_font_size_override("font_size", FONT_SIZE)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(state, _rounded(BAR_COLOUR, 20))
	button.add_theme_color_override("font_color", TEXT_ON_BAR)
	button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT, Control.PRESET_MODE_MINSIZE)
	button.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	button.grow_vertical = Control.GROW_DIRECTION_BEGIN
	button.offset_right = -MARGIN
	button.offset_bottom = -MARGIN
	button.pressed.connect(open_store)
	return button


## Above the Store button, at the bottom right.
func _build_supplies_bar() -> SuppliesBar:
	var bar := SuppliesBar.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT, Control.PRESET_MODE_MINSIZE)
	bar.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_right = -MARGIN
	bar.offset_bottom = -MARGIN - SUPPLIES_BAR_LIFT
	return bar


func _build_mascot_corner() -> Control:
	var corner := HBoxContainer.new()
	corner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	corner.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_MINSIZE)
	corner.offset_left = MARGIN
	corner.offset_bottom = -MARGIN
	corner.grow_vertical = Control.GROW_DIRECTION_BEGIN
	corner.alignment = BoxContainer.ALIGNMENT_END
	corner.add_child(Mascot.new())
	_bubble = PanelContainer.new()
	_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bubble.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_bubble.add_theme_stylebox_override("panel", _rounded(BUBBLE_COLOUR, 20))
	_speech = _label(TEXT_IN_BUBBLE)
	_speech.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_speech.custom_minimum_size = Vector2(560, 0)
	_bubble.add_child(_speech)
	_bubble.visible = false
	corner.add_child(_bubble)
	return corner


func _label(colour: Color) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", FONT_SIZE)
	label.add_theme_color_override("font_color", colour)
	return label


func _rounded(colour: Color, corner_radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.set_corner_radius_all(corner_radius)
	style.content_margin_left = MARGIN
	style.content_margin_right = MARGIN
	style.content_margin_top = MARGIN / 2.0
	style.content_margin_bottom = MARGIN / 2.0
	return style
