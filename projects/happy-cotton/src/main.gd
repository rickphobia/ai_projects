extends Node
## Entry scene: logs which build is running, loads and checks the tuning table, continues the
## saved Farm (or starts a new one) and wires it to the field, The App and its store, the
## Children's letters (see LettersView) and the wall clock, and adds the debug controls (Skip
## time, +100 Labour Points) in debug mode. It puts the player's settings into effect and opens
## the Settings screen from The App. It
## autosaves after every command, when a Shift's Hand-in opens, when the player leaves (see
## LeavingWatch), and every AUTOSAVE_SECONDS of play.
## Kept thin: no game rules here.

const TUNING_PATH := "res://data/tuning.tres"
## The web export only copies a save to browser storage on its next frame, and a hidden tab
## gets none, so the save made as the tab hides is lost if the tab is closed while hidden.
## Saving this often bounds what that loses: online play that would count as offline time.
const AUTOSAVE_SECONDS := 15.0

## The save slot. Tests set their own before adding the scene.
var save_store := SaveStore.new()
## The player's settings file. Tests set their own before adding the scene.
var settings_store := SettingsStore.new()

var _tuning: Tuning
var _farm: Farm
var _clock: WallClock
var _worker_activity := WorkerView.Activity.IN_FIELD
var _since_autosave := 0.0
## False when a damaged save couldn't be moved aside: saving would overwrite it.
var _can_save := true
var _letters: LettersView

@onready var _field: Field = $Field
@onready var _app: AppOverlay = $AppOverlay


func _ready() -> void:
	GameLog.info("game started", {"version": BuildVersion.read()})
	var tuning := Tuning.load_file(TUNING_PATH)
	if tuning == null:
		_stop_with(["Could not load the tuning table at %s" % TUNING_PATH])
		return
	var problems := tuning.problems()
	if not problems.is_empty():
		_stop_with(problems)
		return
	_tuning = tuning
	GameLog.info("tuning loaded", {"path": TUNING_PATH})
	_letters = LettersView.new()
	_letters.name = "LettersView"
	_letters.layer = _app.layer + 1
	add_child(_letters)
	_add_settings_screen()
	_clock = WallClock.new(Time.get_unix_time_from_system)
	_open_save()
	var leaving_watch := LeavingWatch.new()
	leaving_watch.leaving.connect(_save.bind("hidden"))
	add_child(leaving_watch)
	if DebugMode.is_on():
		GameLog.info("debug mode on")
		var debug_panel := DebugPanel.new()
		debug_panel.skip_requested.connect(_on_skip_requested)
		debug_panel.labour_points_requested.connect(_on_labour_points_requested)
		add_child(debug_panel)


## Adds the Settings screen above The App and the letters, hidden until The App's Settings
## button opens it.
func _add_settings_screen() -> void:
	var layer := CanvasLayer.new()
	layer.layer = _letters.layer + 1
	var panel := SettingsPanel.new()
	panel.name = "SettingsPanel"
	panel.store = settings_store
	panel.visible = false
	panel.changed.connect(_apply_settings)
	layer.add_child(panel)
	add_child(layer)
	_app.settings_pressed.connect(panel.open)
	_apply_settings(settings_store.read())


func _apply_settings(settings: PlayerSettings) -> void:
	SettingsEffects.apply_volume(settings)
	_app.scale_text(settings.text_scale)
	_letters.scale_text(settings.text_scale)
	_app.set_reduced_motion(settings.reduced_motion)
	_field.set_reduced_motion(settings.reduced_motion)


## Continues the saved Farm, feeding the time since it was saved through the offline resume,
## or starts a new one when there is no save. A save that can't be read is kept aside and the
## player is offered Start over.
func _open_save() -> void:
	var stored := save_store.read()
	if stored.status == StoredSave.Status.NONE:
		GameLog.info("new game", {"path": save_store.path()})
		_begin(_new_farm())
		return
	var problem := stored.problem
	if stored.status == StoredSave.Status.FOUND:
		var farm := _new_farm()
		var problems := farm.restore(stored.farm)
		if problems.is_empty():
			GameLog.info("save loaded", {"path": save_store.path(), "shift": farm.shift().number})
			# Counted before _begin() saves, so the time away is counted once.
			_farm = farm
			var away := _clock.offline_seconds_since(stored.saved_at)
			if away != 0.0:
				_resume_offline(away)
			_begin(farm)
			return
		problem = "; ".join(problems)
	_offer_start_over(problem)


