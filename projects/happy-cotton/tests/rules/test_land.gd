extends GutTest
## The Farm's land through Farm: it starts at the tuning's first columns and rows, and each
## Plot has a cell that never changes. Columns count from the left and rows from the front.


func test_a_new_farm_spans_the_first_land() -> void:
	var land := Farm.new(FastTuning.table()).land()

	assert_eq(land.columns, FastTuning.FIRST_LAND_COLUMNS)
	assert_eq(land.rows, FastTuning.FIRST_LAND_ROWS)


func test_the_first_land_has_a_plot_in_every_cell() -> void:
	var farm := Farm.new(FastTuning.with_land(FastTuning.table(), 3, 2))

	assert_eq(farm.land().plot_count(), 6)
	assert_eq(farm.plots().size(), 6)


func test_the_shipped_first_twelve_plots_sit_where_they_always_have() -> void:
	var land := Farm.new(FastTuning.with_land(FastTuning.table(), 4, 3)).land()

	# Numbered row by row from the back left: Plot 0 at the back left, 11 at the front right.
	var expected: Array[Vector2i] = [
		Vector2i(0, 2),
		Vector2i(1, 2),
		Vector2i(2, 2),
		Vector2i(3, 2),
		Vector2i(0, 1),
		Vector2i(1, 1),
		Vector2i(2, 1),
		Vector2i(3, 1),
		Vector2i(0, 0),
		Vector2i(1, 0),
		Vector2i(2, 0),
		Vector2i(3, 0),
	]
	var cells: Array[Vector2i] = []
	for index in land.plot_count():
		cells.append(land.cell_of(index))
	assert_eq(cells, expected)
