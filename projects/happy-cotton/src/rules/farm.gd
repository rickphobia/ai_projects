# gdlint: disable=max-public-methods
# Farm is the one seam the game and the tests drive (see the specs), so every command and view
# is public here; the work itself is delegated to Crops, Toil, Exhaustion, Ledger and Store.
class_name Farm
extends RefCounted
## The Farm rules: the plots and the cotton growing in them. No scene tree, clock or file
## access: time only moves when advance() or resume_offline() is called, so tests play hours
## in milliseconds.
## It also runs the Shift: online play counts it down, and at its end the Quota is checked and
## the next Shift starts at once with a higher Quota. What The App should say comes out as
## AppMessages through take_messages(). A missed Quota starts a Study Session: the Worker can't
## plant or pick until it ends, and the next Shift's clock waits for it.
## The Worker is either in the field or on the Generator (see Toil). Crops grow only while he
## runs on it; after a set number of laps he stops to breathe and growth halts until the
## Overseer whistles, then whips, and he runs again (advance() returns these events).
## Planting or picking brings him back to the field, and so does a Study Session.
## Offline time (the game closed or its tab hidden) grows crops at a slower rate with no
## Generator and serves the Study Session, but the Shift waits. Ripe cotton left unpicked too
## long, counted outside Study Sessions, Withers; each Withered plot is Negligence, which docks
## Labour Points and starts a Study Session longer than a missed Quota's.
## Work wears the Worker down (see Exhaustion): above one threshold his field work is slow,
## above a higher one a pick can drop its cotton, and he runs fewer laps before he stops to
## breathe. Labour Points buy a rest hour, which takes him off the Generator and lowers
## Exhaustion towards a floor that rises every Shift. A missed Quota takes the rest hour away
## for the next Shift. Offline time recovers Exhaustion slowly, never below the floor.
## The store (see Store) sells Upgrades tier by tier: a Generator tier makes each second of
## running grow more cotton at once, and a tools tier makes a slow pick shorter and an
## exhausted one less likely to drop its cotton; each raises the Quota from the next Shift on.
## Every Shift ends with the Bills (see Ledger), met Quota or missed: electricity for each lap
## run that Shift, then rent, shown as a pay slip. A Bill the Labour Points can't cover becomes
## Debt, which earnings pay down first; while it lasts no Privilege or Upgrade can be bought.
## A missed Quota takes away every Privilege for the next Shift.
## Every few Shifts a letter from the Worker's Children arrives (see Letters), as a Family
## event apart from the App messages. A school-fees Bill that leaves a shortfall stops the
## letters until the Debt is cleared; letters that came due meanwhile are lost.
## to_save() gives the whole Farm as plain data and restore() takes it back, so a restored Farm
## plays on exactly as the saved one would have.

const NO_SUCH_PLOT := &"no_such_plot"
const NOT_EMPTY := &"not_empty"
const NOT_RIPE := &"not_ripe"
const NOTHING_PLANTED := &"nothing_planted"
const IN_STUDY_SESSION := &"in_study_session"
const WITHERED := &"withered"
const NOT_WITHERED := &"not_withered"
## He is still at a slow plant, pick or clear (Exhaustion above the slow threshold).
const WORKER_BUSY := &"worker_busy"
const RESTING := &"resting"
## A missed Quota took every Privilege away for this Shift.
const PRIVILEGES_TAKEN_AWAY := &"privileges_taken_away"
## The Worker owes the Farm, so he can buy neither Privileges nor Upgrades.
const IN_DEBT := &"in_debt"
const NOT_ENOUGH_LABOUR_POINTS := &"not_enough_labour_points"
## The Upgrade has no tier left to buy.
const FULLY_UPGRADED := &"fully_upgraded"
## The Privileges buy_privilege() sells.
const REST_HOUR := &"rest_hour"
## buy_privilege() was given a Privilege the Farm does not sell.
const NO_SUCH_PRIVILEGE := &"no_such_privilege"
## The Upgrades buy_upgrade() sells.
const GENERATOR := &"generator"
const TOOLS := &"tools"
## buy_upgrade() was given an Upgrade the Farm does not sell.
const NO_SUCH_UPGRADE := &"no_such_upgrade"
## Every reason a store item can be refused with; the App text table explains each.
const STORE_REFUSALS: Array[StringName] = [
	IN_STUDY_SESSION,
	PRIVILEGES_TAKEN_AWAY,
	RESTING,
	IN_DEBT,
	NOT_ENOUGH_LABOUR_POINTS,
	FULLY_UPGRADED,
]

