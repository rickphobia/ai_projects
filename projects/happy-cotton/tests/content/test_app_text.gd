extends GutTest
## The App text: every key the rules emit has words, every source it cites is in the
## register, and every doublespeak term is tied to its source (spec ground rule 1).

const SAMPLE_VALUES := {
	"shift": 2,
	"picked": 7,
	"quota": 9,
	"minutes": 5,
	"in_a_row": 2,
	"ripened": 3,
	"withered": 2,
	"plots": 2,
	"plot": 13,
	"points": 10,
	"study_minutes": 4,
	"exhaustion_recovered": 6,
	"price": 20,
	"tier": 2,
	"multiplier": 1.25,
	"share": 0.5,
	"quota_rise": 3,
	"earned": 14,
	"laps": 12,
	"electricity": 6,
	"electricity_covered": true,
	"rent": 6,
	"rent_covered": false,
	"balance": -2,
	"debt": 2,
	"every": 3,
	"school_fees_shift": 6,
	"school_fees": 20,
	"school_fees_covered": false,
	"in_hand": 8,
	"handed_in": 8,
	"income_recovered": 24,
	"watch_shifts": 3,
	"times_caught": 1,
	"held": 2,
	"next_price": 6,
	"kind": &"fertiliser",
	"seconds": 20.0,
}


func _register_ids() -> Array[String]:
	var ids: Array[String] = []
	for source in SourcesRegister.entries():
		ids.append(source.id)
	return ids


func test_the_shipped_text_covers_every_key_and_cites_only_registered_sources() -> void:
	var problems := AppText.problems(
		Farm.MESSAGE_KEYS, AppText.lines(), AppText.DOUBLESPEAK, _register_ids()
	)

	assert_eq(problems, [] as Array[String])


func test_every_line_fills_all_its_slots_from_the_rules_values() -> void:
	for key in Farm.MESSAGE_KEYS:
		var text := AppText.render(AppMessage.new(key, SAMPLE_VALUES))

		assert_false(text.is_empty(), "%s has text" % key)
		assert_false(text.contains("{"), "%s has no unfilled slot: %s" % [key, text])


func test_every_store_refusal_has_text_citing_only_registered_sources() -> void:
	var problems := AppText.problems(
		Farm.STORE_REFUSALS, AppText.store_refusals(), AppText.DOUBLESPEAK, _register_ids()
	)

	assert_eq(problems, [] as Array[String])


func test_every_fertilise_refusal_has_text_citing_only_registered_sources() -> void:
	var problems := AppText.problems(
		Farm.FERTILISE_REFUSALS, AppText.fertilise_refusals(), AppText.DOUBLESPEAK, _register_ids()
	)

	assert_eq(problems, [] as Array[String])


func test_a_refusal_fills_in_the_price_and_points() -> void:
	var text := AppText.render_store_refusal(
		Farm.NOT_ENOUGH_LABOUR_POINTS, {"price": 20, "points": 7}
	)

	assert_string_contains(text, "20 Labour Points")
	assert_string_contains(text, "You have 7")


func test_every_store_item_has_a_name_and_a_blurb() -> void:
	for item in Farm.new(FastTuning.table()).store():
		assert_true(AppText.STORE_NAMES.has(item.id), "%s has a name" % item.id)
		assert_true(AppText.STORE_BLURBS.has(item.id), "%s has a blurb" % item.id)


func test_a_multiplier_reads_without_needless_decimals() -> void:
	var values := {"tier": 1, "price": 10, "multiplier": 2.0, "quota_rise": 1}
	var text := AppText.render(AppMessage.new(Farm.GENERATOR_UPGRADED, values))

	assert_string_contains(text, "×2 the cotton")
	assert_eq(AppText.fill("×{effect}", {"effect": 1.25}), "×1.25")


func test_render_fills_in_the_values() -> void:
	var text := AppText.render(AppMessage.new(Farm.QUOTA_MISSED, SAMPLE_VALUES))

	assert_string_contains(text, "7 of 9")


func test_a_key_with_no_text_renders_as_nothing() -> void:
	assert_eq(AppText.render(AppMessage.new(&"no_such_key")), "")


func test_a_key_with_no_text_is_reported() -> void:
	var keys: Array[StringName] = [&"missing"]
	var no_lines: Dictionary[StringName, AppLine] = {}
	var no_terms: Dictionary[String, String] = {}

	var problems := AppText.problems(keys, no_lines, no_terms, [])

	assert_eq(problems, ["message key missing has no text"] as Array[String])


func test_a_line_citing_an_unknown_source_is_reported() -> void:
	var cited: Array[String] = ["nowhere"]
	var app_lines: Dictionary[StringName, AppLine] = {&"hello": AppLine.new("Hello", cited)}
	var no_terms: Dictionary[String, String] = {}

	var problems := AppText.problems([], app_lines, no_terms, ["aspi-2020"])

	assert_eq(problems, ["line hello cites unknown source nowhere"] as Array[String])


func test_a_term_tied_to_an_unknown_source_is_reported() -> void:
	var no_lines: Dictionary[StringName, AppLine] = {}
	var terms: Dictionary[String, String] = {"Harmony": "nowhere"}

	var problems := AppText.problems([], no_lines, terms, ["aspi-2020"])

	assert_eq(problems, ["term Harmony cites unknown source nowhere"] as Array[String])


func test_a_line_using_a_term_without_citing_its_source_is_reported() -> void:
	var app_lines: Dictionary[StringName, AppLine] = {&"tip": AppLine.new("Enjoy harmony!")}
	var terms: Dictionary[String, String] = {"Harmony": "aspi-2020"}

	var problems := AppText.problems([], app_lines, terms, ["aspi-2020"])

	var expected: Array[String] = ["line tip uses Harmony but doesn't cite aspi-2020"]
	assert_eq(problems, expected)


func test_the_app_never_mentions_hidden_savings() -> void:
	var texts: Array[String] = []
	var constants := (load("res://src/content/app_text.gd") as GDScript).get_script_constant_map()
	for constant: Variant in constants.values():
		if constant is String:
			texts.append(constant)
	for line: AppLine in AppText.lines().values():
		texts.append(line.text)
	for line: AppLine in AppText.store_refusals().values():
		texts.append(line.text)
	texts.append_array(AppText.STORE_NAMES.values())
	texts.append_array(AppText.STORE_BLURBS.values())
	var tin := RegEx.create_from_string("(?i)saving|mattress|\\btin\\b")

	for text in texts:
		assert_null(tin.search(text), "The App never mentions hidden savings: %s" % text)


func test_every_spray_refusal_has_text_citing_only_registered_sources() -> void:
	var problems := AppText.problems(
		Farm.SPRAY_REFUSALS, AppText.spray_refusals(), AppText.DOUBLESPEAK, _register_ids()
	)

	assert_eq(problems, [] as Array[String])


func test_every_disaster_has_a_name() -> void:
	assert_has(AppText.DISASTER_NAMES, Farm.SANDSTORM)
	assert_has(AppText.DISASTER_NAMES, Farm.HEATWAVE)


func test_the_sandstorm_warning_counts_whole_seconds() -> void:
	var warned := AppMessage.new(Farm.SANDSTORM_WARNED, {"kind": Farm.SANDSTORM, "seconds": 20.0})

	assert_string_contains(AppText.render(warned), "in 20 seconds")
