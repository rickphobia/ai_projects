class_name Land
extends RefCounted
## The Farm's land: how many columns and rows it spans and the cell each Plot sits in. A Plot
## keeps its number and its cell for good. The first land's Plots are numbered row by row
## from the back left, as the field has always shown them; columns count from the left and
## rows from the front, so land added later on the right and at the back never moves a Plot
## already there. More land is bought a Plot at a time in a fixed order: a column on the right,
## then a row at the back, and so on until the largest land, each strip from the front or the
## left. A strip's first Plot widens the land to take in the whole strip; its other cells stay
## unworked ground until bought. Farm owns this and delegates to it; tested through Farm, not
## on its own.

var _columns: int
var _rows: int
var _cells: Array[Vector2i] = []
## The cells still for sale, in the order they are sold.
var _for_sale: Array[Vector2i] = []
var _first_plots: int
## How many more picks the Quota demands for each Plot bought.
var _quota_rise_per_plot: int


func _init(first: Vector2i, largest: Vector2i, quota_rise_per_plot: int) -> void:
	_quota_rise_per_plot = quota_rise_per_plot
	_columns = first.x
	_rows = first.y
	for row in range(first.y - 1, -1, -1):
		for column in first.x:
			_cells.append(Vector2i(column, row))
	_first_plots = _cells.size()
	_for_sale = _sale_order(first, largest)


func plot_count() -> int:
	return _cells.size()


## Plots bought since the first land.
func plots_bought() -> int:
	return _cells.size() - _first_plots


## How many more picks the Quota demands for each Plot bought, from the next Shift.
func quota_rise_per_plot() -> int:
	return _quota_rise_per_plot


## The Quota rise of every Plot bought so far.
func quota_rise() -> int:
	return plots_bought() * _quota_rise_per_plot


## Plots still for sale before the land is at its largest.
func plots_for_sale() -> int:
	return _for_sale.size()


func is_fully_bought() -> bool:
	return _for_sale.is_empty()


## Takes in the next cell for sale as a new Plot, widening the land if it opens a strip.
## Returns the new Plot's number. Callers check is_fully_bought() first.
func buy() -> int:
	var cell: Vector2i = _for_sale.pop_front()
	_cells.append(cell)
	_columns = maxi(_columns, cell.x + 1)
	_rows = maxi(_rows, cell.y + 1)
	return _cells.size() - 1


func view() -> LandView:
	return LandView.new(_columns, _rows, _cells)


## Every cell between the first land and the largest, in the order they are sold: a column on
## the right, then a row at the back, taking whichever is left once one runs out.
static func _sale_order(first: Vector2i, largest: Vector2i) -> Array[Vector2i]:
	var order: Array[Vector2i] = []
	var size := first
	var column_next := true
	while size.x < largest.x or size.y < largest.y:
		if (column_next and size.x < largest.x) or size.y >= largest.y:
			for row in size.y:
				order.append(Vector2i(size.x, row))
			size.x += 1
		else:
			for column in size.x:
				order.append(Vector2i(column, size.y))
			size.y += 1
		column_next = not column_next
	return order