## The save format to_save() writes and restore() reads. Raise it when the format changes.
## Version 2 added the store; a version 1 save restores with no Upgrades. Version 3 added the
## tools; a version 2 save restores with none. Version 4 added the Bills; a version 3 save
## restores with nothing earned and no laps run yet this Shift. Version 5 added the school
## fees; an older save restores with them paid up and due school_fees_every_shifts Shifts after
## its own. Version 6 added the letters; an older save restores with none received and no
## letter Shifts passed.
const SAVE_VERSION := 6
const SAVE_VERSIONS_READ: Array[int] = [1, 2, 3, 4, 5, SAVE_VERSION]
## The lowest balance a save can hold: Debt can grow, but not without end.
const LEAST_SAVED_BALANCE := -1000000000

## Why resume_offline() didn't use the clock's time as given (AwayReport.clock_problem).
const NEGATIVE_OFFLINE_TIME := &"negative_offline_time"
const OFFLINE_TIME_CAPPED := &"offline_time_capped"

## App message keys. A Shift began: values shift, quota.
const SHIFT_STARTED := &"shift_started"
## The Quota was met (or beaten) at the end of a Shift: values shift, picked, quota.
const QUOTA_MET := &"quota_met"
## The Quota was missed at the end of a Shift: values shift, picked, quota. The key grows
## colder with each miss in a row: the first, the second, then every one after.
const QUOTA_MISSED := &"quota_missed"
const QUOTA_MISSED_AGAIN := &"quota_missed_again"
const QUOTA_MISSED_REPEATEDLY := &"quota_missed_repeatedly"
## A Study Session began: values seconds, minutes (rounded up), in_a_row (Quotas missed in a
## row so far: 1 for the first since the last met Quota, unchanged by Negligence).
const STUDY_SESSION_STARTED := &"study_session_started"
## A Study Session ended: values in_a_row.
const STUDY_SESSION_ENDED := &"study_session_ended"
## Plots Withered at the same moment: values plots (how many), points (Labour Points docked).
## A Study Session for the Negligence follows at once.
const NEGLIGENCE_LOGGED := &"negligence_logged"
## The Worker came back from offline time: values minutes (away, rounded up), ripened (plots
## that ripened while away, even if they then Withered), withered (plots that Withered while
## away), study_minutes (Study Session served while away, rounded up), exhaustion_recovered
## (rounded).
const AWAY_SUMMARY := &"away_summary"
## A rest hour was bought: values price, minutes (rounded up).
const REST_STARTED := &"rest_started"
## A rest hour ran its course. A Study Session cuts one short without this.
const REST_ENDED := &"rest_ended"
## An exhausted pick dropped its cotton: nothing counted, nothing earned.
const COTTON_DROPPED := &"cotton_dropped"
## A Generator tier was bought: values tier (from 1), price, multiplier (growth against no
## Upgrade), quota_rise (from the next Shift).
const GENERATOR_UPGRADED := &"generator_upgraded"
## A tools tier was bought: values tier (from 1), price, share (of a slow pick's time and of the
## drop chance, against no Upgrade), quota_rise (from the next Shift).
const TOOLS_UPGRADED := &"tools_upgraded"
## The Bills were charged at the end of a Shift: values shift, earned (by work this Shift),
## laps, electricity, electricity_covered, rent, rent_covered (whether the balance covered each
## Bill) and balance (Labour Points left, negative for Debt).
const PAY_SLIP := &"pay_slip"
## A Bill left the Worker in Debt when he wasn't: values debt.
const FELL_INTO_DEBT := &"fell_into_debt"
## Earnings paid the last of the Debt: values points (Labour Points left over).
const DEBT_CLEARED := &"debt_cleared"
## The App tells a new game that the Worker's two Children are at a state boarding school
## (values: school_fees_shift, every).
const CHILDREN_AT_SCHOOL := &"children_at_school"
## Every key the rules can emit; the App text table must have text for each.
const MESSAGE_KEYS: Array[StringName] = [
	SHIFT_STARTED,
	QUOTA_MET,
	QUOTA_MISSED,
	QUOTA_MISSED_AGAIN,
	QUOTA_MISSED_REPEATEDLY,
	STUDY_SESSION_STARTED,
	STUDY_SESSION_ENDED,
	NEGLIGENCE_LOGGED,
	AWAY_SUMMARY,
	REST_STARTED,
	REST_ENDED,
	COTTON_DROPPED,
	GENERATOR_UPGRADED,
	TOOLS_UPGRADED,
	PAY_SLIP,
	FELL_INTO_DEBT,
	DEBT_CLEARED,
	CHILDREN_AT_SCHOOL,
]
## Family events (FamilyEvent kinds), the Children's side, never App text. A letter arrived at
## the start of a Shift: id is one of LETTER_IDS.
const LETTER_ARRIVED := &"letter_arrived"
## A school-fees Bill left a shortfall, so no letters come until the Debt is cleared.
const LETTERS_STOPPED := &"letters_stopped"
## The Debt that stopped the letters was cleared, so the next letter Shift brings one again.
const LETTERS_STARTED_AGAIN := &"letters_started_again"
## Every letter, in the order they arrive; the Family text table must have text for each. Their
## tone moves from warm and homesick to distant and full of school slogans. Saves hold these
## ids, and one that holds an unknown id is damaged, so add new letters at the end and never
## rename or remove one.
const LETTER_IDS: Array[StringName] = [
	&"letter_01",
	&"letter_02",
	&"letter_03",
	&"letter_04",
	&"letter_05",
	&"letter_06",
	&"letter_07",
	&"letter_08",
]
## Overseer events, for the field and its sounds; never App text. He blew his whistle at the
## Worker stopped to breathe.
const OVERSEER_WHISTLE := Toil.WHISTLE
## He used the whip, and the Worker runs again. It changes no numbers.
const OVERSEER_WHIP := Toil.WHIP
## The Quota-missed key for the first, second and every later miss in a row.
const MISSED_KEYS: Array[StringName] = [QUOTA_MISSED, QUOTA_MISSED_AGAIN, QUOTA_MISSED_REPEATEDLY]