## Keeps the damaged save aside, untouched, and covers the game until the player starts over.
func _offer_start_over(problem: String) -> void:
	var kept_as := save_store.keep_aside()
	GameLog.warning("save unreadable", {"problem": problem, "kept_as": kept_as})
	if kept_as.is_empty():
		_can_save = false
		var not_kept := {"path": save_store.path(), "problem": save_store.last_problem()}
		GameLog.error("save not kept aside, saving is off", not_kept)
	var notice := DamagedSaveNotice.new()
	notice.start_over_pressed.connect(_on_start_over_after_damaged_save)
	add_child(notice)


func _on_start_over_after_damaged_save() -> void:
	GameLog.info("start over after a damaged save")
	_begin(_new_farm())


func _new_farm() -> Farm:
	return Farm.new(_tuning)


## Builds the field from the Farm's land, wires the Farm to it and The App, and saves it at
## once: a new Farm, or a restored one now that its time away has been counted (so it isn't
## counted again).
func _begin(farm: Farm) -> void:
	_farm = farm
	_field.show_land(farm.land())
	_field.plot_tapped.connect(_on_plot_tapped)
	_field.generator_tapped.connect(_on_generator_tapped)
	_app.upgrade_pressed.connect(_on_upgrade_pressed)
	_app.privilege_pressed.connect(_on_privilege_pressed)
	_app.land_pressed.connect(_on_land_pressed)
	_app.hand_in_pressed.connect(_on_hand_in_pressed)
	_save("start")
	_show_farm()


## The tuning table that passed the startup check, or null if the game stopped.
func tuning() -> Tuning:
	return _tuning


## Crops grow in real time while the game runs. A hidden browser tab stops frames, and Godot
## caps one frame's delta (about 0.13 s), so the hidden time doesn't count as online play: the
## wall clock reports it as offline time instead.
func _process(delta: float) -> void:
	if _farm == null:
		return
	var away := _clock.offline_seconds(delta)
	if away != 0.0:
		_resume_offline(away)
	var hand_in_was_open := _farm.hand_in_open()
	for overseer_event in _farm.advance(delta):
		GameLog.debug("overseer", {"event": overseer_event})
		_field.show_overseer(overseer_event)
	_since_autosave += delta
	if _farm.hand_in_open() and not hand_in_was_open:
		# So closing the game at the Hand-in finds it still waiting.
		_save("hand_in")
	elif _since_autosave >= AUTOSAVE_SECONDS:
		_save("timer")
	_show_farm()


## A tap on an empty plot plants it, on a Withered one clears it, and on any other plot it
## tries to pick. The rules decide whether that happens, and a command that happens brings the
## Worker back to the field; an unripe plot shows its time left instead.
func _on_plot_tapped(index: int) -> void:
	var stage := _farm.plot(index).stage
	if stage == PlotView.Stage.EMPTY:
		_log_command("plant", index, _farm.plant(index))
	elif stage == PlotView.Stage.WITHERED:
		_log_command("clear", index, _farm.clear(index))
	else:
		var picked := _farm.shift().picked
		var result := _farm.pick(index)
		_log_command("pick", index, result)
		if _farm.shift().picked > picked:
			_app.show_crop_counted(_field.plot_screen_position(index))
		if result.reason == Farm.NOT_RIPE:
			_field.show_time_left(index, _farm.plot(index).seconds_left)
	_save("command")
	# The whole Farm, so the crop counter goes up with the "+1".
	_show_farm()


func _on_generator_tapped() -> void:
	var result := _farm.run_generator()
	if result.happened:
		GameLog.debug("run generator")
	else:
		GameLog.debug("run generator refused", {"reason": result.reason})
	_save("command")
	_show_worker()


## The rules decide whether he gets the next tier. A purchase closes the store, so the Mascot's
## celebration shows; a refusal is explained by the Mascot.
func _on_upgrade_pressed(id: StringName) -> void:
	var item := _store_item(id)
	var result := _farm.buy_upgrade(id)
	if result.happened:
		GameLog.info("upgrade bought", {"item": id, "tier": item.tier + 1, "price": item.price})
	_after_purchase(id, item, result)


## The rules decide whether he gets the Privilege, as for an Upgrade.
func _on_privilege_pressed(id: StringName) -> void:
	var item := _store_item(id)
	var result := _farm.buy_privilege(id)
	if result.happened:
		GameLog.info("privilege bought", {"item": id, "price": item.price})
	_after_purchase(id, item, result)


