# gdlint: disable=max-public-methods
# Farm is the one seam the game and the tests drive (see the specs), so every command and view
# is public here; the work itself is delegated to Crops, Toil, Exhaustion, Ledger, Store,
# StoreFront and Shifts.
class_name Farm
extends RefCounted
## The Farm rules: the plots and the cotton growing in them. No scene tree, clock or file
## access: time only moves when advance() or resume_offline() is called, so tests play hours
## in milliseconds.
## It also runs the Shift (see Shifts): online play counts it down, and at its end the Hand-in
## opens. The Farm stands still until the Worker hands in his cotton: online time moves
## nothing and every other command is refused, though offline time works as usual. Handing in
## pays Labour Points for the cotton handed in (never at a pick), checks the Quota on it, and
## starts the next Shift with a higher Quota. What The App should say comes
## out as AppMessages through take_messages(). A missed Quota starts a Study Session: the Worker
## can't plant or pick until it ends, and the next Shift's clock waits for it.
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
## Labour Points also buy a call home: it takes him off the Generator for its length, so crops
## halt, and sends a Family event whose call follows the latest letter received.
## The store also sells land (see Land), a Plot at a time in a fixed order, each dearer than the
## last; each Plot bought raises the Quota from the next Shift, by less than it should yield.
## At the Hand-in the Worker can keep some cotton back: it neither counts towards the Quota nor
## earns Labour Points, but sells on the side for hidden savings, kept in the Ledger beside
## them. They buy anything in the store and pay a Bill the Labour Points can't cover before it
## becomes Debt; they never pay existing Debt, and Negligence never touches them.
## Keeping back, and spending hidden savings in the store, make a Harmony Audit likelier (see
## Audits); one that catches him takes the savings and starts the longest Study Session.
## The store also sells supplies (see Supplies) into a small stock. Fertiliser, dearer every
## Shift, is spread on a Seedling so that crop grows faster until it leaves the Plot.
## Bollworms come to growing Plots by chance in online play outside Study Sessions (see
## Bollworms). Tapping the Plot picks them off, which is slow field work; left too long they eat
## the crop, emptying the Plot, and it is Negligence as for a Withered Plot. Pesticide, sprayed
## on a Plot without them, keeps them off until the crop in it, or the next one planted, leaves.
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
## The Shift's time ran out: nothing else happens until he hands in his cotton.
const HAND_IN_OPEN := &"hand_in_open"
## hand_in() was called with no Hand-in open.
const NO_HAND_IN := &"no_hand_in"
const RESTING := Privileges.RESTING
## He is on a call home: no field work, no Generator, no other Privilege until it ends.
const ON_A_CALL := Privileges.ON_A_CALL
## A missed Quota took every Privilege away for this Shift.
const PRIVILEGES_TAKEN_AWAY := &"privileges_taken_away"
## The Worker owes the Farm, so he can buy nothing in the store, whatever pays.
const IN_DEBT := Ledger.IN_DEBT
const NOT_ENOUGH_LABOUR_POINTS := Ledger.NOT_ENOUGH_LABOUR_POINTS
## Not among STORE_REFUSALS: The App never mentions hidden savings, so the tin explains it.
const NOT_ENOUGH_HIDDEN_SAVINGS := Ledger.NOT_ENOUGH_HIDDEN_SAVINGS
## What a store purchase is paid with.
const PAY_LABOUR_POINTS := Ledger.PayWith.LABOUR_POINTS
const PAY_HIDDEN_SAVINGS := Ledger.PayWith.HIDDEN_SAVINGS
## hand_in() with this, or any amount over the cotton in hand, hands in all of it.
const ALL_IN_HAND := -1
## The Upgrade has no tier left to buy.
const FULLY_UPGRADED := StoreFront.FULLY_UPGRADED
## The land is at its largest: no Plot is left to buy.
const FULLY_BOUGHT := StoreFront.FULLY_BOUGHT
## The land item in store(), which buy_plot() buys.
const LAND := StoreFront.LAND
## The Privileges buy_privilege() sells.
const REST_HOUR := StoreFront.REST_HOUR
const CALL_HOME := StoreFront.CALL_HOME
## buy_privilege() was given a Privilege the Farm does not sell.
const NO_SUCH_PRIVILEGE := &"no_such_privilege"
## The Upgrades buy_upgrade() sells.
const GENERATOR := StoreFront.GENERATOR
const TOOLS := StoreFront.TOOLS
## buy_upgrade() was given an Upgrade the Farm does not sell.
const NO_SUCH_UPGRADE := &"no_such_upgrade"
## Supplies, their message key and their refusals, documented in Supplies.
const FERTILISER := Supplies.FERTILISER
const PESTICIDE := Supplies.PESTICIDE
const SUPPLIES := Supplies.KINDS
const SUPPLY_BOUGHT := Supplies.SUPPLY_BOUGHT
const STOCK_FULL := Supplies.STOCK_FULL
const NO_SUCH_SUPPLY := Supplies.NO_SUCH_SUPPLY
const NONE_HELD := Supplies.NONE_HELD
const WRONG_STAGE := Supplies.WRONG_STAGE
const ALREADY_FERTILISED := Supplies.ALREADY_FERTILISED
## Bollworm keys and refusals, documented in Bollworms.
const BOLLWORMS_ARRIVED := Bollworms.BOLLWORMS_ARRIVED
const CROP_EATEN := Bollworms.CROP_EATEN
const NO_BOLLWORMS := Bollworms.NO_BOLLWORMS
const BOLLWORMS_ON_PLOT := Bollworms.BOLLWORMS_ON_PLOT
const ALREADY_PROTECTED := Bollworms.ALREADY_PROTECTED
## The reasons fertilise() refuses that The App explains; the others it shares with planting.
const FERTILISE_REFUSALS: Array[StringName] = [NONE_HELD, WRONG_STAGE, ALREADY_FERTILISED]
## The reasons spray() refuses that The App explains.
const SPRAY_REFUSALS: Array[StringName] = [NONE_HELD, BOLLWORMS_ON_PLOT, ALREADY_PROTECTED]
## Every reason a store item can be refused with; the App text table explains each.
const STORE_REFUSALS: Array[StringName] = [
	HAND_IN_OPEN,
	IN_STUDY_SESSION,
	PRIVILEGES_TAKEN_AWAY,
	RESTING,
	ON_A_CALL,
	IN_DEBT,
	NOT_ENOUGH_LABOUR_POINTS,
	FULLY_UPGRADED,
	FULLY_BOUGHT,
	STOCK_FULL,
]

