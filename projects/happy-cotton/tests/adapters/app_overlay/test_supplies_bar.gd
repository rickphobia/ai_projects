extends GutTest
## The supplies bar: a button per supply with how many he holds; pressing one picks it for the
## next tap only, and pressing it again puts it back.

var _bar: SuppliesBar


func before_each() -> void:
	_bar = SuppliesBar.new()
	add_child_autofree(_bar)


func _fertiliser(held: int) -> Array[StoreItemView]:
	var item := StoreItemView.supply(Farm.FERTILISER, Vector2i(3, 4), Vector2i(held, 5), &"")
	var rest_hour := StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, &"")
	return [item, rest_hour]


func test_it_shows_a_button_per_supply_with_how_many_he_holds() -> void:
	assert_true(_bar.show_supplies(_fertiliser(2)), "the first showing adds the button")
	assert_false(_bar.show_supplies(_fertiliser(1)), "later showings only update it")

	assert_eq(_bar.button(Farm.FERTILISER).text, "Fertiliser ×1")
	assert_null(_bar.button(Farm.REST_HOUR))


func test_pressing_a_supply_picks_it_for_the_next_tap_only() -> void:
	_bar.show_supplies(_fertiliser(1))

	_bar.button(Farm.FERTILISER).pressed.emit()

	assert_true(_bar.hint().visible)
	assert_eq(_bar.take_chosen(), Farm.FERTILISER)
	assert_eq(_bar.take_chosen(), &"")
	assert_false(_bar.hint().visible)


func test_pressing_the_picked_supply_again_puts_it_back() -> void:
	_bar.show_supplies(_fertiliser(1))
	_bar.button(Farm.FERTILISER).pressed.emit()

	_bar.button(Farm.FERTILISER).pressed.emit()

	assert_eq(_bar.chosen(), &"")
