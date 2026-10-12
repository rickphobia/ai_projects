extends GutTest
## The track's centre line: a rounded rectangle around the field, measured from the lap line
## on its left side in the direction he runs (away from the camera first). It follows the
## Farm's bounds, so a bigger Farm stretches it to the right and the back.

const HALF_SIZE := Vector2(7.0, 5.0)
const RADIUS := 1.0
const LAP_LINE_Z := 3.0
const BOUNDS := Rect2(-HALF_SIZE, HALF_SIZE * 2.0)
## The field's plots and the track's distance outside their edges, as the field builds them.
const SPACING := 2.4
const PLOT_SIZE := 2.0
const FRONT_LEFT := Vector3(-3.6, 0.0, 2.4)
const OUTSIDE_PLOTS := 2.9

var _track: TrackPath


func before_each() -> void:
	_track = TrackPath.new(BOUNDS, RADIUS, LAP_LINE_Z)


func test_a_lap_is_the_straights_and_one_full_circle_of_corners() -> void:
	var straights := 2.0 * (12.0 + 8.0)
	assert_almost_eq(_track.length(), straights + TAU * RADIUS, 0.0001)


func test_it_starts_at_the_lap_line_heading_away_from_the_camera() -> void:
	assert_almost_eq(_track.point_at(0.0), Vector3(-7.0, 0.0, 3.0), Vector3.ONE * 0.0001)
	assert_almost_eq(_track.heading_at(0.0), Vector3(0.0, 0.0, -1.0), Vector3.ONE * 0.0001)


func test_it_runs_round_the_back_then_the_far_side() -> void:
	# 7 m up the left side and 0.5π m round the corner reach the back straight.
	var back_straight_start := 7.0 + PI / 2.0
	assert_almost_eq(
		_track.point_at(back_straight_start + 6.0), Vector3(0.0, 0.0, -5.0), Vector3.ONE * 0.0001
	)
	assert_almost_eq(
		_track.heading_at(back_straight_start + 6.0), Vector3(1.0, 0.0, 0.0), Vector3.ONE * 0.0001
	)
	var right_side_middle := back_straight_start + 12.0 + PI / 2.0 + 4.0
	assert_almost_eq(
		_track.point_at(right_side_middle), Vector3(7.0, 0.0, 0.0), Vector3.ONE * 0.0001
	)


func test_corners_are_round() -> void:
	var halfway_round := 7.0 + PI / 4.0
	var corner_centre := Vector3(-6.0, 0.0, -4.0)
	assert_almost_eq(_track.point_at(halfway_round).distance_to(corner_centre), RADIUS, 0.0001)


func test_a_lap_brings_him_back_to_the_lap_line() -> void:
	assert_almost_eq(_track.point_at(_track.length()), _track.point_at(0.0), Vector3.ONE * 0.0001)
	assert_almost_eq(
		_track.point_at(_track.length() + 2.0), _track.point_at(2.0), Vector3.ONE * 0.0001
	)
	assert_almost_eq(_track.point_at(-1.0), Vector3(-7.0, 0.0, 4.0), Vector3.ONE * 0.0001)


func test_it_reaches_the_given_half_size_and_no_further() -> void:
	var furthest := Vector2.ZERO
	for step in 200:
		var point := _track.point_at(_track.length() * step / 200.0)
		furthest = furthest.max(Vector2(absf(point.x), absf(point.z)))
	assert_almost_eq(furthest, HALF_SIZE, Vector2.ONE * 0.0001)


func test_off_centre_bounds_move_the_whole_track() -> void:
	var moved := TrackPath.new(
		Rect2(BOUNDS.position + Vector2(2.0, -3.0), BOUNDS.size), RADIUS, 0.0
	)

	assert_almost_eq(moved.point_at(0.0), Vector3(-5.0, 0.0, 0.0), Vector3.ONE * 0.0001)
	assert_almost_eq(moved.length(), _track.length(), 0.0001)


func _track_round(land: LandView) -> TrackPath:
	var plots := PlotGrid.new(land, FRONT_LEFT, SPACING, PLOT_SIZE)
	return TrackPath.new(plots.bounds().grow(OUTSIDE_PLOTS), RADIUS, LAP_LINE_Z)


func test_a_wider_farm_keeps_the_lap_line_and_adds_two_spacings_per_column() -> void:
	var first := _track_round(FieldLand.first())

	for extra_columns: int in [1, 2]:
		var wider := _track_round(FieldLand.grown(extra_columns, 0))
		assert_almost_eq(wider.point_at(0.0), first.point_at(0.0), Vector3.ONE * 0.0001)
		assert_almost_eq(wider.length(), first.length() + 2.0 * SPACING * extra_columns, 0.0001)


func test_a_deeper_farm_keeps_the_lap_line_and_adds_two_spacings_per_row() -> void:
	var first := _track_round(FieldLand.first())

	for extra_rows: int in [1, 2]:
		var deeper := _track_round(FieldLand.grown(0, extra_rows))
		assert_almost_eq(deeper.point_at(0.0), first.point_at(0.0), Vector3.ONE * 0.0001)
		assert_almost_eq(deeper.length(), first.length() + 2.0 * SPACING * extra_rows, 0.0001)


func test_a_bigger_farm_keeps_the_front_and_left_sides_and_moves_the_back_and_right() -> void:
	var first := _track_round(FieldLand.first())
	var bigger := _track_round(FieldLand.grown(1, 1))

	var first_reach := Rect2(first.centre - first.half_size, first.half_size * 2.0)
	var bigger_reach := Rect2(bigger.centre - bigger.half_size, bigger.half_size * 2.0)
	assert_almost_eq(bigger_reach.position.x, first_reach.position.x, 0.0001, "left side")
	assert_almost_eq(bigger_reach.end.y, first_reach.end.y, 0.0001, "front side")
	assert_almost_eq(bigger_reach.end.x, first_reach.end.x + SPACING, 0.0001, "right side")
	assert_almost_eq(bigger_reach.position.y, first_reach.position.y - SPACING, 0.0001, "back")
