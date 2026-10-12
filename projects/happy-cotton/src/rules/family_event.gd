class_name FamilyEvent
extends RefCounted
## Something from the Worker's Family, as data: a kind (Farm.LETTER_ARRIVED and the like) and,
## for a letter, its id. Kept apart from AppMessage because App messages are the state's voice
## and these are the Children's. The rules never hold the letters' words; the Family text
## table turns an id into them.

var kind: StringName:
	get:
		return _kind
## The letter's id (one of Farm.LETTER_IDS), or &"" for an event about no one letter.
var id: StringName:
	get:
		return _id

var _kind: StringName
var _id: StringName


func _init(event_kind: StringName, event_id: StringName = &"") -> void:
	_kind = event_kind
	_id = event_id
