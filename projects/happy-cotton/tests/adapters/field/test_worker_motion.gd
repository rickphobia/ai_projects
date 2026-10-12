extends GutTest
## The Worker model follows the rules' view of him: out through the gate to the lap line,
## laps of the track in step with the lap clock, slowing on his last lap, staggering into his
## breath on the lap line, and back along the track and through the gate to his place.

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
const BREATHING := WorkerView.Activity.BREATHING

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


func _walk_out(progress := 0.0) -> void:
	_hold(WorkerView.new(RUNNING, 5, 0.0, progress), WALK_THERE)


## The distance from him to the lap clock's place, `progress` of the way round.
func _off_the_clock(progress: float) -> float:
	return _body.position.distance_to(_track.point_at(progress * _track.length()))


func test_he_stands_at_his_place_at_first() -> void:
	assert_eq(_player.current_animation, WorkerMotion.STANDING)


func test_he_walks_out_through_the_gate_to_the_lap_line() -> void:
	_hold(WorkerView.new(RUNNING, 5), 0.5)
	assert_eq(_player.current_animation, WorkerMotion.WALKING)
	assert_almost_eq(_body.position.distance_to(HOME), WorkerMotion.WALK_SPEED * 0.5, 0.05)

	_hold(WorkerView.new(RUNNING, 5), WALK_THERE)

	assert_almost_eq(_body.position, _track.point_at(0.0), Vector3.ONE * 0.001)


func test_he_runs_laps_in_step_with_the_lap_clock() -> void:
	_walk_out()

	_run(LAP_SECONDS * 1.5)

	assert_eq(_player.current_animation, WorkerMotion.RUNNING)
	assert_lt(_off_the_clock(0.5), 1.0)


func test_he_runs_over_the_lap_line_at_full_stride() -> void:
	_walk_out()
	_run(LAP_SECONDS * 1.5)
	var mid_lap_speed := _motion.track_speed()
	var slowest_near_the_line := INF
	_run(LAP_SECONDS * 0.35, 0.5)

	for frame in ceili(LAP_SECONDS * 0.3 / STEP):
		_run(STEP, 0.85 + frame * STEP / LAP_SECONDS)
		if _body.position.distance_to(_track.point_at(0.0)) < 1.0:
			slowest_near_the_line = minf(slowest_near_the_line, _motion.track_speed())

	assert_lt(slowest_near_the_line, INF, "he passed the line")
	assert_gt(slowest_near_the_line, mid_lap_speed * 0.9)
	assert_eq(_player.current_animation, WorkerMotion.RUNNING)


func test_he_slows_to_a_walk_as_his_last_lap_ends() -> void:
	_walk_out()

	_run(LAP_SECONDS * 0.2, 0.0, 1)
	assert_eq(_player.current_animation, WorkerMotion.RUNNING)
	_run(LAP_SECONDS * 0.79, 0.2, 1)

	assert_eq(_player.current_animation, WorkerMotion.WALKING)


func test_he_staggers_into_his_breath_on_the_lap_line() -> void:
	_walk_out()
	_run(LAP_SECONDS * 0.99, 0.0, 1)

	_hold(WorkerView.new(BREATHING, 5), 2.0)

	assert_almost_eq(_body.position, _track.point_at(0.0), Vector3.ONE * 0.001)
	assert_eq(_player.current_animation, WorkerMotion.STAGGERING)
	assert_eq(Array(_player.get_queue()), [WorkerMotion.BREATHING])


func test_he_staggers_into_a_breath_that_began_while_he_walked_out() -> void:
	_hold(WorkerView.new(RUNNING, 1), 0.5)

	_hold(WorkerView.new(BREATHING, 5), WALK_THERE)

	assert_almost_eq(_body.position, _track.point_at(0.0), Vector3.ONE * 0.001)
	assert_eq(_player.current_animation, WorkerMotion.STAGGERING)


func test_he_runs_on_over_the_lap_line_after_his_breath() -> void:
	_walk_out()
	_hold(WorkerView.new(BREATHING, 5), 1.0)

	_run(1.0)

	assert_eq(_player.current_animation, WorkerMotion.RUNNING)
	assert_gt(_body.position.distance_to(_track.point_at(0.0)), 1.0)


func test_behind_the_lap_clock_he_catches_up() -> void:
	_walk_out(0.2)

	_run(LAP_SECONDS * 0.3, 0.2)

	assert_lt(_off_the_clock(0.5), 1.0)