## The save format to_save() writes and restore() reads. Raise it when the format changes.
## Version 2 added the store; a version 1 save restores with no Upgrades. Version 3 added the
## tools; a version 2 save restores with none. Version 4 added the Bills; a version 3 save
## restores with nothing earned and no laps run yet this Shift. Version 5 added the school
## fees; an older save restores with them paid up and due school_fees_every_shifts Shifts after
## its own. Version 6 added the letters; an older save restores with none received and no
## letter Shifts passed. Version 7 added the call home; an older save restores with none under
## way. Version 8 added land; an older save restores with the first land's Plots only. Version 9
## added longer laps; an older save's lap in progress takes lap_seconds. Version 10 added the
## Hand-in; an older save carries on with the Shift's picks as cotton in hand and none open.
## Version 11 added hidden savings; an older save restores with none. Version 12 added Harmony
## Audits; an older save restores with a clean record, none planned, never caught. Version 13
## added supplies; an older save restores with none held and nothing fertilised. Version 14
## added Bollworms; an older save restores with none. Version 15 added Pesticide; an older save
## restores with no Plot protected.
const SAVE_VERSION := 15
const SAVE_VERSIONS_READ: Array[int] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

## Why resume_offline() didn't use the clock's time as given (AwayReport.clock_problem).
const NEGATIVE_OFFLINE_TIME := &"negative_offline_time"
const OFFLINE_TIME_CAPPED := &"offline_time_capped"

