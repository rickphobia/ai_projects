class_name WeighingScale
extends Node3D
## The weighing scale by the gate, built from simple shapes: a platform the cotton is weighed
## on, a post and a beam with its weight. It always stands there; the Overseer goes to stand
## beside it, watching, when a Harmony Audit is coming (see Field.show_audit_tell).

const METAL_COLOUR := Color(0.38, 0.4, 0.42)
const PLATFORM_COLOUR := Color(0.3, 0.3, 0.3)
const PLATFORM_SIZE := Vector3(0.9, 0.12, 0.9)
const POST_HEIGHT := 1.2
## The beam runs across the platform's back, its weight hung at one end.
const BEAM_LENGTH := 0.8


func _ready() -> void:
	var metal := _material(METAL_COLOUR)
	_add_box(
		"Platform",
		PLATFORM_SIZE,
		Vector3(0.0, PLATFORM_SIZE.y / 2.0, 0.0),
		_material(PLATFORM_COLOUR)
	)
	var back := -PLATFORM_SIZE.z / 2.0
	_add_box("Post", Vector3(0.08, POST_HEIGHT, 0.08), Vector3(0.0, POST_HEIGHT / 2.0, back), metal)
	_add_box("Beam", Vector3(BEAM_LENGTH, 0.05, 0.05), Vector3(0.0, POST_HEIGHT, back), metal)
	var weight_spot := Vector3(BEAM_LENGTH / 2.0, POST_HEIGHT - 0.15, back)
	_add_box("Weight", Vector3(0.12, 0.18, 0.12), weight_spot, metal)


func _add_box(part: String, size: Vector3, centre: Vector3, material: StandardMaterial3D) -> void:
	var box := BoxMesh.new()
	box.size = size
	box.material = material
	var instance := MeshInstance3D.new()
	instance.name = part
	instance.mesh = box
	instance.position = centre
	add_child(instance)


func _material(colour: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	material.roughness = 1.0
	return material