var _tuning: Tuning
var _crops: Crops
var _exhaustion: Exhaustion
var _toil: Toil
var _shift_number := 1
## Seconds of online play into the current Shift.
var _shift_elapsed := 0.0
## Cotton picked this Shift. Starts from zero each Shift: a surplus carries no credit.
var _picked := 0
var _ledger := Ledger.new()
var _store: Store
## The Quota rise of the Upgrades bought before this Shift began; later ones wait for the next.
var _shift_upgrade_rise := 0
## Seconds left in the current Study Session; 0 when the Worker is on the field.
var _study_left := 0.0
## Quotas missed since the last met one; it sets the next Study Session's length.
var _misses_in_a_row := 0
var _messages: Array[AppMessage] = []
var _letters := Letters.new(LETTER_IDS)
var _family_events: Array[FamilyEvent] = []
## Seconds left of a slow field action; he can do no other field work until it is 0.
var _busy_left := 0.0
## Seconds left of a rest hour; 0 when he isn't resting.
var _rest_left := 0.0
## Set by a missed Quota for the whole of the next Shift.
var _privileges_taken_away := false
## Returns a number from 0 to 1 each call; a pick drops its cotton when it comes up under the
## tuning's chance.
var _roll: Callable
## Kept here for the default roll, as a Callable doesn't keep its object alive.
var _random: RandomNumberGenerator


## `roll` is the source of chance, returning a number from 0 to 1; tests pass their own.
## Without one the Farm uses a randomly seeded generator.
func _init(tuning: Tuning, plot_count: int, roll: Callable = Callable()) -> void:
	_tuning = tuning
	_crops = Crops.new(tuning.grow_seconds, tuning.wither_seconds, plot_count)
	_exhaustion = Exhaustion.new(tuning)
	_toil = Toil.new(tuning, _exhaustion)
	_store = Store.new(tuning.generator_tiers, tuning.tools_tiers)
	if roll.is_valid():
		_roll = roll
	else:
		_random = RandomNumberGenerator.new()
		_random.randomize()
		_roll = _random.randf
	_ledger = Ledger.new(0, 0, _fees_every())
	var children := {"school_fees_shift": _ledger.next_fees_shift(), "every": _fees_every()}
	_messages.append(AppMessage.new(CHILDREN_AT_SCHOOL, children))
	_start_shift()


func plant(index: int) -> CommandResult:
	if in_study_session():
		return CommandResult.refused(IN_STUDY_SESSION)
	if not _crops.exists(index):
		return CommandResult.refused(NO_SUCH_PLOT)
	if _crops.is_withered(index):
		return CommandResult.refused(WITHERED)
	if not _crops.is_empty(index):
		return CommandResult.refused(NOT_EMPTY)
	var unable := _unable_to_work()
	if unable != &"":
		return CommandResult.refused(unable)
	_start_field_work(_tuning.exhaustion_per_plant)
	_crops.plant(index)
	return CommandResult.done()


## Picks ripe cotton. Exhausted past the mistake threshold, he can drop it: the plot is
## emptied, but nothing counts towards the Quota and nothing is earned. Better tools make a
## slow pick shorter and a drop less likely.
func pick(index: int) -> CommandResult:
	var refusal := _pick_refusal(index)
	if refusal != &"":
		return CommandResult.refused(refusal)
	# How tired he was as he reached for it decides whether he drops it.
	var roll: float = _roll.call()
	var work_share := _store.work_share()
	var drop_chance := _tuning.dropped_cotton_chance * work_share
	var drops := _exhaustion.can_drop_cotton() and roll < drop_chance
	_start_field_work(_tuning.exhaustion_per_pick, work_share)
	_crops.empty(index)
	if drops:
		_messages.append(AppMessage.new(COTTON_DROPPED, {}))
	else:
		_picked += 1
		var were_stopped := letters_stopped()
		_note_paid_in(_ledger.earn(roundi(_tuning.labour_points_per_pick)), were_stopped)
	return CommandResult.done()


