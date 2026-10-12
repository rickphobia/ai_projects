// How an Item's time is shown, in the owner's locale, on every screen.
export const shownTime = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