## App message keys. The Shift's own are documented in Shifts.
const SHIFT_STARTED := Shifts.SHIFT_STARTED
const HAND_IN_OPENED := Shifts.HAND_IN_OPENED
## The Worker handed in his cotton: values shift, handed_in, kept (back, for the log only:
## The App never mentions it), earned (Labour Points for what was handed in).
const HANDED_IN := &"handed_in"
const QUOTA_MET := Shifts.QUOTA_MET
const QUOTA_MISSED := Shifts.QUOTA_MISSED
const QUOTA_MISSED_AGAIN := Shifts.QUOTA_MISSED_AGAIN
const QUOTA_MISSED_REPEATEDLY := Shifts.QUOTA_MISSED_REPEATEDLY
const STUDY_SESSION_STARTED := Shifts.STUDY_SESSION_STARTED
const STUDY_SESSION_ENDED := Shifts.STUDY_SESSION_ENDED
const PAY_SLIP := Shifts.PAY_SLIP
const FELL_INTO_DEBT := Shifts.FELL_INTO_DEBT
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
const REST_ENDED := Privileges.REST_ENDED
## A call home was bought: values price, minutes (rounded up).
const CALL_STARTED := &"call_started"
## An exhausted pick dropped its cotton: nothing counted, nothing earned.
const COTTON_DROPPED := &"cotton_dropped"
## A Generator tier was bought: values tier (from 1), price, multiplier (growth against no
## Upgrade), quota_rise (from the next Shift).
const GENERATOR_UPGRADED := &"generator_upgraded"
## A tools tier was bought: values tier (from 1), price, share (of a slow pick's time and of the
## drop chance, against no Upgrade), quota_rise (from the next Shift).
const TOOLS_UPGRADED := &"tools_upgraded"
## A Plot was bought: values plot (its number, from 1), price, quota_rise (from the next Shift).
const PLOT_BOUGHT := &"plot_bought"
## Earnings paid the last of the Debt: values points (Labour Points left over).
const DEBT_CLEARED := &"debt_cleared"
## The App tells a new game that the Worker's two Children are at a state boarding school
## (values: school_fees_shift, every).
const CHILDREN_AT_SCHOOL := &"children_at_school"
## Harmony Audit keys, documented in Audits.
const AUDIT_ANNOUNCED := Audits.AUDIT_ANNOUNCED
const AUDIT_PASSED := Audits.AUDIT_PASSED
const CAUGHT := Audits.CAUGHT
const CAUGHT_AGAIN := Audits.CAUGHT_AGAIN
const ON_WATCH_ENDED := Audits.ON_WATCH_ENDED
## Every key the rules can emit; the App text table must have text for each.
const MESSAGE_KEYS: Array[StringName] = [
	SHIFT_STARTED,
	HAND_IN_OPENED,
	HANDED_IN,
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
	CALL_STARTED,
	COTTON_DROPPED,
	GENERATOR_UPGRADED,
	TOOLS_UPGRADED,
	PLOT_BOUGHT,
	PAY_SLIP,
	FELL_INTO_DEBT,
	DEBT_CLEARED,
	CHILDREN_AT_SCHOOL,
	AUDIT_ANNOUNCED,
	AUDIT_PASSED,
	CAUGHT,
	CAUGHT_AGAIN,
	ON_WATCH_ENDED,
	SUPPLY_BOUGHT,
	BOLLWORMS_ARRIVED,
	CROP_EATEN,
]
## Family events (FamilyEvent kinds), the Children's side, never App text. The Shift's own are
## documented in Shifts.
const LETTER_ARRIVED := Shifts.LETTER_ARRIVED
const LETTERS_STOPPED := Shifts.LETTERS_STOPPED
## The Debt that stopped the letters was cleared, so the next letter Shift brings one again.
const LETTERS_STARTED_AGAIN := &"letters_started_again"
## The Worker called home: id is one of CALL_IDS.
const CALLED_HOME := &"called_home"
## Every call home the Family text table must have lines for (see Letters).
const CALL_IDS := Letters.CALL_IDS
## The call that follows each letter, and every letter in the order they arrive (see Letters).
const LETTER_CALLS := Letters.CALLS
const LETTER_IDS := Letters.IDS
## Overseer events, for the field and its sounds; never App text. He blew his whistle at the
## Worker stopped to breathe.
const OVERSEER_WHISTLE := Toil.WHISTLE
## He used the whip, and the Worker runs again. It changes no numbers.
const OVERSEER_WHIP := Toil.WHIP
## The Quota-missed key for the first, second and every later miss in a row.
const MISSED_KEYS := Shifts.MISSED_KEYS

var _tuning: Tuning
var _land: Land
var _crops: Crops
var _exhaustion: Exhaustion
var _toil: Toil
var _ledger: Ledger
var _store: Store
var _shifts: Shifts
var _audits: Audits
var _supplies: Supplies
var _bollworms: Bollworms
## Shared with Shifts, so both queues are emptied in place, never replaced.
var _messages: Array[AppMessage] = []
var _letters := Letters.new(LETTER_IDS)
var _family_events: Array[FamilyEvent] = []
## Seconds left of a slow field action; he can do no other field work until it is 0.
var _busy_left := 0.0
var _privileges: Privileges
## Returns a number from 0 to 1 each call; a pick drops its cotton when it comes up under the
## tuning's chance.
var _roll: Callable
## Kept here for the default roll, as a Callable doesn't keep its object alive.
var _random: RandomNumberGenerator


## `roll` is the source of chance, returning a number from 0 to 1; tests pass their own.
## Without one the Farm uses a randomly seeded generator. The land starts at the tuning's first
## columns and rows.
func _init(tuning: Tuning, roll: Callable = Callable()) -> void:
	_tuning = tuning
	_land = Land.first_land(_tuning)
	_crops = _new_crops(_land)
	_supplies = Supplies.new(tuning)
	_exhaustion = Exhaustion.new(tuning)
	_toil = Toil.new(tuning, _exhaustion, _lap_seconds(_land))
	_privileges = Privileges.new(tuning, _exhaustion, _toil, _messages)
	_store = Store.new(tuning.generator_tiers, tuning.tools_tiers)
	if roll.is_valid():
		_roll = roll
	else:
		_random = RandomNumberGenerator.new()
		_random.randomize()
		_roll = _random.randf
	_bollworms = Bollworms.new(tuning, _land.plot_count(), _roll, _messages)
	_ledger = Ledger.new(0, 0, _fees_every())
	_audits = Audits.new(tuning, _ledger, _messages, _roll)
	_shifts = _new_shifts(_ledger, _exhaustion, _toil, _store, _land, _letters, _audits)
	var children := {"school_fees_shift": _ledger.next_fees_shift(), "every": _fees_every()}
	_messages.append(AppMessage.new(CHILDREN_AT_SCHOOL, children))
	_shifts.start()