## Empties a Withered plot so it can be planted again. Like planting, it is field work.
func clear(index: int) -> CommandResult:
	if in_study_session():
		return CommandResult.refused(IN_STUDY_SESSION)
	if not _crops.exists(index):
		return CommandResult.refused(NO_SUCH_PLOT)
	if not _crops.is_withered(index):
		return CommandResult.refused(NOT_WITHERED)
	var unable := _unable_to_work()
	if unable != &"":
		return CommandResult.refused(unable)
	_start_field_work(0.0)
	_crops.empty(index)
	return CommandResult.done()


## Sends the Worker to run on the Generator. Sending him while he is on it changes nothing.
func run_generator() -> CommandResult:
	if in_study_session():
		return CommandResult.refused(IN_STUDY_SESSION)
	if _resting():
		return CommandResult.refused(RESTING)
	_toil.send()
	return CommandResult.done()


## Buys the next tier of an Upgrade (GENERATOR or TOOLS) with Labour Points. It works at once;
## its Quota rise counts from the next Shift.
func buy_upgrade(upgrade: StringName) -> CommandResult:
	if upgrade != GENERATOR and upgrade != TOOLS:
		return CommandResult.refused(NO_SUCH_UPGRADE)
	var refusal := _upgrade_refusal(upgrade)
	if refusal != &"":
		return CommandResult.refused(refusal)
	if upgrade == GENERATOR:
		var tier := _store.next_generator_tier()
		_ledger.spend(roundi(tier.price))
		_store.buy_generator_tier()
		var values := _upgraded_values(_store.generator_tier(), tier.price, tier.quota_rise)
		values["multiplier"] = tier.growth_multiplier
		_messages.append(AppMessage.new(GENERATOR_UPGRADED, values))
	else:
		var tier := _store.next_tools_tier()
		_ledger.spend(roundi(tier.price))
		_store.buy_tools_tier()
		var values := _upgraded_values(_store.tools_tier(), tier.price, tier.quota_rise)
		values["share"] = tier.work_share
		_messages.append(AppMessage.new(TOOLS_UPGRADED, values))
	return CommandResult.done()


## Only the debug wiring calls this, so players can never use it: it adds Labour Points
## without work, to reach the store's dearer items quickly.
func debug_add_labour_points(points: int) -> void:
	var were_stopped := letters_stopped()
	_note_paid_in(_ledger.credit(points), were_stopped)


## Buys a Privilege with Labour Points. The only one so far is REST_HOUR.
func buy_privilege(privilege: StringName) -> CommandResult:
	if privilege == REST_HOUR:
		return _buy_rest_hour()
	return CommandResult.refused(NO_SUCH_PRIVILEGE)


## The rest hour, the first Privilege: it costs Labour Points and takes the Worker off the
## Generator, lowering his Exhaustion towards its floor while the Shift counts on.
func _buy_rest_hour() -> CommandResult:
	var refusal := _rest_hour_refusal()
	if refusal != &"":
		return CommandResult.refused(refusal)
	var price := _rest_hour_price()
	_ledger.spend(price)
	_rest_left = _tuning.rest_hour_seconds
	_toil.bring_back()
	var values := {"price": price, "minutes": ceili(_rest_left / 60.0)}
	_messages.append(AppMessage.new(REST_STARTED, values))
	return CommandResult.done()


## Moves the Farm on by some seconds of online play. Time never runs backwards, so a
## negative step does nothing. The clock that runs is the Study Session's while the Worker is
## in one, and the Shift's otherwise; crops grow only while he runs on the Generator.
## Returns what the Overseer did in that time (OVERSEER_WHISTLE, OVERSEER_WHIP), oldest first,
## for the scene to show as it happens; they are not saved.
func advance(seconds: float) -> Array[StringName]:
	var overseer_events: Array[StringName] = []
	_busy_left = maxf(0.0, _busy_left - maxf(seconds, 0.0))
	var remaining := seconds
	# One long step can cover several Shifts, Study Sessions, runs, breaths, rests and
	# Witherings; each ends in turn.
	while remaining > 0.0:
		if in_study_session():
			remaining -= _serve_study_session(remaining)
		else:
			var shift_left := _tuning.shift_seconds - _shift_elapsed
			var growth_rate := _store.growth_multiplier() if _toil.is_running() else 0.0
			var worked := minf(minf(remaining, shift_left), _toil.seconds_until_turn())
			worked = minf(worked, _crops.seconds_until_wither(growth_rate))
			worked = minf(worked, _rest_left if _resting() else INF)
			var overseer_event := _toil.pass_time(worked)
			if overseer_event != Toil.NO_EVENT:
				overseer_events.append(overseer_event)
			_rest(worked)
			var withered := _crops.tend(worked, growth_rate)
			remaining -= worked
			if worked >= shift_left:
				_shift_elapsed = 0.0
				_end_shift()
			else:
				_shift_elapsed += worked
			# After the Shift's end, so a missed Quota's shorter Study Session can't replace it.
			_log_negligence(withered)
	return overseer_events


