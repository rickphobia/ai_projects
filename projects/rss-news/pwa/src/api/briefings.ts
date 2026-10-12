// Briefings as the PWA sees them, and how the backend's JSON becomes them.

import type { Folder } from "./client";

// An Item a point came from; it opens in the Item view.
export interface BriefingItemLink {
  id: number;
  title: string;
  source: string;
}

export interface BriefingPoint {
  text: string;
  items: BriefingItemLink[];
}

export interface BriefingSection {
  folder: Folder;
  points: BriefingPoint[];
}

export interface Briefing {
  id: number;
  // Such as "all-24h".
  scope: string;
  // ISO 8601 with a time zone.
  createdAt: string;
  itemCount: number;
  // USD to the cent, as text so it isn't rounded again: "0.21".
  costUsd: string;
  sections: BriefingSection[];
}

export interface BriefingEstimate {
  // 0 when nothing arrived in the window; there is nothing to brief then.
  itemCount: number;
  sectionCount: number;
  estimatedCostUsd: string;
}

export interface BriefingProgress {
  // Reading the top articles, then the model writing the section.
  step: "reading" | "writing";
  // 1-based, of `sections`.
  section: number;
  sections: number;
  folder: string;
}

export interface WrittenBriefing {
  briefing: Briefing;
  // True when today's saved Briefing was given back instead of writing a new one.
  reused: boolean;
}

export interface BriefingJson {
  id: number;
  scope: string;
  created_at: string;
  item_count: number;
  cost_usd: string;
  sections: BriefingSection[];
}

export interface EstimateJson {
  item_count: number;
  section_count: number;
  estimated_cost_usd: string;
}

export function briefingFromJson(briefing: BriefingJson): Briefing {
  return {
    id: briefing.id,
    scope: briefing.scope,
    createdAt: briefing.created_at,
    itemCount: briefing.item_count,
    costUsd: briefing.cost_usd,
    sections: briefing.sections,
  };
}

export function estimateFromJson(estimate: EstimateJson): BriefingEstimate {
  return {
    itemCount: estimate.item_count,
    sectionCount: estimate.section_count,
    estimatedCostUsd: estimate.estimated_cost_usd,
  };
}
