import type { MutationId } from "../catalog/mutations";

// Inline SVG in a 24×24 viewBox, in the same cartoon outline as the trick icons, so a crate card
// has a picture for the items that have no portrait of their own.
const OUTLINE = `stroke="#2a2118" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;

export const MUTATION_MARKS: Readonly<Record<MutationId, string>> = {
  split: `<path d="M11 3a8 9 0 0 0 0 18z" fill="#7cc46a" ${OUTLINE}/><path d="M13 3a8 9 0 0 1 0 18z" fill="#7cc46a" ${OUTLINE}/><path d="M12 2v20" fill="none" stroke="#e8483f" stroke-width="1.6" stroke-dasharray="2 2"/>`,
  giant: `<circle cx="12" cy="13" r="9" fill="#c98b4e" ${OUTLINE}/><path d="M8 7l4-5 4 5" fill="none" ${OUTLINE}/><circle cx="9" cy="12" r="1.2" fill="#2a2118"/><circle cx="15" cy="12" r="1.2" fill="#2a2118"/>`,
  "explosive-shields": `<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" fill="#8fd3ff" ${OUTLINE}/><path d="M12 8l1.2 3 3-.6-2 2.3 1.6 2.8-3-1-1 2.8-.9-2.8-3 1 1.6-2.8-2-2.3 3 .6z" fill="#ffd23f" ${OUTLINE}/>`,
  "conga-line": `<circle cx="5" cy="14" r="3" fill="#ffd23f" ${OUTLINE}/><circle cx="12" cy="12" r="3" fill="#ffd23f" ${OUTLINE}/><circle cx="19" cy="10" r="3" fill="#ffd23f" ${OUTLINE}/><path d="M7.5 12.5l2-.8M14.5 10.5l2-.8" fill="none" ${OUTLINE}/>`,
  "ghost-mode": `<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-2-2.3 2-2.4-2-2.4 2-2.3-2z" fill="#fffaf0" ${OUTLINE}/><circle cx="9.5" cy="11" r="1.3" fill="#2a2118"/><circle cx="14.5" cy="11" r="1.3" fill="#2a2118"/>`,
  "gold-teeth": `<path d="M3 9c3-3 15-3 18 0-1 7-5 11-9 11S4 16 3 9z" fill="#e8483f" ${OUTLINE}/><path d="M6 10h12v3H6z" fill="#ffd23f" ${OUTLINE}/><path d="M9 10v3M12 10v3M15 10v3" fill="none" ${OUTLINE}/>`,
};

export const FREE_UNDO_MARK = `<circle cx="12" cy="12" r="9.5" fill="#8fd3ff" ${OUTLINE}/><path d="M8 9h6a4 4 0 0 1 0 8h-4" fill="none" ${OUTLINE}/><path d="M10.5 6L7.5 9l3 3" fill="none" ${OUTLINE}/>`;
