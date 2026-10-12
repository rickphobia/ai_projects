class_name FamilyText
extends RefCounted
## The Children's words: every letter the rules can send (Farm.LETTER_IDS) and every call home
## (Farm.CALL_IDS), each call sounding like the letters it follows. This is their voice,
## never The App's, so it is kept apart from AppText; tests/content/test_family_text.gd checks
## it the same way. A letter that makes a factual claim cites its source by id from the sources
## register; the rest is written as the Child's own experience, not as claims.
## Content rule (economy spec): the Children are never shown, described or implied being
## punished.
## What the change in tone draws on, all in zenz-2019 (Adrian Zenz, "Break Their Roots",
## July 2019), so a reader can check it:
## - Mandarin only: section 3.4 quotes a teacher, "All teachers and students must use Mandarin
##   to communicate", and a goal of "a fully Chinese-medium language education".
## - "You are all studying": section 2.3 quotes a Hotan official, "I tell the children: 'Your
##   parents and you all alike are studying'"; section 2.1, children told their parents are
##   studying so their "family life will be happier in the future".
## - Teachers as mothers: section 2.1, children call their teachers "mummy"; section 2.2,
##   schools are to "make up for the lack of family ties".
## - The slogan: section 2.4, "Be grateful to the Party! Obey the Party! Follow the Party!"
## - High walls: section 3.5, school walls with "additional anti-climbing barriers".
## The apricot tree, Grandmother's bread, the red flower, the songs and the like are the
## Children's own lives, not claims, and cite nothing.

## The Worker's two Children, decided here (economy spec, "Family text"): name and age.
const CHILDREN: Dictionary[StringName, Dictionary] = {
	&"aygul": {"name": "Aygül", "age": 11},
	&"erkin": {"name": "Erkin", "age": 8},
}


## The words of every letter, by id.
static func letters() -> Dictionary[StringName, FamilyLetter]:
	return {
		&"letter_01":
		FamilyLetter.new(
			&"aygul",
			(
				"Dear Dada,\n\nWe got to the school. It is very big, with a high wall all the way"
				+ " round. Erkin cried the first night, so I held his hand until he slept.\n\nThe"
				+ " bread here is not like Grandmother's. I miss our apricot tree and the noise"
				+ " of the yard. Are you eating properly? When can you come?\n\nYour Aygül"
			),
			["zenz-2019"]
		),
		&"letter_02":
		FamilyLetter.new(
			&"erkin",
			(
				"Dada!\n\nI can write my name now. Aygül helped with this letter. My bed is next"
				+ " to the window and at night I count the lamps.\n\nAygül says you pick cotton so"
				+ " we can go to school. I am being good. Please come soon.\n\nErkin"
			)
		),
		&"letter_03":
		FamilyLetter.new(
			&"aygul",
			(
				"Dear Dada,\n\nAt school we only speak Mandarin now, in class and in the yard"
				+ " too. Teacher says it is the language of our future. I practise every night"
				+ " so the words come quicker.\n\nErkin still says things the old way when he is"
				+ " sleepy. I am keeping our words for this letter, so you know I miss you.\n\n"
				+ "Your Aygül"
			),
			["zenz-2019"]
		),
		&"letter_04":
		FamilyLetter.new(
			&"erkin",
			(
				"Dada,\n\nTeacher says you are studying too, like us, so our family will be"
				+ " happier later. Are you studying well?\n\nI got a red flower for neat"
				+ " writing. All the little ones call our teacher Mama now. I do too.\n\nErkin"
			),
			["zenz-2019"]
		),
		&"letter_05":
		FamilyLetter.new(
			&"aygul",
			(
				"Dada,\n\nThis letter is in Mandarin, because that is how we write now. We"
				+ " learned three new songs this month. Everything is going well and I am"
				+ " studying hard. Erkin is fine.\n\nI tried to remember which way the apricot"
				+ " tree leaned, and I couldn't.\n\nAygül"
			),
			["zenz-2019"]
		),
		&"letter_06":
		FamilyLetter.new(
			&"erkin",
			(
				"Dear Father,\n\nI am well. I am grateful to the Party. I obey the Party. I follow"
				+ " the Party. I am studying hard to become a useful person.\n\nErkin"
			),
			["zenz-2019"]
		),
		&"letter_07":
		FamilyLetter.new(
			&"aygul",
			(
				"Dear Father,\n\nGreetings. The school takes good care of us, so you do not need"
				+ " to worry. Work hard and study well, as we do.\n\nBe grateful to the Party!"
				+ " Obey the Party! Follow the Party!\n\nYour daughter, Aygül"
			),
			["zenz-2019"]
		),
		&"letter_08":
		FamilyLetter.new(
			&"erkin",
			(
				"Dear Father,\n\nTeacher says the school is one big family. I have many brothers"
				+ " and sisters here, so I am never lonely.\n\nStudy well.\n\nErkin"
			),
			["zenz-2019"]
		),
	}


