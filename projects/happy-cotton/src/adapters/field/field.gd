class_name Field
extends Node3D
## The field the Worker works: a fenced grid of plots seen from a fixed, angled camera, with
## the Worker beside it, a track around the fence paved with power tiles (see PowerTiles) and
## the Generator at the track's corner, outside the fence's gate. Shows each plot's growth
## stage as a cotton plant (see CropLooks), shows the time left on a growing plot, shows the
## Worker walking out to the track and running laps of it (see WorkerMotion), lights the tile
## under each of his steps, shows the Overseer beside the Generator whistling and whipping
## when the rules say so (see OverseerLook), shows the Worker's tools on a rack by the
## Generator at their Upgrade tier (see ToolRack), plays the field's sounds (see FieldSounds), and
## reports which plot, or the Generator, was tapped. Knows nothing of the rules beyond the
## views and events it is shown. Nothing of the Farm is built until show_land() gives it the
## land: the plots, unworked ground, fence and track follow the land's cells and edges, and
## are built again, with the camera's limits, each time the land grows.
##
## Dragging pans the camera and pinching or the mouse wheel zooms it (within FieldCamera's
## limits); a tap counts on release, only if the pointer barely moved (PointerGesture).
## Touches are read as touches, so a pinch's two fingers can be told apart; the left clicks
## Godot makes up from a touch (emulate_mouse_from_touch, kept on so The App's buttons work
## with touch) are ignored here. Input reaches this only after The App's controls pass on it.

signal plot_tapped(index: int)
signal generator_tapped

## Plots are raised beds this tall, in metres, centred on the ground.
const SOIL_HEIGHT := 0.1
## Tilled soil: the dust texture, darker.
const SOIL_COLOUR := Color(0.42, 0.34, 0.27)
## Unworked ground inside the fence: hard, pale, flat earth, barely above the dust.
const UNWORKED_COLOUR := Color(0.62, 0.55, 0.45)
const UNWORKED_HEIGHT := 0.02
const SOIL_TEXTURE := preload("res://assets/polyhaven/dry_ground_01_diff_1k.jpg")
## How far a finger or the mouse may move between press and release, in viewport units
## (the 1280x720 base size, whatever the screen), and still count as a tap.
const TAP_SLOP := 12.0
## How far the view pans for a drag, as a share of the drag: below 1 the ground slides
## slower than the finger, so a short drag never flings the view across the field.
const PAN_SPEED := 0.6
## The pointer id the mouse uses in a gesture; touch fingers are numbered from 0.
const MOUSE_POINTER := -2
## Where the Overseer stands from the lap line: outside the track, by the loudspeaker pole,
## watching the lap line where the Worker stops.
const OVERSEER_SPOT := Vector3(-1.9, 0.0, -1.7)
## Where the tool rack stands, from the Generator: beyond its pump, away from the Overseer.
const TOOL_RACK_SPOT := Vector3(-2.2, 0.0, 2.4)
## Where the weighing scale stands, from the Generator: outside the track by the gate, between
## the Overseer and the tool rack.
const SCALE_SPOT := Vector3(-2.4, 0.0, 0.4)
## Where the Overseer stands to watch the scale, from the scale: behind it, facing the gate.
const SCALE_WATCH_SPOT := Vector3(-0.8, 0.0, 0.0)
## How much colour is left in the world when the Worker is fully exhausted: nearly grey.
const DRAINED_SATURATION := 0.1

## Where the front-left plot's centre sits. Land added later grows to the right and the back
## from here, so the gate, the Generator and the starting view never move; the first 4 × 3
## land sits centred on the scene's origin, where the camera starts.
@export var front_left_plot := Vector3(-3.6, 0.0, 2.4)
@export var spacing := 2.4
@export var plot_size := 2.0
## How long the time-left label stays up after a tap, in seconds.
@export var time_left_shown_seconds := 3.0
## The fence's distance from the outer plots' edges, in metres.
@export var fence_margin := 1.6
## The track's centre line's distance outside the fence, its width, and how round its corners
## are, in metres.
@export var track_gap := 1.3
@export var track_width := 1.6
@export var track_corner_radius := 1.6
## Where the gate in the fence's left side is, front to back (z); the lap line crosses the
## track outside it. Must fall between the track's corners.
@export var gate_z := 4.0
## How far inside the fence he steps on his way through the gate, in metres.
@export var gate_inside := 0.6

