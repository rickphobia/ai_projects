class_name FamilyLetter
extends RefCounted
## One letter from the Worker's Children: which Child wrote it (a key of FamilyText.CHILDREN),
## its words, and the ids of the sources behind any factual claim in it (empty for a letter
## that only tells the Child's own experience).

var child: StringName
var text: String
var source_ids: Array[String]


func _init(
	letter_child: StringName, letter_text: String, letter_source_ids: Array[String] = []
) -> void:
	child = letter_child
	text = letter_text
	source_ids = letter_source_ids
