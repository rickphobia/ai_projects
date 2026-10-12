extends GutTest
## The Family text: every letter the rules can send has words from a known Child, and every
## source it cites is in the register (spec ground rule 1 covers the Children's voice too).


func _register_ids() -> Array[String]:
	var ids: Array[String] = []
	for source in SourcesRegister.entries():
		ids.append(source.id)
	return ids


func test_the_shipped_letters_cover_every_id_and_cite_only_registered_sources() -> void:
	var problems := FamilyText.problems(Farm.LETTER_IDS, FamilyText.letters(), _register_ids())

	assert_eq(problems, [] as Array[String])


func test_a_letter_the_rules_can_send_without_text_is_reported() -> void:
	var letters: Dictionary[StringName, FamilyLetter] = {
		&"letter_01": FamilyLetter.new(&"erkin", " "),
	}
	var sent: Array[StringName] = [&"letter_01", &"letter_02"]

	var problems := FamilyText.problems(sent, letters, _register_ids())

	var expected: Array[String] = ["letter letter_01 has no text", "letter letter_02 has no text"]
	assert_eq(problems, expected)


func test_a_letter_citing_an_unknown_source_is_reported() -> void:
	var letters: Dictionary[StringName, FamilyLetter] = {
		&"letter_01": FamilyLetter.new(&"aygul", "Dear Dada", ["not-a-source"]),
	}
	var sent: Array[StringName] = [&"letter_01"]

	var problems := FamilyText.problems(sent, letters, _register_ids())

	assert_eq(problems, ["letter letter_01 cites unknown source not-a-source"] as Array[String])


func test_a_letter_from_no_known_child_is_reported() -> void:
	var letters: Dictionary[StringName, FamilyLetter] = {
		&"letter_01": FamilyLetter.new(&"stranger", "Dear Dada"),
	}
	var sent: Array[StringName] = [&"letter_01"]

	var problems := FamilyText.problems(sent, letters, _register_ids())

	assert_eq(problems, ["letter letter_01 is from no known Child (stranger)"] as Array[String])


func test_both_children_write_and_each_letter_is_signed_by_its_writer() -> void:
	var writers := {}
	for id in Farm.LETTER_IDS:
		var letter: FamilyLetter = FamilyText.letters()[id]
		writers[letter.child] = true
		assert_true(letter.text.ends_with(FamilyText.child_name(letter)), "%s is signed" % id)
	assert_eq(writers.size(), FamilyText.CHILDREN.size())


func test_no_letter_uses_the_app_s_doublespeak() -> void:
	for id in Farm.LETTER_IDS:
		for term: String in AppText.DOUBLESPEAK:
			assert_false(FamilyText.letters()[id].text.containsn(term), "%s avoids %s" % [id, term])