var _grid: PlotGrid
var _crop_looks := CropLooks.new()
var _crops: Array[Node3D] = []
var _shown_stages: Array[PlotView.Stage] = []
var _labelled_plot := -1
var _label_seconds_remaining := 0.0
var _gesture := PointerGesture.new(TAP_SLOP)
## Null until show_land(); the field ignores input and frames until then.
var _worker: WorkerMotion
var _overseer: OverseerLook
var _sounds := FieldSounds.new()
var _track: TrackPath
var _tiles: PowerTiles
var _view: FieldCamera
var _tool_rack := ToolRack.new()
var _scale := WeighingScale.new()
var _overseer_body: Node3D
## The unit vector from the ground back to the camera: the camera's fixed angle.
var _camera_back: Vector3
## The scene's own colour saturation, shown while he is rested.
var _full_saturation: float
## Kept for the Worker, the power tiles and the lamp, which show_land() makes.
var _reduced_motion := false

@onready var _camera: Camera3D = $Camera
@onready var _haze: WorldEnvironment = $Haze
@onready var _time_left: Label3D = $TimeLeft
@onready var _generator: Generator = $Generator


func _ready() -> void:
	# Its own copy: the scene's environment is shared by every instance of the scene.
	_haze.environment = _haze.environment.duplicate()
	_full_saturation = _haze.environment.adjustment_saturation
	add_child(_sounds)
	_time_left.visible = false


## Builds the plots, unworked ground, fence and track from the Farm's land. The first time,
## before anything is shown, it also places the Generator, the tool rack, the Worker, the
## Overseer and the camera round them. Each later call is the land grown: the new plots are
## added, the fence and track move out (the gate, lap line and Generator stay put), the Worker
## keeps his share of the lap, and the camera's limits follow the track.
func show_land(land: LandView) -> void:
	var first_time := _grid == null
	_grid = PlotGrid.new(land, front_left_plot, spacing, plot_size)
	_add_plots()
	_replace(_unworked_ground())
	var fence_bounds := _grid.bounds().grow(fence_margin)
	_replace(FenceLook.build(fence_bounds, gate_z))
	_track = TrackPath.new(fence_bounds.grow(track_gap), track_corner_radius, gate_z)
	_replace(TrackLook.build(_track, track_width))
	_tiles = PowerTiles.new(_track, track_width)
	_tiles.name = "PowerTiles"
	_replace(_tiles)
	if first_time:
		_place_round_the_land(fence_bounds)
	else:
		_worker.follow_track(_track)
		_view.follow(_track_reach())
		_place_camera()
	set_reduced_motion(_reduced_motion)


## Swaps a part of the land's look for its new build, by name, freeing the old one.
func _replace(part: Node3D) -> void:
	var old := get_node_or_null(NodePath(part.name))
	if old != null:
		remove_child(old)
		old.queue_free()
	add_child(part)


## The Generator, tool rack, camera, Worker and Overseer, placed once round the first land.
func _place_round_the_land(fence_bounds: Rect2) -> void:
	_generator.position = _track.point_at(0.0)
	_tool_rack.name = "ToolRack"
	_tool_rack.position = _generator.position + TOOL_RACK_SPOT
	add_child(_tool_rack)
	_scale.name = "WeighingScale"
	_scale.position = _generator.position + SCALE_SPOT
	add_child(_scale)
	_start_camera()
	_start_worker(Vector3(fence_bounds.position.x + gate_inside, 0.0, gate_z))
	_start_overseer()
	_worker.stepped.connect(_on_worker_stepped)


