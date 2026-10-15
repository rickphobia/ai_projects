class_name RisingCount
extends Label
## The "+1" The App shows over a Plot when a pick goes on the crop counter: it rises a little
## from where it starts and fades, then frees itself. With reduced motion it only fades where it
## is. It catches no taps.

const SECONDS := 0.9
## How far it rises before it is gone, in pixels.
const RISE := 70.0

var _still := false


## `still` is reduced motion: it fades without rising.
func _init(still := false) -> void:
	_still = still
	text = AppText.CROP_COUNTED
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme_type_variation = AppLook.COUNT_LABEL


func _ready() -> void:
	# Centred on where it was placed, not hanging from it.
	position -= get_combined_minimum_size() / 2.0
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "modulate:a", 0.0, SECONDS).set_ease(Tween.EASE_IN)
	if not _still:
		tween.tween_property(self, "position:y", position.y - RISE, SECONDS)
	tween.chain().tween_callback(queue_free)
