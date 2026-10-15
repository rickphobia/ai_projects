class_name BalanceBadge
extends PanelContainer
## The Worker's Labour Points on The App's top bar, or his Debt in their place on red while he
## owes any. It shows what it is given and catches no taps.

var _label: Label


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = Label.new()
	_label.theme_type_variation = AppLook.BAR_LABEL
	add_child(_label)
	theme_type_variation = AppLook.BADGE_PANEL


## Labour Points and Debt are never both above zero, so it shows whichever is.
func show_balance(labour_points: int, debt: int) -> void:
	if debt > 0:
		_label.text = AppText.DEBT.format({"debt": debt})
		theme_type_variation = AppLook.DEBT_BADGE_PANEL
	else:
		_label.text = AppText.LABOUR_POINTS.format({"points": labour_points})
		theme_type_variation = AppLook.BADGE_PANEL


func shows_debt() -> bool:
	return theme_type_variation == AppLook.DEBT_BADGE_PANEL
