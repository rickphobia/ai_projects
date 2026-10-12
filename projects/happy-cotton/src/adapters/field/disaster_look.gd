class_name DisasterLook
extends Node3D
## The weather a Disaster brings to the field. A Sandstorm turns the sky orange, closes the haze
## in round the field, dims and reddens the sun and blows dust across the field; it fades in as
## it strikes and out as it passes. With reduced motion nothing moves: no dust blows and the
## change comes and goes at once, a still orange tint. It shows the Disaster it is given and
## knows nothing of the rules.

## The sky and haze in a Sandstorm, and the sun through it.
const SANDSTORM_SKY := Color(0.84, 0.5, 0.22)
const SANDSTORM_AMBIENT := Color(0.72, 0.48, 0.3)
const SANDSTORM_SUN := Color(1.0, 0.62, 0.34)
const SANDSTORM_SUN_ENERGY := 0.8
## Where the haze starts and turns solid, in metres from the camera: close enough to swallow
## the far side of the track.
const SANDSTORM_FOG_BEGIN := 3.0
const SANDSTORM_FOG_END := 18.0
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
var _dust: CPUParticles3D
var _reduced_motion := false


func _ready() -> void:
	_dust = _build_dust()
	add_child(_dust)


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
	var sandstorm := (
		disaster.phase == DisasterView.Phase.STRIKING and disaster.kind == Farm.SANDSTORM
	)
	_target = 1.0 if sandstorm else 0.0
	_update_dust()
	if _reduced_motion:
		_strength = _target
		_apply()


func set_reduced_motion(on: bool) -> void:
	_reduced_motion = on
	_update_dust()
	if on:
		_strength = _target
		_apply()


func is_blowing_dust() -> bool:
	return _dust.emitting


## From 0 (calm) to 1 (the full Sandstorm look).
func strength() -> float:
	return _strength


func _process(delta: float) -> void:
	if is_equal_approx(_strength, _target):
		return
	_strength = move_toward(_strength, _target, delta / FADE_SECONDS)
	_apply()


func _update_dust() -> void:
	_dust.emitting = _target > 0.0 and not _reduced_motion


func _apply() -> void:
	if _environment == null:
		return
	_environment.background_color = _calm_sky.lerp(SANDSTORM_SKY, _strength)
	_environment.fog_light_color = _calm_fog.lerp(SANDSTORM_SKY, _strength)
	_environment.ambient_light_color = _calm_ambient.lerp(SANDSTORM_AMBIENT, _strength)
	_environment.fog_depth_begin = lerpf(_calm_fog_begin, SANDSTORM_FOG_BEGIN, _strength)
	_environment.fog_depth_end = lerpf(_calm_fog_end, SANDSTORM_FOG_END, _strength)
	_sun.light_color = _calm_sun.lerp(SANDSTORM_SUN, _strength)
	_sun.light_energy = lerpf(_calm_sun_energy, SANDSTORM_SUN_ENERGY, _strength)


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
