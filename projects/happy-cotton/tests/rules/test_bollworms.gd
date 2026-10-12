extends GutTest
## Bollworms, through the Farm's public interface: every check, counted in online play outside
## Study Sessions, each growing Plot without them may get them. Tapping the Plot picks them off,
## which keeps the Worker busy and adds Exhaustion. Left for the eat time they eat the crop: the
## Plot empties and it is logged as Negligence, as for a Withered Plot. A ripe crop with
## Bollworms can't be picked until they are picked off. Nothing comes or eats offline.

const CHECK := FastTuning.BOLLWORM_CHECK_SECONDS
const EAT := FastTuning.BOLLWORM_EAT_SECONDS
const PICK_OFF := FastTuning.BOLLWORM_PICK_OFF_SECONDS

var _farm: Farm


func before_each() -> void:
	_farm = Farm.new(FastTuning.with_bollworms(FastTuning.table()))
	_farm.take_messages()


func _message(key: StringName, messages: Array[AppMessage]) -> AppMessage:
	for message in messages:
		if message.key == key:
			return message
	return null


## Seconds offline that ripen a crop planted just now, with no Bollworm check on the way.
func _offline_ripen_seconds() -> float:
	return FastTuning.GROW_SECONDS / FastTuning.OFFLINE_GROWTH_RATE


func test_a_growing_plot_gets_bollworms_at_the_check_and_not_before() -> void:
	_farm.plant(0)

	HandingIn.advance(_farm, CHECK - 1.0)
	assert_false(_farm.plot(0).bollworms, "not a second early")

	HandingIn.advance(_farm, 1.0)
	assert_true(_farm.plot(0).bollworms)
	assert_eq(_farm.plot(0).bollworm_seconds_left, EAT)
	var arrived := _message(Farm.BOLLWORMS_ARRIVED, _farm.take_messages())
	assert_not_null(arrived, "The App says so")
	var plots: int = arrived.values["plots"]
	var plot_indexes: Array = arrived.values["plot_indexes"]
	assert_eq(plots, 1)
	assert_eq(plot_indexes, [0])


func test_empty_ripe_and_withered_plots_get_none() -> void:
	var farm := Farm.new(FastTuning.with_bollworms(FastTuning.withering_table()))
	farm.plant(0)
	farm.plant(1)
	farm.resume_offline(_offline_ripen_seconds())
	farm.resume_offline(FastTuning.WITHER_SECONDS)
	assert_eq(farm.plot(0).stage, PlotView.Stage.WITHERED)
	HandingIn.advance(farm, FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS)
	farm.clear(1)
	farm.plant(1)
	farm.resume_offline(_offline_ripen_seconds())
	farm.plant(2)

	HandingIn.advance(farm, CHECK)

	assert_false(farm.plot(0).bollworms, "Withered")
	assert_false(farm.plot(1).bollworms, "ripe")
	assert_true(farm.plot(2).bollworms, "growing")
	assert_false(farm.plot(3).bollworms, "empty")


func test_the_roll_decides_whether_they_come() -> void:
	var tuning := FastTuning.table()
	tuning.bollworm_chance = 0.5
	var spared := Farm.new(tuning, func() -> float: return 0.5)
	var struck := Farm.new(tuning, func() -> float: return 0.49)
	spared.plant(0)
	struck.plant(0)

	HandingIn.advance(spared, CHECK)
	HandingIn.advance(struck, CHECK)

	assert_false(spared.plot(0).bollworms)
	assert_true(struck.plot(0).bollworms)


func test_a_later_check_leaves_their_time_running() -> void:
	_farm.plant(0)

	HandingIn.advance(_farm, CHECK * 2)

	assert_eq(_farm.plot(0).bollworm_seconds_left, EAT - CHECK)


func test_tapping_picks_them_off_and_keeps_the_worker_busy_and_adds_exhaustion() -> void:
	_farm.plant(0)
	_farm.plant(1)
	HandingIn.advance(_farm, CHECK)
	_farm.run_generator()

	assert_true(_farm.pick_off_bollworms(0).happened)

	assert_false(_farm.plot(0).bollworms)
	assert_true(_farm.plot(1).bollworms, "only the Plot tapped")
	assert_eq(_farm.exhaustion(), FastTuning.BOLLWORM_PICK_OFF_EXHAUSTION)
	assert_eq(_farm.worker().activity, WorkerView.Activity.IN_FIELD, "back from the Generator")
	HandingIn.advance(_farm, PICK_OFF - 0.5)
	assert_eq(_farm.pick_off_bollworms(1).reason, Farm.WORKER_BUSY)
	HandingIn.advance(_farm, 0.5)
	assert_true(_farm.pick_off_bollworms(1).happened)


func test_picking_off_needs_bollworms_and_a_plot() -> void:
	_farm.plant(0)

	assert_eq(_farm.pick_off_bollworms(0).reason, Farm.NO_BOLLWORMS)
	assert_eq(_farm.pick_off_bollworms(99).reason, Farm.NO_SUCH_PLOT)


func test_a_ripe_crop_with_bollworms_cant_be_picked_until_they_are_picked_off() -> void:
	_farm.plant(0)
	_farm.run_generator()
	HandingIn.advance(_farm, FastTuning.GROW_SECONDS)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.RIPE)
	assert_true(_farm.plot(0).bollworms, "they came while it grew")

	assert_eq(_farm.pick(0).reason, Farm.BOLLWORMS_ON_PLOT)

	_farm.pick_off_bollworms(0)
	HandingIn.advance(_farm, PICK_OFF)
	assert_true(_farm.pick(0).happened)


