extends GutTest
## The App's Disaster countdown under the top bar: hidden with none, the time until it strikes
## once warned of, then the time it has left.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func _banner() -> DisasterBanner:
	return _overlay.find_child("DisasterBanner", true, false) as DisasterBanner


func _show(disaster: DisasterView) -> void:
	_overlay.show_shift(ShiftView.new(2, 12, 5, 90.0, 3, false, disaster), 30)


func test_with_no_disaster_there_is_no_banner() -> void:
	_show(DisasterView.new())

	assert_false(_banner().visible)


func test_a_warning_counts_down_to_the_strike() -> void:
	_show(DisasterView.new(DisasterView.Phase.WARNED, Farm.SANDSTORM, 9.5))

	assert_true(_banner().visible)
	assert_eq(_banner().text(), "Sandstorm in 0:10!")


func test_a_striking_disaster_counts_down_to_its_end() -> void:
	_show(DisasterView.new(DisasterView.Phase.STRIKING, Farm.SANDSTORM, 75.0))

	assert_eq(_banner().text(), "Sandstorm!  ·  1:15 left")


func test_the_banner_goes_when_it_passes() -> void:
	_show(DisasterView.new(DisasterView.Phase.STRIKING, Farm.SANDSTORM, 1.0))

	_show(DisasterView.new())

	assert_false(_banner().visible)
