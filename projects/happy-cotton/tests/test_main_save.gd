extends GutTest
## The entry scene's saving: a new game is saved at once, after each command, at the end of a
## Shift and when the game loses focus; a save is continued with its time away counted; a
## damaged one is kept aside and the player offered Start over; and the log never holds the
## save itself. Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_save"
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


## The Farm in the save slot, restored with the shipped tuning table.
func _saved_farm(main: Node) -> Farm:
	var tuning: Tuning = main.call("tuning")
	var farm := Farm.new(tuning)
	assert_eq(farm.restore(_store.read().farm), [] as Array[String])
	return farm


## A save of a Farm with plot 0 planted, written `seconds_ago`.
func _write_save(seconds_ago: float) -> void:
	var tuning := Tuning.load_file("res://data/tuning.tres")
	var farm := Farm.new(tuning)
	farm.plant(0)
	_store.write(farm.to_save(), Time.get_unix_time_from_system() - seconds_ago)


func _has_line_starting(start: String) -> bool:
	return _lines.any(func(line: String) -> bool: return line.begins_with(start))


func test_a_new_game_is_saved_at_once_and_after_each_command() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")
	assert_true(_store.has_save(), "saved on start")

	field.plot_tapped.emit(4)

	assert_eq(_saved_farm(main).plot(4).stage, PlotView.Stage.SEEDLING)


func test_the_hand_in_opening_and_handing_in_are_each_saved() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")

	main.call("_process", tuning.shift_seconds)

	assert_true(_saved_farm(main).hand_in_open(), "closing the game now finds it waiting")

	var app: AppOverlay = main.get_node("AppOverlay")
	var button: Button = app.find_child("HandInButton", true, false)
	button.pressed.emit()

	assert_false(_saved_farm(main).hand_in_open())
	assert_eq(_saved_farm(main).shift().number, 2)


func test_leaving_the_game_saves_it() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	main.call("_process", 1.0)
	_lines.clear()

	var watch: LeavingWatch = main.find_children("*", "LeavingWatch", true, false)[0]
	watch.leaving.emit()

	assert_eq(_lines, ['[debug] game saved reason="hidden"'] as Array[String])
	var tuning: Tuning = main.call("tuning")
	assert_lt(_saved_farm(main).shift().seconds_left, tuning.shift_seconds - 0.5, "play saved")


func test_a_save_is_continued_with_the_time_away_counted_and_logged() -> void:
	_write_save(3600.0)

	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")
	var app: AppOverlay = main.get_node("AppOverlay")

	assert_has(_lines, '[info] save loaded path="%s" shift=1' % SAVE_SLOT)
	assert_true(_has_line_starting("[info] offline resume seconds=3600."), "an hour away")
	assert_string_contains(app.speech(), "Welcome back!")
	_lines.clear()
	field.plot_tapped.emit(0)
	assert_false(_has_line_starting("[debug] plant plot=0"), "plot 0 was already planted")
	assert_false(_store.read().farm.is_empty())


func test_continuing_a_save_rewrites_it_so_the_time_away_counts_once() -> void:
	_write_save(3600.0)
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	assert_almost_eq(_store.read().saved_at, Time.get_unix_time_from_system(), 5.0)


func test_a_save_that_is_not_json_is_kept_aside_and_the_player_offered_start_over() -> void:
	var file := FileAccess.open(SAVE_SLOT, FileAccess.WRITE)
	file.store_string("{ not a save")
	file.close()

	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	var kept_as := SAVE_FOLDER + "/save.damaged-1.json"
	assert_eq(FileAccess.get_file_as_string(kept_as), "{ not a save", "kept aside, untouched")
	assert_false(_store.has_save(), "nothing saved over it")
	assert_true(_has_line_starting('[warning] save unreadable problem="not JSON'))
	var notice: DamagedSaveNotice = main.find_children("*", "DamagedSaveNotice", true, false)[0]
	var start_over := notice.find_child("StartOverButton", true, false) as Button

	start_over.pressed.emit()

	assert_has(_lines, "[info] start over after a damaged save")
	assert_eq(_saved_farm(main).shift().number, 1)
	assert_eq(FileAccess.get_file_as_string(kept_as), "{ not a save")


func test_a_save_the_rules_cannot_read_is_kept_aside_with_its_problems_logged() -> void:
	_store.write({"version": Farm.SAVE_VERSION + 1}, Time.get_unix_time_from_system())

	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)

	var problem := '[warning] save unreadable problem="version %d' % (Farm.SAVE_VERSION + 1)
	assert_true(_has_line_starting(problem))
	assert_eq(main.find_children("*", "DamagedSaveNotice", true, false).size(), 1)
	assert_true(FileAccess.file_exists(SAVE_FOLDER + "/save.damaged-1.json"))


func test_the_log_never_holds_the_save_itself() -> void:
	GameLog.minimum_level = GameLog.Level.DEBUG
	_write_save(60.0)
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var field: Field = main.get_node("Field")

	field.plot_tapped.emit(1)

	assert_false(_lines.any(func(line: String) -> bool: return "crops" in line or "grown" in line))