## The rules decide whether he gets the next Plot; a new one grows the field round it.
func _on_land_pressed() -> void:
	var item := _store_item(Farm.LAND)
	var result := _farm.buy_plot()
	if result.happened:
		var bought := {"plot": _farm.land().plot_count(), "price": item.price}
		GameLog.info("plot bought", bought)
		_field.show_land(_farm.land())
	_after_purchase(Farm.LAND, item, result)


## Hands in the cotton; the rest of the Shift end follows, and the next Shift starts.
func _on_hand_in_pressed() -> void:
	var result := _farm.hand_in()
	if not result.happened:
		GameLog.debug("hand in refused", {"reason": result.reason})
	_save("shift_end")
	_show_farm()


func _after_purchase(id: StringName, item: StoreItemView, result: CommandResult) -> void:
	if result.happened:
		_app.store_panel().hide()
	else:
		GameLog.debug("purchase refused", {"item": id, "reason": result.reason})
		var values := {"price": item.price if item else 0, "points": _farm.labour_points()}
		_app.say(AppText.render_store_refusal(result.reason, values))
	_save("command")
	_show_farm()


## The store's item with this id, or null if the store doesn't sell it.
func _store_item(id: StringName) -> StoreItemView:
	for item in _farm.store():
		if item.id == id:
			return item
	return null


## Debug mode only: Labour Points without work, to try the store's dearer items.
func _on_labour_points_requested(points: int) -> void:
	if _farm == null:
		return
	GameLog.info("debug labour points added", {"points": points})
	_farm.debug_add_labour_points(points)
	_save("command")
	_show_farm()


## Skip time runs exactly the offline resume of a real absence that long.
func _on_skip_requested(seconds: float) -> void:
	if _farm == null:
		return
	GameLog.info("skip time", {"seconds": seconds})
	_resume_offline(seconds)
	_save("command")
	_show_farm()


## Logs each return from offline time, with a warning when the clock's time couldn't be used
## as given. The away summary reaches The App with the other messages.
func _resume_offline(seconds: float) -> void:
	var report := _farm.resume_offline(seconds)
	if report.clock_problem != &"":
		var adjusted := {
			"problem": report.clock_problem,
			"seconds_away": report.seconds_away,
			"seconds_counted": report.seconds_counted,
		}
		GameLog.warning("offline time adjusted", adjusted)
	var resumed := {
		"seconds": report.seconds_counted,
		"ripened": report.ripened,
		"withered": report.withered,
		"study_seconds_served": report.study_seconds_served,
		"exhaustion_recovered": report.exhaustion_recovered,
	}
	GameLog.info("offline resume", resumed)


## Writes the Farm to the save slot. Only the reason is logged, never the save itself.
func _save(reason: String) -> void:
	if _farm == null or not _can_save:
		return
	_since_autosave = 0.0
	var problem := save_store.write(_farm.to_save(), _clock.now())
	if problem.is_empty():
		GameLog.debug("game saved", {"reason": reason})
	else:
		GameLog.error("save failed", {"reason": reason, "problem": problem})


func _show_farm() -> void:
	_field.show_plots(_farm.plots())
	_show_worker()
	_show_app()
	_show_family()


## Opens each letter that has just arrived and each call home, and keeps the box up to date.
## Logs the letters arriving, stopping and starting again, and the calls, by id only: never
## their words.
func _show_family() -> void:
	for event in _farm.take_family_events():
		if event.kind == Farm.LETTER_ARRIVED:
			GameLog.info("letter arrived", {"id": event.id, "shift": _farm.shift().number})
			if not _letters.open_letter(event.id):
				GameLog.warning("letter has no text", {"id": event.id})
		elif event.kind == Farm.CALLED_HOME:
			GameLog.info("called home", {"id": event.id, "shift": _farm.shift().number})
			if not _letters.open_call(event.id):
				GameLog.warning("call has no lines", {"id": event.id})
		elif event.kind == Farm.LETTERS_STOPPED:
			GameLog.info("letters stopped", {"shift": _farm.shift().number})
		elif event.kind == Farm.LETTERS_STARTED_AGAIN:
			GameLog.info("letters started again", {"shift": _farm.shift().number})
	_letters.show_letters(_farm.letters_received())


## Shows the Worker and logs each change in what he is doing, such as stopping to breathe.
func _show_worker() -> void:
	var view := _farm.worker()
	if view.activity != _worker_activity:
		_worker_activity = view.activity
		var activity_name: String = WorkerView.Activity.keys()[view.activity]
		GameLog.debug("worker", {"activity": activity_name.to_lower()})
	_field.show_worker(view)
	_app.show_powered(view.activity == WorkerView.Activity.RUNNING)


