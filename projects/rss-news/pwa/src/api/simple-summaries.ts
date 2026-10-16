// Simple summaries as the PWA sees them (POST api/items/{id}/simple-summary).

export interface SimpleSummary {
  // One sentence: what the Item is about.
  gist: string;
  points: string[];
  // True when the page couldn't be read, so only the feed's preview was summarised.
  fromPreview: boolean;
  // USD as text, to the hundredth of a cent: "0.0006".
  costUsd: string;
}

export interface SimpleSummaryJson {
  gist: string;
  points: string[];
  from_preview: boolean;
  cost_usd: string;
}

export function simpleSummaryFromJson(body: SimpleSummaryJson): SimpleSummary {
  return {
    gist: body.gist,
    points: body.points,
    fromPreview: body.from_preview,
    costUsd: body.cost_usd,
  };
}
