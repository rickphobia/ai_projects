extends GutTest
## Taps, drags, pinches and the mouse wheel on the field scene: only a tap reaches a plot or
## the Generator, and moving the view keeps the camera's angle.

const FIELD_SCENE := preload("res://src/adapters/field/field.tscn")
const VIEW_SIZE := Vector2i(1280, 720)
const PLOT := 5

var _viewport: SubViewport
var _field: Field
var _camera: Camera3D
var _tapped: Array[int] = []
var _generator_taps := 0


func before_each() -> void:
	_tapped = []
	_generator_taps = 0
	_viewport = SubViewport.new()
	_viewport.size = VIEW_SIZE
	add_child_autofree(_viewport)
	_field = FIELD_SCENE.instantiate()
	_viewport.add_child(_field)
	_field.show_land(FieldLand.first())
	_camera = _field.get_node("Camera")
	_field.plot_tapped.connect(func(index: int) -> void: _tapped.append(index))
	_field.generator_tapped.connect(func() -> void: _generator_taps += 1)
	await wait_process_frames(1)


func _plot_on_screen(index: int) -> Vector2:
	var grid := PlotGrid.new(
		FieldLand.first(), _field.front_left_plot, _field.spacing, _field.plot_size
	)
	return _camera.unproject_position(grid.centre_of(index))


func _generator_on_screen() -> Vector2:
	var generator: Node3D = _field.get_node("Generator")
	var on_screen := _camera.unproject_position(generator.position)
	assert_true(Rect2(Vector2.ZERO, VIEW_SIZE).has_point(on_screen), "the Generator is in view")
	return on_screen


