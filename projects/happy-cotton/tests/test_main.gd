extends GutTest
## Smoke test of the entry scene: it loads, logs the build version and accepts the shipped
## tuning table, that a tap on the field reaches the Farm rules, and that offline time and
## Skip time are logged. Its save slot is in a test folder of its own (saving itself is
## tested in test_main_save.gd).

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main"
const SAVE_SLOT := SAVE_FOLDER + "/save.json"

var _lines: Array[String] = []
var _store := SaveStore.new(SAVE_SLOT)
var _settings_store := SettingsStore.new(SAVE_FOLDER + "/settings.json")


func before_each() -> void:
	_lines = []
	GameLog.reset()
	GameLog.sink = func(_level: GameLog.Level, line: String) -> void: _lines.append(line)
	_empty_save_folder()


func after_each() -> void:
	GameLog.reset()


func after_all() -> void:
	_empty_save_folder()


func _empty_save_folder() -> void:
	DirAccess.make_dir_recursive_absolute(SAVE_FOLDER)
	for file in DirAccess.get_files_at(SAVE_FOLDER):
		DirAccess.remove_absolute(SAVE_FOLDER.path_join(file))


func _main() -> Node:
	var main := MAIN_SCENE.instantiate()
	main.set("save_store", _store)
	main.set("settings_store", _settings_store)
	return main


## Presses the Hand-in card's button, as the player would.
func _hand_in(main: Node) -> void:
	var app: AppOverlay = main.get_node("AppOverlay")
	var button: Button = app.find_child("HandInButton", true, false)
	button.pressed.emit()


func test_the_entry_scene_logs_the_build_version_on_start() -> void:
	add_child_autofree(_main())
	await wait_process_frames(1)

	assert_has(_lines, '[info] game started version="%s"' % BuildVersion.read())


func test_the_entry_scene_starts_with_the_shipped_tuning_table() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	var tuning: Tuning = main.call("tuning")
	assert_not_null(tuning)
	assert_false(_lines.any(func(line: String) -> bool: return line.begins_with("[error]")))


func test_tapping_an_empty_plot_plants_it_and_logs_at_debug_level() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")

	field.plot_tapped.emit(2)

	assert_has(_lines, "[debug] plant plot=2")


func test_tapping_a_growing_plot_is_refused_by_the_rules_as_not_ripe() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")
	field.plot_tapped.emit(0)
	_lines.clear()

	field.plot_tapped.emit(0)

	var expected: Array[String] = [
		'[debug] pick refused plot=0 reason=&"not_ripe"', '[debug] game saved reason="command"'
	]
	assert_eq(_lines, expected)


func test_a_rest_hour_he_cannot_afford_is_refused_and_the_mascot_says_why() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")

	app.privilege_pressed.emit(Farm.REST_HOUR)

	var refused := '[debug] purchase refused item=&"rest_hour" reason=&"not_enough_labour_points"'
	assert_has(_lines, refused)
	assert_string_contains(app.speech(), "You have 0")
	assert_eq((app.find_child("StoreButton", true, false) as Button).text, "Store")


func test_the_mascot_announces_the_first_shift_on_start() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")

	assert_string_contains(app.speech(), "Shift 1 begins!")


func test_the_end_of_a_shift_logs_the_quota_check_at_info_level() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")

	main.call("_process", tuning.shift_seconds)
	_hand_in(main)

	var quota := roundi(tuning.first_quota)
	assert_has(_lines, "[info] quota checked shift=1 picked=0 quota=%d met=false" % quota)


func test_the_end_of_a_shift_logs_each_bill_shows_the_pay_slip_and_the_debt() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var app: AppOverlay = main.get_node("AppOverlay")
	var rent := roundi(tuning.rent_per_shift)

	main.call("_process", tuning.shift_seconds)
	_hand_in(main)

	var electricity := '[info] bill charged shift=1 bill="electricity" amount=0 laps=0 covered=true'
	assert_has(_lines, electricity)
	assert_has(_lines, '[info] bill charged shift=1 bill="rent" amount=%d covered=false' % rent)
	assert_has(_lines, "[info] debt incurred debt=%d" % rent)
	assert_true((app.find_child("PaySlipCard", true, false) as PaySlipCard).visible)
	assert_true((app.find_child("BalanceBadge", true, false) as BalanceBadge).shows_debt())


func test_the_mascot_says_the_quota_result_and_the_next_shift_together() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_process", tuning.shift_seconds)
	_hand_in(main)

	assert_string_contains(app.speech(), "The Quota was not met")
	assert_string_contains(app.speech(), "Shift 2 begins!")