func plant(index: int) -> CommandResult:
	var held_up := _held_up()
	if held_up != &"":
		return CommandResult.refused(held_up)
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


## Picks ripe cotton into his hands: the crop counter goes up by one, and it is paid for only
## when handed in. Exhausted past the mistake threshold, he can drop it: the plot is emptied,
## but nothing is counted. Better tools make a slow pick shorter and a drop less likely.
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
	_bollworms.crop_left(index)
	if drops:
		_messages.append(AppMessage.new(COTTON_DROPPED, {}))
	else:
		_shifts.count_pick()
	return CommandResult.done()


## Hands in `amount` of the cotton in hand (ALL_IN_HAND, or more than he holds, for all of
## it) and runs the rest of the Shift end: Labour Points for it, the Quota check on it, the
## Bills, the Exhaustion floor rise and the next Shift. The rest is kept back and sold on the
## side: it adds hidden savings before the Bills, so they can pay one.
func hand_in(amount: int = ALL_IN_HAND) -> CommandResult:
	if not hand_in_open():
		return CommandResult.refused(NO_HAND_IN)
	var in_hand := _shifts.cotton_in_hand()
	var handed_in := in_hand if amount < 0 else mini(amount, in_hand)
	var kept := in_hand - handed_in
	var earned := handed_in * roundi(_tuning.labour_points_per_pick)
	var values := {"shift": _shifts.view().number, "handed_in": handed_in, "kept": kept}
	values["earned"] = earned
	_messages.append(AppMessage.new(HANDED_IN, values))
	_ledger.save_up(kept * roundi(_tuning.hidden_savings_per_kept_pick))
	var were_stopped := letters_stopped()
	_note_paid_in(_ledger.earn(earned), were_stopped)
	_shifts.hand_in(handed_in, kept)
	_cut_short_for_study_session()
	return CommandResult.done()


## Empties a Withered plot so it can be planted again. Like planting, it is field work.
func clear(index: int) -> CommandResult:
	var held_up := _held_up()
	if held_up != &"":
		return CommandResult.refused(held_up)
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


## Picks the Bollworms off plot `index`, saving its crop. It is field work that keeps him busy
## for bollworm_pick_off_seconds, longer if he is slow anyway, and adds its own Exhaustion.
func pick_off_bollworms(index: int) -> CommandResult:
	var refusal := _held_up()
	if refusal == &"" and not _crops.exists(index):
		refusal = NO_SUCH_PLOT
	if refusal == &"" and not _bollworms.has(index):
		refusal = NO_BOLLWORMS
	if refusal == &"":
		refusal = _unable_to_work()
	if refusal != &"":
		return CommandResult.refused(refusal)
	_start_field_work(_tuning.bollworm_pick_off_exhaustion)
	_busy_left = maxf(_busy_left, _tuning.bollworm_pick_off_seconds)
	_bollworms.remove(index)
	return CommandResult.done()


## Sends the Worker to run on the Generator. Sending him while he is on it changes nothing.
func run_generator() -> CommandResult:
	var held_up := _held_up()
	if held_up != &"":
		return CommandResult.refused(held_up)
	var unable := _privileges.away_reason()
	if unable != &"":
		return CommandResult.refused(unable)
	_toil.send()
	return CommandResult.done()


## Buys the next tier of an Upgrade (GENERATOR or TOOLS) with Labour Points or hidden savings
## (PAY_LABOUR_POINTS, PAY_HIDDEN_SAVINGS). It works at once; its Quota rise counts from the
## next Shift.
func buy_upgrade(
	upgrade: StringName, pay_with: Ledger.PayWith = PAY_LABOUR_POINTS
) -> CommandResult:
	if upgrade != GENERATOR and upgrade != TOOLS:
		return CommandResult.refused(NO_SUCH_UPGRADE)
	var refusal := _store_front().refusal(upgrade, pay_with)
	if refusal != &"":
		return CommandResult.refused(refusal)
	if upgrade == GENERATOR:
		var tier := _store.next_generator_tier()
		_pay(roundi(tier.price), pay_with)
		_store.buy_generator_tier()
		var values := _upgraded_values(_store.generator_tier(), tier.price, tier.quota_rise)
		values["multiplier"] = tier.growth_multiplier
		_messages.append(AppMessage.new(GENERATOR_UPGRADED, values))
	else:
		var tier := _store.next_tools_tier()
		_pay(roundi(tier.price), pay_with)
		_store.buy_tools_tier()
		var values := _upgraded_values(_store.tools_tier(), tier.price, tier.quota_rise)
		values["share"] = tier.work_share
		_messages.append(AppMessage.new(TOOLS_UPGRADED, values))
	return CommandResult.done()