func test_ahead_of_a_lap_clock_carried_over_he_waits_on_the_lap_line_for_it() -> void:
	_walk_out(0.8)
	_run(LAP_SECONDS * 0.1, 0.8)

	assert_almost_eq(_body.position, _track.point_at(0.0), Vector3.ONE * 0.001)
	assert_eq(_player.current_animation, WorkerMotion.STANDING)

	_run(LAP_SECONDS * 0.4, 0.9)
	assert_lt(_off_the_clock(0.3), 1.0)


func test_he_goes_back_along_the_track_and_through_the_gate_to_his_place() -> void:
	_walk_out()
	_run(LAP_SECONDS * 0.3)

	_hold(WorkerView.new(WorkerView.Activity.IN_FIELD, 5), 0.5)
	assert_eq(_player.current_animation, WorkerMotion.RUNNING, "he jogs back")
	var heading := _track.heading_at(0.3 * _track.length())
	assert_almost_eq(_body.rotation.y, atan2(-heading.x, -heading.z), 0.01, "the shorter way")

	_hold(WorkerView.new(WorkerView.Activity.IN_FIELD, 5), 20.0)

	assert_almost_eq(_body.position, HOME, Vector3.ONE * 0.001)
	assert_almost_eq(_body.rotation.y, HOME_FACING, 0.001)
	assert_eq(_player.current_animation, WorkerMotion.STANDING)


func test_he_rests_standing_at_his_place() -> void:
	_walk_out()
	_run(LAP_SECONDS * 0.6)

	_hold(WorkerView.new(WorkerView.Activity.RESTING, 5), 20.0)

	assert_almost_eq(_body.position, HOME, Vector3.ONE * 0.001)
	assert_eq(_player.current_animation, WorkerMotion.STANDING)


func test_he_slumps_and_slows_as_exhaustion_rises() -> void:
	_motion.show(WorkerView.new(WorkerView.Activity.IN_FIELD, 5, Exhaustion.MOST))

	assert_almost_eq(_body.rotation.x, deg_to_rad(WorkerMotion.MOST_SLUMP_DEGREES), 0.001)
	assert_almost_eq(_player.speed_scale, WorkerMotion.SLOWEST_ANIMATION_SPEED, 0.001)


func test_rested_again_he_straightens_up() -> void:
	_motion.show(WorkerView.new(WorkerView.Activity.IN_FIELD, 5, Exhaustion.MOST))

	_motion.show(WorkerView.new(WorkerView.Activity.IN_FIELD, 5, 0.0))

	assert_eq(_body.rotation.x, 0.0)
	assert_eq(_player.speed_scale, 1.0)


func test_he_never_plays_a_fighting_animation() -> void:
	var used: Array[StringName] = [WorkerMotion.STAGGERING]
	used.append_array(WorkerMotion.LOOPING)
	for animation in used:
		for fighting: String in ["Punch", "Kick", "Sword", "Gun", "Shoot", "Death"]:
			assert_false(String(animation).contains(fighting), "%s is a fighting move" % animation)


func test_whipped_he_flinches_and_staggers_on_the_lap_line_then_runs_again() -> void:
	_walk_out()
	_hold(WorkerView.new(BREATHING, 5), 1.0)

	_motion.flinch()
	_run(WorkerMotion.FLINCH_SECONDS / 2.0)

	assert_eq(_player.current_animation, WorkerMotion.STAGGERING)
	assert_almost_eq(_body.position, _track.point_at(0.0), Vector3.ONE * 0.05)
	_run(WorkerMotion.FLINCH_SECONDS)
	assert_eq(_player.current_animation, WorkerMotion.RUNNING)


func test_with_the_stagger_skipped_he_breathes_and_runs_on_without_it() -> void:
	_motion.skip_stagger = true
	_walk_out()
	_run(LAP_SECONDS * 0.99, 0.0, 1)

	_hold(WorkerView.new(BREATHING, 5), 1.0)
	assert_eq(_player.current_animation, WorkerMotion.BREATHING)
	_motion.flinch()
	_run(WorkerMotion.FLINCH_SECONDS / 2.0)

	assert_ne(_player.current_animation, WorkerMotion.STAGGERING)
	assert_gt(_body.position.distance_to(_track.point_at(0.0)), 0.05)


func test_his_speed_on_the_track_is_zero_unless_he_runs_it() -> void:
	assert_eq(_motion.track_speed(), 0.0)
	_walk_out()
	_run(LAP_SECONDS * 0.5)
	assert_almost_eq(_motion.track_speed(), _track.length() / LAP_SECONDS, 0.5)
	_run(LAP_SECONDS * 0.49, 0.5, 1)

	_hold(WorkerView.new(BREATHING, 5), 2.0)

	assert_eq(_motion.track_speed(), 0.0)
