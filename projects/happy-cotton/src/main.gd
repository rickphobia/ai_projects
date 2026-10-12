extends Node
## Entry scene: logs which build is running, loads and checks the tuning table, continues the
## saved Farm (or starts a new one) and wires it to the field, The App and its store, the
## Children's letters (see LettersView), the hidden savings tin (see SavingsTin) and the wall
## clock, and adds the debug controls (Skip time, +100 Labour Points, Audit this Shift,
## Bollworms now, Sandstorm now) in debug mode. It puts the player's settings into effect and
## opens the Settings screen from The App. It autosaves after every command, when a Shift's Hand-in
## opens, when the player leaves (see LeavingWatch), and every AUTOSAVE_SECONDS of play.
## Kept thin: no game rules here.

const TUNING_PATH := "res://data/tuning.tres"
## The web export only copies a save to browser storage on its next frame, and a hidden tab
## gets none, so the save made as the tab hides is lost if the tab is closed while hidden.
## Saving this often bounds what that loses: online play that would count as offline time.
const AUTOSAVE_SECONDS := 15.0
## The log line for each Disaster message: warned of, struck and passed (kind, seconds).
const DISASTER_LOG_EVENTS: Dictionary[StringName, String] = {
	Farm.SANDSTORM_WARNED: "disaster warned",
	Farm.SANDSTORM_STRUCK: "disaster struck",
	Farm.DISASTER_PASSED: "disaster passed",
}

## The save slot. Tests set their own before adding the scene.
var save_store := SaveStore.new()
## The player's settings file. Tests set their own before adding the scene.
var settings_store := SettingsStore.new()
## The Farm's source of chance (see Farm); unset, the Farm rolls at random. Tests set their own
## before adding the scene, so random Bollworms, audits and drops can't upset them.
var roll := Callable()

var _tuning: Tuning
var _farm: Farm
var _clock: WallClock
var _worker_activity := WorkerView.Activity.IN_FIELD
var _since_autosave := 0.0
## False when a damaged save couldn't be moved aside: saving would overwrite it.
var _can_save := true
var _letters: LettersView
var _tin: SavingsTin

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
	_tin = SavingsTin.new()
	_tin.name = "SavingsTin"
	# Under The App, so the store and the Study Session room cover it.
	_tin.layer = _app.layer - 1
	add_child(_tin)
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
		debug_panel.audit_requested.connect(_on_audit_requested)
		debug_panel.bollworms_requested.connect(_on_bollworms_requested)
		debug_panel.sandstorm_requested.connect(_on_sandstorm_requested)
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
	return Farm.new(_tuning, roll)


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
	_app.supply_pressed.connect(_on_supply_pressed)
	_app.hand_in_pressed.connect(_on_hand_in_pressed)
	_app.savings_pressed.connect(_on_savings_pressed)
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


## A tap on a plot with Bollworms picks them off, on an empty plot plants it, on a Withered one
## clears it, and on any other plot it tries to pick. The rules decide whether that happens, and a
## command that happens brings the Worker back to the field; an unripe plot shows its time left
## instead. With a supply picked on the supplies bar, the tap spreads or sprays it instead, and the
## tap after works as normal; Bollworms come first even then, and the supply is put back.
func _on_plot_tapped(index: int) -> void:
	var view := _farm.plot(index)
	var stage := view.stage
	var chosen := _app.supplies_bar().take_chosen()
	if view.bollworms:
		_pick_off_bollworms(index)
	elif chosen in Farm.SUPPLIES:
		_use_supply(chosen, index)
	elif stage == PlotView.Stage.EMPTY:
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


## Bollworms picked off are logged by Plot.
func _pick_off_bollworms(index: int) -> void:
	var result := _farm.pick_off_bollworms(index)
	if result.happened:
		GameLog.info("bollworms picked off", {"plot": index})
	else:
		_log_command("pick off bollworms", index, result)


## Spreads Fertiliser or sprays Pesticide on the plot, or has The App say plainly why not.
## Supplies used are logged by kind and plot.
func _use_supply(supply: StringName, index: int) -> void:
	var fertiliser := supply == Farm.FERTILISER
	var result := _farm.fertilise(index) if fertiliser else _farm.spray(index)
	if result.happened:
		GameLog.info("supply used", {"kind": supply, "plot": index})
		return
	_log_command("fertilise" if fertiliser else "spray", index, result)
	var refusal := AppText.render_supply_refusal(supply, result.reason)
	if not refusal.is_empty():
		_app.say(refusal)


