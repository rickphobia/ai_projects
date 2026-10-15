class_name DisasterBanner
extends PanelContainer
## The Disaster countdown under The App's top bar: what is coming and how soon once The App has
## warned of it, then how long it has left while it strikes. Hidden with no Disaster to show.
## It shows what it is given and catches no taps.

var _label: Label


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = Label.new()
	_label.theme_type_variation = AppLook.BAR_LABEL
	add_child(_label)
	visible = false


func show_disaster(disaster: DisasterView) -> void:
	if disaster.phase == DisasterView.Phase.NONE:
		visible = false
		return
	var warned := disaster.phase == DisasterView.Phase.WARNED
	var shown := {
		"name": AppText.DISASTER_NAMES.get(disaster.kind, String(disaster.kind)),
		"time": AppOverlay.clock_text(disaster.seconds_left),
	}
	_label.text = (AppText.DISASTER_WARNED if warned else AppText.DISASTER_STRIKING).format(shown)
	theme_type_variation = AppLook.WARNED_PANEL if warned else AppLook.STRIKING_PANEL
	visible = true


func text() -> String:
	return _label.text
