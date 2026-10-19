import type { Side } from "../battle/battle";
import type { BattleEvent } from "../battle/events";
import { PIECES, type PieceId } from "../catalog/pieces";
import {
  goldBreakdown,
  type BattleEnd,
  type GoldBreakdown,
} from "../economy/economy";
import { BOARD_COLUMNS, BOARD_ROWS } from "../maze/board";

/** Everything the Round report shows, built from one battle's events and how it ended. */
export interface RoundReport {
  readonly winner: Side;
  readonly goalDamage: number;
  /** Kills by each kind of Piece, most first. */
  readonly killsByPiece: readonly {
    readonly pieceId: PieceId;
    readonly kills: number;
  }[];
  /** Deaths per tile, `deaths[row][column]`. */
  readonly deaths: readonly (readonly number[])[];
  readonly gold: GoldBreakdown;
}

export function roundReport(
  events: readonly BattleEvent[],
  end: BattleEnd,
): RoundReport {
  let goalDamage = 0;
  const kills = new Map<PieceId, number>();
  const deaths = Array.from({ length: BOARD_ROWS }, () =>
    new Array<number>(BOARD_COLUMNS).fill(0),
  );
  for (const event of events) {
    if (event.type === "reach-goal") {
      goalDamage += event.damage;
    } else if (event.type === "kill") {
      kills.set(event.pieceId, (kills.get(event.pieceId) ?? 0) + 1);
      const row = clamp(Math.floor(event.at.y), BOARD_ROWS);
      const column = clamp(Math.floor(event.at.x), BOARD_COLUMNS);
      const cells = deaths[row];
      if (cells !== undefined) cells[column] = (cells[column] ?? 0) + 1;
    }
  }
  return {
    winner: end.winner,
    goalDamage,
    killsByPiece: [...kills]
      .map(([pieceId, count]) => ({ pieceId, kills: count }))
      .sort((a, b) => b.kills - a.kills),
    deaths,
    gold: goldBreakdown(events, end),
  };
}

/** A death exactly on the Board's far edge still lands in its last tile. */
function clamp(index: number, size: number): number {
  return Math.min(size - 1, Math.max(0, index));
}

/** The report's gold lines: label and amount, per wallet. */
export function goldLines(
  gold: GoldBreakdown,
): Record<Side, readonly [string, number][]> {
  return {
    defense: [
      ["Kills", gold.defense.kills],
      ["Goal health left", gold.defense.goalHealthLeft],
      ["Tax Booths", gold.defense.taxed],
    ],
    attack: [
      ["Dudes at the Goal", gold.attack.reachedGoal],
      ["Survivors", gold.attack.survivors],
      ["Pieces destroyed", gold.attack.piecesDestroyed],
      ["Tax Booths", -gold.attack.taxPaid],
    ],
  };
}

/** The Round report over the Board after every battle; one click or tap anywhere closes it. */
export class RoundReportPanel {
  constructor(private readonly host: HTMLElement) {
    host.hidden = true;
    host.addEventListener("click", () => {
      this.hide();
    });
  }

  show(report: RoundReport, won: boolean): void {
    const doc = this.host.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      text = "",
    ): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      node.textContent = text;
      return node;
    };

    const heading = el("h1", won ? "Round won" : "Round lost");
    const damage = el("p", `Goal damage: ${String(report.goalDamage)}`);

    const kills = el("ul");
    kills.className = "report-kills";
    if (report.killsByPiece.length === 0) kills.append(el("li", "No kills"));
    for (const { pieceId, kills: count } of report.killsByPiece) {
      kills.append(el("li", `${PIECES[pieceId].name}: ${String(count)}`));
    }

    const most = Math.max(1, ...report.deaths.flat());
    const map = el("div");
    map.className = "report-deaths";
    map.setAttribute("aria-label", "Where Dudes died");
    map.style.gridTemplateColumns = `repeat(${String(BOARD_COLUMNS)}, 1fr)`;
    map.style.aspectRatio = `${String(BOARD_COLUMNS)} / ${String(BOARD_ROWS)}`;
    for (const row of report.deaths) {
      for (const count of row) {
        const cell = el("span");
        cell.style.opacity = String(
          count === 0 ? 0.08 : 0.25 + (0.75 * count) / most,
        );
        map.append(cell);
      }
    }

    const lines = goldLines(report.gold);
    const gold = el("div");
    gold.className = "report-gold";
    for (const side of ["defense", "attack"] as const) {
      const list = el("dl");
      list.className = side;
      list.append(
        el("dt", side === "defense" ? "Defense gold" : "Attack gold"),
      );
      for (const [label, amount] of lines[side]) {
        list.append(el("dd", `${label}: ${String(amount)}`));
      }
      gold.append(list);
    }

    const close = el("button", "Close");
    close.type = "button";
    this.host.replaceChildren(
      heading,
      damage,
      el("h2", "Kills per Piece"),
      kills,
      el("h2", "Where Dudes died"),
      map,
      gold,
      close,
    );
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
