class_name AppText
extends RefCounted
## The App's words: the text for each message key the rules emit, the overlay's labels, and
## the state's doublespeak terms. All of it is the state's cheerful voice, never the Worker's.
## A line that uses a doublespeak term or makes a claim cites its source by id from the
## sources register; tests/content/test_app_text.gd fails if one doesn't.

## The state's vocabulary, each term mapped to the source that documents it.
## Where in the source, so a reader can check it:
## - Poverty Alleviation: zenz-2020, Executive Summary: cotton picking "plays a key role in
##   achieving the state's poverty alleviation targets. These targets are mainly achieved
##   through coercive labor transfers."
const DOUBLESPEAK: Dictionary[String, String] = {
	"Poverty Alleviation": "zenz-2020",
}

## Overlay labels, filled with String.format.
const QUOTA_BAR := "Quota {picked} / {quota}"
const SHIFT_TIMER := "Shift {shift}  ·  {time} left  ·  School fees after Shift {school_fees_shift}"
const LABOUR_POINTS := "{points} Labour Points"
## Shown in red where the Labour Points usually are.
const DEBT := "Debt {debt} Labour Points"
## The pay slip card: a title, a row per line, and the button that puts it away. Each Bill is
## worded as a gift from the state.
const PAY_SLIP_TITLE := "Pay slip  ·  Shift {shift}"
const PAY_SLIP_EARNED := "Earned this Shift: +{earned}"
const PAY_SLIP_ELECTRICITY := "Electricity, {laps} laps: −{electricity}. Thanks for the power!"
const PAY_SLIP_RENT := "Dormitory rent: −{rent}. A warm bed, kindly provided!"
const PAY_SLIP_SCHOOL_FEES := "School fees: −{school_fees}. An investment in your Children!"
const PAY_SLIP_LEFT := "Yours to keep: {points} Labour Points"
const PAY_SLIP_DEBT := "Owed to the Farm: {debt} Labour Points. We will settle it together!"
const PAY_SLIP_CLOSE := "Thank you!"
## The Hand-in card: a title, how much of the cotton in hand the slider hands in against the
## Quota, and the button that hands it in.
const HAND_IN_TITLE := "Hand-in  ·  Shift {shift}"
const HAND_IN_COTTON := "Handing in {handed_in} of {in_hand} cotton  ·  Quota: {quota}"
const HAND_IN_BUTTON := "Hand in"
## The crop counter beside the Labour Points, and what rises from a Plot at each counted pick.
const CROP_COUNTER := "{picked} cotton"
const CROP_COUNTED := "+1"
const STUDY_SESSION_TIMER := "Study Session  ·  {time} left"
const EXHAUSTION := "Exhaustion {level}%"
const RESTING := "Resting  ·  {time} left"
const ON_A_CALL := "On a call home  ·  {time} left"
## Shown while he is on watch after being caught, with the Shifts left counting this one.
const ON_WATCH := "Selected for Harmony Support!  ·  Shifts left: {shifts}"
const STORE_BUTTON := "Store"
const STORE_TITLE := "Happy Store"
const STORE_UPGRADES := "Upgrades"
const STORE_LAND := "Land"
const STORE_PRIVILEGES := "Privileges"
const STORE_CLOSE := "Close"
const STORE_PRICE := "{price} Labour Points"
const STORE_TIER := "Tier {tier} of {top_tier}"
const STORE_FULLY_UPGRADED := "Fully upgraded!"
const STORE_FULLY_BOUGHT := "Fully bought!"
## The store is honest about the Quota rise: the player sees the trade and takes it anyway.
const STORE_QUOTA_RISE := "Quota +{quota_rise} from next Shift. More to give, more to be proud of!"
## What each item is called in the store, and The App's pitch for it (values: effect, current).
const STORE_NAMES: Dictionary[StringName, String] = {
	Farm.GENERATOR: "Generator",
	Farm.TOOLS: "Tools",
	Farm.LAND: "Plot of land",
	Farm.REST_HOUR: "Rest hour",
	Farm.CALL_HOME: "Call home",
}
const STORE_BLURBS: Dictionary[StringName, String] = {
	Farm.GENERATOR:
	"Turn every step into more harvest! Growth ×{effect} per second of running (now ×{current}).",
	Farm.TOOLS:
	(
		"Sharper tools for faster hands! Tired picks take ×{effect} the time and drop"
		+ " ×{effect} as much cotton (now ×{current})."
	),
	Farm.LAND: "More land for the Farm, one Plot at a time! Every Plot is the state's gain.",
	Farm.REST_HOUR: "A short rest, kindly granted. The Shift goes on while you recover.",
	Farm.CALL_HOME: "Hear your Children's voices! The Shift goes on while you talk.",
}