## Buys the next Plot, in the land's fixed order, paid as buy_upgrade() is. It can be planted
## at once; its Quota rise counts from the next Shift.
func buy_plot(pay_with: Ledger.PayWith = PAY_LABOUR_POINTS) -> CommandResult:
	var front := _store_front()
	var refusal := front.refusal(LAND, pay_with)
	if refusal != &"":
		return CommandResult.refused(refusal)
	var price := front.plot_price()
	_pay(price, pay_with)
	var plot := _land.buy()
	_crops.add_plot()
	_bollworms.add_plot()
	_toil.set_next_lap_seconds(_lap_seconds(_land))
	var values := {"plot": plot + 1, "price": price, "quota_rise": _land.quota_rise_per_plot()}
	_messages.append(AppMessage.new(PLOT_BOUGHT, values))
	return CommandResult.done()


## Buys one of a supply (FERTILISER, PESTICIDE) into his stock, paid as buy_upgrade() is.
func buy_supply(supply: StringName, pay_with: Ledger.PayWith = PAY_LABOUR_POINTS) -> CommandResult:
	if supply not in SUPPLIES:
		return CommandResult.refused(NO_SUCH_SUPPLY)
	var front := _store_front()
	var refusal := front.refusal(supply, pay_with)
	if refusal != &"":
		return CommandResult.refused(refusal)
	var price := front.supply_price(supply)
	_pay(price, pay_with)
	_supplies.add(supply)
	var values := {"kind": supply, "price": price, "held": _supplies.held(supply)}
	values["next_price"] = _supplies.price(supply, shift().number + 1)
	_messages.append(AppMessage.new(SUPPLY_BOUGHT, values))
	return CommandResult.done()


## Spreads one Fertiliser from his stock on plot `index`'s Seedling: that crop grows faster for
## the rest of its growth. Like planting, it is field work.
func fertilise(index: int) -> CommandResult:
	return _use_supply(FERTILISER, index)


## Sprays one Pesticide from his stock on plot `index`, empty or not: no Bollworms come to it
## until the crop in it, or the next one planted, leaves the Plot. Like planting, it is field
## work.
func spray(index: int) -> CommandResult:
	return _use_supply(PESTICIDE, index)


## Only the debug wiring calls this, so players can never use it: it adds Labour Points
## without work, to reach the store's dearer items quickly.
func debug_add_labour_points(points: int) -> void:
	var were_stopped := letters_stopped()
	_note_paid_in(_ledger.credit(points), were_stopped)


## Only the debug wiring calls this: Bollworms come at once to every growing Plot without them.
func debug_bollworms_now() -> void:
	_bollworms.arrive(_crops.growing())


## Only the debug wiring calls this: it plans a Harmony Audit for this Shift, announced at once
## if the Hand-in is already open.
func debug_plan_audit() -> void:
	_audits.plan_now()
	if hand_in_open():
		_audits.announce(shift().number)


## Buys a Privilege, REST_HOUR or CALL_HOME, paid as buy_upgrade() is. Each takes the Worker
## off the Generator while the Shift counts on (see Privileges). A call home also sends a
## Family event whose call follows the latest letter received.
func buy_privilege(
	privilege: StringName, pay_with: Ledger.PayWith = PAY_LABOUR_POINTS
) -> CommandResult:
	if privilege != REST_HOUR and privilege != CALL_HOME:
		return CommandResult.refused(NO_SUCH_PRIVILEGE)
	var front := _store_front()
	var refusal := front.refusal(privilege, pay_with)
	if refusal != &"":
		return CommandResult.refused(refusal)
	var rest := privilege == REST_HOUR
	var price := front.rest_hour_price() if rest else front.call_home_price()
	_pay(price, pay_with)
	var values := {"price": price, "minutes": ceili(_privileges.start(rest) / 60.0)}
	_messages.append(AppMessage.new(REST_STARTED if rest else CALL_STARTED, values))
	if not rest:
		_family_events.append(FamilyEvent.new(CALLED_HOME, _letters.next_call()))
	return CommandResult.done()


