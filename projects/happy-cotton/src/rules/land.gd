class_name Land
extends RefCounted
## The Farm's land: how many columns and rows it spans and the cell each Plot sits in. A Plot
## keeps its number and its cell for good. The first land's Plots are numbered row by row
## from the back left, as the field has always shown them; columns count from the left and
## rows from the front, so land added later on the right and at the back never moves a Plot
## already there. Farm owns this and delegates to it; tested through Farm, not on its own.

var _columns: int
var _rows: int
var _cells: Array[Vector2i] = []


func _init(first_columns: int, first_rows: int) -> void:
	_columns = first_columns
	_rows = first_rows
	for row in range(first_rows - 1, -1, -1):
		for column in first_columns:
			_cells.append(Vector2i(column, row))


func plot_count() -> int:
	return _cells.size()


func view() -> LandView:
	return LandView.new(_columns, _rows, _cells)
