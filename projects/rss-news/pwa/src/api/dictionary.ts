// Dictionary look-ups as the PWA sees them (POST api/dictionary).

// The longest term and context the server takes; longer selections belong in Ask AI.
export const LONGEST_TERM = 100;
export const LONGEST_CONTEXT = 1000;

export interface Definition {
  term: string;
  definition: string;
  // USD as text, to the hundredth of a cent: "0.0001".
  costUsd: string;
}

export interface DefinitionJson {
  term: string;
  definition: string;
  cost_usd: string;
}

export function definitionFromJson(body: DefinitionJson): Definition {
  return {
    term: body.term,
    definition: body.definition,
    costUsd: body.cost_usd,
  };
}