func test_a_missed_quota_logs_the_study_session_and_shows_the_room() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_process", tuning.shift_seconds)
	_hand_in(main)

	var seconds := tuning.study_session_seconds
	var started := (
		"[info] study session started seconds=%s minutes=%d in_a_row=1"
		% [var_to_str(seconds), ceili(seconds / 60.0)]
	)
	assert_has(_lines, started)
	assert_true(app.in_study_room())

	main.call("_process", seconds)

	assert_has(_lines, "[info] study session ended in_a_row=1")
	assert_false(app.in_study_room())


func test_tapping_the_generator_sends_the_worker_and_lights_the_lamp_and_the_app() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")
	var generator: Generator = field.get_node("Generator")
	var app: AppOverlay = main.get_node("AppOverlay")
	assert_false(app.is_powered(), "The App is dim before he runs")

	field.generator_tapped.emit()

	assert_has(_lines, "[debug] run generator")
	assert_has(_lines, '[debug] worker activity="running"')
	assert_true(generator.is_lit())
	assert_true(app.is_powered())

	field.plot_tapped.emit(0)

	assert_has(_lines, '[debug] worker activity="in_field"')
	assert_false(generator.is_lit())
	assert_false(app.is_powered())


func test_there_is_no_skip_time_control_without_debug_mode() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	assert_eq(main.find_children("*", "DebugPanel", true, false).size(), 0)


func test_skip_time_runs_the_offline_resume_logs_it_and_shows_the_away_summary() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_on_skip_requested", 3600.0)

	assert_has(_lines, "[info] skip time seconds=3600.0")
	assert_has(
		_lines,
		(
			"[info] offline resume seconds=3600.0 ripened=0 withered=0"
			+ " study_seconds_served=0.0 exhaustion_recovered=0.0"
		)
	)
	assert_string_contains(app.speech(), "Welcome back!")


func test_ripe_cotton_skipped_past_the_wither_time_is_logged_as_negligence_and_cleared() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var field: Field = main.get_node("Field")
	var app: AppOverlay = main.get_node("AppOverlay")
	field.plot_tapped.emit(0)
	main.call("_on_skip_requested", 3600.0)
	assert_has(
		_lines,
		(
			"[info] offline resume seconds=3600.0 ripened=1 withered=0 study_seconds_served=0.0"
			+ " exhaustion_recovered=0.5"
		)
	)

	main.call("_on_skip_requested", tuning.wither_seconds)

	assert_has(_lines, "[info] negligence logged plots=1 points=0")
	var seconds := tuning.negligence_study_session_seconds
	var started := (
		"[info] study session started seconds=%s minutes=%d in_a_row=0"
		% [var_to_str(seconds), ceili(seconds / 60.0)]
	)
	assert_has(_lines, started)
	assert_string_contains(app.speech(), "Negligence logged")
	assert_true(app.in_study_room())

	# The first skip left the cotton ripe for this long, so the second Withered it this long
	# before its end and served that much of the Study Session.
	var ripe_before := 3600.0 - tuning.grow_seconds / tuning.offline_growth_rate
	main.call("_process", seconds - ripe_before)
	assert_false(app.in_study_room())
	_lines.clear()
	field.plot_tapped.emit(0)

	assert_has(_lines, "[debug] clear plot=0")


func test_offline_time_past_the_cap_is_logged_as_a_warning() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var too_long := tuning.offline_cap_seconds * 2.0

	main.call("_resume_offline", too_long)

	var warning := (
		'[warning] offline time adjusted problem=&"offline_time_capped" seconds_away=%s'
		+ " seconds_counted=%s"
	)
	assert_has(_lines, warning % [var_to_str(too_long), var_to_str(tuning.offline_cap_seconds)])


func test_negative_offline_time_is_logged_as_a_warning() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	main.call("_resume_offline", -60.0)

	assert_has(
		_lines,
		(
			'[warning] offline time adjusted problem=&"negative_offline_time"'
			+ " seconds_away=-60.0 seconds_counted=0.0"
		)
	)


func test_the_stored_settings_are_put_into_effect_and_the_app_opens_them() -> void:
	var stored := PlayerSettings.new()
	stored.reduced_motion = true
	stored.muted = true
	_settings_store.write(stored)
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app := main.get_node("AppOverlay") as AppOverlay
	var panel := main.find_child("SettingsPanel", true, false) as Control

	app.celebrate()
	assert_false(app.is_celebrating(), "reduced motion: no confetti")
	assert_true(AudioServer.is_bus_mute(AudioServer.get_bus_index(&"Master")))
	assert_false(panel.visible)
	app.settings_pressed.emit()
	assert_true(panel.visible)

	SettingsEffects.apply_volume(PlayerSettings.new())
