// Notes as the PWA sees them (api/notes), and how the backend's JSON becomes them.

// The longest comment and origin title the server takes.
export const LONGEST_COMMENT = 2000;
export const LONGEST_ORIGIN = 300;

export type NoteSourceKind = "briefing" | "item" | "chat";

// Where a selection was made: the Note's link back.
export interface NoteLink {
  kind: NoteSourceKind;
  id: number;
}

export interface NoteSource extends NoteLink {
  // Where it was selected, such as "Item: Ringgit rises (Reuters)".
  title: string;
  // False once the Briefing, Item or Chat is deleted, such as an Item cleared out with age.
  exists: boolean;
}

export interface Note {
  id: number;
  // ISO 8601 with a time zone.
  createdAt: string;
  text: string;
  // Empty when the owner added none.
  comment: string;
  source: NoteSource;
}

export interface NewNote {
  text: string;
  comment: string;
  source: NoteLink & { title: string };
}

export interface NoteJson {
  id: number;
  created_at: string;
  text: string;
  comment: string;
  source: NoteSource;
}

export function noteFromJson(body: NoteJson): Note {
  return {
    id: body.id,
    createdAt: body.created_at,
    text: body.text,
    comment: body.comment,
    source: body.source,
  };
}
