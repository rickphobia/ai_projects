extends GutTest
## The entry scene's letters wiring: a letter that arrives opens as a handwritten page and is
## logged by id, never by its words, and the letters stopping is logged. Its save slot is in a
## test folder of its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_letters"
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


## Plays to each of the next `count` Hand-ins, through any Study Session before it, and hands
## in at each, as the player would.
func _hand_in_shifts(main: Node, count: int) -> void:
	var tuning: Tuning = main.call("tuning")
	var app: AppOverlay = main.get_node("AppOverlay")
	var button: Button = app.find_child("HandInButton", true, false)
	for shift in count:
		# The Farm waits at the Hand-in, so a long step stops there.
		main.call("_process", tuning.shift_seconds + tuning.study_session_cap_seconds)
		button.pressed.emit()


func test_a_letter_arriving_is_logged_by_id_and_opens_as_a_page() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")
	var letters: LettersView = main.find_child("LettersView", true, false)

	_hand_in_shifts(main, roundi(tuning.letter_every_shifts) - 1)

	var id := Farm.LETTER_IDS[0]
	var shift := roundi(tuning.letter_every_shifts)
	assert_has(_lines, '[info] letter arrived id=&"%s" shift=%d' % [id, shift])
	assert_true(letters.is_page_open())
	assert_true(letters.letters_button().visible)
	var text := FamilyText.letters()[id].text
	assert_false(_lines.any(func(line: String) -> bool: return line.contains(text.left(20))))


func test_unpaid_school_fees_log_the_letters_stopping() -> void:
	var main: Node = add_child_autofree(_main())
	await wait_process_frames(1)
	var tuning: Tuning = main.call("tuning")

	# Every Shift up to the first school fees, unpaid.
	_hand_in_shifts(main, roundi(tuning.school_fees_every_shifts))

	var stopped := func(line: String) -> bool: return line.begins_with("[info] letters stopped")
	assert_true(_lines.any(stopped))
