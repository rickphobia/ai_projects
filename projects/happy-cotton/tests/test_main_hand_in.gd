extends GutTest
## The entry scene's crop counter and Hand-in: a counted pick raises the counter with a "+1",
## the end of a Shift's time opens the Hand-in card and the Farm waits for it, and handing in is
## logged. Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_hand_in"
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
	main.set("roll", FastTuning.never)
	return main


func _card(app: AppOverlay) -> HandInCard:
	return app.find_child("HandInCard", true, false) as HandInCard


## Presses the Hand-in card's button, as the player would.
func _hand_in(main: Node) -> void:
	var app: AppOverlay = main.get_node("AppOverlay")
	var button: Button = _card(app).find_child("HandInButton", true, false)
	button.pressed.emit()


func test_the_end_of_a_shifts_time_opens_the_hand_in_and_the_farm_waits_for_it() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_process", tuning.shift_seconds)
	main.call("_process", tuning.shift_seconds)

	var quota := roundi(tuning.first_quota)
	assert_has(_lines, "[info] hand-in opened shift=1 in_hand=0 quota=%d" % quota)
	assert_true(_card(app).visible)
	assert_eq(_card(app).cotton_text(), "Handing in 0 of 0 cotton  ·  Quota: %d" % quota)
	assert_false(_lines.any(func(line: String) -> bool: return line.contains("quota checked")))

	_hand_in(main)

	assert_has(_lines, "[info] handed in shift=1 handed_in=0 kept=0 earned=0")
	assert_false(_card(app).visible)


func test_a_counted_pick_raises_the_crop_counter_with_a_rising_plus_one() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var field: Field = main.get_node("Field")
	var app: AppOverlay = main.get_node("AppOverlay")
	field.plot_tapped.emit(0)
	field.generator_tapped.emit()
	main.call("_process", tuning.grow_seconds * 1.5)

	field.plot_tapped.emit(0)

	var counter: Label = app.find_child("CropCounter", true, false)
	assert_eq(counter.text, "1 cotton")
	assert_eq(app.find_children("*", "RisingCount", true, false).size(), 1)