## Moves the Farm on by some seconds offline: crops grow at the offline rate whatever the
## Worker was doing, and a Study Session counts down, but the Shift waits and the Worker stays
## where he was: a rest hour waits for his return, like the Shift. Exhaustion recovers at the
## offline rate, never below its floor. A wrong clock can't break the Farm: negative time
## counts as zero and a long absence is cut to the tuning's cap; the report says which.
func resume_offline(seconds: float) -> AwayReport:
	var counted := clampf(seconds, 0.0, _tuning.offline_cap_seconds)
	var problem := &""
	if seconds < 0.0:
		problem = NEGATIVE_OFFLINE_TIME
	elif seconds > _tuning.offline_cap_seconds:
		problem = OFFLINE_TIME_CAPPED
	_busy_left = maxf(0.0, _busy_left - counted)
	var recovered := _exhaustion.recover(_tuning.offline_recovery_per_hour * counted / 3600.0)
	var rate := _tuning.offline_growth_rate
	var ripe_before := _crops.ripe_count()
	var study_served := 0.0
	var withered := 0
	var remaining := counted
	# The Study Session comes first; ripe cotton ages towards Withering only after it.
	while remaining > 0.0:
		if in_study_session():
			var served := _serve_study_session(remaining)
			_crops.grow(served, rate)
			study_served += served
			remaining -= served
		else:
			var step := minf(remaining, _crops.seconds_until_wither(rate))
			var withered_plots := _crops.tend(step, rate)
			withered += withered_plots.size()
			_log_negligence(withered_plots)
			remaining -= step
	# Withered plots are no longer ripe, and nothing else stops being ripe while away.
	var ripened := _crops.ripe_count() - ripe_before + withered
	if counted > 0.0:
		var values := {
			"minutes": ceili(counted / 60.0),
			"ripened": ripened,
			"withered": withered,
			"study_minutes": ceili(study_served / 60.0),
			"exhaustion_recovered": roundi(recovered),
		}
		_messages.append(AppMessage.new(AWAY_SUMMARY, values))
	return AwayReport.new(seconds, counted, problem, ripened, withered, study_served, recovered)


## The whole Farm as plain data (numbers, true or false, lists and dictionaries), with the save
## format version. Pending App messages and the source of chance are not part of it.
func to_save() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"shift_number": _shift_number,
		"shift_elapsed": _shift_elapsed,
		"picked": _picked,
		"labour_points": _ledger.balance(),
		"shift_earned": _ledger.earned(),
		"school_fees_shift": _ledger.next_fees_shift(),
		"school_fees_unpaid": _ledger.fees_unpaid(),
		"school_fees_unpaid_in_a_row": _ledger.fees_unpaid_in_a_row(),
		"letters": {"letter_shifts": _letters.letter_shifts(), "received": _letters.received()},
		"study_left": _study_left,
		"misses_in_a_row": _misses_in_a_row,
		"busy_left": _busy_left,
		"rest_left": _rest_left,
		# Named before every Privilege was taken away, not only the rest hour; kept for old saves.
		"rest_taken_away": _privileges_taken_away,
		"crops": _crops.to_save(),
		"exhaustion": _exhaustion.to_save(),
		"toil": _toil.to_save(),
		"store": _store.to_save(),
		"shift_upgrade_quota_rise": _shift_upgrade_rise,
	}


