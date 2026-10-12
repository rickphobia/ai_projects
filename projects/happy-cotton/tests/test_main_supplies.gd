extends GutTest
## The entry scene's supplies wiring: buying Fertiliser from the store is logged with its kind
## and price and fills the supplies bar; picking it on the bar makes the next plot tap spread it
## (logged with its kind and Plot), and the tap after works as normal; a refusal is said plainly
## by The App. Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_supplies"
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


func test_buying_fertiliser_logs_it_and_fills_the_supplies_bar() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var tuning: Tuning = main.call("tuning")
	main.call("_on_labour_points_requested", 100)
	app.open_store()

	app.supply_pressed.emit(Farm.FERTILISER)

	var price := roundi(tuning.fertiliser_first_price)
	assert_has(_lines, '[info] supply bought kind=&"fertiliser" price=%d' % price)
	assert_false(app.is_store_open(), "the store closes so the celebration shows")
	assert_string_contains(app.speech(), "Delivered!")
	assert_eq(app.supplies_bar().button(Farm.FERTILISER).text, "Fertiliser ×1")


func test_the_next_plot_tap_after_picking_fertiliser_spreads_it_then_taps_are_normal() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var field: Field = main.get_node("Field")
	main.call("_on_labour_points_requested", 100)
	app.supply_pressed.emit(Farm.FERTILISER)
	field.plot_tapped.emit(0)

	app.supplies_bar().button(Farm.FERTILISER).pressed.emit()
	field.plot_tapped.emit(0)

	assert_has(_lines, '[info] supply used kind=&"fertiliser" plot=0')
	assert_true(_farm(main).plot(0).fertilised)
	assert_eq(app.supplies_bar().chosen(), &"")
	field.plot_tapped.emit(1)
	assert_eq(_farm(main).plot(1).stage, PlotView.Stage.SEEDLING, "the tap after plants")
	assert_false(_farm(main).plot(1).fertilised)


func test_with_none_held_the_app_says_so_plainly() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var field: Field = main.get_node("Field")
	field.plot_tapped.emit(0)

	app.supplies_bar().button(Farm.FERTILISER).pressed.emit()
	field.plot_tapped.emit(0)

	assert_eq(app.speech(), AppText.render_fertilise_refusal(Farm.NONE_HELD))
	assert_false(_farm(main).plot(0).fertilised)
