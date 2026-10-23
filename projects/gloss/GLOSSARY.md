# Gloss

An Android app that explains English words and sentences highlighted in a book in Legado, using what the book has said so far, without leaving the page.

## Language

**Selection**:
The text the owner highlights in the reader and sends to Gloss from the text-selection menu, with Define, Explain or Note.
_Avoid_: Highlight, query

**Define**:
Asking for the meaning of a word or short phrase as it is used in its sentence, in this book at this point.
_Avoid_: Dictionary, look up, translate

**Explain**:
Asking what a sentence or passage means, with follow-up questions.
_Avoid_: Ask AI, chat, summarise

**Popup**:
The card Gloss shows at the bottom of the screen over the reader with the answer to a Define or an Explain.
_Avoid_: Dialog, overlay, window

**Book context**:
What Gloss knows about where a Selection came from: the book, its author, the chapter, and the chapter's text up to and around the Selection. There is Book context only when the Selection is found in the chapter being read; otherwise the Lookup has none.
_Avoid_: Context (alone), metadata

**Spoiler line**:
The owner's current place in the book. Answers use nothing from beyond it.
_Avoid_: Progress, position

**Lookup**:
One Define or Explain, with its answer and any follow-ups.
_Avoid_: Query, request, entry

**Note**:
The owner's own words about a Selection, written without the AI, kept with its Book context; it can stand alone or be attached to a Lookup.
_Avoid_: Annotation, comment, thought, bookmark

**Book page**:
Everything Gloss holds for one book: its Notes and Lookups in reading order, by chapter.
_Avoid_: History, notebook, log

**Spending limit**:
The most Gloss may spend on the AI in a calendar month; once reached, it stops calling the AI until the next month.
_Avoid_: Budget, quota, cap