## Adds a plot for each of the grid's plots not shown yet; plots never move once added.
func _add_plots() -> void:
	var soil := BoxMesh.new()
	soil.size = Vector3(plot_size, SOIL_HEIGHT, plot_size)
	var soil_material := _material(SOIL_COLOUR)
	soil_material.albedo_texture = SOIL_TEXTURE
	soil.material = soil_material
	for index in range(_crops.size(), _grid.count()):
		var plot := Node3D.new()
		plot.name = "Plot%d" % index
		plot.position = _grid.centre_of(index)
		var soil_instance := MeshInstance3D.new()
		soil_instance.mesh = soil
		plot.add_child(soil_instance)
		var crop := Node3D.new()
		crop.position.y = SOIL_HEIGHT / 2.0
		plot.add_child(crop)
		_crops.append(crop)
		_shown_stages.append(PlotView.Stage.EMPTY)
		add_child(plot)


## A flat patch of hard ground in each cell of the land with no plot yet.
func _unworked_ground() -> Node3D:
	var ground := Node3D.new()
	ground.name = "UnworkedGround"
	var patch := BoxMesh.new()
	patch.size = Vector3(plot_size, UNWORKED_HEIGHT, plot_size)
	patch.material = _material(UNWORKED_COLOUR)
	for centre in _grid.unworked_centres():
		var cell := MeshInstance3D.new()
		cell.mesh = patch
		cell.position = centre
		ground.add_child(cell)
	return ground


## The track's centre line, round the fence.
func track() -> TrackPath:
	return _track


## Redraws every plot from the rules' views, and keeps the time-left label current.
func show_plots(views: Array[PlotView]) -> void:
	for index in views.size():
		var stage := views[index].stage
		if stage == _shown_stages[index]:
			continue
		_shown_stages[index] = stage
		var crop := _crops[index]
		for old_look in crop.get_children():
			old_look.queue_free()
		crop.add_child(_crop_looks.build(stage))
	if _labelled_plot >= 0:
		var labelled := views[_labelled_plot]
		if labelled.seconds_left <= 0.0:
			_hide_time_left()
		else:
			_time_left.text = time_left_text(labelled.seconds_left)


## Shows the Worker where the rules put him, lights the loudspeaker while he runs, and drains
## the world's colour as his Exhaustion rises.
func show_worker(view: WorkerView) -> void:
	_worker.show(view)
	_generator.set_lit(view.activity == WorkerView.Activity.RUNNING)
	_haze.environment.adjustment_saturation = saturation_for(view.exhaustion, _full_saturation)


## Shows the Generator Upgrade tier owned, from 0 (none).
func show_generator_tier(tier: int) -> void:
	_generator.show_tier(tier)


## Shows the tools Upgrade tier owned, from 0 (none).
func show_tools_tier(tier: int) -> void:
	_tool_rack.show_tier(tier)


## Reduced motion: the Worker neither slumps nor staggers, the power tiles' trail goes dark
## at once instead of fading and the lamp doesn't pulse. The colour drain stays, as it only
## follows his Exhaustion and never moves on screen; so do the sounds.
func set_reduced_motion(on: bool) -> void:
	_reduced_motion = on
	if _worker == null:
		return
	_worker.skip_slump = on
	_worker.skip_stagger = on
	_tiles.instant_fade = on
	_generator.skip_pulse = on


## The Overseer acts on an event from the rules (Farm.OVERSEER_WHISTLE or OVERSEER_WHIP): he
## blows his whistle, or cracks the whip and the Worker flinches and staggers. The camera
## stays where the player put it.
func show_overseer(event: StringName) -> void:
	match event:
		Farm.OVERSEER_WHISTLE:
			_overseer.blow_whistle()
			_sounds.whistle()
		Farm.OVERSEER_WHIP:
			_overseer.crack_whip()
			_sounds.whip_crack()
			_worker.flinch()
		_:
			GameLog.warning("unknown overseer event", {"event": event})


## The audit's tell: with an audit coming the Overseer stands by the weighing scale, watching
## it; otherwise he stands by the Generator.
func show_audit_tell(watching: bool) -> void:
	if _overseer_body == null:
		return
	var spot := _scale.position + SCALE_WATCH_SPOT if watching else _overseer_spot()
	if _overseer_body.position.is_equal_approx(spot):
		return
	_overseer_body.position = spot
	var facing := _scale.position if watching else _generator.position
	_overseer_body.rotation.y = atan2(facing.x - spot.x, facing.z - spot.z)
	GameLog.debug("overseer watching the scale", {"watching": watching})