## Takes the Farm from a save written by to_save(), as it comes back from JSON. Returns what is
## wrong with it, one line per bad field; then the Farm is left as it was. On success the
## pending App messages are dropped: they described the Farm before the restore.
## Timers are held to what the tuning table allows now, in case it shortened them since the
## save was written; the save's other numbers are taken as they are. A version 1 save, from
## before the store, restores with no Upgrades; a negative balance restores as Debt.
func restore(save: Dictionary) -> Array[String]:
	var reader := SaveReader.new(save)
	var version := reader.whole("version")
	if reader.problems().is_empty() and version not in SAVE_VERSIONS_READ:
		return ["version %d is not a version this game reads (%s)" % [version, SAVE_VERSIONS_READ]]
	var crops := Crops.new(_tuning.grow_seconds, _tuning.wither_seconds, _crops.count())
	crops.restore(reader.section("crops"))
	var exhaustion := Exhaustion.new(_tuning)
	exhaustion.restore(reader.section("exhaustion"))
	var toil := Toil.new(_tuning, exhaustion)
	toil.restore(reader.section("toil"), version >= 4)
	var shift_number := reader.whole("shift_number", 1)
	var shift_elapsed := minf(reader.number("shift_elapsed"), _tuning.shift_seconds)
	var picked := reader.whole("picked")
	var balance := reader.whole("labour_points", LEAST_SAVED_BALANCE)
	var shift_earned := reader.whole("shift_earned") if version >= 4 else 0
	var fees_shift := shift_number + _fees_every()
	var fees_unpaid := false
	var fees_unpaid_in_a_row := 0
	if version >= 5:
		fees_shift = reader.whole("school_fees_shift", 1)
		fees_unpaid = reader.flag("school_fees_unpaid")
		fees_unpaid_in_a_row = reader.whole("school_fees_unpaid_in_a_row")
	var letters := Letters.new(LETTER_IDS)
	if version >= 6:
		var letters_section := reader.section("letters")
		letters = Letters.new(
			LETTER_IDS,
			letters_section.whole("letter_shifts"),
			letters_section.ids("received", LETTER_IDS)
		)
	var study_left := reader.number("study_left")
	var misses_in_a_row := reader.whole("misses_in_a_row")
	var busy_left := minf(reader.number("busy_left"), _tuning.slow_action_seconds)
	var rest_left := minf(reader.number("rest_left"), _tuning.rest_hour_seconds)
	var privileges_taken_away := reader.flag("rest_taken_away")
	var store := Store.new(_tuning.generator_tiers, _tuning.tools_tiers)
	var shift_upgrade_rise := 0
	if version >= 2:
		store.restore(reader.section("store"), version >= 3)
		shift_upgrade_rise = reader.whole("shift_upgrade_quota_rise")
	if not reader.problems().is_empty():
		return reader.problems()
	_crops = crops
	_exhaustion = exhaustion
	_toil = toil
	_shift_number = shift_number
	_shift_elapsed = shift_elapsed
	_picked = picked
	_ledger = Ledger.new(balance, shift_earned, fees_shift, fees_unpaid, fees_unpaid_in_a_row)
	_letters = letters
	_study_left = study_left
	_misses_in_a_row = misses_in_a_row
	_busy_left = busy_left
	_rest_left = rest_left
	_privileges_taken_away = privileges_taken_away
	_store = store
	_shift_upgrade_rise = shift_upgrade_rise
	_messages = []
	_family_events = []
	return []


## The plot at index; it must exist.
func plot(index: int) -> PlotView:
	return _crops.view(index, _store.growth_multiplier())


func plots() -> Array[PlotView]:
	var views: Array[PlotView] = []
	for index in _crops.count():
		views.append(plot(index))
	return views


func shift() -> ShiftView:
	var seconds_left := _tuning.shift_seconds - _shift_elapsed
	return ShiftView.new(_shift_number, _quota(), _picked, seconds_left, _ledger.next_fees_shift())


## Set when a school-fees Bill left a shortfall; cleared when the Debt reaches zero.
func school_fees_unpaid() -> bool:
	return _ledger.fees_unpaid()


## School-fees Bills in a row that left a shortfall; a covered one resets the count.
func school_fees_unpaid_in_a_row() -> int:
	return _ledger.fees_unpaid_in_a_row()


## The letters received so far, oldest first.
func letters_received() -> Array[StringName]:
	return _letters.received()


## Set while unpaid school fees keep the letters from coming; cleared with the Debt.
func letters_stopped() -> bool:
	return _ledger.fees_unpaid()


## Labour Points to spend; 0 while in Debt.
func labour_points() -> int:
	return _ledger.labour_points()


## Labour Points owed to the Farm; 0 while out of Debt. Never above 0 with labour_points().
func debt() -> int:
	return _ledger.debt()


func in_study_session() -> bool:
	return _study_left > 0.0


## Seconds until the Worker is back on the field; 0 when they are on it.
func study_session_seconds_left() -> float:
	return _study_left


func worker() -> WorkerView:
	var activity := WorkerView.Activity.IN_FIELD
	if _resting():
		activity = WorkerView.Activity.RESTING
	elif _toil.is_breathing():
		activity = WorkerView.Activity.BREATHING
	elif _toil.is_running():
		activity = WorkerView.Activity.RUNNING
	return WorkerView.new(activity, _toil.laps_left(), _exhaustion.level(), _toil.lap_progress())


## From 0 (rested) to Exhaustion.MOST (spent).
func exhaustion() -> float:
	return _exhaustion.level()


## The least Exhaustion can be; it rises every Shift and never falls.
func exhaustion_floor() -> float:
	return _exhaustion.floor_level()


func _resting() -> bool:
	return _rest_left > 0.0


## Its price, the seconds left of one under way, and whether a missed Quota took it away.
func rest_hour() -> RestHourView:
	return RestHourView.new(_rest_hour_price(), _rest_left, _privileges_taken_away)


