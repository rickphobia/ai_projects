// The owner's stocks an Item mentions, as small tags in the Inbox row and the Item view.
export function stockTags(stocks: string[]): HTMLSpanElement | null {
  if (stocks.length === 0) return null;
  const tags = document.createElement("span");
  tags.className = "stock-tags";
  tags.setAttribute("aria-label", `Mentions ${stocks.join(", ")}`);
  tags.append(
    ...stocks.map((ticker) => {
      const tag = document.createElement("span");
      tag.className = "stock-tag";
      tag.textContent = ticker;
      return tag;
    }),
  );
  return tags;
}
