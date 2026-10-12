extends GutTest
## The entry scene's hidden savings wiring: the Hand-in slider's amount reaches the rules and
## the cotton kept back is logged, the tin shows the hidden savings, and paying from the tin
## reaches the rules and is logged by item and amount. Its save slot is in a test folder of
## its own.

const MAIN_SCENE := preload("res://src/main.tscn")
const SAVE_FOLDER := "user://test_main_savings"
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


## Starts the game from a new Farm's save changed by `changes`.
func _main_from_save(changes: Dictionary) -> Node:
	var save := Farm.new(_tuning).to_save()
	save.merge(changes, true)
	_store.write(save, Time.get_unix_time_from_system())
	var main := MAIN_SCENE.instantiate()
	main.set("save_store", _store)
	main.set("settings_store", _settings_store)
	return add_child_autofree(main)


func _tin(main: Node) -> SavingsTin:
	return main.get_node("SavingsTin") as SavingsTin


func test_the_tin_shows_the_hidden_savings() -> void:
	var main := _main_from_save({"hidden_savings": 500})
	await wait_process_frames(1)

	assert_eq(_tin(main).savings_text(), "500")


func test_cotton_kept_back_with_the_slider_is_logged_and_goes_into_the_tin() -> void:
	var main := _main_from_save({"hand_in_open": true, "picked": 3})
	await wait_process_frames(1)
	var card: HandInCard = main.find_child("HandInCard", true, false)
	card.slider().value = 1

	(card.find_child("HandInButton", true, false) as Button).pressed.emit()

	var earned := roundi(_tuning.labour_points_per_pick)
	assert_has(_lines, "[info] handed in shift=1 handed_in=1 kept=2 earned=%d" % earned)
	# The rent takes the Labour Points earned, then the rest from the savings.
	var savings := 2 * roundi(_tuning.hidden_savings_per_kept_pick)
	var from_savings := roundi(_tuning.rent_per_shift) - earned
	assert_has(
		_lines,
		(
			'[info] bill charged shift=1 bill="rent" amount=%d covered=true from_savings=%d'
			% [roundi(_tuning.rent_per_shift), from_savings]
		)
	)
	assert_eq(_tin(main).savings_text(), str(savings - from_savings))


func test_paying_from_the_tin_is_logged_and_comes_out_of_the_hidden_savings() -> void:
	var main := _main_from_save({"hidden_savings": 500})
	await wait_process_frames(1)
	var app: AppOverlay = main.get_node("AppOverlay")
	var price := roundi(_tuning.generator_tiers[0].price)

	app.savings_pressed.emit(Farm.GENERATOR)

	assert_has(_lines, '[info] hidden savings spent item=&"generator" amount=%d' % price)
	assert_eq(_tin(main).savings_text(), str(500 - price))
	assert_has(_lines, '[info] upgrade bought item=&"generator" tier=1 price=%d' % price)
