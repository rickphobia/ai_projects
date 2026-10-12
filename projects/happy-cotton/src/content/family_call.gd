class_name FamilyCall
extends RefCounted
## One call home: the Children's lines in the order they say them, and the ids of the sources
## behind any factual claim in them (empty for a call that only tells their own experience).


## One line of a call: which Child says it (a key of FamilyText.CHILDREN) and the words.
class Line:
	extends RefCounted
	var child: StringName
	var text: String

	func _init(line_child: StringName, line_text: String) -> void:
		child = line_child
		text = line_text


var lines: Array[Line]
var source_ids: Array[String]


func _init(call_lines: Array[Line], call_source_ids: Array[String] = []) -> void:
	lines = call_lines
	source_ids = call_source_ids