## Moves the Farm on by some seconds of online play. Time never runs backwards, so a
## negative step does nothing, and while the Hand-in is open nothing moves: the step stops
## where it opens. The clock that runs is the Study Session's while the Worker is
## in one, and the Shift's otherwise; crops grow only while he runs on the Generator.
## Returns what the Overseer did in that time (OVERSEER_WHISTLE, OVERSEER_WHIP), oldest first,
## for the scene to show as it happens; they are not saved.
func advance(seconds: float) -> Array[StringName]:
	var overseer_events: Array[StringName] = []
	if hand_in_open():
		return overseer_events
	var remaining := seconds
	# One long step can cover several Shifts, Study Sessions, runs, breaths, rests and
	# Witherings; each ends in turn.
	while remaining > 0.0:
		if in_study_session():
			remaining -= _shifts.serve_study_session(remaining)
		else:
			var shift_left := _shifts.seconds_left()
			var growth_rate := _store.growth_multiplier() if _toil.is_running() else 0.0
			var worked := minf(minf(remaining, shift_left), _toil.seconds_until_turn())
			worked = minf(worked, _crops.seconds_until_wither(growth_rate))
			worked = minf(worked, _privileges.seconds_until_end())
			worked = minf(worked, _bollworms.seconds_until_next())
			var overseer_event := _toil.pass_time(worked)
			if overseer_event != Toil.NO_EVENT:
				overseer_events.append(overseer_event)
			_privileges.pass_time(worked)
			var withered := _crops.tend(worked, growth_rate)
			var eaten := _bollworms.tend(worked, _crops, withered)
			remaining -= worked
			_shifts.run(worked)
			_cut_short_for_study_session()
			# After the Shift's end, so a missed Quota's shorter Study Session can't replace it.
			_log_negligence(withered)
			_log_negligence(eaten, CROP_EATEN)
			if hand_in_open():
				break
	# Only the time that passed before the Hand-in opened, if it did.
	_busy_left = maxf(0.0, _busy_left - (maxf(seconds, 0.0) - maxf(remaining, 0.0)))
	return overseer_events


## Moves the Farm on by some seconds offline: crops grow at the offline rate whatever the
## Worker was doing, and a Study Session counts down, but the Shift waits and the Worker stays
## where he was: a rest hour or a call home waits for his return, like the Shift. Exhaustion
## recovers at the offline rate, never below its floor. A wrong clock can't break the Farm:
## negative time counts as zero and a long absence is cut to the tuning's cap; the report says
## which.
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
			var served := _shifts.serve_study_session(remaining)
			_crops.grow(served, rate)
			study_served += served
			remaining -= served
		else:
			var step := minf(remaining, _crops.seconds_until_wither(rate))
			var withered_plots := _crops.tend(step, rate)
			withered += withered_plots.size()
			for index in withered_plots:
				_bollworms.crop_left(index)
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
	var save := {
		"version": SAVE_VERSION,
		"letters": _letters.to_save(),
		"busy_left": _busy_left,
		"crops": _crops.to_save(),
		"exhaustion": _exhaustion.to_save(),
		"toil": _toil.to_save(),
		"store": _store.to_save(),
		"plots_bought": _land.plots_bought(),
		"audits": _audits.to_save(),
		"supplies": _supplies.to_save(),
		"bollworms": _bollworms.to_save(),
	}
	save.merge(_ledger.to_save())
	save.merge(_shifts.to_save())
	save.merge(_privileges.to_save())
	return save


