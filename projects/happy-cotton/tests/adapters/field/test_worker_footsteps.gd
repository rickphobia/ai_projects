extends GutTest
## The Worker's feet strike the track with each footfall of his run or walk on it, left and
## right in turn: what lights the power tiles under them.

const WORKER_MODEL := preload("res://assets/quaternius-modular-men/farmer.glb")
const HOME := Vector3(-5.0, 0.0, 2.5)
const GATE := Vector3(-5.5, 0.0, 3.0)
const HOME_FACING := 0.5
const LAP_SECONDS := 14.0
## Small steps, like frames, so he keeps up with the clock as he does in play.
const STEP := 1.0 / 30.0
## Long enough to walk from his place to the lap line.
const WALK_THERE := 3.0
const RUNNING := WorkerView.Activity.RUNNING

var _body: Node3D
var _player: AnimationPlayer
var _track := TrackPath.new(Rect2(-7.0, -5.0, 14.0, 10.0), 1.0, 3.0)
var _motion: WorkerMotion


func before_each() -> void:
	_body = WORKER_MODEL.instantiate()
	_body.position = HOME
	_body.rotation.y = HOME_FACING
	add_child_autofree(_body)
	_player = _body.find_children("*", "AnimationPlayer", true, false)[0]
	_motion = WorkerMotion.new(_body, _player, _track, GATE)


## Shows him one view, then moves him for some seconds in frame-sized steps.
func _hold(view: WorkerView, seconds: float) -> void:
	_motion.show(view)
	for frame in ceili(seconds / STEP):
		_motion.update(STEP)


## Plays some seconds of him running, the lap clock going round once each LAP_SECONDS
## starting from `from_progress`.
func _run(seconds: float, from_progress := 0.0, laps_left := 5) -> void:
	for frame in ceili(seconds / STEP):
		var progress := fposmod(from_progress + (frame + 1) * STEP / LAP_SECONDS, 1.0)
		_motion.show(WorkerView.new(RUNNING, laps_left, 0.0, progress))
		_motion.update(STEP)


func _walk_out() -> void:
	_hold(WorkerView.new(RUNNING, 5), WALK_THERE)


func test_his_feet_strike_the_track_twice_each_cycle_of_his_run() -> void:
	_walk_out()
	watch_signals(_motion)

	_run(LAP_SECONDS)

	# The run plays at his speed over its stride speed, so a lap is this many cycles of it.
	var cycle := _player.get_animation(WorkerMotion.RUNNING).length
	var cycles := _track.length() / (WorkerMotion.RUN_STRIDE_SPEED * cycle)
	var steps: int = get_signal_emit_count(_motion, "stepped")
	assert_almost_eq(float(steps), cycles * 2.0, 2.0)


func test_his_feet_land_left_and_right_in_turn_either_side_of_his_way() -> void:
	_walk_out()
	var feet: Array[Vector3] = []
	_motion.stepped.connect(func(foot: Vector3) -> void: feet.append(foot))

	_run(LAP_SECONDS * 0.2)

	assert_gt(feet.size(), 2)
	var sides: Array[float] = []
	for foot in feet:
		var nearest := _nearest_on_track(foot)
		var right := _track.heading_at(nearest).cross(Vector3.UP)
		var across := (foot - _track.point_at(nearest)).dot(right)
		assert_almost_eq(absf(across), WorkerMotion.FOOT_SPREAD, 0.3, "near his way")
		assert_eq(foot.y, 0.0, "on the ground")
		sides.append(signf(across))
	for index in range(1, sides.size()):
		assert_ne(sides[index], sides[index - 1], "step %d" % index)


func test_walking_back_along_the_track_he_still_strikes_it() -> void:
	_walk_out()
	_run(LAP_SECONDS * 0.3)
	watch_signals(_motion)

	_hold(WorkerView.new(WorkerView.Activity.IN_FIELD, 5), 1.0)

	var steps: int = get_signal_emit_count(_motion, "stepped")
	assert_gt(steps, 0)


## How far round the track the point on its centre line nearest `point` is, to 5 cm.
func _nearest_on_track(point: Vector3) -> float:
	var best := 0.0
	var distance := 0.0
	while distance < _track.length():
		if _track.point_at(distance).distance_to(point) < _track.point_at(best).distance_to(point):
			best = distance
		distance += 0.05
	return best