func _rest_hour_price() -> int:
	return roundi(_tuning.rest_hour_price)


## Why the rest hour can't be bought right now, or &"" when it can.
func _rest_hour_refusal() -> StringName:
	if in_study_session():
		return IN_STUDY_SESSION
	if _privileges_taken_away:
		return PRIVILEGES_TAKEN_AWAY
	if _resting():
		return RESTING
	if _ledger.in_debt():
		return IN_DEBT
	if not _ledger.can_afford(_rest_hour_price()):
		return NOT_ENOUGH_LABOUR_POINTS
	return &""


## The values of an Upgrade-bought message every Upgrade shares.
func _upgraded_values(tier: int, price: float, quota_rise: float) -> Dictionary:
	return {"tier": tier, "price": roundi(price), "quota_rise": roundi(quota_rise)}


## Why the next tier of an Upgrade can't be bought right now, or &"" when it can.
func _upgrade_refusal(upgrade: StringName) -> StringName:
	var tier: Resource = (
		_store.next_generator_tier() if upgrade == GENERATOR else _store.next_tools_tier()
	)
	if tier == null:
		return FULLY_UPGRADED
	if in_study_session():
		return IN_STUDY_SESSION
	if _ledger.in_debt():
		return IN_DEBT
	var tier_price: float = tier.get("price")
	if not _ledger.can_afford(roundi(tier_price)):
		return NOT_ENOUGH_LABOUR_POINTS
	return &""


## Everything the store sells, Upgrades first, each with its price and why it can't be bought
## right now.
func store() -> Array[StoreItemView]:
	var generator_next := _store.next_generator_tier()
	var generator := _upgrade_view(
		GENERATOR,
		Vector2i(_store.generator_tier(), _store.generator_top_tier()),
		generator_next,
		generator_next.growth_multiplier if generator_next != null else 0.0,
		_store.growth_multiplier()
	)
	var tools_next := _store.next_tools_tier()
	var tools := _upgrade_view(
		TOOLS,
		Vector2i(_store.tools_tier(), _store.tools_top_tier()),
		tools_next,
		tools_next.work_share if tools_next != null else 0.0,
		_store.work_share()
	)
	var rest_hour := StoreItemView.new(
		REST_HOUR, StoreItemView.Kind.PRIVILEGE, _rest_hour_price(), _rest_hour_refusal()
	)
	return [generator, tools, rest_hour]


## The store's view of an Upgrade. Fully upgraded (`next` null), it shows the owned tier's
## effect, no price and no Quota rise.
func _upgrade_view(
	upgrade: StringName, tiers: Vector2i, next: Resource, next_effect: float, current: float
) -> StoreItemView:
	var price := 0
	var effect := current
	var rise := 0
	if next != null:
		var next_price: float = next.get("price")
		var next_rise: float = next.get("quota_rise")
		price = roundi(next_price)
		effect = next_effect
		rise = roundi(next_rise)
	return StoreItemView.upgrade(
		upgrade, tiers, price, Vector2(effect, current), rise, _upgrade_refusal(upgrade)
	)


## What The App should say since the last call, oldest first. Empties the queue.
func take_messages() -> Array[AppMessage]:
	var taken := _messages
	_messages = []
	return taken


## What the Family sent since the last call, oldest first. Empties the queue.
func take_family_events() -> Array[FamilyEvent]:
	var taken := _family_events
	_family_events = []
	return taken


## The Quota only ever rises: a fixed step every Shift, met or missed, and the rise of every
## Upgrade bought before this Shift began.
func _quota() -> int:
	var rise := (_shift_number - 1) * _tuning.quota_rise
	return roundi(_tuning.first_quota + rise) + _shift_upgrade_rise


func _start_shift() -> void:
	_picked = 0
	_shift_upgrade_rise = _store.quota_rise()
	_messages.append(AppMessage.new(SHIFT_STARTED, {"shift": _shift_number, "quota": _quota()}))
	var every := roundi(_tuning.letter_every_shifts)
	var letter := _letters.start_shift(_shift_number, every, letters_stopped())
	if letter != &"":
		_family_events.append(FamilyEvent.new(LETTER_ARRIVED, letter))


## Checks the Quota, charges the Bills, raises the Exhaustion floor and starts the next Shift.
## A missed Quota also takes every Privilege away until the next Shift ends.
func _end_shift() -> void:
	var values := {"shift": _shift_number, "picked": _picked, "quota": _quota()}
	if _picked >= _quota():
		_misses_in_a_row = 0
		_privileges_taken_away = false
		_messages.append(AppMessage.new(QUOTA_MET, values))
	else:
		_misses_in_a_row += 1
		_privileges_taken_away = true
		var key := MISSED_KEYS[mini(_misses_in_a_row, MISSED_KEYS.size()) - 1]
		_messages.append(AppMessage.new(key, values))
		_start_study_session()
	_charge_bills()
	_exhaustion.raise_floor(_tuning.exhaustion_floor_rise)
	_shift_number += 1
	_start_shift()


