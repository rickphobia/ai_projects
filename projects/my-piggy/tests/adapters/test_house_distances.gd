extends GutTest
## How far a sound travels through the real house, and through how many doors and walls;
## and whether the torch can see from one point to another. Also where Mum starts again
## after a catch in the real house, with the game's own tuning table, and whether her route
## gives the Piggy a way into the kitchen.

const HOUSE_SCENE := preload("res://src/adapters/house.tscn")
const BEDROOM_MIDDLE := Vector3(0.0, 0.0, 0.0)
const BEDROOM_CORNER := Vector3(2.0, 0.0, 2.0)
const HALLWAY_MIDDLE := Vector3(0.0, 0.0, -10.0)
const KITCHEN_CORNER := Vector3(3.0, 0.0, -22.0)
## Where the Piggy stands when each space's checkpoint is taken: just through each doorway.
const SPACE_ENTRIES: Array[Vector3] = [
	Vector3(0.0, 0.0, -4.3),
	Vector3(0.0, 0.0, -16.3),
	Vector3(0.0, 0.0, -15.9),
	Vector3(0.0, 0.0, -3.9),
]
## No route point is this close to a checkpoint, so she never restarts on top of the Piggy.
const ROUTE_CLEAR_OF_ENTRIES := 3.0
## The kitchen doorway and the first metre inside it: where the Piggy is while slipping in.
const KITCHEN_DOORWAY: Array[Vector3] = [
	Vector3(-0.3, 0.0, -16.1),
	Vector3(0.0, 0.0, -16.1),
	Vector3(0.3, 0.0, -16.1),
	Vector3(-0.3, 0.0, -16.6),
	Vector3(0.0, 0.0, -16.6),
	Vector3(0.3, 0.0, -16.6),
	Vector3(-0.3, 0.0, -17.1),
	Vector3(0.0, 0.0, -17.1),
	Vector3(0.3, 0.0, -17.1),
]
## Each loop of her route, she spends at least this long in the kitchen with her torch off
## the doorway, so a careful Piggy following her down the hallway can get in.
const KITCHEN_WINDOW_SECONDS := 8.0
## Somewhere this close inside the kitchen doorway her torch never finds on her whole route:
## where the Piggy ducks once in.
const KITCHEN_COVER_WITHIN := 2.0
const KITCHEN_ENTRY := Vector3(0.0, 0.0, -16.3)
## How finely the kitchen floor is searched for cover, in metres.
const COVER_SEARCH_STEP := 0.25
## How often her walk is sampled, in seconds. Precision, not a game number.
const WALK_STEP_SECONDS := 0.1

var _distances: HouseDistances
var _house: House


func before_each() -> void:
	_house = add_child_autofree(HOUSE_SCENE.instantiate())
	_house.setup(NightTestTuning.table())
	var map := _house.walkable().get_navigation_map()
	_distances = HouseDistances.new(_house.get_world_3d(), map)
	# The walkable area reaches the navigation map on a later physics frame, not a fixed one.
	await wait_until(
		func() -> bool: return _distances.sound_path(BEDROOM_MIDDLE, HALLWAY_MIDDLE).distance < INF,
		2.0
	)


func test_within_one_room_a_sound_goes_straight_through_nothing() -> void:
	var path := _distances.sound_path(BEDROOM_MIDDLE, BEDROOM_CORNER)

	assert_eq(path.barriers, 0)
	# The walkable area keeps clear of furniture, so the path bends a little.
	assert_almost_eq(path.distance, BEDROOM_MIDDLE.distance_to(BEDROOM_CORNER), 1.0)


func test_the_closed_bedroom_door_is_between_the_bedroom_and_the_hallway() -> void:
	var path := _distances.sound_path(BEDROOM_MIDDLE, HALLWAY_MIDDLE)

	assert_eq(path.barriers, 1)


func test_from_the_bedroom_to_the_kitchen_the_path_goes_round_through_the_doors() -> void:
	var path := _distances.sound_path(BEDROOM_CORNER, KITCHEN_CORNER)

	assert_gt(path.distance, BEDROOM_CORNER.distance_to(KITCHEN_CORNER))
	assert_gte(path.barriers, 2, "walls and doors between two rooms apart")


func test_across_an_open_room_the_torch_has_a_clear_view() -> void:
	assert_true(_distances.has_clear_view(BEDROOM_MIDDLE, BEDROOM_CORNER))


func test_the_closed_bedroom_door_blocks_the_view_into_the_hallway() -> void:
	assert_false(_distances.has_clear_view(HALLWAY_MIDDLE, BEDROOM_MIDDLE))


func test_walking_distance_is_the_path_a_sound_takes() -> void:
	var walk := _distances.walking_distance(BEDROOM_CORNER, KITCHEN_CORNER)

	assert_eq(walk, _distances.sound_path(BEDROOM_CORNER, KITCHEN_CORNER).distance)


