class_name LandView
extends RefCounted
## A read-only snapshot of the Farm's land, for the field to build from: how many columns and
## rows it spans and the cell each Plot sits in. Changing the Farm never changes a view
## already handed out; ask the Farm for a new one.

## Plots across, counted from the left.
var columns: int:
	get:
		return _columns
## Plots front to back, counted from the front (row 0 is nearest the camera).
var rows: int:
	get:
		return _rows

var _columns: int
var _rows: int
var _cells: Array[Vector2i]


func _init(land_columns: int, land_rows: int, plot_cells: Array[Vector2i]) -> void:
	_columns = land_columns
	_rows = land_rows
	_cells = plot_cells.duplicate()


func plot_count() -> int:
	return _cells.size()


## The cell Plot `index` sits in: (column from the left, row from the front).
func cell_of(index: int) -> Vector2i:
	return _cells[index]
