extends GutTest
## The entry scene's Bollworm wiring: a tap on a Plot with Bollworms picks them off before
## anything else, Bollworms arriving, picked off and eating a crop are logged by Plot, and debug
## mode's "Bollworms now" brings them at once. Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_bollworms"
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


func _farm(main: Node) -> Farm:
	return main.get("_farm")


func test_debug_bollworms_now_puts_them_on_the_field_and_logs_them() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")
	field.plot_tapped.emit(0)

	main.call("_on_bollworms_requested")

	assert_has(_lines, "[info] debug bollworms now")
	assert_has(_lines, "[info] bollworms arrived plots=1 plot_indexes=[0]")
	assert_true(_farm(main).plot(0).bollworms)
	assert_true((field.get_node("Plot0/Bollworms") as Node3D).visible)
	assert_string_contains((main.get_node("AppOverlay") as AppOverlay).speech(), "Bollworms")


func test_a_tap_picks_them_off_first_even_with_fertiliser_chosen() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var field: Field = main.get_node("Field")
	main.call("_on_labour_points_requested", 100)
	app.supply_pressed.emit(Farm.FERTILISER)
	field.plot_tapped.emit(0)
	main.call("_on_bollworms_requested")
	app.supplies_bar().button(Farm.FERTILISER).pressed.emit()

	field.plot_tapped.emit(0)

	assert_has(_lines, "[info] bollworms picked off plot=0")
	assert_false(_farm(main).plot(0).bollworms)
	assert_false(_farm(main).plot(0).fertilised, "the supply is put back")
	assert_eq(app.supplies_bar().chosen(), &"")


func test_a_crop_eaten_is_logged() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var field: Field = main.get_node("Field")
	field.plot_tapped.emit(0)
	main.call("_on_bollworms_requested")

	_farm(main).advance(tuning.bollworm_eat_seconds)
	main.call("_show_farm")

	assert_has(_lines, "[info] crop eaten plots=1 points=0 plot_indexes=[0]")
