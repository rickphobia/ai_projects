extends GutTest
## The letters view: a handwritten page for a letter and a box of those received, in order.

var _view: LettersView


func before_each() -> void:
	_view = LettersView.new()
	add_child_autofree(_view)


func _ids(count: int) -> Array[StringName]:
	return Farm.LETTER_IDS.slice(0, count)


func test_with_no_letters_there_is_nothing_to_see() -> void:
	_view.show_letters([] as Array[StringName])

	assert_false(_view.letters_button().visible)
	assert_false(_view.is_page_open())
	assert_false(_view.is_box_open())


func test_a_letter_opens_as_a_page_of_its_text_in_the_handwritten_font() -> void:
	var id := Farm.LETTER_IDS[0]

	assert_true(_view.open_letter(id))

	assert_true(_view.is_page_open())
	assert_eq(_view.page_text(), FamilyText.letters()[id].text)
	assert_eq(_view.page_font(), LettersView.HANDWRITING)


func test_a_letter_with_no_text_shows_nothing() -> void:
	assert_false(_view.open_letter(&"a_letter_never_written"))

	assert_false(_view.is_page_open())


func test_the_box_lists_the_received_letters_in_order_with_their_writers() -> void:
	_view.show_letters(_ids(3))

	assert_true(_view.letters_button().visible)
	var expected: Array[String] = ["1. From Aygül", "2. From Erkin", "3. From Aygül"]
	assert_eq(_view.box_entries(), expected)


func test_the_letters_button_opens_the_box_and_an_entry_reopens_its_letter() -> void:
	_view.show_letters(_ids(2))

	_view.letters_button().pressed.emit()
	(_view.find_child("Letter2", true, false) as Button).pressed.emit()

	assert_true(_view.is_box_open())
	assert_true(_view.is_page_open())
	assert_eq(_view.page_text(), FamilyText.letters()[Farm.LETTER_IDS[1]].text)


func test_folding_the_page_away_closes_it() -> void:
	_view.open_letter(Farm.LETTER_IDS[0])

	(_view.find_child("PutAway", true, false) as Button).pressed.emit()

	assert_false(_view.is_page_open())
