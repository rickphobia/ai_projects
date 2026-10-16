export interface ItemGestures {
  // A swipe to the left, or the right arrow key.
  onNext: () => void;
  // A swipe to the right, or the left arrow key.
  onPrevious: () => void;
  // How far a pull past the end has gone, from 0 to 1; 0 again when it is let go.
  onPull: (progress: number) => void;
  // A pull past the end that went all the way.
  onPulledPastEnd: () => void;
}

// How far, in CSS pixels, the finger has to travel once the page can't scroll any further.
const PULL_DISTANCE = 90;
// The same for a mouse wheel or trackpad, whose steps are larger and come in bursts.
const WHEEL_DISTANCE = 400;
// A wheel that reaches the end still has momentum; only scrolling after this pause counts.
const WHEEL_SETTLE_MS = 400;
const WHEEL_IDLE_MS = 800;
const SWIPE_DISTANCE = 70;
// Swipes starting this close to the screen's side are the phone's own back gesture.
const EDGE = 24;

// Swipes and arrow keys move between Items, and scrolling on past the end of the page finishes
// it. The listeners are on the window, so they stop once `view` leaves the page.
export function followItemGestures(
  view: HTMLElement,
  gestures: ItemGestures,
): void {
  let touch: { x: number; y: number; pullFromY: number | null } | null = null;
  let pull = 0;
  let wheelPull = 0;
  let endReachedAt: number | null = null;
  let wheelIdle: number | undefined;

  const setPull = (distance: number, full: number): void => {
    pull = Math.max(0, distance);
    gestures.onPull(Math.min(1, pull / full));
  };
  const stopped = (): boolean => {
    if (view.isConnected) return false;
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
    return true;
  };

  const onTouchStart = (event: TouchEvent): void => {
    const first = event.touches[0];
    if (stopped() || event.touches.length > 1 || first === undefined) {
      touch = null;
      return;
    }
    touch = {
      x: first.clientX,
      y: first.clientY,
      pullFromY: atEnd() ? first.clientY : null,
    };
  };
  const onTouchMove = (event: TouchEvent): void => {
    const first = event.touches[0];
    if (stopped() || touch === null || first === undefined) return;
    // A page that reaches its end mid-swipe starts the pull from there.
    if (touch.pullFromY === null && atEnd()) touch.pullFromY = first.clientY;
    if (touch.pullFromY !== null) {
      setPull(touch.pullFromY - first.clientY, PULL_DISTANCE);
    }
  };
  const onTouchEnd = (event: TouchEvent): void => {
    const last = event.changedTouches[0];
    const started = touch;
    touch = null;
    if (stopped() || started === null || last === undefined) return;
    const pulled = pull >= PULL_DISTANCE;
    setPull(0, PULL_DISTANCE);
    const dx = last.clientX - started.x;
    const dy = last.clientY - started.y;
    const fromEdge = started.x < EDGE || started.x > window.innerWidth - EDGE;
    if (
      Math.abs(dx) >= SWIPE_DISTANCE &&
      Math.abs(dx) > 2 * Math.abs(dy) &&
      !fromEdge &&
      !selecting()
    ) {
      if (dx < 0) gestures.onNext();
      else gestures.onPrevious();
    } else if (pulled) {
      gestures.onPulledPastEnd();
    }
  };
  const onWheel = (event: WheelEvent): void => {
    if (stopped()) return;
    window.clearTimeout(wheelIdle);
    wheelIdle = window.setTimeout(() => {
      wheelPull = 0;
      setPull(0, WHEEL_DISTANCE);
    }, WHEEL_IDLE_MS);
    if (event.deltaY <= 0 || !atEnd()) {
      endReachedAt = null;
      wheelPull = 0;
      setPull(0, WHEEL_DISTANCE);
      return;
    }
    endReachedAt ??= performance.now();
    if (performance.now() - endReachedAt < WHEEL_SETTLE_MS) return;
    wheelPull += event.deltaY;
    setPull(wheelPull, WHEEL_DISTANCE);
    if (wheelPull >= WHEEL_DISTANCE) {
      wheelPull = 0;
      endReachedAt = null;
      setPull(0, WHEEL_DISTANCE);
      gestures.onPulledPastEnd();
    }
  };
  const onKey = (event: KeyboardEvent): void => {
    if (stopped()) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (typing(event.target)) return;
    if (event.key === "ArrowRight") gestures.onNext();
    else if (event.key === "ArrowLeft") gestures.onPrevious();
  };

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("keydown", onKey);
}

function atEnd(): boolean {
  const page = document.documentElement;
  return window.innerHeight + window.scrollY >= page.scrollHeight - 4;
}

function selecting(): boolean {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed;
}

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