func is_overseer_at_the_scale() -> bool:
	return (
		_overseer_body != null
		and _overseer_body.position.is_equal_approx(_scale.position + SCALE_WATCH_SPOT)
	)


## The field's colour saturation at some Exhaustion: the scene's own when rested, falling
## evenly to DRAINED_SATURATION when spent.
static func saturation_for(exhaustion: float, full_saturation: float) -> float:
	return lerpf(full_saturation, DRAINED_SATURATION, exhaustion / Exhaustion.MOST)


## Shows how long a growing plot has left, above the plot, for a few seconds.
func show_time_left(index: int, seconds_left: float) -> void:
	_labelled_plot = index
	_label_seconds_remaining = time_left_shown_seconds
	_time_left.position = _grid.centre_of(index) + Vector3(0.0, 1.4, 0.0)
	_time_left.text = time_left_text(seconds_left)
	_time_left.visible = true


## Where plot `index` is on the screen, for The App to show something rising from it.
func plot_screen_position(index: int) -> Vector2:
	return _camera.unproject_position(to_global(_grid.centre_of(index)))


## "2:05 left": whole seconds rounded up, so the label never shows 0:00 on a growing plot.
static func time_left_text(seconds_left: float) -> String:
	var whole := ceili(seconds_left)
	return "%d:%02d left" % [floori(whole / 60.0), whole % 60]


func _process(delta: float) -> void:
	if _worker == null:
		return
	_worker.update(delta)
	_sounds.set_generator_speed(_worker.track_speed())
	if _labelled_plot < 0:
		return
	_label_seconds_remaining -= delta
	if _label_seconds_remaining <= 0.0:
		_hide_time_left()


func _unhandled_input(event: InputEvent) -> void:
	if _worker == null:
		return
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		_on_pointer_button(touch.index, touch.position, touch.pressed, touch.canceled)
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		_move_pointer(drag.index, drag.position)
	elif event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	elif event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		if click.button_index == MOUSE_BUTTON_LEFT:
			_on_pointer_button(MOUSE_POINTER, click.position, click.pressed, false)
		elif click.pressed and click.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom_at(click.position, 1.0 / FieldCamera.WHEEL_ZOOM_STEP)
		elif click.pressed and click.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom_at(click.position, FieldCamera.WHEEL_ZOOM_STEP)
		else:
			return
	elif event is InputEventMouseMotion:
		if not _gesture.is_pressed(MOUSE_POINTER):
			return
		_move_pointer(MOUSE_POINTER, (event as InputEventMouseMotion).position)
	else:
		return
	get_viewport().set_input_as_handled()


func _on_pointer_button(pointer: int, position: Vector2, pressed: bool, canceled: bool) -> void:
	if pressed:
		_gesture.press(pointer, position)
	elif canceled:
		_gesture.cancel(pointer)
	elif _gesture.release(pointer):
		var ground_point := _ground_under(position)
		if not ground_point.is_finite():
			return
		var index := _grid.index_at(ground_point)
		if index >= 0:
			plot_tapped.emit(index)
		elif _generator.covers(ground_point):
			generator_tapped.emit()


## One finger or the mouse pans gently (see _pan); two fingers pan by their midpoint and
## zoom by how much their spread changed, towards the point between them.
func _move_pointer(pointer: int, position: Vector2) -> void:
	var midpoint_before := _gesture.midpoint()
	var spread_before := _gesture.spread()
	_gesture.move(pointer, position)
	var spread_after := _gesture.spread()
	if spread_before > 0.0 and spread_after > 0.0:
		_pan_holding(midpoint_before, _gesture.midpoint())
		_zoom_at(_gesture.midpoint(), spread_before / spread_after)
	else:
		_pan(_gesture.midpoint() - midpoint_before)


## Slides the camera by a drag across the screen. The drag is measured on the ground at the
## middle of the screen, not under the finger: the camera is tilted, so ground near the top
## is far away and a drag there would fling the view many metres.
func _pan(screen_drag: Vector2) -> void:
	var centre := get_viewport().get_visible_rect().size / 2.0
	_pan_holding(centre, centre + screen_drag * PAN_SPEED)


