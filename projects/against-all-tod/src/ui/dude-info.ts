import type { DudeKindEntry, WallBreakerStats } from "../catalog/dudes";

export interface DudeInfoStat {
  readonly label: string;
  readonly value: string;
}

/** What the ⓘ panel shows for one Dude kind. */
export interface DudeInfoContent {
  readonly name: string;
  readonly price: string;
  readonly description: string;
  readonly stats: readonly DudeInfoStat[];
}

/**
 * Everything comes from the catalogue entry, so a balance change shows up here unaided.
 * `price` is the shop's, which a Curse or trick may have moved off the catalogue's.
 */
export function dudeInfoContent(
  entry: DudeKindEntry,
  price: number,
): DudeInfoContent {
  const stats: DudeInfoStat[] = [
    { label: "Health", value: String(entry.health) },
    { label: "Speed", value: `${String(entry.speed)} tiles/s` },
    { label: "Goal damage", value: String(entry.goalDamage) },
  ];
  if (entry.flies) stats.push({ label: "Flies", value: "over the Maze" });
  if (entry.shield !== null) {
    stats.push({
      label: "Shield",
      value: `${String(entry.shield.health)} health`,
    });
  }
  if (entry.hypeAura !== null) {
    stats.push({
      label: "Hype aura",
      value: `+${String(Math.round(entry.hypeAura.speedBoost * 100))}% speed, ${String(entry.hypeAura.range)} tiles`,
    });
  }
  if (entry.tunnelTiles > 0) {
    stats.push({
      label: "Tunnels",
      value: `${String(entry.tunnelTiles)} tiles, once`,
    });
  }
  if (entry.drawsFire) stats.push({ label: "Draws fire", value: "yes" });
  if (entry.wallBreaker !== null) {
    stats.push({
      label: "Breaks walls",
      value: wallBreakerText(entry.wallBreaker),
    });
  }
  return {
    name: entry.name,
    price: `${String(price)}g each`,
    description: entry.description,
    stats,
  };
}

function wallBreakerText(breaker: WallBreakerStats): string {
  switch (breaker.attack) {
    case "chew":
      return `chews ${String(breaker.damagePerSecond)}/s`;
    case "ram":
      return `rams every ${String(breaker.cooldownSeconds)}s`;
    case "blast":
      return "blows up with the wall";
  }
}

/** The card a Unit bar ⓘ opens. Closes on ✕, a tap outside it, or Escape. */
export class DudeInfo {
  private readonly host: HTMLElement;
  private readonly portrait: HTMLImageElement;
  private readonly name: HTMLElement;
  private readonly price: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly description: HTMLElement;

  constructor(doc: Document) {
    this.host = doc.createElement("aside");
    this.host.id = "dude-info";
    this.host.className = "card";
    this.host.setAttribute("role", "dialog");
    this.host.hidden = true;
    this.name = doc.createElement("h2");
    this.name.className = "ribbon";
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "btn dude-info-close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      this.hide();
    });
    this.portrait = doc.createElement("img");
    this.portrait.className = "dude-info-portrait";
    this.portrait.alt = "";
    this.price = doc.createElement("p");
    this.price.className = "dude-info-price";
    this.stats = doc.createElement("dl");
    this.stats.className = "dude-info-stats";
    this.description = doc.createElement("p");
    this.host.append(
      this.name,
      close,
      this.portrait,
      this.price,
      this.stats,
      this.description,
    );
    doc.body.append(this.host);
    // Capture phase, so the tap that opens it (on ⓘ, outside the card) has already passed.
    doc.addEventListener(
      "pointerdown",
      (event) => {
        if (this.host.hidden) return;
        if (event.target instanceof Node && this.host.contains(event.target))
          return;
        this.hide();
      },
      true,
    );
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.hide();
    });
  }

  show(content: DudeInfoContent, portraitSrc: string): void {
    const doc = this.host.ownerDocument;
    this.name.textContent = content.name;
    this.host.setAttribute("aria-label", content.name);
    this.portrait.src = portraitSrc;
    this.price.textContent = content.price;
    this.stats.replaceChildren(
      ...content.stats.flatMap(({ label, value }) => {
        const term = doc.createElement("dt");
        term.textContent = label;
        const detail = doc.createElement("dd");
        detail.textContent = value;
        return [term, detail];
      }),
    );
    this.description.textContent = content.description;
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
