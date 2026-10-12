extends GutTest
## Placing plots on the ground from the land's cells, and turning a tapped point on the ground
## into the plot under it.

const FRONT_LEFT := Vector3(-3.0, 0.0, 2.0)

var _grid := PlotGrid.new(FieldLand.first(), FRONT_LEFT, 2.0, 1.6)


func test_the_grid_counts_every_plot() -> void:
	assert_eq(_grid.count(), 12)


func test_the_first_land_sits_round_the_origin_back_left_to_front_right() -> void:
	assert_eq(_grid.centre_of(0), Vector3(-3.0, 0.0, -2.0))
	assert_eq(_grid.centre_of(11), Vector3(3.0, 0.0, 2.0))


func test_every_plot_centre_finds_its_own_plot() -> void:
	for index in _grid.count():
		assert_eq(_grid.index_at(_grid.centre_of(index)), index)


func test_a_point_near_a_plot_edge_still_finds_it() -> void:
	assert_eq(_grid.index_at(_grid.centre_of(5) + Vector3(0.79, 0.0, -0.79)), 5)


func test_the_gap_between_plots_hits_no_plot() -> void:
	assert_eq(_grid.index_at(_grid.centre_of(5) + Vector3(0.9, 0.0, 0.0)), -1)


func test_a_point_off_the_grid_hits_no_plot() -> void:
	assert_eq(_grid.index_at(Vector3(20.0, 0.0, 0.0)), -1)
	assert_eq(_grid.index_at(Vector3(0.0, 0.0, -20.0)), -1)


func test_the_bounds_reach_the_outer_plots_edges() -> void:
	assert_eq(_grid.bounds(), Rect2(-3.8, -2.8, 7.6, 5.6))


func test_a_wider_and_deeper_farm_keeps_the_first_twelve_where_they_were() -> void:
	var bigger := PlotGrid.new(FieldLand.grown(1, 1), FRONT_LEFT, 2.0, 1.6)

	for index in _grid.count():
		assert_eq(bigger.centre_of(index), _grid.centre_of(index))


func test_a_wider_and_deeper_farm_grows_to_the_right_and_the_back() -> void:
	var bigger := PlotGrid.new(FieldLand.grown(1, 1), FRONT_LEFT, 2.0, 1.6)

	assert_eq(bigger.bounds(), Rect2(-3.8, -4.8, 9.6, 7.6))
	assert_eq(bigger.centre_of(12), Vector3(5.0, 0.0, 2.0), "the new column's front cell")
	assert_eq(bigger.centre_of(13), Vector3(-3.0, 0.0, -4.0), "the new row's left cell")
	assert_eq(bigger.index_at(Vector3(5.0, 0.0, 2.0)), 12)


func test_an_unworked_cell_hits_no_plot() -> void:
	var bigger := PlotGrid.new(FieldLand.grown(1, 1), FRONT_LEFT, 2.0, 1.6)

	assert_eq(bigger.index_at(Vector3(5.0, 0.0, -4.0)), -1, "the back-right cell has no plot")


func test_the_first_land_has_no_unworked_ground() -> void:
	assert_eq(_grid.unworked_centres(), [] as Array[Vector3])


func test_the_cells_of_a_bought_strip_without_a_plot_are_unworked_ground() -> void:
	var bigger := PlotGrid.new(FieldLand.grown(1, 1), FRONT_LEFT, 2.0, 1.6)

	# The new column's cells behind its front Plot, and the new row's cells right of its left one.
	var expected: Array[Vector3] = [
		Vector3(5.0, 0.0, 0.0),
		Vector3(5.0, 0.0, -2.0),
		Vector3(-1.0, 0.0, -4.0),
		Vector3(1.0, 0.0, -4.0),
		Vector3(3.0, 0.0, -4.0),
		Vector3(5.0, 0.0, -4.0),
	]
	assert_eq(bigger.unworked_centres(), expected)
