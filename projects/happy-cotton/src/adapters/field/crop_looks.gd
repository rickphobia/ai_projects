class_name CropLooks
extends RefCounted
## Builds what a cotton plant looks like at each growth stage, from the CC0 plant models in
## assets/ (credits in assets/CREDITS.md). Each look is a fresh node standing on y = 0.
##
## The models share one green material; it is replaced with a dusty, muted one so the crop
## matches the field. Flowers and bolls are small low-poly spheres added on top. A Withered
## plant is the bush gone dry, dead tan and slumped, its few bolls shrivelled grey: plain to see
## from across the field, and nothing like ripe cotton.
## A fertilised Plot gets a mark on its soil (see fertiliser_mark()): a dark, damp ring round the
## plant strewn with pale blue granules, the chemical fertiliser's colour, so it reads apart
## from bare soil whatever the crop's stage.
## A Plot with Bollworms gets fat pink caterpillars crawling round the plant and up into it (see
## bollworm_mark()), big and bright enough against the dust and leaves to spot across the field.

const LEAF_COLOUR := Color(0.36, 0.4, 0.27)
const FLOWER_COLOUR := Color(0.85, 0.8, 0.62)
const GREEN_BOLL_COLOUR := Color(0.42, 0.44, 0.28)
const COTTON_COLOUR := Color(0.9, 0.88, 0.82)
const WITHERED_COLOUR := Color(0.62, 0.52, 0.36)
const SHRIVELLED_BOLL_COLOUR := Color(0.5, 0.46, 0.4)
const DAMP_SOIL_COLOUR := Color(0.2, 0.15, 0.11)
const GRANULE_COLOUR := Color(0.72, 0.84, 0.95)
## The pink bollworm's larva: pinkish brown.
const BOLLWORM_COLOUR := Color(0.88, 0.5, 0.45)
## The fertiliser mark's ring, in metres: inside a 2 m Plot, around the plant's stem.
const DAMP_RING_RADIUS := 0.8
const GRANULE_RADIUS := 0.04
## How many granules lie on the ring, evenly round it.
const GRANULE_COUNT := 12
## The bollworm mark's caterpillars, in metres: each a row of round segments, laid round the
## stem at alternate reaches and heights so some sit on the soil and some in the plant.
const BOLLWORM_COUNT := 6
const BOLLWORM_SEGMENTS := 4
const BOLLWORM_SEGMENT_RADIUS := 0.09
const BOLLWORM_REACHES: Array[float] = [0.45, 0.7]
const BOLLWORM_HEIGHTS: Array[float] = [0.05, 0.6]
## How a Withered bush slumps: squashed to this share of its height and leaning over.
const WITHERED_SLUMP := 0.65
const WITHERED_LEAN_DEGREES := 18.0

const SEEDLING_MODEL := preload("res://assets/kenney-nature-kit/crops_leafsStageA.glb")
const YOUNG_PLANT_MODEL := preload("res://assets/kenney-nature-kit/crops_leafsStageB.glb")
const BUSH_MODEL := preload("res://assets/kenney-nature-kit/plant_bushDetailed.glb")

## Where buds sit on the bush, as fractions of its size: spread over the top and sides.
const BUD_SPOTS: Array[Vector3] = [
	Vector3(0.0, 1.0, 0.0),
	Vector3(0.55, 0.75, 0.2),
	Vector3(-0.5, 0.7, 0.35),
	Vector3(0.15, 0.65, -0.6),
	Vector3(-0.35, 0.85, -0.3),
	Vector3(0.4, 0.5, 0.55),
	Vector3(-0.6, 0.45, -0.1),
]

## Public so tests can find the open bolls on a ripe plant and tell a Withered one apart.
var cotton := _material(COTTON_COLOUR)
var withered := _material(WITHERED_COLOUR)
var granule := _material(GRANULE_COLOUR)
var bollworm := _material(BOLLWORM_COLOUR)

var _leaf := _material(LEAF_COLOUR)
var _flower := _material(FLOWER_COLOUR)
var _green_boll := _material(GREEN_BOLL_COLOUR)
var _shrivelled_boll := _material(SHRIVELLED_BOLL_COLOUR)


## A new node showing the plant at a stage. EMPTY has no plant, so it is an empty node.
func build(stage: PlotView.Stage) -> Node3D:
	match stage:
		PlotView.Stage.SEEDLING:
			return _plant(SEEDLING_MODEL, 2.0)
		PlotView.Stage.FLOWERING:
			return _with_buds(_plant(YOUNG_PLANT_MODEL, 1.8), 1.2, 4, 0.06, _flower)
		PlotView.Stage.BOLL:
			return _with_buds(_plant(BUSH_MODEL, 2.6), 0.9, 7, 0.08, _green_boll)
		PlotView.Stage.RIPE:
			return _with_buds(_plant(BUSH_MODEL, 2.8), 0.97, 7, 0.13, cotton)
		PlotView.Stage.WITHERED:
			return _withered_plant()
	return Node3D.new()


