class_name FieldLand
extends RefCounted
## Land views for the field's tests, built by hand so the field is tested without the rules.
## first() is the shipped first land: 4 × 3, numbered row by row from the back left.


static func first() -> LandView:
	var cells: Array[Vector2i] = []
	for row in range(2, -1, -1):
		for column in 4:
			cells.append(Vector2i(column, row))
	return LandView.new(4, 3, cells)


## The first land widened by some columns on the right and deepened by some rows at the back,
## with a Plot bought only in each new column's front cell, then in each new row's left cell:
## the rest are unworked ground.
static func grown(extra_columns: int, extra_rows: int) -> LandView:
	var first_land := first()
	var cells: Array[Vector2i] = []
	for index in first_land.plot_count():
		cells.append(first_land.cell_of(index))
	for column in extra_columns:
		cells.append(Vector2i(first_land.columns + column, 0))
	for row in extra_rows:
		cells.append(Vector2i(0, first_land.rows + row))
	return LandView.new(first_land.columns + extra_columns, first_land.rows + extra_rows, cells)
