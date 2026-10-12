extends GutTest
## The Worker leans forward as Exhaustion rises, unless reduced motion turns the slump off.

const WORKER_MODEL := preload("res://assets/quaternius-modular-men/farmer.glb")
const GATE := Vector3(-5.5, 0.0, 3.0)
const IN_FIELD := WorkerView.Activity.IN_FIELD

var _body: Node3D
var _motion: WorkerMotion


func before_each() -> void:
	_body = WORKER_MODEL.instantiate()
	add_child_autofree(_body)
	var player: AnimationPlayer = _body.find_children("*", "AnimationPlayer", true, false)[0]
	var track := TrackPath.new(Rect2(-7.0, -5.0, 14.0, 10.0), 1.0, 3.0)
	_motion = WorkerMotion.new(_body, player, track, GATE)


func test_he_leans_forward_as_exhaustion_rises() -> void:
	_motion.show(WorkerView.new(IN_FIELD, 5, Exhaustion.MOST))

	assert_almost_eq(_body.rotation.x, deg_to_rad(WorkerMotion.MOST_SLUMP_DEGREES), 0.001)


func test_with_the_slump_skipped_he_stays_upright_however_exhausted() -> void:
	_motion.skip_slump = true
	_motion.show(WorkerView.new(IN_FIELD, 5, Exhaustion.MOST))

	assert_eq(_body.rotation.x, 0.0)
