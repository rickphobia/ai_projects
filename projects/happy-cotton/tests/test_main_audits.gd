extends GutTest
## The entry scene's Harmony Audit wiring: audits and their results are logged and The App
## says them, being on watch shows as "Harmony Support", and the debug button plans an audit.
## Its save slot is in a test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_audits"
const SAVE_SLOT := SAVE_FOLDER + "/save.json"

var _lines: Array[String] = []
var _store := SaveStore.new(SAVE_SLOT)
var _settings_store := SettingsStore.new(SAVE_FOLDER + "/settings.json")
var _tuning := Tuning.load_file("res://data/tuning.tres")


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


## Starts the game from a new Farm's save at an open Hand-in with `picked` in hand and an audit
## planned, changed by `changes`.
func _main_at_an_audit(picked: int, changes: Dictionary = {}) -> Node:
	var save := Farm.new(_tuning).to_save()
	var audits: Dictionary = save["audits"]
	audits["planned"] = true
	save.merge({"hand_in_open": true, "picked": picked}, true)
	save.merge(changes, true)
	return _main_from(save)


func _main_from(save: Dictionary) -> Node:
	_store.write(save, Time.get_unix_time_from_system())
	var main := MAIN_SCENE.instantiate()
	main.set("save_store", _store)
	main.set("settings_store", _settings_store)
	main.set("roll", FastTuning.never)
	return add_child_autofree(main)


func _line_starting(prefix: String) -> String:
	for line in _lines:
		if line.begins_with(prefix):
			return line
	return ""


func test_an_audit_that_finds_nothing_is_logged_and_cheered() -> void:
	var main := _main_at_an_audit(10)
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_on_hand_in_pressed", 10)

	assert_string_contains(_line_starting("[info] audit passed"), "kept_share=0.0")
	assert_string_contains(app.speech(), "Your harmony is exemplary!")


func test_being_caught_is_logged_said_and_shown_as_harmony_support() -> void:
	var main := _main_at_an_audit(24, {"hidden_savings": 100})
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")

	main.call("_on_hand_in_pressed", 12)

	var caught := _line_starting("[info] caught")
	assert_string_contains(caught, "kept_share=0.5")
	assert_string_contains(caught, "times_caught=1")
	assert_string_contains(app.speech(), "This is theft.")
	var on_watch: Label = app.find_child("OnWatch", true, false)
	assert_true(on_watch.visible)
	var shifts := roundi(_tuning.on_watch_shifts)
	assert_eq(on_watch.text, "Selected for Harmony Support!  ·  Shifts left: %d" % shifts)


func test_the_debug_button_plans_an_audit_and_logs_it() -> void:
	var main := _main_from(Farm.new(_tuning).to_save())
	await wait_process_frames(1)

	main.call("_on_audit_requested")

	assert_has(_lines, "[info] debug audit planned shift=1")
	var audits: Dictionary = _store.read().farm["audits"]
	var planned: bool = audits["planned"]
	assert_true(planned)
