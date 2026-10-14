class_name Confetti
extends CPUParticles2D
## The App's confetti: one burst of bright pieces falling from the top of the screen, for a met
## Quota or a purchase. Emitting starts off; restart() sets it falling.


func _init() -> void:
	emitting = false
	one_shot = true
	explosiveness = 0.8
	amount = 160
	lifetime = 3.0
	emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	direction = Vector2.DOWN
	spread = 30.0
	gravity = Vector2(0, 300)
	initial_velocity_min = 100.0
	initial_velocity_max = 300.0
	angular_velocity_min = -360.0
	angular_velocity_max = 360.0
	scale_amount_min = 6.0
	scale_amount_max = 10.0
	# Each piece picks a random point on this ramp; constant steps keep the colours pure.
	var colours := Gradient.new()
	colours.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CONSTANT
	var offsets := PackedFloat32Array()
	for index in AppLook.CONFETTI_COLOURS.size():
		offsets.append(float(index) / AppLook.CONFETTI_COLOURS.size())
	colours.offsets = offsets
	colours.colors = PackedColorArray(AppLook.CONFETTI_COLOURS)
	color_initial_ramp = colours