## A supply picked on the bar is for the next tap, so tapping the Generator puts it back.
func _on_generator_tapped() -> void:
	_app.supplies_bar().take_chosen()
	var result := _farm.run_generator()
	if result.happened:
		GameLog.debug("run generator")
	else:
		GameLog.debug("run generator refused", {"reason": result.reason})
	_save("command")
	_show_worker()


## The rules decide whether he gets the next tier. A purchase closes the store, so the Mascot's
## celebration shows; a refusal is explained by the Mascot.
func _on_upgrade_pressed(id: StringName, pay_with := Farm.PAY_LABOUR_POINTS) -> void:
	var item := _store_item(id)
	var result := _farm.buy_upgrade(id, pay_with)
	if result.happened:
		GameLog.info("upgrade bought", {"item": id, "tier": item.tier + 1, "price": item.price})
	_after_purchase(id, item, result, pay_with)


## The rules decide whether he gets the Privilege, as for an Upgrade.
func _on_privilege_pressed(id: StringName, pay_with := Farm.PAY_LABOUR_POINTS) -> void:
	var item := _store_item(id)
	var result := _farm.buy_privilege(id, pay_with)
	if result.happened:
		GameLog.info("privilege bought", {"item": id, "price": item.price})
	_after_purchase(id, item, result, pay_with)


## The rules decide whether he gets the next Plot; a new one grows the field round it.
func _on_land_pressed(pay_with := Farm.PAY_LABOUR_POINTS) -> void:
	var item := _store_item(Farm.LAND)
	var result := _farm.buy_plot(pay_with)
	if result.happened:
		var bought := {"plot": _farm.land().plot_count(), "price": item.price}
		GameLog.info("plot bought", bought)
		_field.show_land(_farm.land())
	_after_purchase(Farm.LAND, item, result, pay_with)


## The rules decide whether he gets one more of the supply. Supplies bought are logged by kind
## and price.
func _on_supply_pressed(id: StringName, pay_with := Farm.PAY_LABOUR_POINTS) -> void:
	var item := _store_item(id)
	var result := _farm.buy_supply(id, pay_with)
	if result.happened:
		GameLog.info("supply bought", {"kind": id, "price": item.price})
	_after_purchase(id, item, result, pay_with)


## The tin's button on a store item: the same purchase, paid with hidden savings.
func _on_savings_pressed(id: StringName) -> void:
	if id == Farm.GENERATOR or id == Farm.TOOLS:
		_on_upgrade_pressed(id, Farm.PAY_HIDDEN_SAVINGS)
	elif id == Farm.LAND:
		_on_land_pressed(Farm.PAY_HIDDEN_SAVINGS)
	elif id in Farm.SUPPLIES:
		_on_supply_pressed(id, Farm.PAY_HIDDEN_SAVINGS)
	else:
		_on_privilege_pressed(id, Farm.PAY_HIDDEN_SAVINGS)


## Hands in what the slider says; the rest is kept back. The rest of the Shift end follows,
## and the next Shift starts.
func _on_hand_in_pressed(amount: int) -> void:
	var result := _farm.hand_in(amount)
	if not result.happened:
		# The card shows only while a Hand-in is open, so this is odd.
		GameLog.warning("hand in refused", {"reason": result.reason})
		return
	_save("shift_end")
	_show_farm()


## Hidden savings spent are logged by item and amount. A refusal The App has no words for
## (not enough hidden savings) is only logged: the tin's button already says so.
func _after_purchase(
	id: StringName, item: StoreItemView, result: CommandResult, pay_with: Ledger.PayWith
) -> void:
	if result.happened:
		if pay_with == Farm.PAY_HIDDEN_SAVINGS:
			GameLog.info("hidden savings spent", {"item": id, "amount": item.price})
		_app.store_panel().hide()
	else:
		GameLog.debug("purchase refused", {"item": id, "reason": result.reason})
		var values := {"price": item.price if item else 0, "points": _farm.labour_points()}
		var refusal := AppText.render_store_refusal(result.reason, values)
		if not refusal.is_empty():
			_app.say(refusal)
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