## A new node marking a fertilised Plot's soil, standing on y = 0.
func fertiliser_mark() -> Node3D:
	var mark := Node3D.new()
	var damp := CylinderMesh.new()
	damp.top_radius = DAMP_RING_RADIUS
	damp.bottom_radius = DAMP_RING_RADIUS
	damp.height = 0.01
	damp.radial_segments = 24
	damp.material = _material(DAMP_SOIL_COLOUR)
	var damp_instance := MeshInstance3D.new()
	damp_instance.mesh = damp
	damp_instance.position.y = 0.005
	mark.add_child(damp_instance)
	var pellet := SphereMesh.new()
	pellet.radius = GRANULE_RADIUS
	pellet.height = GRANULE_RADIUS * 2.0
	pellet.radial_segments = 6
	pellet.rings = 3
	pellet.material = granule
	for index in GRANULE_COUNT:
		var angle := TAU * index / GRANULE_COUNT
		# Alternately nearer and farther out, so the granules look strewn rather than drawn.
		var reach := DAMP_RING_RADIUS * (0.55 if index % 2 == 0 else 0.85)
		var instance := MeshInstance3D.new()
		instance.mesh = pellet
		instance.position = Vector3(cos(angle) * reach, 0.02, sin(angle) * reach)
		mark.add_child(instance)
	return mark


## A new node showing Bollworms on a Plot, standing on y = 0.
func bollworm_mark() -> Node3D:
	var mark := Node3D.new()
	var segment := SphereMesh.new()
	segment.radius = BOLLWORM_SEGMENT_RADIUS
	segment.height = BOLLWORM_SEGMENT_RADIUS * 2.0
	segment.radial_segments = 8
	segment.rings = 4
	segment.material = bollworm
	for index in BOLLWORM_COUNT:
		var caterpillar := Node3D.new()
		var angle := TAU * index / BOLLWORM_COUNT
		var reach := BOLLWORM_REACHES[index % BOLLWORM_REACHES.size()]
		var height := BOLLWORM_HEIGHTS[index % BOLLWORM_HEIGHTS.size()] + BOLLWORM_SEGMENT_RADIUS
		caterpillar.position = Vector3(cos(angle) * reach, height, sin(angle) * reach)
		# Crawling round the stem rather than towards it.
		caterpillar.rotation.y = -angle
		for part in BOLLWORM_SEGMENTS:
			var instance := MeshInstance3D.new()
			instance.mesh = segment
			instance.position.z = (part - BOLLWORM_SEGMENTS / 2.0) * BOLLWORM_SEGMENT_RADIUS * 1.5
			caterpillar.add_child(instance)
		mark.add_child(caterpillar)
	return mark


func _plant(model: PackedScene, scale: float, material: Material = _leaf) -> Node3D:
	var plant := model.instantiate() as Node3D
	plant.scale = Vector3.ONE * scale
	for mesh in plant.find_children("*", "MeshInstance3D", true, false):
		(mesh as MeshInstance3D).material_override = material
	return plant


func _withered_plant() -> Node3D:
	var bush := _plant(BUSH_MODEL, 2.6, withered)
	bush.scale.y *= WITHERED_SLUMP
	var look := _with_buds(bush, 0.8, 3, 0.07, _shrivelled_boll)
	look.rotation_degrees.z = WITHERED_LEAN_DEGREES
	return look


## Adds round buds over the plant's outer surface. Sizes are in metres, after scaling.
func _with_buds(
	plant: Node3D, reach: float, count: int, radius: float, material: Material
) -> Node3D:
	var bud := SphereMesh.new()
	bud.radius = radius
	bud.height = radius * 2.0
	bud.radial_segments = 8
	bud.rings = 4
	bud.material = material
	var size := _bounds_of(plant).size * plant.scale
	var holder := Node3D.new()
	holder.add_child(plant)
	for spot_index in count:
		var spot := BUD_SPOTS[spot_index]
		var instance := MeshInstance3D.new()
		instance.mesh = bud
		instance.position = Vector3(
			spot.x * size.x / 2.0 * reach, spot.y * size.y * reach, spot.z * size.z / 2.0 * reach
		)
		holder.add_child(instance)
	return holder


## The plant's unscaled bounds, from its meshes (all imported at the model's origin).
func _bounds_of(plant: Node3D) -> AABB:
	var bounds := AABB()
	for mesh in plant.find_children("*", "MeshInstance3D", true, false):
		bounds = bounds.merge((mesh as MeshInstance3D).mesh.get_aabb())
	return bounds


func _material(colour: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	material.roughness = 1.0
	return material
