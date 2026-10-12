extends GutTest
## The entry scene's store wiring: a purchase from The App's store reaches the rules, is logged
## with its item, tier and price (a Plot with its number and price), closes the store so the
## Mascot's celebration shows, and shows in the field; debug mode's +100 Labour Points goes
## through the rules' debug command. Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_store"
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


func test_buying_a_generator_tier_logs_it_celebrates_and_shows_in_the_field() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var generator: Generator = main.get_node("Field/Generator")
	var tuning: Tuning = main.call("tuning")
	var tier := tuning.generator_tiers[0]
	main.call("_on_labour_points_requested", 100)
	app.open_store()

	app.upgrade_pressed.emit(Farm.GENERATOR)

	assert_has(_lines, "[info] debug labour points added points=100")
	assert_has(_lines, '[info] upgrade bought item=&"generator" tier=1 price=%d' % tier.price)
	assert_false(app.is_store_open(), "the store closes so the celebration shows")
	assert_string_contains(app.speech(), "Congratulations! Generator tier 1")
	assert_eq(generator.tier(), 1)


func test_buying_a_tools_tier_logs_it_celebrates_and_shows_in_the_field() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var rack: ToolRack = main.get_node("Field/ToolRack")
	var tuning: Tuning = main.call("tuning")
	var tier := tuning.tools_tiers[0]
	main.call("_on_labour_points_requested", 100)
	app.open_store()

	app.upgrade_pressed.emit(Farm.TOOLS)

	assert_has(_lines, '[info] upgrade bought item=&"tools" tier=1 price=%d' % tier.price)
	assert_false(app.is_store_open(), "the store closes so the celebration shows")
	assert_string_contains(app.speech(), "Tools tier 1")
	assert_eq(rack.tier(), 1)


func test_buying_a_rest_hour_logs_it_and_the_store_button_shows_the_rest() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var tuning: Tuning = main.call("tuning")
	main.call("_on_labour_points_requested", 100)

	app.privilege_pressed.emit(Farm.REST_HOUR)

	var bought := '[info] privilege bought item=&"rest_hour" price=%d' % tuning.rest_hour_price
	assert_has(_lines, bought)
	assert_string_contains((app.find_child("StoreButton", true, false) as Button).text, "Resting")


func test_buying_a_plot_logs_it_celebrates_and_grows_the_field() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var tuning: Tuning = main.call("tuning")
	main.call("_on_labour_points_requested", 100)
	app.open_store()

	app.land_pressed.emit()

	assert_has(_lines, "[info] plot bought plot=13 price=%d" % tuning.first_plot_price)
	assert_false(app.is_store_open(), "the store closes so the celebration shows")
	assert_string_contains(app.speech(), "Plot 13")
	assert_true(main.has_node("Field/Plot12"))
	assert_eq(main.get_node("Field/UnworkedGround").get_child_count(), 2)