## Slides the camera so the ground under one screen point moves exactly to another. A pinch
## pans this way: its fingers move one at a time, so its midpoint wobbles, and only an exact
## pan undoes the wobble.
func _pan_holding(from_screen: Vector2, to_screen: Vector2) -> void:
	var from_ground := _ground_under(from_screen)
	var to_ground := _ground_under(to_screen)
	if not from_ground.is_finite() or not to_ground.is_finite():
		return
	var offset := from_ground - to_ground
	_view.pan(Vector2(offset.x, offset.z))
	_place_camera()


## Zooms by a factor while keeping the ground under a screen point where it is.
func _zoom_at(screen_position: Vector2, factor: float) -> void:
	var anchor := _ground_under(screen_position)
	_view.zoom_by(factor)
	_place_camera()
	var drifted := _ground_under(screen_position)
	if not anchor.is_finite() or not drifted.is_finite():
		return
	var offset := anchor - drifted
	_view.pan(Vector2(offset.x, offset.z))
	_place_camera()


## Where the camera ray through a screen position meets the ground (y = 0); not finite when
## the ray never comes down to it.
func _ground_under(screen_position: Vector2) -> Vector3:
	var origin := _camera.project_ray_origin(screen_position)
	var direction := _camera.project_ray_normal(screen_position)
	if direction.y >= 0.0:
		return Vector3(INF, INF, INF)
	return origin + direction * (-origin.y / direction.y)


## The camera starts where the scene puts it; from then on it keeps that angle and only
## slides and zooms along it, over the field and the track around it.
func _start_camera() -> void:
	_camera_back = _camera.transform.basis.z.normalized()
	var start_distance := _camera.position.y / _camera_back.y
	var start_focus := _camera.position - _camera_back * start_distance
	_view = FieldCamera.new(Vector2(start_focus.x, start_focus.z), start_distance, _track_reach())
	_place_camera()


## The ground the camera may look over: the track, out to its outer edge.
func _track_reach() -> Rect2:
	var half_size := _track.half_size + Vector2.ONE * track_width / 2.0
	return Rect2(_track.centre - half_size, half_size * 2.0)


## How far the camera may pull back now, in metres; it grows with the Farm.
func farthest_zoom() -> float:
	return _view.far_distance


## The ground the camera may look over, on the ground plane (x, z).
func camera_reach() -> Rect2:
	return _view.reach


func _place_camera() -> void:
	_camera.position = _view.position_along(_camera_back)


func _hide_time_left() -> void:
	_labelled_plot = -1
	_time_left.visible = false


## `gate` is where he steps through the gate, just inside the fence.
func _start_worker(gate: Vector3) -> void:
	var body: Node3D = $Worker
	var player := _animation_player_of(body, "worker")
	_worker = WorkerMotion.new(body, player, _track, gate)


## A footstep on the track: you hear it, and the tile under it lights, ticks and pulses the
## lamp (which only pulses while he runs).
func _on_worker_stepped(foot: Vector3) -> void:
	_sounds.footstep()
	if _tiles.light_at(foot):
		_sounds.tile_tick()
		_generator.pulse()


func _start_overseer() -> void:
	var body: Node3D = $Overseer
	_overseer_body = body
	body.position = _overseer_spot()
	body.rotation.y = atan2(-OVERSEER_SPOT.x, -OVERSEER_SPOT.z)
	var player := _animation_player_of(body, "overseer")
	_overseer = OverseerLook.new(body, player)


func _overseer_spot() -> Vector3:
	return _generator.position + OVERSEER_SPOT


## The model's animation player, or null (with a warning) if it has none: he then moves
## without animating.
func _animation_player_of(body: Node3D, who: String) -> AnimationPlayer:
	var animation_players := body.find_children("*", "AnimationPlayer", true, false)
	if animation_players.is_empty():
		GameLog.warning("%s has no animation player" % who)
		return null
	return animation_players[0] as AnimationPlayer


func _material(colour: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	material.roughness = 1.0
	return material