func _mouse_button(button: MouseButton, position: Vector2, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.button_index = button
	event.position = position
	event.pressed = pressed
	_viewport.push_input(event)


func _mouse_drag(position: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.position = position
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	_viewport.push_input(event)


func _touch(finger: int, position: Vector2, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = finger
	event.position = position
	event.pressed = pressed
	_viewport.push_input(event)


func _touch_drag(finger: int, position: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = finger
	event.position = position
	_viewport.push_input(event)


func test_a_click_on_a_plot_taps_it_on_release() -> void:
	var plot := _plot_on_screen(PLOT)
	_mouse_button(MOUSE_BUTTON_LEFT, plot, true)
	assert_eq(_tapped, [] as Array[int], "nothing happens on the press")
	_mouse_button(MOUSE_BUTTON_LEFT, plot, false)
	assert_eq(_tapped, [PLOT] as Array[int])


func test_a_mouse_drag_pans_and_never_taps() -> void:
	var start := _plot_on_screen(PLOT)
	var end := start + Vector2(120, 40)
	_mouse_button(MOUSE_BUTTON_LEFT, start, true)
	_mouse_drag(end)
	_mouse_button(MOUSE_BUTTON_LEFT, end, false)
	assert_eq(_tapped, [] as Array[int])
	var moved := _plot_on_screen(PLOT) - start
	assert_gt(moved.dot(end - start), 0.0, "the field moves the way the pointer did")
	assert_lt(moved.length(), (end - start).length() * 0.8, "but less far, so panning is gentle")


func test_a_drag_near_the_horizon_pans_as_far_as_one_in_the_middle() -> void:
	var centre := Vector2(VIEW_SIZE) / 2.0
	var near_top := Vector2(centre.x, VIEW_SIZE.y * 0.1)
	var step := Vector2(0, 60)
	var focus_before := _camera.position
	_mouse_button(MOUSE_BUTTON_LEFT, centre, true)
	_mouse_drag(centre + step)
	_mouse_button(MOUSE_BUTTON_LEFT, centre + step, false)
	var middle_pan := _camera.position - focus_before
	focus_before = _camera.position
	_mouse_button(MOUSE_BUTTON_LEFT, near_top, true)
	_mouse_drag(near_top + step)
	_mouse_button(MOUSE_BUTTON_LEFT, near_top + step, false)
	var top_pan := _camera.position - focus_before
	assert_gt(middle_pan.length(), 0.0)
	assert_almost_eq(top_pan, middle_pan, Vector3.ONE * 0.01, "far ground doesn't pan faster")


func test_a_finger_tap_taps_the_plot() -> void:
	var plot := _plot_on_screen(PLOT)
	_touch(0, plot, true)
	_touch(0, plot, false)
	assert_eq(_tapped, [PLOT] as Array[int])


func test_the_click_godot_makes_up_from_a_touch_is_ignored() -> void:
	var plot := _plot_on_screen(PLOT)
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.device = InputEvent.DEVICE_ID_EMULATION
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = plot
		event.pressed = pressed
		_viewport.push_input(event)
	assert_eq(_tapped, [] as Array[int])


func test_a_pinch_zooms_and_never_taps() -> void:
	var plot := _plot_on_screen(PLOT)
	var distance_before := _camera.position.distance_to(Vector3.ZERO)
	_touch(0, plot - Vector2(50, 0), true)
	_touch(1, plot + Vector2(50, 0), true)
	_touch_drag(0, plot - Vector2(100, 0))
	_touch_drag(1, plot + Vector2(100, 0))
	_touch(1, plot + Vector2(100, 0), false)
	_touch(0, plot - Vector2(100, 0), false)
	assert_eq(_tapped, [] as Array[int])
	assert_lt(_camera.position.distance_to(Vector3.ZERO), distance_before, "spreading zooms in")
	assert_almost_eq(_plot_on_screen(PLOT), plot, Vector2.ONE * 0.5, "zooms towards the fingers")


func test_the_wheel_zooms_towards_the_mouse_without_turning_the_camera() -> void:
	var plot := _plot_on_screen(PLOT)
	var angle := _camera.basis
	var height_before := _camera.position.y
	_mouse_button(MOUSE_BUTTON_WHEEL_UP, plot, true)
	assert_lt(_camera.position.y, height_before, "wheel up zooms in")
	assert_eq(_camera.basis, angle)
	assert_almost_eq(_plot_on_screen(PLOT), plot, Vector2.ONE * 0.5)


func test_the_wheel_cannot_zoom_past_the_far_limit() -> void:
	for notch in 100:
		_mouse_button(MOUSE_BUTTON_WHEEL_DOWN, Vector2(VIEW_SIZE) / 2.0, true)
	var back := _camera.basis.z
	assert_almost_eq(_camera.position.y, back.y * FieldCamera.FAR_DISTANCE, 0.001)


func test_a_click_on_a_button_over_the_field_stays_with_the_button() -> void:
	var plot := _plot_on_screen(PLOT)
	var button := Button.new()
	button.position = plot - Vector2(40, 40)
	button.size = Vector2(80, 80)
	_viewport.add_child(button)
	var presses: Array[bool] = []
	button.pressed.connect(func() -> void: presses.append(true))
	_mouse_button(MOUSE_BUTTON_LEFT, plot, true)
	_mouse_button(MOUSE_BUTTON_LEFT, plot, false)
	assert_eq(presses.size(), 1, "the button got the click")
	assert_eq(_tapped, [] as Array[int])


func test_a_click_on_the_generator_taps_it_and_no_plot() -> void:
	var generator := _generator_on_screen()
	_mouse_button(MOUSE_BUTTON_LEFT, generator, true)
	_mouse_button(MOUSE_BUTTON_LEFT, generator, false)
	assert_eq(_generator_taps, 1)
	assert_eq(_tapped, [] as Array[int])


func test_a_finger_tap_on_the_generator_taps_it() -> void:
	var generator := _generator_on_screen()
	_touch(0, generator, true)
	_touch(0, generator, false)
	assert_eq(_generator_taps, 1)


func test_a_drag_from_the_generator_pans_and_never_sends_him() -> void:
	var start := _generator_on_screen()
	var end := start + Vector2(150, 0)
	_touch(0, start, true)
	_touch_drag(0, end)
	_touch(0, end, false)
	assert_eq(_generator_taps, 0)


func test_a_pinch_over_the_generator_never_sends_him() -> void:
	var generator := _generator_on_screen()
	_touch(0, generator - Vector2(40, 0), true)
	_touch(1, generator + Vector2(40, 0), true)
	_touch_drag(1, generator + Vector2(90, 0))
	_touch(1, generator + Vector2(90, 0), false)
	_touch(0, generator - Vector2(40, 0), false)
	assert_eq(_generator_taps, 0)


func test_a_tap_on_bare_ground_taps_nothing() -> void:
	var ground := _camera.unproject_position(Vector3(0.0, 0.0, -10.0))
	_mouse_button(MOUSE_BUTTON_LEFT, ground, true)
	_mouse_button(MOUSE_BUTTON_LEFT, ground, false)
	assert_eq(_generator_taps, 0)
	assert_eq(_tapped, [] as Array[int])


func test_dragging_can_bring_every_part_of_the_track_to_the_middle_of_the_view() -> void:
	var track := _field.track()
	var centre := Vector2(VIEW_SIZE) / 2.0
	for eighth in 8:
		var along := track.length() * eighth / 8.0
		var outer_edge := (
			track.point_at(along)
			+ track.heading_at(along).cross(Vector3.UP) * (-_field.track_width / 2.0)
		)
		# Drag a little at a time, pulling the edge towards the middle of the screen.
		for drag in 30:
			var towards := (centre - _camera.unproject_position(outer_edge)).limit_length(150.0)
			_mouse_button(MOUSE_BUTTON_LEFT, centre, true)
			_mouse_drag(centre + towards)
			_mouse_button(MOUSE_BUTTON_LEFT, centre + towards, false)
		var on_screen := _camera.unproject_position(outer_edge)
		assert_almost_eq(on_screen, centre, Vector2.ONE * 2.0, "track edge at %.1f m" % along)