## Text for every message key the rules can emit (Farm.MESSAGE_KEYS).
static func lines() -> Dictionary[StringName, AppLine]:
	return {
		Farm.SHIFT_STARTED:
		AppLine.new(
			(
				"Shift {shift} begins! Today's Quota is {quota} cotton. Every boll you pick"
				+ " is a step on the road of Poverty Alleviation!"
			),
			["zenz-2020"]
		),
		# The state collects the cotton; Labour Points wait for it.
		Farm.HAND_IN_OPENED:
		AppLine.new(
			(
				"Shift {shift} is over! Please hand in your {in_hand} cotton. Every boll"
				+ " belongs to the people's harvest!"
			)
		),
		Farm.HANDED_IN:
		AppLine.new(
			"{handed_in} cotton received with thanks! {earned} Labour Points have been credited."
		),
		Farm.QUOTA_MET:
		AppLine.new(
			(
				"Wonderful! {picked} picked, Quota of {quota} met! Such fine work shows how"
				+ " much more you can give next Shift!"
			)
		),
		# The Quota-missed lines grow colder with each miss in a row.
		Farm.QUOTA_MISSED:
		AppLine.new(
			(
				"Oh dear! Shift {shift}: {picked} of {quota}. The Quota was not met. Everyone"
				+ " can improve with a little help!"
			)
		),
		Farm.QUOTA_MISSED_AGAIN:
		AppLine.new(
			"Shift {shift}: {picked} of {quota}. The Quota was missed again. This is recorded."
		),
		Farm.QUOTA_MISSED_REPEATEDLY:
		AppLine.new("Shift {shift}: {picked} of {quota}. Your attitude has been noted."),
		Farm.STUDY_SESSION_STARTED:
		AppLine.new(
			(
				"Good news! You have been chosen for a {minutes}-minute Study Session. Learning"
				+ " helps us all work with a grateful heart!"
			)
		),
		Farm.STUDY_SESSION_ENDED:
		AppLine.new("Study Session complete. Return to the field and show what you have learned!"),
		# Negligence: the state books the crop's death as the Worker's offence.
		Farm.NEGLIGENCE_LOGGED:
		AppLine.new(
			(
				"Negligence logged: {plots} cotton Withered on your watch. {points} Labour"
				+ " Points have been deducted. The harvest belongs to everyone!"
			)
		),
		# The night shift: the field never stops working, even when the Worker is away.
		Farm.AWAY_SUMMARY:
		AppLine.new(
			(
				"Welcome back! While you were away ({minutes} min), the night shift kept the"
				+ " field growing: {ripened} cotton ripened, {withered} Withered. Study"
				+ " Session served: {study_minutes} min. Exhaustion recovered:"
				+ " {exhaustion_recovered}%."
			)
		),
		Farm.REST_STARTED:
		AppLine.new(
			(
				"Rest hour approved! {price} Labour Points well spent. Rest quickly: the"
				+ " Quota is still waiting!"
			)
		),
		Farm.REST_ENDED:
		# No source in the register documents how the Worker's calls home are handled, so the
		AppLine.new("Rest hour over. Refreshed workers make a stronger Farm. Back to work!"),
		# line praises "family harmony" as a slogan and claims nothing about listening in.
		Farm.CALL_STARTED:
		AppLine.new(
			(
				"Call home approved! {price} Labour Points well spent. Calls support family"
				+ " harmony! Keep it short: the Quota is still waiting!"
			)
		),
		Farm.COTTON_DROPPED:
		AppLine.new("Cotton dropped! Careless hands waste the people's harvest. Focus!"),
		Farm.GENERATOR_UPGRADED:
		AppLine.new(
			(
				"Congratulations! Generator tier {tier} is yours for {price} Labour Points!"
				+ " Every second of running now grows ×{multiplier} the cotton. Your Quota rises"
				+ " by {quota_rise} from next Shift, so everyone shares your success!"
			)
		),
		Farm.TOOLS_UPGRADED:
		AppLine.new(
			(
				"Wonderful! Tools tier {tier} is yours for {price} Labour Points! Tired picks"
				+ " now take ×{share} the time and drop ×{share} as much cotton. Your Quota"
				+ " rises by {quota_rise} from next Shift. Better tools, bigger dreams!"
			)
		),
		# The Worker's own Labour Points buy land that is plainly the state's, not his.
		Farm.PLOT_BOUGHT:
		AppLine.new(
			(
				"Glorious news! Plot {plot} joins the people's Farm, bought with your {price}"
				+ " Labour Points. The state grows richer by your hand! Your Quota rises by"
				+ " {quota_rise} from next Shift: more land, more to give!"
			)
		),
		Farm.PAY_SLIP:
		AppLine.new(
			"Pay day! Your Shift {shift} pay slip is here. Thank you for your contribution!"
		),
		Farm.FELL_INTO_DEBT:
		AppLine.new(
			(
				"Your account is {debt} Labour Points in Debt. Don't worry: everything you earn"
				+ " goes to settling it first. Privileges and Upgrades can wait!"
			)
		),
		# The boarding school is documented (zenz-2019: children of detained parents placed in
		# state boarding schools). The fees are the game's invention: The App states them as its
		# own terms, not as fact, and no source is cited for them.
		Farm.CHILDREN_AT_SCHOOL:
		AppLine.new(
			(
				"Good news about your family! Your two Children are cared for at a state"
				+ " boarding school, far from any bad influence. Their school fees come out of"
				+ " your pay every {every} Shifts, the first after Shift {school_fees_shift}."
			),
			["zenz-2019"]
		),
		Farm.DEBT_CLEARED:
		AppLine.new(
			(
				"Debt cleared! Your account is in good standing again, with {points} Labour"
				+ " Points to spend. Keep up the grateful work!"
			)
		),
		# Harmony Audits, and any penalty for keeping cotton back, are the game's invention: no
		# source in the register documents audits of pickers or such penalties (checked for
		# ticket 31), so these lines claim nothing and cite nothing. Being caught is paperwork
		# and a Study Session, never violence, and the only time The App names keeping back
		# or the hidden savings, as theft and "unregistered income".
		Farm.AUDIT_ANNOUNCED:
		AppLine.new(
			(
				"Good news! Shift {shift} has been selected for a Harmony Audit. Your cotton"
				+ " will be weighed with care. Honesty is the root of harmony!"
			)
		),
		Farm.AUDIT_PASSED:
		AppLine.new(
			"Harmony Audit complete. Your harmony is exemplary! Thank you for your honesty."
		),
		Farm.CAUGHT:
		AppLine.new(
			(
				"Harmony Audit finding: cotton was withheld from the people's harvest. This is"
				+ " theft. Unregistered income recovered: {income_recovered}. Please attend a"
				+ " {minutes}-minute Study Session. You have been selected for Harmony Support"
				+ " for {watch_shifts} Shifts!"
			)
		),
		Farm.CAUGHT_AGAIN:
		AppLine.new(
			(
				"Harmony Audit finding: theft from the people's harvest, again. Unregistered"
				+ " income recovered: {income_recovered}. Your file ({times_caught} findings) has"
				+ " been forwarded for review. Please attend a {minutes}-minute Study Session."
			)
		),
		Farm.ON_WATCH_ENDED:
		AppLine.new(
			"Harmony Support complete! Your file shows steady improvement. Keep up the honest work!"
		),
	}


