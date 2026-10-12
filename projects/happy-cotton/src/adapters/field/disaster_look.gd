class_name DisasterLook
extends Node3D
## The weather a Disaster brings to the field. A Sandstorm turns the sky orange, closes the haze
## in round the field, dims and reddens the sun and blows dust across the field; it fades in as
## it strikes and out as it passes. A Heatwave bleaches the sky, brightens and whitens the sun
## and sets the air above the field shimmering. With reduced motion nothing moves: no dust blows,
## nothing shimmers and the change comes and goes at once, a still tint. It shows the Disaster
## it is given and knows nothing of the rules.

## The sky and haze in a Sandstorm, and the sun through it.
const SANDSTORM_SKY := Color(0.84, 0.5, 0.22)
const SANDSTORM_AMBIENT := Color(0.72, 0.48, 0.3)
const SANDSTORM_SUN := Color(1.0, 0.62, 0.34)
const SANDSTORM_SUN_ENERGY := 0.8
## Where the haze starts and turns solid, in metres from the camera: close enough to swallow
## the far side of the track.
const SANDSTORM_FOG_BEGIN := 3.0
const SANDSTORM_FOG_END := 18.0
## The bleached sky and harsh sun of a Heatwave.
const HEATWAVE_SKY := Color(0.93, 0.88, 0.7)
const HEATWAVE_AMBIENT := Color(0.95, 0.85, 0.65)
const HEATWAVE_SUN := Color(1.0, 0.97, 0.86)
const HEATWAVE_SUN_ENERGY := 1.8
## The shimmer: a sheet over the field that wobbles what is seen through it.
const SHIMMER_SIZE := Vector2(16.0, 12.0)
const SHIMMER_CENTRE := Vector3(-4.0, 0.6, 0.0)
const SHIMMER_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform sampler2D screen : hint_screen_texture, filter_linear;
uniform float strength = 0.0;
void fragment() {
	vec2 wobble = vec2(sin(SCREEN_UV.y * 90.0 + TIME * 6.0), cos(SCREEN_UV.x * 70.0 + TIME * 5.0));
	ALBEDO = texture(screen, SCREEN_UV + wobble * 0.003 * strength).rgb;
	ALPHA = strength;
}
"""
## How long the weather takes to come in and to clear, in seconds.
const FADE_SECONDS := 3.0
## The blowing dust: grains from a box over the field and the track, blown along x.
const DUST_COLOUR := Color(0.82, 0.62, 0.38, 0.7)
const DUST_AMOUNT := 600
const DUST_GRAIN_SIZE := 0.07
const DUST_LIFETIME := 2.5
const DUST_BOX := Vector3(16.0, 1.5, 12.0)
const DUST_CENTRE := Vector3(-4.0, 1.2, 0.0)
const DUST_SPEED_LOWEST := 5.0
const DUST_SPEED_HIGHEST := 9.0

var _environment: Environment
var _sun: DirectionalLight3D
## The scene's own sky, haze and sun, shown with no Disaster.
var _calm_sky: Color
var _calm_fog: Color
var _calm_ambient: Color
var _calm_fog_begin: float
var _calm_fog_end: float
var _calm_sun: Color
var _calm_sun_energy: float
## How far the Sandstorm's look is in, from 0 (calm) to 1, and where it is heading.
var _strength := 0.0
var _target := 0.0
## The same for the Heatwave's.
var _heat_strength := 0.0
var _heat_target := 0.0
var _dust: CPUParticles3D
var _shimmer: MeshInstance3D
var _reduced_motion := false


func _ready() -> void:
	_dust = _build_dust()
	add_child(_dust)
	_shimmer = _build_shimmer()
	add_child(_shimmer)


## The field's environment and sun, whose calm look is kept to come back to.
func setup(environment: Environment, sun: DirectionalLight3D) -> void:
	_environment = environment
	_sun = sun
	_calm_sky = environment.background_color
	_calm_fog = environment.fog_light_color
	_calm_ambient = environment.ambient_light_color
	_calm_fog_begin = environment.fog_depth_begin
	_calm_fog_end = environment.fog_depth_end
	_calm_sun = sun.light_color
	_calm_sun_energy = sun.light_energy


func show_disaster(disaster: DisasterView) -> void:
	var striking := disaster.phase == DisasterView.Phase.STRIKING
	_target = 1.0 if striking and disaster.kind == Farm.SANDSTORM else 0.0
	_heat_target = 1.0 if striking and disaster.kind == Farm.HEATWAVE else 0.0
	_update_motion()
	if _reduced_motion:
		_settle()


func set_reduced_motion(on: bool) -> void:
	_reduced_motion = on
	_update_motion()
	if on:
		_settle()


func is_blowing_dust() -> bool:
	return _dust.emitting


func is_shimmering() -> bool:
	return _shimmer.visible


## From 0 (calm) to 1 (the full Sandstorm look).
func strength() -> float:
	return _strength


## From 0 (calm) to 1 (the full Heatwave look).
func heat_strength() -> float:
	return _heat_strength


func _process(delta: float) -> void:
	if is_equal_approx(_strength, _target) and is_equal_approx(_heat_strength, _heat_target):
		return
	_strength = move_toward(_strength, _target, delta / FADE_SECONDS)
	_heat_strength = move_toward(_heat_strength, _heat_target, delta / FADE_SECONDS)
	_apply()


func _settle() -> void:
	_strength = _target
	_heat_strength = _heat_target
	_apply()


func _update_motion() -> void:
	_dust.emitting = _target > 0.0 and not _reduced_motion
	# Shown while fading out too, so the shimmer dies away with the light.
	_shimmer.visible = (_heat_target > 0.0 or _heat_strength > 0.0) and not _reduced_motion


func _apply() -> void:
	if _environment == null:
		return
	# At most one Disaster strikes at a time, so the two looks never truly mix.
	var sky := _calm_sky.lerp(SANDSTORM_SKY, _strength).lerp(HEATWAVE_SKY, _heat_strength)
	_environment.background_color = sky
	_environment.fog_light_color = (_calm_fog.lerp(SANDSTORM_SKY, _strength).lerp(
		HEATWAVE_SKY, _heat_strength
	))
	_environment.ambient_light_color = (_calm_ambient.lerp(SANDSTORM_AMBIENT, _strength).lerp(
		HEATWAVE_AMBIENT, _heat_strength
	))
	_environment.fog_depth_begin = lerpf(_calm_fog_begin, SANDSTORM_FOG_BEGIN, _strength)
	_environment.fog_depth_end = lerpf(_calm_fog_end, SANDSTORM_FOG_END, _strength)
	_sun.light_color = _calm_sun.lerp(SANDSTORM_SUN, _strength).lerp(HEATWAVE_SUN, _heat_strength)
	_sun.light_energy = lerpf(
		lerpf(_calm_sun_energy, SANDSTORM_SUN_ENERGY, _strength),
		HEATWAVE_SUN_ENERGY,
		_heat_strength
	)
	var material := _shimmer.material_override as ShaderMaterial
	material.set_shader_parameter("strength", _heat_strength)
	if is_zero_approx(_heat_strength) and is_zero_approx(_heat_target):
		_shimmer.visible = false


func _build_shimmer() -> MeshInstance3D:
	var sheet := MeshInstance3D.new()
	sheet.name = "Shimmer"
	sheet.visible = false
	sheet.position = SHIMMER_CENTRE
	sheet.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var plane := PlaneMesh.new()
	plane.size = SHIMMER_SIZE
	sheet.mesh = plane
	var shader := Shader.new()
	shader.code = SHIMMER_SHADER
	var material := ShaderMaterial.new()
	material.shader = shader
	sheet.material_override = material
	return sheet


func _build_dust() -> CPUParticles3D:
	var dust := CPUParticles3D.new()
	dust.name = "Dust"
	dust.emitting = false
	dust.amount = DUST_AMOUNT
	dust.lifetime = DUST_LIFETIME
	dust.position = DUST_CENTRE
	dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	dust.emission_box_extents = DUST_BOX / 2.0
	dust.direction = Vector3(1.0, 0.05, 0.2)
	dust.spread = 8.0
	dust.gravity = Vector3.ZERO
	dust.initial_velocity_min = DUST_SPEED_LOWEST
	dust.initial_velocity_max = DUST_SPEED_HIGHEST
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	material.albedo_color = DUST_COLOUR
	var grain := QuadMesh.new()
	grain.size = Vector2(DUST_GRAIN_SIZE, DUST_GRAIN_SIZE)
	grain.material = material
	dust.mesh = grain
	return dust
