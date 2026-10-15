extends GutTest
## The App's Store button and the store it opens over the field: the button reads "Store", or
## the rest time left while he rests; buy buttons in the store reach The App's signals; and new
## rows take the player's text size.

var _overlay: AppOverlay


func before_each() -> void:
	_overlay = AppOverlay.new()
	add_child_autofree(_overlay)


func _store_button() -> Button:
	return _overlay.find_child("StoreButton", true, false) as Button


func test_the_store_button_reads_store() -> void:
	_overlay.show_resting(0.0)

	assert_eq(_store_button().text, "Store")


func test_while_he_rests_the_store_button_shows_the_time_left() -> void:
	_overlay.show_resting(45.0)

	assert_eq(_store_button().text, "Resting  ·  0:45 left")


func test_on_a_call_home_the_store_button_shows_the_time_left() -> void:
	_overlay.show_resting(0.0, 30.0)

	assert_eq(_store_button().text, "On a call home  ·  0:30 left")


func test_the_store_is_closed_until_its_button_is_pressed() -> void:
	assert_false(_overlay.is_store_open())

	_store_button().pressed.emit()

	assert_true(_overlay.is_store_open())


func test_a_buy_button_in_the_store_is_reported_with_the_item() -> void:
	var items: Array[StoreItemView] = [
		StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, &"")
	]
	_overlay.show_store(items, 30)
	watch_signals(_overlay)

	_overlay.store_panel().row(Farm.REST_HOUR).button().pressed.emit()

	assert_signal_emitted_with_parameters(_overlay, "privilege_pressed", [Farm.REST_HOUR])


func test_store_rows_take_the_players_text_size() -> void:
	_overlay.scale_text(2.0)
	var items: Array[StoreItemView] = [
		StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, &"")
	]

	_overlay.show_store(items, 30)

	var button := _overlay.store_panel().row(Farm.REST_HOUR).button()
	assert_eq(button.get_theme_font_size(&"font_size"), AppLook.BODY * 2)


func test_the_tins_pencil_button_takes_the_players_text_size_too() -> void:
	var items: Array[StoreItemView] = [
		StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, &"")
	]
	_overlay.scale_text(1.5)
	_overlay.show_store(items, 30, 50)
	var tin_button := _overlay.store_panel().row(Farm.REST_HOUR).savings_button()
	assert_eq(tin_button.get_theme_font_size(&"font_size"), roundi(AppLook.SMALL * 1.5))

	_overlay.scale_text(1.0)

	assert_eq(tin_button.get_theme_font_size(&"font_size"), AppLook.SMALL)
