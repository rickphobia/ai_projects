class_name FenceLook
extends RefCounted
## Builds the plank fence around the plots, from the CC0 fence model in assets/ (credits in
## assets/CREDITS.md): one model per run of about two metres, leaving no gaps at the corners
## except one gate on the left side, where the Worker goes out to the Generator.

## Weathered, unpainted planks instead of the model's warm wood.
const FENCE_COLOUR := Color(0.33, 0.3, 0.26)
const FENCE_MODEL := preload("res://assets/kenney-nature-kit/fence_planks.glb")
## The fence model is one metre long; scaled up so it reaches a person's waist.
const FENCE_SCALE := 2.0
## How far back from its origin the fence model's planks sit, in model units.
const FENCE_BACK_EDGE := 0.465


## A new fence along `bounds`, on the ground plane (x across, y front to back as the ground's
## z). The left side leaves out the section that covers `gate_z`.
static func build(bounds: Rect2, gate_z: float) -> Node3D:
	var fence := Node3D.new()
	fence.name = "Fence"
	var centre := bounds.get_center()
	fence.position = Vector3(centre.x, 0.0, centre.y)
	var half_size := bounds.size / 2.0
	var gate_offset := gate_z - centre.y
	var planks := StandardMaterial3D.new()
	planks.albedo_color = FENCE_COLOUR
	planks.roughness = 1.0
	for side in [Vector2(0, -1), Vector2(0, 1), Vector2(-1, 0), Vector2(1, 0)] as Array[Vector2]:
		var along_x := side.y != 0.0
		var half_length := half_size.x if along_x else half_size.y
		var pieces := ceili(half_length * 2.0 / FENCE_SCALE)
		var piece_length := half_length * 2.0 / pieces
		for piece in pieces:
			var offset := -half_length + (piece + 0.5) * piece_length
			if side.x < 0.0 and absf(offset - gate_offset) < piece_length / 2.0:
				continue
			var section := FENCE_MODEL.instantiate() as Node3D
			for mesh in section.find_children("*", "MeshInstance3D", true, false):
				(mesh as MeshInstance3D).material_override = planks
			section.scale = Vector3(piece_length, FENCE_SCALE, FENCE_SCALE)
			if along_x:
				section.position = Vector3(offset, 0.0, side.y * half_size.y)
			else:
				section.position = Vector3(side.x * half_size.x, 0.0, offset)
				section.rotation.y = PI / 2.0
			# The model's planks run along its back edge; move them onto the fence line.
			section.translate_object_local(Vector3(0.0, 0.0, FENCE_BACK_EDGE))
			fence.add_child(section)
	return fence
