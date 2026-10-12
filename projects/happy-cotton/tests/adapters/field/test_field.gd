extends GutTest
## The field's time-left text, the world's colour draining as the Worker tires, the Overseer,
## the power tiles lighting under his steps, and the field growing with the land.

const FIELD_SCENE := preload("res://src/adapters/field/field.tscn")


## A field in the tree, built on the shipped first land.
func _field() -> Field:
	var field: Field = add_child_autofree(FIELD_SCENE.instantiate())
	field.show_land(FieldLand.first())
	return field


func test_time_left_shows_minutes_and_seconds() -> void:
	assert_eq(Field.time_left_text(125.0), "2:05 left")


func test_time_left_rounds_part_seconds_up() -> void:
	assert_eq(Field.time_left_text(0.2), "0:01 left")
	assert_eq(Field.time_left_text(179.5), "3:00 left")


func test_colour_drains_evenly_from_the_scenes_own_to_nearly_grey() -> void:
	assert_eq(Field.saturation_for(0.0, 0.8), 0.8)
	assert_almost_eq(
		Field.saturation_for(Exhaustion.MOST / 2.0, 0.8),
		(0.8 + Field.DRAINED_SATURATION) / 2.0,
		0.001
	)
	assert_almost_eq(Field.saturation_for(Exhaustion.MOST, 0.8), Field.DRAINED_SATURATION, 0.001)


func test_an_exhausted_worker_drains_this_fields_colour_only() -> void:
	var tired := _field()
	var rested := _field()
	var haze: WorldEnvironment = rested.get_node("Haze")
	var full := haze.environment.adjustment_saturation

	tired.show_worker(WorkerView.new(WorkerView.Activity.IN_FIELD, 5, Exhaustion.MOST))

	var tired_haze: WorldEnvironment = tired.get_node("Haze")
	assert_almost_eq(tired_haze.environment.adjustment_saturation, Field.DRAINED_SATURATION, 0.001)
	assert_eq(haze.environment.adjustment_saturation, full)


func test_the_overseer_stands_outside_the_track_by_the_generator() -> void:
	var field := _field()
	var overseer: Node3D = field.get_node("Overseer")
	var lap_line := (field.get_node("Generator") as Node3D).position

	assert_almost_eq(overseer.position.distance_to(lap_line), Field.OVERSEER_SPOT.length(), 0.01)


func test_the_whip_makes_the_overseer_crack_it_and_the_worker_stagger() -> void:
	var field := _field()
	var camera: Camera3D = field.get_node("Camera")
	var camera_before := camera.global_transform

	field.show_overseer(Farm.OVERSEER_WHIP)

	var overseer: AnimationPlayer = (
		field.get_node("Overseer").find_children("*", "AnimationPlayer", true, false)[0]
	)
	var worker: AnimationPlayer = (
		field.get_node("Worker").find_children("*", "AnimationPlayer", true, false)[0]
	)
	assert_eq(overseer.current_animation, OverseerLook.WHIPPING)
	assert_eq(worker.current_animation, WorkerMotion.STAGGERING)
	assert_eq(camera.global_transform, camera_before, "the camera does not move in")


func test_the_whistle_makes_the_overseer_blow_it() -> void:
	var field := _field()

	field.show_overseer(Farm.OVERSEER_WHISTLE)

	var overseer: AnimationPlayer = (
		field.get_node("Overseer").find_children("*", "AnimationPlayer", true, false)[0]
	)
	assert_eq(overseer.current_animation, OverseerLook.WHISTLING)


func test_the_lap_line_is_at_the_generator() -> void:
	var field := _field()
	var line: Node3D = field.get_node("PowerTiles/LapLine")
	var generator: Node3D = field.get_node("Generator")

	assert_almost_eq(line.position.x, generator.position.x, 0.001)
	assert_almost_eq(line.position.z, generator.position.z, 0.001)


func test_a_step_while_he_runs_lights_its_tile_and_pulses_the_lamp() -> void:
	var field := _field()
	var tiles: PowerTiles = field.get_node("PowerTiles")
	var generator: Generator = field.get_node("Generator")
	field.show_worker(WorkerView.new(WorkerView.Activity.RUNNING, 5))

	field._on_worker_stepped(field.track().point_at(3.0))

	assert_eq(tiles.lit_count(), 1)
	assert_true(generator.is_pulsing())


func test_reduced_motion_stops_the_trail_fading_and_the_lamp_pulsing() -> void:
	var field := _field()
	var tiles: PowerTiles = field.get_node("PowerTiles")
	var generator: Generator = field.get_node("Generator")

	field.set_reduced_motion(true)

	assert_true(tiles.instant_fade)
	assert_true(generator.skip_pulse)


func test_the_first_land_is_laid_out_where_it_always_was() -> void:
	var field := _field()

	assert_eq((field.get_node("Plot0") as Node3D).position, Vector3(-3.6, 0.0, -2.4))
	assert_eq((field.get_node("Plot11") as Node3D).position, Vector3(3.6, 0.0, 2.4))
	assert_almost_eq(
		(field.get_node("Generator") as Node3D).position,
		Vector3(-7.5, 0.0, 4.0),
		Vector3.ONE * 0.0001
	)
	assert_almost_eq(field.track().half_size, Vector2(7.5, 6.3), Vector2.ONE * 0.0001)