## The pay slip, and word of the Worker falling into Debt if the Bills put him there.
func _charge_bills() -> void:
	var was_in_debt := _ledger.in_debt()
	var were_stopped := letters_stopped()
	var slip := _ledger.settle_shift(_shift_number, _toil.take_laps_run(), _tuning)
	_messages.append(AppMessage.new(PAY_SLIP, slip))
	if _ledger.in_debt() and not was_in_debt:
		_messages.append(AppMessage.new(FELL_INTO_DEBT, {"debt": _ledger.debt()}))
	if letters_stopped() and not were_stopped:
		_family_events.append(FamilyEvent.new(LETTERS_STOPPED))


## After Labour Points came in: says so when they paid off the last of the Debt (`cleared`),
## and when that starts again the letters that were stopped before they came in.
func _note_paid_in(cleared: bool, were_stopped: bool) -> void:
	if cleared:
		_messages.append(AppMessage.new(DEBT_CLEARED, {"points": _ledger.labour_points()}))
	if were_stopped and not letters_stopped():
		_family_events.append(FamilyEvent.new(LETTERS_STARTED_AGAIN))


func _fees_every() -> int:
	return roundi(_tuning.school_fees_every_shifts)


## Doubles for each miss in a row, up to the cap.
func _start_study_session() -> void:
	var doublings := _misses_in_a_row - 1
	_begin_study_session(
		minf(_tuning.study_session_seconds * pow(2.0, doublings), _tuning.study_session_cap_seconds)
	)


## Logs the plots that Withered at one moment as Negligence: docks Labour Points for each, never
## below zero, and starts the Negligence Study Session. Plots Withering together share one.
func _log_negligence(withered_plots: Array[int]) -> void:
	if withered_plots.is_empty():
		return
	var docked := _ledger.dock(withered_plots.size() * roundi(_tuning.negligence_labour_points))
	var values := {"plots": withered_plots.size(), "points": docked}
	_messages.append(AppMessage.new(NEGLIGENCE_LOGGED, values))
	_begin_study_session(maxf(_study_left, _tuning.negligence_study_session_seconds))


## Takes the Worker off the Generator and cuts any rest hour short.
func _begin_study_session(seconds: float) -> void:
	_study_left = seconds
	_rest_left = 0.0
	_toil.bring_back()
	var values := {
		"seconds": _study_left,
		"minutes": ceili(_study_left / 60.0),
		"in_a_row": _misses_in_a_row,
	}
	_messages.append(AppMessage.new(STUDY_SESSION_STARTED, values))


## Counts the Study Session down by up to `seconds`, ending it if they cover what is left.
## Returns the seconds served: 0 when there is no Study Session.
func _serve_study_session(seconds: float) -> float:
	var served := minf(seconds, _study_left)
	if served <= 0.0:
		return 0.0
	if served >= _study_left:
		_end_study_session()
	else:
		_study_left -= served
	return served


func _end_study_session() -> void:
	_study_left = 0.0
	_messages.append(AppMessage.new(STUDY_SESSION_ENDED, {"in_a_row": _misses_in_a_row}))


## Why plot `index` can't be picked right now, or &"" when it can.
func _pick_refusal(index: int) -> StringName:
	if in_study_session():
		return IN_STUDY_SESSION
	if not _crops.exists(index):
		return NO_SUCH_PLOT
	if _crops.is_empty(index):
		return NOTHING_PLANTED
	if _crops.is_withered(index):
		return WITHERED
	if not _crops.is_ripe(index):
		return NOT_RIPE
	return _unable_to_work()


## Why the Worker can't do field work right now, or &"" when he can.
func _unable_to_work() -> StringName:
	if _resting():
		return RESTING
	if _busy_left > 0.0:
		return WORKER_BUSY
	return &""


## Field work brings him back from the Generator. Exhausted, it is slow, judged by how tired he
## was when he started, and `slow_share` of the usual slow time (tools shorten a pick); then it
## adds its own Exhaustion.
func _start_field_work(exhaustion_added: float, slow_share: float = 1.0) -> void:
	_toil.bring_back()
	if _exhaustion.slows_work():
		_busy_left = _tuning.slow_action_seconds * slow_share
	_exhaustion.add(exhaustion_added)


## Some seconds of a rest hour, never past its end: Exhaustion falls a little at a time.
func _rest(seconds: float) -> void:
	if not _resting():
		return
	_exhaustion.recover(_tuning.rest_hour_recovery * seconds / _tuning.rest_hour_seconds)
	if seconds >= _rest_left:
		_rest_left = 0.0
		_toil.rested()
		_messages.append(AppMessage.new(REST_ENDED, {}))
	else:
		_rest_left -= seconds