## Debug mode only: a Harmony Audit this Shift, to see the tell and the result without waiting.
func _on_audit_requested() -> void:
	if _farm == null:
		return
	GameLog.info("debug audit planned", {"shift": _farm.shift().number})
	_farm.debug_plan_audit()
	_save("command")
	_show_farm()


## Debug mode only: Bollworms on every growing Plot, to see them without waiting.
func _on_bollworms_requested() -> void:
	if _farm == null:
		return
	GameLog.info("debug bollworms now")
	_farm.debug_bollworms_now()
	_save("command")
	_show_farm()


## Debug mode only: a Sandstorm strikes at once, to see it without waiting.
func _on_sandstorm_requested() -> void:
	if _farm == null:
		return
	GameLog.info("debug sandstorm now", {"shift": _farm.shift().number})
	_farm.debug_disaster_now(Farm.SANDSTORM)
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
				Farm.SUPPLY_BOUGHT,
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
	var audit := _farm.audit()
	var shift := _farm.shift()
	_app.show_shift(shift, _farm.labour_points(), _farm.debt(), audit.watch_shifts_left)
	_field.show_disaster(shift.disaster)
	_app.show_study_session(_farm.study_session_seconds_left())
	_app.show_exhaustion(_farm.exhaustion())
	_app.show_resting(_farm.rest_hour().seconds_left, _farm.call_home_seconds_left())
	_field.show_audit_tell(audit.tell)
	var store := _farm.store()
	_app.show_store(store, _farm.labour_points(), _farm.hidden_savings())
	_tin.show_savings(_farm.hidden_savings())
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
	elif message.key == Farm.BOLLWORMS_ARRIVED:
		GameLog.info("bollworms arrived", message.values)
	elif message.key == Farm.CROP_EATEN:
		GameLog.info("crop eaten", message.values)
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
	elif message.key in DISASTER_LOG_EVENTS:
		GameLog.info(DISASTER_LOG_EVENTS[message.key], message.values)
	else:
		_log_audit(message)


## Audits planned (with their chance; the plan itself is secret), their result, catches and
## the end of being on watch; and the Shift's Disaster planned (kind, when it strikes, length).
func _log_audit(message: AppMessage) -> void:
	if message.key == Farm.SHIFT_STARTED:
		var shift_number: int = message.values["shift"]
		if message.values.get("audit_planned", false):
			GameLog.info(
				"audit planned", {"shift": shift_number, "chance": message.values["audit_chance"]}
			)
		var disaster: Dictionary = message.values.get("disaster", {})
		if disaster.get("kind", &"") != &"":
			var planned := {"shift": shift_number}
			planned.merge(disaster)
			GameLog.info("disaster planned", planned)
	elif message.key == Farm.AUDIT_PASSED:
		GameLog.info("audit passed", message.values)
	elif message.key in [Farm.CAUGHT, Farm.CAUGHT_AGAIN]:
		GameLog.info("caught", message.values)
	elif message.key == Farm.ON_WATCH_ENDED:
		GameLog.info("on watch ended", {"shift": _farm.shift().number})


## One line per Bill in the order charged, with whether Labour Points and hidden savings
## covered it and how much the savings paid.
func _log_bills(slip: Dictionary) -> void:
	var shift: int = slip["shift"]
	var electricity := {"shift": shift, "bill": "electricity", "amount": slip["electricity"]}
	electricity["laps"] = slip["laps"]
	electricity["covered"] = slip["electricity_covered"]
	electricity["from_savings"] = slip["electricity_from_savings"]
	GameLog.info("bill charged", electricity)
	var rent := {"shift": shift, "bill": "rent", "amount": slip["rent"]}
	rent["covered"] = slip["rent_covered"]
	rent["from_savings"] = slip["rent_from_savings"]
	GameLog.info("bill charged", rent)
	var school_fees: int = slip["school_fees"]
	if school_fees > 0:
		var fees := {"shift": shift, "bill": "school fees", "amount": school_fees}
		fees["covered"] = slip["school_fees_covered"]
		fees["from_savings"] = slip["school_fees_from_savings"]
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