## Why a store item can't be bought, for each reason the store gives (Farm.STORE_REFUSALS;
## values: price, points).
static func store_refusals() -> Dictionary[StringName, AppLine]:
	return {
		Farm.HAND_IN_OPEN:
		AppLine.new("The store is closed until your cotton is handed in. Harvest first!"),
		Farm.IN_STUDY_SESSION:
		AppLine.new("The store is closed during Study Sessions. Learning comes first!"),
		Farm.PRIVILEGES_TAKEN_AWAY:
		AppLine.new("Privileges are suspended this Shift. Meet your Quota to earn them back!"),
		Farm.RESTING: AppLine.new("You are already resting. Enjoy your Privilege!"),
		Farm.ON_A_CALL: AppLine.new("You are already on a call home. Enjoy your Privilege!"),
		Farm.IN_DEBT:
		AppLine.new("Not while you are in Debt. Every Labour Point you earn settles it first!"),
		Farm.NOT_ENOUGH_LABOUR_POINTS:
		AppLine.new("This costs {price} Labour Points. You have {points}. Keep picking!"),
		Farm.FULLY_UPGRADED: AppLine.new("Fully upgraded! The very best the Farm can give you."),
		Farm.FULLY_BOUGHT:
		AppLine.new("The Farm is complete! Every Plot is already working for the people."),
	}


