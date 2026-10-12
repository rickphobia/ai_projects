class_name PlotGrid
extends RefCounted
## Where each plot sits on the ground, and which plot a point on the ground falls in. Plots
## sit in the land's cells (see LandView): columns run to the right (+x) and rows to the back
## (-z) from the front-left cell, which stays put however much land is added.

## Distance between neighbouring plot centres, in metres.
var spacing: float
## Width of one square plot, in metres. Points in the gap between plots hit no plot.
var plot_size: float

var _land: LandView
var _front_left: Vector3
## The plot in each cell that has one; a cell missing from it is unworked ground.
var _plot_in: Dictionary[Vector2i, int] = {}


func _init(land: LandView, front_left_centre: Vector3, centre_spacing: float, size: float) -> void:
	_land = land
	_front_left = front_left_centre
	spacing = centre_spacing
	plot_size = size
	for index in land.plot_count():
		_plot_in[land.cell_of(index)] = index


func count() -> int:
	return _land.plot_count()


func centre_of(index: int) -> Vector3:
	var cell := _land.cell_of(index)
	return _front_left + Vector3(cell.x * spacing, 0.0, -cell.y * spacing)


## The plot under a point on the ground, or -1 when the point is outside every plot.
func index_at(point: Vector3) -> int:
	var cell := Vector2i(
		roundi((point.x - _front_left.x) / spacing), roundi((_front_left.z - point.z) / spacing)
	)
	if not _plot_in.has(cell):
		return -1
	var index: int = _plot_in[cell]
	var centre := centre_of(index)
	var half := plot_size / 2.0
	if absf(point.x - centre.x) > half or absf(point.z - centre.z) > half:
		return -1
	return index


## The centres of the land's cells with no Plot yet: unworked ground inside the fence.
func unworked_centres() -> Array[Vector3]:
	var centres: Array[Vector3] = []
	for row in _land.rows:
		for column in _land.columns:
			var cell := Vector2i(column, row)
			if not _plot_in.has(cell):
				centres.append(_front_left + Vector3(cell.x * spacing, 0.0, -cell.y * spacing))
	return centres


## The ground the land's cells cover, from the outer plots' edges, on the ground plane: x
## across and y front to back (the ground's z).
func bounds() -> Rect2:
	var across := (_land.columns - 1) * spacing + plot_size
	var deep := (_land.rows - 1) * spacing + plot_size
	var back_left := Vector2(
		_front_left.x - plot_size / 2.0, _front_left.z + plot_size / 2.0 - deep
	)
	return Rect2(back_left, Vector2(across, deep))
