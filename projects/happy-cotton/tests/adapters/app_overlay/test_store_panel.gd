extends GutTest
## The store panel shows what the store sells: Upgrades, land, supplies and Privileges in their
## own sections, each with its price, an Upgrade's tier, effect and Quota rise, a supply's stock
## and tomorrow's price, the reason an item can't be bought, and a fully upgraded item marked as
## such. Its buttons only ask.

var _panel: StorePanel


func before_each() -> void:
	_panel = StorePanel.new()
	add_child_autofree(_panel)


func _generator(tier: int, refusal: StringName) -> StoreItemView:
	if tier >= 3:
		return StoreItemView.upgrade(
			Farm.GENERATOR, Vector2i(3, 3), 0, Vector2(2.0, 2.0), 0, refusal
		)
	return StoreItemView.upgrade(
		Farm.GENERATOR, Vector2i(tier, 3), 40, Vector2(1.25, 1.0), 3, refusal
	)


func _rest_hour(refusal: StringName) -> StoreItemView:
	return StoreItemView.new(Farm.REST_HOUR, StoreItemView.Kind.PRIVILEGE, 20, refusal)


func _show(items: Array[StoreItemView], points := 100) -> void:
	_panel.show_items(items, points)


func _texts(row: StoreRow) -> Array[String]:
	var texts: Array[String] = []
	for node in row.find_children("*", "Label", true, false):
		var label := node as Label
		if label.visible:
			texts.append(label.text)
	return texts


func test_an_upgrade_shows_its_tier_price_effect_and_quota_rise() -> void:
	_show([_generator(0, &"")])

	var row := _panel.row(Farm.GENERATOR)
	var texts := _texts(row)
	assert_has(texts, "Generator  ·  Tier 0 of 3")
	assert_true(texts.any(func(text: String) -> bool: return text.contains("×1.25")), "effect")
	assert_true(texts.any(func(text: String) -> bool: return text.contains("(now ×1)")), "now")
	assert_true(texts.any(func(text: String) -> bool: return text.contains("Quota +3")), "rise")
	assert_eq(row.button().text, "40 Labour Points")
	assert_false(row.button().disabled)


func test_upgrades_and_privileges_go_in_their_own_sections() -> void:
	_show([_generator(0, &""), _rest_hour(&"")])

	var upgrade_row := _panel.row(Farm.GENERATOR)
	var privilege_row := _panel.row(Farm.REST_HOUR)
	assert_ne(upgrade_row.get_parent(), privilege_row.get_parent())


func test_an_item_that_cannot_be_bought_says_why_and_its_button_is_off() -> void:
	_show([_rest_hour(Farm.NOT_ENOUGH_LABOUR_POINTS)], 7)

	var row := _panel.row(Farm.REST_HOUR)
	assert_eq(row.refusal_text(), "This costs 20 Labour Points. You have 7. Keep picking!")
	assert_true(row.button().disabled)


func test_each_refusal_reads_as_the_app_says_it() -> void:
	for reason: StringName in [
		Farm.IN_STUDY_SESSION, Farm.PRIVILEGES_TAKEN_AWAY, Farm.RESTING, Farm.IN_DEBT
	]:
		_show([_rest_hour(reason)])

		assert_eq(
			_panel.row(Farm.REST_HOUR).refusal_text(),
			AppText.render_store_refusal(reason, {}),
			String(reason)
		)


func test_a_fully_upgraded_item_is_marked_on_its_button_with_no_quota_rise() -> void:
	_show([_generator(3, Farm.FULLY_UPGRADED)])

	var row := _panel.row(Farm.GENERATOR)
	assert_eq(row.button().text, "Fully upgraded!")
	assert_true(row.button().disabled)
	assert_eq(row.refusal_text(), "")
	assert_false(_texts(row).any(func(text: String) -> bool: return text.contains("Quota +")))


func test_rows_are_made_once_and_updated_after() -> void:
	assert_true(_panel.show_items([_rest_hour(&"")], 100), "the first show adds rows")

	var added := _panel.show_items([_rest_hour(Farm.RESTING)], 100)

	assert_false(added)
	assert_true(_panel.row(Farm.REST_HOUR).button().disabled)


func test_a_buy_button_asks_for_its_upgrade() -> void:
	_show([_generator(1, &"")])
	watch_signals(_panel)

	_panel.row(Farm.GENERATOR).button().pressed.emit()

	assert_signal_emitted_with_parameters(_panel, "upgrade_pressed", [Farm.GENERATOR])


func test_close_hides_the_store() -> void:
	(_panel.find_child("CloseButton", true, false) as Button).pressed.emit()

	assert_false(_panel.visible)


