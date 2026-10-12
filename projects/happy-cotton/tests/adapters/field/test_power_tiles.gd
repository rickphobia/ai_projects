extends GutTest
## The power tiles paving the track: each footstep lights the tile under it, the light fades
## behind him, and a white lap line crosses the track where each lap ends.

const WIDTH := 1.6

## The field's own track: round its corners the tiles must still meet.
var _track := TrackPath.new(Rect2(-7.5, -6.3, 15.0, 12.6), 1.6, 4.0)
var _tiles: PowerTiles


func before_each() -> void:
	_tiles = PowerTiles.new(_track, WIDTH)
	add_child_autofree(_tiles)


## A point on the track some distance past the lap line, `across` metres to his right.
func _on_track(distance: float, across: float) -> Vector3:
	var right := _track.heading_at(distance).cross(Vector3.UP)
	return _track.point_at(distance) + right * across


func test_the_tiles_pave_the_whole_track_two_across() -> void:
	var tiles: MultiMeshInstance3D = _tiles.get_node("Tiles")
	assert_eq(tiles.multimesh.instance_count, _tiles.tile_count())
	var distance := 0.1
	while distance < _track.length():
		for across: float in [-0.6, -0.2, 0.2, 0.6]:
			assert_gte(_tiles.tile_at(_on_track(distance, across)), 0, "%.1f m" % distance)
		distance += 0.5
	assert_ne(
		_tiles.tile_at(_on_track(2.0, -0.3)),
		_tiles.tile_at(_on_track(2.0, 0.3)),
		"left and right feet land on different tiles"
	)


func test_a_step_off_the_track_lights_nothing() -> void:
	assert_false(_tiles.light_at(Vector3.ZERO), "inside the fence")
	assert_false(_tiles.light_at(_on_track(2.0, WIDTH)), "beside the track")
	assert_eq(_tiles.lit_count(), 0)


func test_a_step_lights_the_tile_under_the_foot_and_it_fades_out() -> void:
	var foot := _on_track(5.0, 0.3)
	var tile := _tiles.tile_at(foot)

	assert_true(_tiles.light_at(foot))
	assert_eq(_tiles.glow_shown(tile), 1.0)
	_tiles.update(PowerTiles.FADE_SECONDS / 2.0)
	assert_almost_eq(_tiles.glow_shown(tile), 0.5, 0.01)
	_tiles.update(PowerTiles.FADE_SECONDS)

	assert_eq(_tiles.glow_shown(tile), 0.0)
	assert_eq(_tiles.lit_count(), 0)


func test_a_lit_tile_glows_on_top_of_that_tile() -> void:
	var foot := _on_track(20.0, -0.3)

	_tiles.light_at(foot)

	var glow: MeshInstance3D = _tiles.get_node("Glow0")
	assert_true(glow.visible)
	assert_eq(_tiles.tile_at(glow.position), _tiles.tile_at(foot))
	assert_gt(glow.position.y, PowerTiles.TILE_TOP, "above the tile's top")


func test_past_the_pool_the_newest_step_takes_the_dimmest_glow() -> void:
	var first := _on_track(1.0, 0.3)
	_tiles.light_at(first)
	var newest := Vector3.ZERO
	for step in PowerTiles.GLOWS:
		_tiles.update(0.05)
		newest = _on_track(2.0 + step * 0.8, 0.3)
		_tiles.light_at(newest)

	assert_eq(_tiles.lit_count(), PowerTiles.GLOWS)
	assert_eq(_tiles.glow_shown(_tiles.tile_at(first)), 0.0, "the oldest went dark")
	assert_eq(_tiles.glow_shown(_tiles.tile_at(newest)), 1.0)


func test_his_steps_leave_a_fading_trail() -> void:
	var first := _on_track(5.0, -0.3)
	var second := _on_track(6.3, 0.3)

	_tiles.light_at(first)
	_tiles.update(0.4)
	_tiles.light_at(second)

	assert_eq(_tiles.lit_count(), 2)
	assert_gt(_tiles.glow_shown(_tiles.tile_at(first)), 0.0)
	assert_lt(_tiles.glow_shown(_tiles.tile_at(first)), _tiles.glow_shown(_tiles.tile_at(second)))


func test_with_instant_fade_only_the_tile_under_his_last_step_is_lit_and_it_never_dims() -> void:
	_tiles.instant_fade = true
	var first := _on_track(5.0, -0.3)
	var second := _on_track(6.3, 0.3)

	_tiles.light_at(first)
	_tiles.light_at(second)
	assert_eq(_tiles.glow_shown(_tiles.tile_at(first)), 0.0)
	_tiles.update(PowerTiles.INSTANT_HOLD_SECONDS / 2.0)
	assert_eq(_tiles.glow_shown(_tiles.tile_at(second)), 1.0)
	_tiles.update(PowerTiles.INSTANT_HOLD_SECONDS)

	assert_eq(_tiles.glow_shown(_tiles.tile_at(second)), 0.0)
	assert_eq(_tiles.lit_count(), 0)


func test_the_lap_line_crosses_the_track_where_each_lap_ends() -> void:
	var line: MeshInstance3D = _tiles.get_node("LapLine")
	var at_start := _track.point_at(0.0)

	var line_spot := Vector2(line.position.x, line.position.z)
	assert_almost_eq(line_spot, Vector2(at_start.x, at_start.z), Vector2.ONE * 0.001)
	assert_almost_eq((line.mesh as BoxMesh).size.x, WIDTH, 0.001, "right across the track")
	assert_almost_eq(line.basis.x.dot(_track.heading_at(0.0)), 0.0, 0.001, "square to his way")