## The refusal as The App says it, or an empty string when the reason has no text.
static func render_store_refusal(reason: StringName, values: Dictionary) -> String:
	var refusals := store_refusals()
	if not refusals.has(reason):
		return ""
	return fill(refusals[reason].text, values)


## The message as The App says it, or an empty string when the key has no text.
static func render(message: AppMessage) -> String:
	var all_lines := lines()
	if not all_lines.has(message.key):
		return ""
	return fill(all_lines[message.key].text, message.values)


## Fills a line's {named} slots. Fractions show at most two decimals and whole numbers none, so
## a multiplier of 2.0 reads "2" and 1.25 reads "1.25".
static func fill(text: String, values: Dictionary) -> String:
	var shown := {}
	for key: Variant in values:
		var value: Variant = values[key]
		if value is float:
			var fraction: float = value
			var whole := fraction == roundf(fraction)
			shown[key] = str(roundi(fraction)) if whole else String.num(fraction, 2)
		else:
			shown[key] = value
	return text.format(shown)


## Everything wrong with the App text: emitted keys with no text, source ids missing from the
## register, and lines that use a doublespeak term without citing its source.
static func problems(
	emitted_keys: Array[StringName],
	app_lines: Dictionary[StringName, AppLine],
	terms: Dictionary[String, String],
	known_source_ids: Array[String]
) -> Array[String]:
	var found: Array[String] = []
	for key in emitted_keys:
		if not app_lines.has(key):
			found.append("message key %s has no text" % key)
	for term: String in terms:
		if not known_source_ids.has(terms[term]):
			found.append("term %s cites unknown source %s" % [term, terms[term]])
	for key: StringName in app_lines:
		var line: AppLine = app_lines[key]
		for source_id in line.source_ids:
			if not known_source_ids.has(source_id):
				found.append("line %s cites unknown source %s" % [key, source_id])
		for term: String in terms:
			var term_source: String = terms[term]
			if line.text.containsn(term) and not line.source_ids.has(term_source):
				found.append("line %s uses %s but doesn't cite %s" % [key, term, term_source])
	return found