## Takes the Farm from a save written by to_save(), as it comes back from JSON. Returns what is
## wrong with it, one line per bad field; then the Farm is left as it was. On success the
## pending App messages are dropped: they described the Farm before the restore.
## Timers are held to what the tuning table allows now, in case it shortened them since the
## save was written; the save's other numbers are taken as they are. A version 1 save, from
## before the store, restores with no Upgrades; a negative balance restores as Debt. One from
## before land (version 7 or older) restores with the first land's Plots only. One from before
## the Hand-in (version 9 or older) keeps the Shift's picks as cotton in hand, and one from
## before hidden savings (version 10 or older) has none, and one from before supplies (version 12
## or older) holds none and has nothing fertilised, and one from before Bollworms has none, and
## one from before Pesticide has no Plot protected.
func restore(save: Dictionary) -> Array[String]:
	var reader := SaveReader.new(save)
	var version := reader.whole("version")
	if reader.problems().is_empty() and version not in SAVE_VERSIONS_READ:
		return ["version %d is not a version this game reads (%s)" % [version, SAVE_VERSIONS_READ]]
	var land := Land.first_land(_tuning)
	if version >= 8:
		land.restore(reader)
	var crops := _new_crops(land)
	crops.restore(reader.section("crops"), version >= 13)
	var supplies := Supplies.restored(_tuning, reader, version >= 13)
	var bollworms := Bollworms.new(_tuning, land.plot_count(), _roll, _messages)
	if version >= 14:
		bollworms.restore(reader.section("bollworms"), version >= 15)
	var exhaustion := Exhaustion.new(_tuning)
	exhaustion.restore(reader.section("exhaustion"))
	var toil := Toil.new(_tuning, exhaustion, _lap_seconds(land))
	toil.restore(reader.section("toil"), version >= 4, version >= 9)
	var shift_number := reader.whole("shift_number", 1)
	var shift_elapsed := reader.number("shift_elapsed")
	var picked := reader.whole("picked")
	var hand_in_is_open := reader.flag("hand_in_open") if version >= 10 else false
	var ledger := Ledger.restored(reader, version, shift_number + _fees_every())
	var letters := Letters.restored(reader, version >= 6)
	var study_left := reader.number("study_left")
	var misses_in_a_row := reader.whole("misses_in_a_row")
	var busy_left := minf(reader.number("busy_left"), _tuning.slow_action_seconds)
	var privileges := Privileges.new(_tuning, exhaustion, toil, _messages)
	privileges.restore(reader, version >= 7)
	var privileges_taken_away := reader.flag("rest_taken_away")
	var store := Store.new(_tuning.generator_tiers, _tuning.tools_tiers)
	var shift_upgrade_rise := 0
	if version >= 2:
		store.restore(reader.section("store"), version >= 3)
		shift_upgrade_rise = reader.whole("shift_upgrade_quota_rise")
	var audits := Audits.new(_tuning, ledger, _messages, _roll)
	if version >= 12:
		audits.restore(reader.section("audits"))
	var shifts := _new_shifts(ledger, exhaustion, toil, store, land, letters, audits)
	shifts.restore(
		shift_number,
		shift_elapsed,
		picked,
		hand_in_is_open,
		study_left,
		misses_in_a_row,
		privileges_taken_away,
		shift_upgrade_rise
	)
	if not reader.problems().is_empty():
		return reader.problems()
	_land = land
	_crops = crops
	_exhaustion = exhaustion
	_toil = toil
	_ledger = ledger
	_audits = audits
	_supplies = supplies
	_bollworms = bollworms
	_letters = letters
	_busy_left = busy_left
	_privileges = privileges
	_store = store
	_shifts = shifts
	_messages.clear()
	_family_events.clear()
	return []


## The plot at index; it must exist.
func plot(index: int) -> PlotView:
	var view := _crops.view(index, _store.growth_multiplier())
	return view.with_bollworms(_bollworms.seconds_left(index), _bollworms.is_protected(index))


func plots() -> Array[PlotView]:
	var views: Array[PlotView] = []
	for index in _crops.count():
		views.append(plot(index))
	return views


## The Farm's columns and rows and the cell each Plot sits in.
func land() -> LandView:
	return _land.view()


func shift() -> ShiftView:
	return _shifts.view()


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


## What cotton kept back sold for, under his mattress. Only the hidden savings tin shows it,
## never The App.
func hidden_savings() -> int:
	return _ledger.hidden_savings()


## The audit's tell, being on watch and the times caught.
func audit() -> AuditView:
	return _audits.view(_shifts.seconds_left())


## Labour Points owed to the Farm; 0 while out of Debt. Never above 0 with labour_points().
func debt() -> int:
	return _ledger.debt()


func in_study_session() -> bool:
	return _shifts.in_study_session()


## Set from the moment the Shift's time runs out until hand_in().
func hand_in_open() -> bool:
	return _shifts.hand_in_open()


## Seconds until the Worker is back on the field; 0 when they are on it.
func study_session_seconds_left() -> float:
	return _shifts.study_session_seconds_left()


func worker() -> WorkerView:
	return _toil.worker_view(_privileges.is_resting())


## From 0 (rested) to Exhaustion.MOST (spent).
func exhaustion() -> float:
	return _exhaustion.level()


## The least Exhaustion can be; it rises every Shift and never falls.
func exhaustion_floor() -> float:
	return _exhaustion.floor_level()


## Seconds left of a call home under way; 0 when he isn't on one.
func call_home_seconds_left() -> float:
	return _privileges.call_left()


## Its price, the seconds left of one under way, and whether a missed Quota took it away.
func rest_hour() -> RestHourView:
	var price := _store_front().rest_hour_price()
	return RestHourView.new(price, _privileges.rest_left(), _shifts.privileges_taken_away())


## The values of an Upgrade-bought message every Upgrade shares.
func _upgraded_values(tier: int, price: float, quota_rise: float) -> Dictionary:
	return {"tier": tier, "price": roundi(price), "quota_rise": roundi(quota_rise)}


## Everything the store sells, Upgrades first, then land, then Privileges, each with its price
## and why it can't be bought right now with Labour Points, and with hidden savings.
func store() -> Array[StoreItemView]:
	return _store_front().items()


