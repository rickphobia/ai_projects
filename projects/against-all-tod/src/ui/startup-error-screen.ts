/**
 * Shows why the game could not start, in plain DOM so it works even when PixiJS didn't.
 * Falls back to replacing the page body if index.html lacks the error box.
 */
export function showStartupError(doc: Document, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  const box = doc.getElementById("startup-error");
  const detail = doc.getElementById("startup-error-reason");
  if (box === null || detail === null) {
    doc.body.textContent = `Against All TOD could not start: ${reason}`;
    return;
  }
  detail.textContent = reason;
  box.hidden = false;
}
