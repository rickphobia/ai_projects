extends GutTest
## The marks a plot shows on its soil: Fertiliser, Pesticide's protection and Bollworms.

const FIELD_SCENE := preload("res://src/adapters/field/field.tscn")


## A field in the tree, built on the shipped first land.
func _field() -> Field:
	var field: Field = add_child_autofree(FIELD_SCENE.instantiate())
	field.show_land(FieldLand.first())
	return field


func _empty_plots(count: int) -> Array[PlotView]:
	var views: Array[PlotView] = []
	for index in count:
		views.append(PlotView.new(PlotView.Stage.EMPTY, 0.0))
	return views


func test_a_fertilised_plot_shows_the_fertiliser_mark_until_the_crop_leaves() -> void:
	var field := _field()
	var views := _empty_plots(FieldLand.first().plot_count())
	views[1] = PlotView.new(PlotView.Stage.SEEDLING, 10.0, true)
	var mark: Node3D = field.get_node("Plot1/Fertilised")

	field.show_plots(views)
	assert_true(mark.visible)
	assert_false((field.get_node("Plot0/Fertilised") as Node3D).visible)

	field.show_plots(_empty_plots(FieldLand.first().plot_count()))
	assert_false(mark.visible)


func test_a_protected_plot_shows_it_until_the_protection_ends() -> void:
	var field := _field()
	var views := _empty_plots(FieldLand.first().plot_count())
	views[3] = PlotView.new(PlotView.Stage.EMPTY, 0.0, false, 0.0, true)
	var mark: Node3D = field.get_node("Plot3/Protected")

	field.show_plots(views)
	assert_true(mark.visible)
	assert_false((field.get_node("Plot0/Protected") as Node3D).visible)

	field.show_plots(_empty_plots(FieldLand.first().plot_count()))
	assert_false(mark.visible)


func test_a_plot_with_bollworms_shows_them_until_they_are_gone() -> void:
	var field := _field()
	var views := _empty_plots(FieldLand.first().plot_count())
	views[2] = PlotView.new(PlotView.Stage.FLOWERING, 10.0, false, 20.0)
	var mark: Node3D = field.get_node("Plot2/Bollworms")

	field.show_plots(views)
	assert_true(mark.visible)
	assert_false((field.get_node("Plot0/Bollworms") as Node3D).visible)

	field.show_plots(_empty_plots(FieldLand.first().plot_count()))
	assert_false(mark.visible)