## The store as it stands now, told what holds the Worker up: an open Hand-in or a Study
## Session stops every purchase, and Privileges taken away or one under way stop Privileges.
func _store_front() -> StoreFront:
	var held_up := _held_up()
	var privileges_blocked := _privileges.away_reason()
	if _shifts.privileges_taken_away():
		privileges_blocked = PRIVILEGES_TAKEN_AWAY
	return StoreFront.new(
		_tuning, _ledger, _store, _land, _supplies, shift().number, held_up, privileges_blocked
	)


## What The App should say since the last call, oldest first. Empties the queue.
func take_messages() -> Array[AppMessage]:
	var taken: Array[AppMessage] = _messages.duplicate()
	_messages.clear()
	return taken


## What the Family sent since the last call, oldest first. Empties the queue.
func take_family_events() -> Array[FamilyEvent]:
	var taken: Array[FamilyEvent] = _family_events.duplicate()
	_family_events.clear()
	return taken


## After Labour Points came in: says so when they paid off the last of the Debt (`cleared`),
## and when that starts again the letters that were stopped before they came in.
func _note_paid_in(cleared: bool, were_stopped: bool) -> void:
	if cleared:
		_messages.append(AppMessage.new(DEBT_CLEARED, {"points": _ledger.labour_points()}))
	if were_stopped and not letters_stopped():
		_family_events.append(FamilyEvent.new(LETTERS_STARTED_AGAIN))


func _fees_every() -> int:
	return roundi(_tuning.school_fees_every_shifts)


## Logs the plots lost at one moment, Withered or eaten (`key`), as Negligence (see Shifts).
func _log_negligence(lost_plots: Array[int], key := NEGLIGENCE_LOGGED) -> void:
	_shifts.log_negligence(lost_plots, key)
	_cut_short_for_study_session()


## How long a lap of the track round this land takes: each column or row beyond the first
## land's lengthens it by lap_seconds_per_strip.
func _lap_seconds(land: Land) -> float:
	return _tuning.lap_seconds + land.strips_added() * _tuning.lap_seconds_per_strip


func _new_crops(land: Land) -> Crops:
	return Crops.new(
		_tuning.grow_seconds,
		_tuning.wither_seconds,
		land.plot_count(),
		_tuning.fertiliser_growth_factor
	)


## The Shifts with the parts they work on, sharing the Farm's queues.
func _new_shifts(
	ledger: Ledger,
	exhaustion: Exhaustion,
	toil: Toil,
	store: Store,
	land: Land,
	letters: Letters,
	audits: Audits
) -> Shifts:
	return Shifts.new(
		_tuning, ledger, exhaustion, toil, store, land, letters, audits, _messages, _family_events
	)


## Pays a store price; the store sees hidden savings spent, which makes an audit likelier.
func _pay(price: int, pay_with: Ledger.PayWith) -> void:
	_ledger.pay(price, pay_with)
	if pay_with == PAY_HIDDEN_SAVINGS:
		_audits.note_savings_spent(price)


## A Study Session cuts any rest hour or call home short.
func _cut_short_for_study_session() -> void:
	if in_study_session():
		_privileges.cut_short()


## Uses one of supply `kind` from his stock on plot `index`. Like planting, it is field work.
func _use_supply(kind: StringName, index: int) -> CommandResult:
	var refusal := _held_up()
	if refusal == &"" and not _crops.exists(index):
		refusal = NO_SUCH_PLOT
	if refusal == &"":
		refusal = _supplies.use_refusal(kind, _crops, index, _bollworms.spray_refusal(index))
	if refusal == &"":
		refusal = _unable_to_work()
	if refusal != &"":
		return CommandResult.refused(refusal)
	_start_field_work(0.0)
	_supplies.use(kind)
	if kind == FERTILISER:
		_crops.fertilise(index)
	else:
		_bollworms.protect(index)
	return CommandResult.done()


## Why plot `index` can't be picked right now, or &"" when it can.
func _pick_refusal(index: int) -> StringName:
	var held_up := _held_up()
	if held_up != &"":
		return held_up
	if not _crops.exists(index):
		return NO_SUCH_PLOT
	if _crops.is_empty(index):
		return NOTHING_PLANTED
	if _crops.is_withered(index):
		return WITHERED
	if not _crops.is_ripe(index):
		return NOT_RIPE
	return BOLLWORMS_ON_PLOT if _bollworms.has(index) else _unable_to_work()


## HAND_IN_OPEN or IN_STUDY_SESSION while either holds up every command but handing in, or
## &"" when neither does.
func _held_up() -> StringName:
	if hand_in_open():
		return HAND_IN_OPEN
	if in_study_session():
		return IN_STUDY_SESSION
	return &""


## Why the Worker can't do field work right now, or &"" when he can.
func _unable_to_work() -> StringName:
	var away := _privileges.away_reason()
	if away != &"":
		return away
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