func _land(fully_bought: bool, refusal: StringName) -> StoreItemView:
	if fully_bought:
		return StoreItemView.land(Farm.LAND, 0, 0, true, Farm.FULLY_BOUGHT)
	return StoreItemView.land(Farm.LAND, 50, 1, false, refusal)


func test_land_shows_the_next_plots_price_and_quota_rise_in_its_own_section() -> void:
	_show([_generator(0, &""), _land(false, &""), _rest_hour(&"")])

	var row := _panel.row(Farm.LAND)
	var texts := _texts(row)
	assert_has(texts, "Plot of land")
	assert_true(texts.any(func(text: String) -> bool: return text.contains("Quota +1")), "rise")
	assert_eq(row.button().text, "50 Labour Points")
	assert_false(row.button().disabled)
	assert_ne(row.get_parent(), _panel.row(Farm.GENERATOR).get_parent())
	assert_ne(row.get_parent(), _panel.row(Farm.REST_HOUR).get_parent())


func test_fully_bought_land_says_so_on_its_button_only() -> void:
	_show([_land(true, Farm.FULLY_BOUGHT)])

	var row := _panel.row(Farm.LAND)
	assert_eq(row.button().text, AppText.STORE_FULLY_BOUGHT)
	assert_true(row.button().disabled)
	assert_eq(row.refusal_text(), "")
	assert_false(_texts(row).any(func(text: String) -> bool: return text.contains("Quota +")))


func test_the_land_button_asks_for_the_next_plot() -> void:
	_show([_land(false, &"")])
	watch_signals(_panel)

	_panel.row(Farm.LAND).button().pressed.emit()

	assert_signal_emitted(_panel, "land_pressed")


func test_the_tins_button_shows_only_with_hidden_savings() -> void:
	var item := _rest_hour(&"")
	item.set_savings_refusal(&"")
	_panel.show_items([item], 100)
	assert_false(_panel.row(Farm.REST_HOUR).savings_button().visible)

	_panel.show_items([item], 100, 30)

	var savings := _panel.row(Farm.REST_HOUR).savings_button()
	assert_true(savings.visible)
	assert_false(savings.disabled)
	assert_eq(savings.text, "20 from the tin")


func test_the_tins_button_says_when_there_is_not_enough() -> void:
	var item := _rest_hour(&"")
	item.set_savings_refusal(Farm.NOT_ENOUGH_HIDDEN_SAVINGS)

	_panel.show_items([item], 100, 5)

	var savings := _panel.row(Farm.REST_HOUR).savings_button()
	assert_true(savings.disabled)
	assert_eq(savings.text, "Not enough in the tin")


func test_the_tins_button_asks_to_pay_with_hidden_savings() -> void:
	var item := _rest_hour(&"")
	item.set_savings_refusal(&"")
	_panel.show_items([item], 100, 30)
	watch_signals(_panel)

	_panel.row(Farm.REST_HOUR).savings_button().pressed.emit()

	assert_signal_emitted_with_parameters(_panel, "savings_pressed", [Farm.REST_HOUR])
	assert_signal_not_emitted(_panel, "privilege_pressed")


func _fertiliser(held: int, refusal: StringName) -> StoreItemView:
	return StoreItemView.supply(Farm.FERTILISER, Vector2i(3, 4), Vector2i(held, 5), refusal)


func test_a_supply_shows_what_is_held_and_tomorrows_price_in_its_own_section() -> void:
	_show([_land(false, &""), _fertiliser(2, &""), _rest_hour(&"")])

	var row := _panel.row(Farm.FERTILISER)
	var texts := _texts(row)
	assert_has(texts, "Fertiliser  ·  Held 2 of 5")
	assert_true(texts.any(func(text: String) -> bool: return text.contains("Tomorrow: 4")), "next")
	assert_false(texts.any(func(text: String) -> bool: return text.contains("Quota +")))
	assert_eq(row.button().text, "3 Labour Points")
	assert_ne(row.get_parent(), _panel.row(Farm.LAND).get_parent())
	assert_ne(row.get_parent(), _panel.row(Farm.REST_HOUR).get_parent())


func test_a_full_stock_says_so_and_its_button_is_off() -> void:
	_show([_fertiliser(5, Farm.STOCK_FULL)])

	var row := _panel.row(Farm.FERTILISER)
	assert_true(row.button().disabled)
	assert_eq(row.refusal_text(), AppText.render_store_refusal(Farm.STOCK_FULL, {}))


func test_a_supply_button_asks_for_its_supply() -> void:
	_show([_fertiliser(0, &"")])
	watch_signals(_panel)

	_panel.row(Farm.FERTILISER).button().pressed.emit()

	assert_signal_emitted_with_parameters(_panel, "supply_pressed", [Farm.FERTILISER])
