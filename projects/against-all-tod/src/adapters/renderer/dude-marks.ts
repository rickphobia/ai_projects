import { Graphics } from "pixi.js";
import { ATTACK_COLOUR, BLOOM_COLOUR, OUTLINE_COLOUR } from "./board-view";
import { LEG_WIDTH, blob } from "./dude-parts";

/** Where a kind's mouth is in its frame: the middle of the gold grin and how wide it is. */
export interface Mouth {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** A row of gold teeth, alone in the frame, laid over the face. */
export function goldGrin({ x, y, width }: Mouth): Graphics {
  const shape = new Graphics()
    .roundRect(x - width / 2, y - 1.5, width, 3, 1.5)
    .fill(BLOOM_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 1 });
  for (let tooth = 1; tooth < Math.round(width / 2.5); tooth++) {
    const toothX = x - width / 2 + (tooth * width) / Math.round(width / 2.5);
    shape.moveTo(toothX, y - 1.5).lineTo(toothX, y + 1.5);
  }
  return shape.stroke({ color: OUTLINE_COLOUR, width: 0.6 });
}

/** A curly fuse sticking up from the top of the frame, its tip burning. */
export function fuse(): Graphics {
  return new Graphics()
    .moveTo(24, 12)
    .quadraticCurveTo(20, 6, 25, 3)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" })
    .circle(25, 3, 2.5)
    .fill(BLOOM_COLOUR)
    .stroke({ color: ATTACK_COLOUR, width: 1 });
}

/** Two arms reaching forward, out to the shoulders of the Dude ahead in the line. */
export function congaHands(): Graphics {
  const shape = new Graphics();
  for (const y of [22, 30]) {
    shape.moveTo(34, y + 2).lineTo(42, y);
  }
  shape.stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" });
  for (const y of [22, 30]) blob(shape, 43, y, 2.5, 2.5);
  return shape;
}