## Passes the rules' App messages to the Mascot, celebrates a met Quota, logs Quota checks,
## Negligence and Study Sessions, and refreshes the bar and the Study Session room.
## A Shift's end and the next Shift's start arrive together, so the Mascot says all of a
## frame's lines at once; otherwise the praise would be replaced before anyone could read it.
func _show_app() -> void:
	var lines: Array[String] = []
	for message in _farm.take_messages():
		_log_message(message)
		if (
			message.key
			in [
				Farm.QUOTA_MET,
				Farm.GENERATOR_UPGRADED,
				Farm.TOOLS_UPGRADED,
				Farm.PLOT_BOUGHT,
				Farm.REST_STARTED,
			]
		):
			_app.celebrate()
		if message.key == Farm.PAY_SLIP:
			_app.show_pay_slip(message.values)
		var text := AppText.render(message)
		if text.is_empty():
			GameLog.warning("app message has no text", {"key": message.key})
		else:
			lines.append(text)
	if not lines.is_empty():
		_app.say("\n".join(lines))
	_app.show_shift(_farm.shift(), _farm.labour_points(), _farm.debt())
	_app.show_study_session(_farm.study_session_seconds_left())
	_app.show_exhaustion(_farm.exhaustion())
	_app.show_resting(_farm.rest_hour().seconds_left, _farm.call_home_seconds_left())
	var store := _farm.store()
	_app.show_store(store, _farm.labour_points())
	for item in store:
		if item.id == Farm.GENERATOR:
			_field.show_generator_tier(item.tier)
		elif item.id == Farm.TOOLS:
			_field.show_tools_tier(item.tier)


func _log_message(message: AppMessage) -> void:
	var met := message.key == Farm.QUOTA_MET
	if met or message.key in Farm.MISSED_KEYS:
		var fields := message.values
		fields["met"] = met
		GameLog.info("quota checked", fields)
	elif message.key == Farm.STUDY_SESSION_STARTED:
		GameLog.info("study session started", message.values)
	elif message.key == Farm.STUDY_SESSION_ENDED:
		GameLog.info("study session ended", message.values)
	elif message.key == Farm.NEGLIGENCE_LOGGED:
		GameLog.info("negligence logged", message.values)
	elif message.key == Farm.REST_ENDED:
		GameLog.info("rest hour ended", {"exhaustion": _farm.exhaustion()})
	elif message.key == Farm.COTTON_DROPPED:
		GameLog.info("cotton dropped", {"exhaustion": _farm.exhaustion()})
	elif message.key == Farm.PAY_SLIP:
		_log_bills(message.values)
	elif message.key == Farm.FELL_INTO_DEBT:
		GameLog.info("debt incurred", message.values)
	elif message.key == Farm.DEBT_CLEARED:
		GameLog.info("debt cleared", message.values)
	elif message.key == Farm.HAND_IN_OPENED:
		GameLog.info("hand-in opened", message.values)
	elif message.key == Farm.HANDED_IN:
		GameLog.info("handed in", message.values)


## One line per Bill in the order charged, with whether the balance covered it.
func _log_bills(slip: Dictionary) -> void:
	var shift: int = slip["shift"]
	var electricity := {"shift": shift, "bill": "electricity", "amount": slip["electricity"]}
	electricity["laps"] = slip["laps"]
	electricity["covered"] = slip["electricity_covered"]
	GameLog.info("bill charged", electricity)
	var rent := {"shift": shift, "bill": "rent", "amount": slip["rent"]}
	rent["covered"] = slip["rent_covered"]
	GameLog.info("bill charged", rent)
	var school_fees: int = slip["school_fees"]
	if school_fees > 0:
		var fees := {"shift": shift, "bill": "school fees", "amount": school_fees}
		fees["covered"] = slip["school_fees_covered"]
		GameLog.info("bill charged", fees)


func _log_command(command: String, index: int, result: CommandResult) -> void:
	if result.happened:
		GameLog.debug(command, {"plot": index})
	else:
		GameLog.debug(command + " refused", {"plot": index, "reason": result.reason})


## Stops the game with the problems on screen and in the log. A headless run exits with a
## failing code, so a bad table can't slip through a scripted run unnoticed.
func _stop_with(problems: Array[String]) -> void:
	for problem in problems:
		GameLog.error("cannot start", {"problem": problem})
	var label := Label.new()
	label.text = "Cannot start Happy Cotton:\n" + "\n".join(problems)
	var layer := CanvasLayer.new()
	layer.add_child(label)
	add_child(layer)
	if DisplayServer.get_name() == "headless":
		get_tree().quit(1)
