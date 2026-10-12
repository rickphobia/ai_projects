extends GutTest
## A Disaster's weather on the field: a striking Sandstorm brings dust and fades the sky to
## orange, and it clears once the Sandstorm passes; with reduced motion no dust blows and the
## tint comes at once. A warning alone changes nothing. How it looks is checked by playing.

const CALM_SKY := Color(0.66, 0.62, 0.54)

var _look: DisasterLook
var _environment: Environment


func before_each() -> void:
	_environment = Environment.new()
	_environment.background_color = CALM_SKY
	var sun := DirectionalLight3D.new()
	add_child_autofree(sun)
	_look = DisasterLook.new()
	add_child_autofree(_look)
	_look.setup(_environment, sun)


func _striking() -> DisasterView:
	return DisasterView.new(DisasterView.Phase.STRIKING, Disasters.SANDSTORM, 20.0)


func test_a_warning_alone_changes_nothing() -> void:
	_look.show_disaster(DisasterView.new(DisasterView.Phase.WARNED, Disasters.SANDSTORM, 5.0))

	assert_false(_look.is_blowing_dust())
	_look._process(DisasterLook.FADE_SECONDS)
	assert_eq(_look.strength(), 0.0)


func test_a_sandstorm_blows_dust_and_fades_the_sky_to_orange() -> void:
	_look.show_disaster(_striking())

	assert_true(_look.is_blowing_dust())
	_look._process(DisasterLook.FADE_SECONDS / 2.0)
	assert_almost_eq(_look.strength(), 0.5, 0.001, "halfway in")
	_look._process(DisasterLook.FADE_SECONDS / 2.0)
	assert_eq(_look.strength(), 1.0)
	assert_eq(_environment.background_color, DisasterLook.SANDSTORM_SKY)


func test_it_clears_once_the_sandstorm_passes() -> void:
	_look.show_disaster(_striking())
	_look._process(DisasterLook.FADE_SECONDS)

	_look.show_disaster(DisasterView.new())
	_look._process(DisasterLook.FADE_SECONDS)

	assert_false(_look.is_blowing_dust())
	assert_eq(_look.strength(), 0.0)
	assert_eq(_environment.background_color, CALM_SKY)


func test_with_reduced_motion_a_still_tint_comes_at_once() -> void:
	_look.set_reduced_motion(true)

	_look.show_disaster(_striking())

	assert_false(_look.is_blowing_dust())
	assert_eq(_look.strength(), 1.0)
	assert_eq(_environment.background_color, DisasterLook.SANDSTORM_SKY)


func test_turning_on_reduced_motion_mid_storm_stops_the_dust() -> void:
	_look.show_disaster(_striking())

	_look.set_reduced_motion(true)

	assert_false(_look.is_blowing_dust())
	assert_eq(_look.strength(), 1.0)


func _heatwave() -> DisasterView:
	return DisasterView.new(DisasterView.Phase.STRIKING, Disasters.HEATWAVE, 20.0)


func test_a_heatwave_shimmers_and_fades_to_a_harsh_light() -> void:
	_look.show_disaster(_heatwave())

	assert_true(_look.is_shimmering())
	assert_false(_look.is_blowing_dust())
	_look._process(DisasterLook.FADE_SECONDS)
	assert_eq(_look.heat_strength(), 1.0)
	assert_eq(_environment.background_color, DisasterLook.HEATWAVE_SKY)


func test_it_stops_shimmering_once_the_heatwave_passes() -> void:
	_look.show_disaster(_heatwave())
	_look._process(DisasterLook.FADE_SECONDS)

	_look.show_disaster(DisasterView.new())
	_look._process(DisasterLook.FADE_SECONDS)

	assert_false(_look.is_shimmering())
	assert_eq(_environment.background_color, CALM_SKY)


func test_with_reduced_motion_a_heatwave_is_a_still_tint() -> void:
	_look.set_reduced_motion(true)

	_look.show_disaster(_heatwave())

	assert_false(_look.is_shimmering())
	assert_eq(_look.heat_strength(), 1.0)
	assert_eq(_environment.background_color, DisasterLook.HEATWAVE_SKY)
