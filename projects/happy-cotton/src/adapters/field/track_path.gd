class_name TrackPath
extends RefCounted
## The centre line of the dirt track around the field: a rectangle with rounded corners round
## the Farm's bounds, so a wider or deeper Farm stretches it to the right and the back while
## its front and left sides, and the lap line, stay put. A place on it is the distance run from
## the lap line, which runs across its left side; he runs up the left side away from the
## camera, round the back, down the right side and back along the front.

## The four sides in running order, each as its start's place on the rectangle (in units of
## the straight's half-length) and its direction. Each side ends in a quarter-circle corner.
const SIDE_STARTS: Array[Vector2] = [Vector2(-1, 1), Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1)]
const SIDE_HEADINGS: Array[Vector2] = [Vector2(0, -1), Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0)]

## The middle of the rectangle, on the ground plane: x across and y front to back (the
## ground's z).
var centre: Vector2
## How far the centre line reaches from its middle: across (x) and front to back (y).
var half_size: Vector2
var _radius: float
## Half of each straight, between the corners: across (x) and front to back (y).
var _straight_half: Vector2
## Where the lap line is, measured from the start of the left side.
var _lap_line_offset: float


## `bounds` is the rectangle the centre line runs along, on the ground plane (x, z).
## `lap_line_z` is where the lap line crosses the left side, between its corners.
func _init(bounds: Rect2, corner_radius: float, lap_line_z: float) -> void:
	centre = bounds.get_center()
	half_size = bounds.size / 2.0
	var from_centre := lap_line_z - centre.y
	assert(absf(from_centre) <= half_size.y - corner_radius, "lap line off the straight")
	_radius = corner_radius
	_straight_half = half_size - Vector2.ONE * corner_radius
	_lap_line_offset = _straight_half.y - from_centre


## One lap, in metres.
func length() -> float:
	return 4.0 * (_straight_half.x + _straight_half.y) + TAU * _radius


## The point on the ground some distance past the lap line, wrapping round lap after lap.
func point_at(distance: float) -> Vector3:
	var place := _place(distance)
	return Vector3(centre.x + place[0].x, 0.0, centre.y + place[0].y)


## The direction he runs at some distance past the lap line, as a unit vector.
func heading_at(distance: float) -> Vector3:
	var place := _place(distance)
	return Vector3(place[1].x, 0.0, place[1].y)


## The point (from the middle) and heading, both on the ground plane (x and z), at a distance
## past the lap line.
func _place(distance: float) -> Array[Vector2]:
	var along := fposmod(distance + _lap_line_offset, length())
	for side in SIDE_STARTS.size():
		var heading := SIDE_HEADINGS[side]
		var start := SIDE_STARTS[side] * _straight_half + heading.orthogonal() * _radius
		var straight := 2.0 * (_straight_half.x if heading.y == 0.0 else _straight_half.y)
		if along <= straight:
			return [start + heading * along, heading]
		along -= straight
		var corner_length := PI / 2.0 * _radius
		if along <= corner_length or side == SIDE_STARTS.size() - 1:
			# The corner turns him to the right, a quarter circle round its centre.
			var centre := start + heading * straight - heading.orthogonal() * _radius
			var turned := along / _radius
			var outward := heading.orthogonal().rotated(turned)
			return [centre + outward * _radius, heading.rotated(turned)]
		along -= corner_length
	return [Vector2.ZERO, Vector2.ZERO]
