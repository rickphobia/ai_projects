class_name PaySlipCard
extends PanelContainer
## The App's pay slip: a bright card in the middle of the screen at the end of each Shift, with
## what the Worker earned, each Bill, and what is left, or the Debt in red. It catches taps only
## on itself, and its button puts it away. It shows what it is given and decides nothing.

const WIDTH := AppLook.SPACE * 90.0

var _title: Label
var _rows: VBoxContainer


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH
	custom_minimum_size = Vector2(WIDTH, 0)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", AppLook.SPACE)
	add_child(column)
	_title = _label(AppLook.TITLE_LABEL)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_title)
	_rows = VBoxContainer.new()
	column.add_child(_rows)
	var close := AppLook.button(AppText.PAY_SLIP_CLOSE)
	close.name = "PaySlipClose"
	close.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	close.pressed.connect(hide)
	column.add_child(close)


## Shows the pay slip from a Farm.PAY_SLIP message's values.
func show_slip(values: Dictionary) -> void:
	var shift: int = values.get("shift", 0)
	_title.text = AppText.PAY_SLIP_TITLE.format({"shift": shift})
	for row in _rows.get_children():
		_rows.remove_child(row)
		row.queue_free()
	var texts := rows(values)
	for index in texts.size():
		var last := index == texts.size() - 1
		var row := _label(AppLook.DEBT_LABEL if last and in_debt(values) else &"")
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.text = texts[index]
		_rows.add_child(row)
	visible = true


func row_texts() -> Array[String]:
	var texts: Array[String] = []
	for row in _rows.get_children():
		texts.append((row as Label).text)
	return texts


## The slip's lines under its title: earned, each Bill in the order charged, then what is left,
## or the Debt when the balance is below zero.
static func rows(values: Dictionary) -> Array[String]:
	var balance: int = values.get("balance", 0)
	var last := AppText.PAY_SLIP_LEFT.format({"points": balance})
	if balance < 0:
		last = AppText.PAY_SLIP_DEBT.format({"debt": -balance})
	var texts: Array[String] = [
		AppText.PAY_SLIP_EARNED.format(values),
		AppText.PAY_SLIP_ELECTRICITY.format(values),
		AppText.PAY_SLIP_RENT.format(values),
	]
	var school_fees: int = values.get("school_fees", 0)
	if school_fees > 0:
		texts.append(AppText.PAY_SLIP_SCHOOL_FEES.format(values))
	texts.append(last)
	return texts


static func in_debt(values: Dictionary) -> bool:
	var balance: int = values.get("balance", 0)
	return balance < 0


func _label(variation: StringName) -> Label:
	var label := Label.new()
	label.theme_type_variation = variation
	return label
