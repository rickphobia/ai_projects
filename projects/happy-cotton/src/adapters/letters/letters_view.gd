class_name LettersView
extends CanvasLayer
## The Children's letters, drawn to look nothing like The App: a handwritten page in ink on
## plain, slightly crooked paper, and a box of the letters received so far, oldest first, to
## re-read. The Letters button on the right edge opens the box once a letter has come. A new
## letter opens by itself. It shows what it is given and decides nothing; while the page or
## the box is open it covers the screen, so a tap meant for it never reaches the field.
## Its words are the Children's (FamilyText); its own few labels are the Worker's, not The
## App's, so they live here rather than in AppText.

## "First Time Writing!" by GGBotNet, CC0 (assets/CREDITS.md): a child's school handwriting.
const HANDWRITING: FontFile = preload(
	"res://assets/ggbotnet-first-time-writing/FirstTimeWriting.woff2"
)
const BACKDROP := Color(0.08, 0.07, 0.05, 0.6)
const PAPER := Color(0.95, 0.92, 0.83)
const PAPER_EDGE := Color(0.6, 0.55, 0.45)
const INK := Color(0.15, 0.2, 0.42)
const PAGE_FONT_SIZE := 30
const BUTTON_FONT_SIZE := 28
const MARGIN := 28
## The paper's share of the screen, so it fits a phone held sideways.
const PAGE_SHARE := Vector2(0.62, 0.86)
## Handwritten pages never sit square.
const PAGE_TILT_DEGREES := -1.2
const LETTERS_BUTTON_TEXT := "Letters"
const PUT_AWAY_TEXT := "Fold it away"
const BOX_TITLE := "Letters from home"
const BOX_CLOSE_TEXT := "Close the box"
## One entry in the box: its place in order and who wrote it.
const BOX_ENTRY := "{number}. From {name}"

var _root: Control
var _box_button: Button
var _page: Control
var _page_text: Label
var _box: Control
var _box_entries: VBoxContainer
var _received: Array[StringName] = []


func _ready() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_box_button = _build_box_button()
	_box_button.visible = false
	_root.add_child(_box_button)
	_box = _build_box()
	_box.visible = false
	_root.add_child(_box)
	_page = _build_page()
	_page.visible = false
	_root.add_child(_page)


## The letters received so far, oldest first, for the box. The Letters button shows once
## there is one.
func show_letters(received: Array[StringName]) -> void:
	if received == _received:
		return
	_received = received.duplicate()
	_box_button.visible = not _received.is_empty()
	for entry in _box_entries.get_children():
		_box_entries.remove_child(entry)
		entry.queue_free()
	var letters := FamilyText.letters()
	for index in _received.size():
		var id := _received[index]
		var letter: FamilyLetter = letters.get(id)
		var name := FamilyText.child_name(letter) if letter != null else ""
		var entry := _paper_button(BOX_ENTRY.format({"number": index + 1, "name": name}))
		entry.name = "Letter%d" % (index + 1)
		entry.alignment = HORIZONTAL_ALIGNMENT_LEFT
		entry.pressed.connect(open_letter.bind(id))
		_box_entries.add_child(entry)


## Opens the letter with this id as a handwritten page, over the box if that is open.
## Returns false, showing nothing, when the Family text has no such letter.
func open_letter(id: StringName) -> bool:
	var letter: FamilyLetter = FamilyText.letters().get(id)
	if letter == null:
		return false
	_page_text.text = letter.text
	_page.visible = true
	return true


func open_box() -> void:
	_box.visible = true


func is_page_open() -> bool:
	return _page.visible


func is_box_open() -> bool:
	return _box.visible


func page_text() -> String:
	return _page_text.text


func page_font() -> Font:
	return _page_text.get_theme_font(&"font")


func letters_button() -> Button:
	return _box_button


## The box's entries in order, as the player reads them.
func box_entries() -> Array[String]:
	var texts: Array[String] = []
	for entry in _box_entries.get_children():
		texts.append((entry as Button).text)
	return texts