func test_a_bigger_farm_adds_plots_and_leaves_the_generator_where_it_was() -> void:
	var first := _field()
	var bigger: Field = add_child_autofree(FIELD_SCENE.instantiate())
	bigger.show_land(FieldLand.grown(1, 1))

	assert_true(bigger.has_node("Plot13"))
	assert_eq(
		(bigger.get_node("Plot0") as Node3D).position, (first.get_node("Plot0") as Node3D).position
	)
	assert_almost_eq(
		(bigger.get_node("Generator") as Node3D).position,
		(first.get_node("Generator") as Node3D).position,
		Vector3.ONE * 0.0001
	)
	assert_gt(bigger.track().length(), first.track().length())


func test_buying_land_adds_its_plots_and_keeps_the_ones_already_there() -> void:
	var field := _field()
	var plot0: Node3D = field.get_node("Plot0")

	field.show_land(FieldLand.grown(1, 0))

	assert_true(field.has_node("Plot12"))
	assert_eq(field.get_node("Plot0"), plot0, "the first plots are not rebuilt")
	# Every plot, old and new, can be shown.
	field.show_plots(_empty_plots(13))


func test_the_unbought_cells_of_a_new_strip_show_as_unworked_ground() -> void:
	var field := _field()
	assert_eq(field.get_node("UnworkedGround").get_child_count(), 0)

	field.show_land(FieldLand.grown(1, 0))

	assert_eq(field.get_node("UnworkedGround").get_child_count(), 2, "the column behind its Plot")


func test_the_fence_and_track_move_out_and_the_generator_stays() -> void:
	var field := _field()
	var generator := (field.get_node("Generator") as Node3D).position
	var first_length := field.track().length()

	field.show_land(FieldLand.grown(1, 1))

	assert_eq(
		field.get_children().filter(func(n: Node) -> bool: return n.name == "Fence").size(), 1
	)
	assert_almost_eq(field.track().length(), first_length + 4.0 * 2.4, 0.0001, "two spacings each")
	assert_eq((field.get_node("Generator") as Node3D).position, generator)
	var tiles: PowerTiles = field.get_node("PowerTiles")
	assert_almost_eq((tiles.get_node("LapLine") as Node3D).position.x, generator.x, 0.001)


func test_the_cameras_limits_and_farthest_zoom_follow_the_track() -> void:
	var field := _field()
	var first_reach := field.camera_reach()

	field.show_land(FieldLand.grown(2, 2))

	var reach := field.camera_reach()
	assert_almost_eq(reach.position.x, first_reach.position.x, 0.0001, "the left edge stays")
	assert_almost_eq(reach.end.y, first_reach.end.y, 0.0001, "the front edge stays")
	assert_almost_eq(reach.end.x, first_reach.end.x + 2 * 2.4, 0.0001)
	assert_almost_eq(reach.position.y, first_reach.position.y - 2 * 2.4, 0.0001)
	assert_gt(field.farthest_zoom(), FieldCamera.FAR_DISTANCE)


func _empty_plots(count: int) -> Array[PlotView]:
	var views: Array[PlotView] = []
	for index in count:
		views.append(PlotView.new(PlotView.Stage.EMPTY, 0.0))
	return views


func test_the_weighing_scale_stands_by_the_gate() -> void:
	var field := _field()

	assert_not_null(field.get_node_or_null("WeighingScale"))


func test_with_an_audit_coming_the_overseer_watches_the_scale_and_then_goes_back() -> void:
	var field := _field()
	var overseer: Node3D = field.get_node("Overseer")
	var by_the_generator := overseer.position

	field.show_audit_tell(true)
	var watching := field.is_overseer_at_the_scale()
	field.show_audit_tell(false)

	assert_true(watching)
	assert_false(field.is_overseer_at_the_scale())
	assert_eq(overseer.position, by_the_generator)


func test_a_fertilised_plot_shows_the_fertiliser_mark_until_the_crop_leaves() -> void:
	var field := _field()
	var views := _empty_plots(FieldLand.first().plot_count())
	views[1] = PlotView.new(PlotView.Stage.SEEDLING, 10.0, true)
	var mark: Node3D = field.get_node("Plot1/Fertilised")

	field.show_plots(views)
	assert_true(mark.visible)
	assert_false((field.get_node("Plot0/Fertilised") as Node3D).visible)

	field.show_plots(_empty_plots(FieldLand.first().plot_count()))
	assert_false(mark.visible)


func test_a_plot_with_bollworms_shows_them_until_they_are_gone() -> void:
	var field := _field()
	var views := _empty_plots(FieldLand.first().plot_count())
	views[2] = PlotView.new(PlotView.Stage.FLOWERING, 10.0, false, 20.0)
	var mark: Node3D = field.get_node("Plot2/Bollworms")

	field.show_plots(views)
	assert_true(mark.visible)
	assert_false((field.get_node("Plot0/Bollworms") as Node3D).visible)

	field.show_plots(_empty_plots(FieldLand.first().plot_count()))
	assert_false(mark.visible)
