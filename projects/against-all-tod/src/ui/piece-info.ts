import type { PieceEntry } from "../catalog/pieces";

/** The small panel naming a Piece and what it does. Shown by hover or tap, never hover alone. */
export class PieceInfo {
  private readonly name: HTMLElement;
  private readonly description: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    const doc = host.ownerDocument;
    this.name = doc.createElement("h2");
    this.description = doc.createElement("p");
    host.replaceChildren(this.name, this.description);
    host.hidden = true;
  }

  show(piece: PieceEntry): void {
    this.name.textContent = piece.name;
    this.description.textContent = piece.description;
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