func test_no_point_of_mums_route_is_near_where_a_checkpoint_is_taken() -> void:
	for entry in _checkpoints():
		for point in _house.mum_route():
			var apart := Vector2(point.x, point.z).distance_to(Vector2(entry.x, entry.z))
			assert_gte(apart, ROUTE_CLEAR_OF_ENTRIES, "route point %s near %s" % [point, entry])


func test_after_a_catch_at_any_checkpoint_mum_starts_far_away_and_out_of_sight() -> void:
	var tuning := Tuning.load_file("res://data/tuning.tres")
	for entry in _checkpoints():
		var spot := RouteSpot.out_of_sight(_house.mum_route(), entry, tuning, _distances)

		var away := _distances.walking_distance(spot.position, entry)
		assert_gte(away, tuning.mum_restart_distance, "far enough from %s" % entry)
		assert_false(
			TorchSight.sees(spot.position, spot.facing, entry, tuning, _distances),
			"out of sight of %s" % entry
		)


func test_each_loop_mum_turns_her_back_on_the_kitchen_doorway_long_enough_to_slip_in() -> void:
	var tuning := Tuning.load_file("res://data/tuning.tres")
	_open_kitchen_doorway()
	var walk := _walk_route(tuning.mum_walk_speed)
	var in_kitchen_not_seeing: Array[bool] = []
	for step in walk:
		var sees_doorway := KITCHEN_DOORWAY.any(
			func(spot: Vector3) -> bool:
				return TorchSight.sees(step.position, step.facing, spot, tuning, _distances)
		)
		in_kitchen_not_seeing.append(
			_house.space_at(step.position) == &"kitchen" and not sees_doorway
		)

	var longest := _longest_run_around(in_kitchen_not_seeing) * WALK_STEP_SECONDS
	assert_gte(longest, KITCHEN_WINDOW_SECONDS, "seconds in the kitchen not seeing the doorway")


func test_just_inside_the_kitchen_doorway_there_is_cover_her_torch_never_finds() -> void:
	var tuning := Tuning.load_file("res://data/tuning.tres")
	_open_kitchen_doorway()
	var walk := _walk_route(tuning.mum_walk_speed)
	var map := _house.walkable().get_navigation_map()
	var hidden: Array[Vector3] = []
	var reach := ceili(KITCHEN_COVER_WITHIN / COVER_SEARCH_STEP)
	for across in range(-reach, reach + 1):
		for deep in range(reach + 1):
			var spot := KITCHEN_ENTRY + Vector3(across, 0.0, -deep) * COVER_SEARCH_STEP
			var on_floor := NavigationServer3D.map_get_closest_point(map, spot)
			if spot.distance_to(KITCHEN_ENTRY) > KITCHEN_COVER_WITHIN:
				continue
			if Vector2(on_floor.x, on_floor.z).distance_to(Vector2(spot.x, spot.z)) > 0.05:
				continue
			var seen := walk.any(
				func(step: RouteSpot) -> bool:
					return TorchSight.sees(step.position, step.facing, spot, tuning, _distances)
			)
			if not seen:
				hidden.append(spot)

	assert_false(hidden.is_empty(), "a walkable spot near the doorway she never lights")


func _checkpoints() -> Array[Vector3]:
	var all := SPACE_ENTRIES.duplicate()
	all.append(_house.piggy_spawn().global_position)
	return all


## The door can be left swung either way, so it is taken out: the view is never hidden by it.
func _open_kitchen_doorway() -> void:
	var door: Door = _house.get_node("KitchenDoor")
	# Rays read the layer straight away. Waiting physics frames here made the walkable area
	# drop out of the map now and then (test houses share it), so the test does not wait.
	door.collision_layer = 0
	assert_true(
		_distances.has_clear_view(Vector3(0.0, 0.0, -18.0), HALLWAY_MIDDLE), "door out of the way"
	)


## Where she stands and faces every WALK_STEP_SECONDS on one loop of her route, walking the
## paths the walkable area gives between its points, as she does in the game.
func _walk_route(speed: float) -> Array[RouteSpot]:
	var route := _house.mum_route()
	var map := _house.walkable().get_navigation_map()
	var stride := speed * WALK_STEP_SECONDS
	var walk: Array[RouteSpot] = []
	for index in route.size():
		var next := (index + 1) % route.size()
		var path := NavigationServer3D.map_get_path(map, route[index], route[next], true)
		var carried := 0.0
		for corner in range(1, path.size()):
			var leg := path[corner] - path[corner - 1]
			leg.y = 0.0
			if leg.length() < 0.01:
				continue
			var along := carried
			while along < leg.length():
				walk.append(RouteSpot.new(path[corner - 1] + leg.normalized() * along, leg, next))
				along += stride
			carried = along - leg.length()
	return walk


## The longest run of trues in a loop, where the end runs on into the start.
func _longest_run_around(loop: Array[bool]) -> int:
	if not loop.has(false):
		return loop.size()
	var longest := 0
	var run := 0
	for flag in loop + loop:
		run = run + 1 if flag else 0
		longest = maxi(longest, run)
	return longest