## The lines of every call home, by id. Each follows the letters before it (Farm.LETTER_CALLS):
## warm and homesick, then Mandarin with a teacher listening, then scripted, then distant.
static func calls() -> Dictionary[StringName, FamilyCall]:
	return {
		&"call_01":
		(
			FamilyCall
			. new(
				_lines(
					[
						[&"aygul", "Dada? Dada, is that you? Erkin, come quick, it's Dada!"],
						[&"erkin", "Dada! When are you coming? I kept some bread for you."],
						[
							&"aygul",
							"We are all right. Are you eating? We have to go, the line is short."
						],
					]
				)
			)
		),
		&"call_02":
		(
			FamilyCall
			. new(
				_lines(
					[
						[
							&"aygul",
							"Hello, Dada. We talk in Mandarin on the phone too. Teacher is here."
						],
						[
							&"erkin",
							"Teacher Mama says you are studying too. Are you nearly finished?"
						],
						[&"aygul", "I miss you. I'm saying it quickly, before the time runs out."],
					]
				),
				["zenz-2019"]
			)
		),
		&"call_03":
		(
			FamilyCall
			. new(
				_lines(
					[
						[&"aygul", "Hello, Father. We are well. We are studying hard."],
						[&"erkin", "I learned a new song. I am a useful person now."],
						[&"aygul", "Goodbye, Father. Work hard."],
					]
				)
			)
		),
		&"call_04":
		(
			FamilyCall
			. new(
				_lines(
					[
						[
							&"aygul",
							"Greetings, Father. The school takes good care of us. Do not worry."
						],
						[&"erkin", "Be grateful to the Party! Obey the Party! Follow the Party!"],
						[&"aygul", "Study well. Goodbye."],
					]
				),
				["zenz-2019"]
			)
		),
	}


## Call lines from [child, text] pairs, to keep the table above short.
static func _lines(pairs: Array) -> Array[FamilyCall.Line]:
	var call_lines: Array[FamilyCall.Line] = []
	for pair: Array in pairs:
		var child: StringName = pair[0]
		var text: String = pair[1]
		call_lines.append(FamilyCall.Line.new(child, text))
	return call_lines


## The name of the Child with this key, or "" for no known Child.
static func name_of(child: StringName) -> String:
	var known: Dictionary = CHILDREN.get(child, {})
	var name: String = known.get("name", "")
	return name


## The name of the Child who wrote this letter, or "" for no known Child.
static func child_name(letter: FamilyLetter) -> String:
	return name_of(letter.child)


## Everything wrong with the letters: an id the rules can send with no words, a letter by no
## known Child, and a cited source that isn't in the register.
static func problems(
	sent_ids: Array[StringName],
	family_letters: Dictionary[StringName, FamilyLetter],
	known_source_ids: Array[String]
) -> Array[String]:
	var found: Array[String] = []
	for id in sent_ids:
		if not family_letters.has(id) or family_letters[id].text.strip_edges().is_empty():
			found.append("letter %s has no text" % id)
	for id: StringName in family_letters:
		var letter: FamilyLetter = family_letters[id]
		if not CHILDREN.has(letter.child):
			found.append("letter %s is from no known Child (%s)" % [id, letter.child])
		for source_id in letter.source_ids:
			if not known_source_ids.has(source_id):
				found.append("letter %s cites unknown source %s" % [id, source_id])
	return found


## Everything wrong with the calls home: an id the rules can send with no lines, a line by no
## known Child, and a cited source that isn't in the register.
static func call_problems(
	sent_ids: Array[StringName],
	family_calls: Dictionary[StringName, FamilyCall],
	known_source_ids: Array[String]
) -> Array[String]:
	var found: Array[String] = []
	for id in sent_ids:
		if not family_calls.has(id) or family_calls[id].lines.is_empty():
			found.append("call %s has no lines" % id)
	for id: StringName in family_calls:
		var call: FamilyCall = family_calls[id]
		for line in call.lines:
			if not CHILDREN.has(line.child):
				found.append("call %s has a line from no known Child (%s)" % [id, line.child])
		for source_id in call.source_ids:
			if not known_source_ids.has(source_id):
				found.append("call %s cites unknown source %s" % [id, source_id])
	return found
