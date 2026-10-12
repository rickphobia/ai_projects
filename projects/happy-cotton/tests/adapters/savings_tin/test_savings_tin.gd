extends GutTest
## The hidden savings tin shows the amount it is given and catches no taps.

var _tin: SavingsTin


func before_each() -> void:
	_tin = SavingsTin.new()
	add_child_autofree(_tin)


func test_it_starts_empty() -> void:
	assert_eq(_tin.savings_text(), "0")


func test_it_shows_the_hidden_savings() -> void:
	_tin.show_savings(42)

	assert_eq(_tin.savings_text(), "42")


func test_it_catches_no_taps() -> void:
	for node in _tin.find_children("*", "Control", true, false):
		assert_eq((node as Control).mouse_filter, Control.MOUSE_FILTER_IGNORE, node.name)