## Scales the letters' text with the player's text size setting.
func scale_text(scale: float) -> void:
	SettingsEffects.scale_text(_root, scale)


func _build_box_button() -> Button:
	var button := _paper_button(LETTERS_BUTTON_TEXT)
	button.name = "LettersButton"
	button.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT, Control.PRESET_MODE_MINSIZE)
	button.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	button.grow_vertical = Control.GROW_DIRECTION_BOTH
	button.offset_right = -MARGIN / 2.0
	button.pressed.connect(open_box)
	return button


func _build_page() -> Control:
	var column := _sheet("LetterPage", PUT_AWAY_TEXT, "PutAway")
	_page_text = _ink_label("")
	_page_text.name = "LetterText"
	_page_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_page_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.get_node("Scroll").add_child(_page_text)
	return column.get_parent().get_parent() as Control


func _build_box() -> Control:
	var column := _sheet("LettersBox", BOX_CLOSE_TEXT, "CloseBox")
	var title := _ink_label(BOX_TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	column.move_child(title, 0)
	_box_entries = VBoxContainer.new()
	_box_entries.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.get_node("Scroll").add_child(_box_entries)
	return column.get_parent().get_parent() as Control


## A sheet of paper over a cover, named `cover_name`: a column holding a scrolling area named
## Scroll and, under it, a button that puts the sheet away. Returns the column; the cover is
## its grandparent.
func _sheet(cover_name: String, close_text: String, close_name: String) -> VBoxContainer:
	var cover := _cover()
	cover.name = cover_name
	var paper := _paper()
	cover.add_child(paper)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	paper.add_child(column)
	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var close := _paper_button(close_text)
	close.name = close_name
	close.size_flags_horizontal = Control.SIZE_SHRINK_END
	close.pressed.connect(cover.hide)
	column.add_child(close)
	return column


## Words in ink, in the handwriting.
func _ink_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override(&"font", HANDWRITING)
	label.add_theme_font_size_override(&"font_size", PAGE_FONT_SIZE)
	label.add_theme_color_override(&"font_color", INK)
	return label


## A dim backdrop over the whole screen that catches every tap.
func _cover() -> Control:
	var cover := Control.new()
	cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cover.mouse_filter = Control.MOUSE_FILTER_STOP
	var backdrop := ColorRect.new()
	backdrop.color = BACKDROP
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cover.add_child(backdrop)
	return cover


## A sheet of plain paper with square corners, tilted a little, in the middle of the screen.
func _paper() -> PanelContainer:
	var paper := PanelContainer.new()
	paper.anchor_left = (1.0 - PAGE_SHARE.x) / 2.0
	paper.anchor_right = 1.0 - paper.anchor_left
	paper.anchor_top = (1.0 - PAGE_SHARE.y) / 2.0
	paper.anchor_bottom = 1.0 - paper.anchor_top
	var style := _paper_style(MARGIN)
	style.shadow_color = Color(0.0, 0.0, 0.0, 0.35)
	style.shadow_size = 6
	paper.add_theme_stylebox_override("panel", style)
	paper.rotation_degrees = PAGE_TILT_DEGREES
	paper.resized.connect(func() -> void: paper.pivot_offset = paper.size / 2.0)
	return paper


## A button written in ink on paper, nothing like The App's bright ones.
func _paper_button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.add_theme_font_override(&"font", HANDWRITING)
	button.add_theme_font_size_override(&"font_size", BUTTON_FONT_SIZE)
	var colours: Array[StringName] = [
		&"font_color", &"font_hover_color", &"font_pressed_color", &"font_focus_color"
	]
	for colour in colours:
		button.add_theme_color_override(colour, INK)
	var style := _paper_style(MARGIN / 2.0)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(state, style)
	return button


## Plain paper with a thin edge and square corners.
func _paper_style(margin: float) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = PAPER
	style.border_color = PAPER_EDGE
	style.set_border_width_all(1)
	style.set_content_margin_all(margin)
	return style