func test_left_for_the_eat_time_they_eat_the_crop_and_it_is_negligence() -> void:
	_farm.debug_add_labour_points(20)
	_farm.plant(0)
	HandingIn.advance(_farm, CHECK)
	_farm.take_messages()

	HandingIn.advance(_farm, EAT - 1.0)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.SEEDLING, "not eaten a second early")

	HandingIn.advance(_farm, 1.0)
	assert_eq(_farm.plot(0).stage, PlotView.Stage.EMPTY, "the Plot empties, nothing Withered")
	assert_false(_farm.plot(0).bollworms)
	var eaten := _message(Farm.CROP_EATEN, _farm.take_messages())
	assert_not_null(eaten)
	var plots: int = eaten.values["plots"]
	var plot_indexes: Array = eaten.values["plot_indexes"]
	var points: int = eaten.values["points"]
	assert_eq(plots, 1)
	assert_eq(plot_indexes, [0])
	assert_eq(points, FastTuning.NEGLIGENCE_LABOUR_POINTS)
	assert_eq(_farm.labour_points(), 20 - FastTuning.NEGLIGENCE_LABOUR_POINTS)
	assert_eq(_farm.study_session_seconds_left(), FastTuning.NEGLIGENCE_STUDY_SESSION_SECONDS)


func test_an_eaten_crop_docks_no_labour_points_below_zero() -> void:
	_farm.plant(0)

	HandingIn.advance(_farm, CHECK + EAT)

	assert_eq(_farm.labour_points(), 0)
	assert_true(_farm.in_study_session())


func test_picked_off_in_time_the_crop_is_safe() -> void:
	_farm.plant(0)
	HandingIn.advance(_farm, CHECK + EAT - 1.0)

	_farm.pick_off_bollworms(0)
	HandingIn.advance(_farm, 1.0)

	assert_eq(_farm.plot(0).stage, PlotView.Stage.SEEDLING)
	assert_false(_farm.in_study_session())


func test_nothing_comes_or_eats_offline() -> void:
	_farm.plant(0)
	_farm.resume_offline(CHECK * 3)
	assert_false(_farm.plot(0).bollworms, "none came while away")

	HandingIn.advance(_farm, CHECK)
	_farm.resume_offline(EAT * 2)

	assert_true(_farm.plot(0).bollworms)
	assert_eq(_farm.plot(0).bollworm_seconds_left, EAT, "their time waits too")
	assert_ne(_farm.plot(0).stage, PlotView.Stage.EMPTY)


## Checks every 30 s and an eat time of 95 s, so Bollworms that came at 30 s outlast the first
## Shift (100 s) and its missed Quota's 20-second Study Session.
func _farm_in_a_study_session_with_bollworms() -> Farm:
	var tuning := FastTuning.with_bollworms(FastTuning.table())
	tuning.bollworm_check_seconds = 30.0
	tuning.bollworm_eat_seconds = 95.0
	var farm := Farm.new(tuning)
	farm.plant(0)
	farm.advance(91.0)
	assert_true(farm.plot(0).bollworms, "came at 30 s")
	farm.plant(1)
	farm.advance(9.0)
	farm.hand_in()
	assert_true(farm.in_study_session(), "the Quota was missed")
	return farm


func test_nothing_comes_or_eats_during_a_study_session() -> void:
	var farm := _farm_in_a_study_session_with_bollworms()

	farm.advance(FastTuning.STUDY_SESSION_SECONDS)
	assert_false(farm.in_study_session())
	assert_eq(farm.plot(0).bollworm_seconds_left, 95.0 - 70.0, "paused through the session")
	assert_false(farm.plot(1).bollworms, "the next check is 30 s outside the session")

	farm.advance(19.0)
	assert_false(farm.plot(1).bollworms)
	farm.advance(1.0)
	assert_true(farm.plot(1).bollworms)
	farm.advance(5.0)
	assert_eq(farm.plot(0).stage, PlotView.Stage.EMPTY, "eaten 95 s after they came")


func test_debug_bollworms_now_puts_them_on_every_growing_plot() -> void:
	var farm := Farm.new(FastTuning.table())
	farm.plant(0)
	farm.plant(1)
	farm.resume_offline(_offline_ripen_seconds())
	farm.plant(2)
	farm.take_messages()

	farm.debug_bollworms_now()

	assert_false(farm.plot(0).bollworms, "ripe")
	assert_true(farm.plot(2).bollworms)
	assert_false(farm.plot(3).bollworms, "empty")
	assert_not_null(_message(Farm.BOLLWORMS_ARRIVED, farm.take_messages()))


func test_bollworms_and_the_check_clock_are_saved() -> void:
	_farm.plant(0)
	HandingIn.advance(_farm, CHECK + 5.0)
	var restored := Farm.new(FastTuning.with_bollworms(FastTuning.table()))

	var parsed: Dictionary = JSON.parse_string(JSON.stringify(_farm.to_save()))
	assert_eq(restored.restore(parsed), [] as Array[String])

	assert_true(restored.plot(0).bollworms)
	assert_eq(restored.plot(0).bollworm_seconds_left, EAT - 5.0)
	restored.plant(1)
	HandingIn.advance(restored, CHECK - 5.0)
	assert_true(restored.plot(1).bollworms, "the next check came on time")


func test_a_save_from_before_bollworms_restores_with_none() -> void:
	_farm.plant(0)
	HandingIn.advance(_farm, CHECK)
	var save := _farm.to_save()
	save["version"] = 13
	save.erase("bollworms")
	var restored := Farm.new(FastTuning.with_bollworms(FastTuning.table()))

	assert_eq(restored.restore(save), [] as Array[String])

	assert_false(restored.plot(0).bollworms)
