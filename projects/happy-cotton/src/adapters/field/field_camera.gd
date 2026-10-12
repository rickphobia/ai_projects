class_name FieldCamera
extends RefCounted
## Where the field's camera looks and how far back it sits, kept within limits: the point it
## looks at stays over the field and the track around it, so neither can leave the screen,
## and the zoom stays between a near and a far distance. When the Farm grows, follow() moves
## the limits out with the track, and the far distance grows in step with the track's size,
## so the whole Farm still fits on screen. The camera's angle is not stored here and never
## changes; the camera only slides along it.

## The closest the camera may get to the ground point it looks at, in metres.
const NEAR_DISTANCE := 5.0
## The furthest the camera may pull back from the first Farm, in metres; the haze swallows
## much more.
const FAR_DISTANCE := 12.0
## One mouse-wheel notch zooms by this factor.
const WHEEL_ZOOM_STEP := 1.1

## The ground point (x, z) at the centre of the screen.
var focus: Vector2
## How far the camera sits from the focus, along its fixed angle, in metres.
var distance: float
## The ground the focus may move over (x across, y front to back as the ground's z).
var reach: Rect2
## The furthest the camera may pull back for the current reach.
var far_distance := FAR_DISTANCE

## The first reach, which FAR_DISTANCE is for.
var _first_size: Vector2


func _init(start_focus: Vector2, start_distance: float, first_reach: Rect2) -> void:
	reach = first_reach
	_first_size = first_reach.size
	focus = _clamp_focus(start_focus)
	distance = clampf(start_distance, NEAR_DISTANCE, far_distance)


## Moves the limits to a new reach, scaling the far distance by how much bigger it is than
## the first in its larger direction, never below FAR_DISTANCE. The view stays where it is,
## pulled back inside the limits if it is now outside them.
func follow(new_reach: Rect2) -> void:
	reach = new_reach
	var growth := maxf(new_reach.size.x / _first_size.x, new_reach.size.y / _first_size.y)
	far_distance = FAR_DISTANCE * maxf(growth, 1.0)
	focus = _clamp_focus(focus)
	distance = clampf(distance, NEAR_DISTANCE, far_distance)


## Moves the focus by a distance on the ground, stopping at the field's edge.
func pan(ground_offset: Vector2) -> void:
	focus = _clamp_focus(focus + ground_offset)


## Multiplies the distance: below 1 zooms in, above 1 zooms out.
func zoom_by(factor: float) -> void:
	distance = clampf(distance * factor, NEAR_DISTANCE, far_distance)


## Where the camera goes, given the unit vector pointing back from the ground to the camera.
func position_along(back: Vector3) -> Vector3:
	return Vector3(focus.x, 0.0, focus.y) + back * distance


func _clamp_focus(point: Vector2) -> Vector2:
	return point.clamp(reach.position, reach.end)
