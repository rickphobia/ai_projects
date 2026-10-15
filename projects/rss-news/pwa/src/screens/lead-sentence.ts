// A sentence end: . ! or ?, any closing quotes or brackets, then a space and a capital or digit.
const SENTENCE_END = /[.!?]["'”’)]*(?=\s+["“‘(]?[A-Z0-9])/g;

// Words that end in a full stop without ending the sentence, as in "Dr. Tan" or "Maybank Bhd. Group".
const ABBREVIATIONS = new Set([
  "bhd",
  "co",
  "corp",
  "dr",
  "inc",
  "jr",
  "ltd",
  "mr",
  "mrs",
  "ms",
  "no",
  "prof",
  "sdn",
  "sr",
  "st",
  "vs",
]);

export interface LeadSentence {
  lead: string;
  rest: string;
}

// Splits a Briefing point's first sentence from the rest, so it can stand as the point's
// headline. Null when the text is a single sentence. A best guess: an unusual abbreviation can
// end the lead early, which only shortens the bold part.
export function splitLeadSentence(text: string): LeadSentence | null {
  for (const end of text.matchAll(SENTENCE_END)) {
    if (end[0].startsWith(".") && isAbbreviation(text.slice(0, end.index))) {
      continue;
    }
    const cut = end.index + end[0].length;
    return { lead: text.slice(0, cut), rest: text.slice(cut).trimStart() };
  }
  return null;
}

// Whether the word just before a full stop is an initial ("J"), dotted ("U.S") or a known
// abbreviation.
function isAbbreviation(before: string): boolean {
  const word = before.slice(before.search(/\S+$/));
  return (
    /^[A-Za-z]$/.test(word) ||
    word.includes(".") ||
    ABBREVIATIONS.has(word.toLowerCase())
  );
}
